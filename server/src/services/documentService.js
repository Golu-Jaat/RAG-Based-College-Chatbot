import { existsSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { env } from "../config/env.js";
import { readDb, writeDb } from "../config/db.js";
import { chunkText, embed, generateFaqsFromChunks, summarizeText } from "./ragService.js";
import { id, nowIso } from "./authService.js";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const allowedExtensions = new Set([".pdf", ".txt", ".md", ".csv", ".json", ".html"]);
const allowedMimePrefixes = ["application/pdf", "text/", "application/json"];

export function sanitizeFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  const base = path.basename(filename, ext).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "") || "document";
  return `${base}-${Date.now()}${ext}`;
}

export function validateUpload(file) {
  if (!file) throw Object.assign(new Error("A document file is required."), { status: 400 });
  const ext = path.extname(file.filename).toLowerCase();
  if (!allowedExtensions.has(ext)) throw Object.assign(new Error("Unsupported file type."), { status: 400 });
  const mimeAllowed = allowedMimePrefixes.some((prefix) => file.mime.startsWith(prefix)) || file.mime === "application/octet-stream";
  if (!mimeAllowed) throw Object.assign(new Error("Unsupported content type."), { status: 400 });
  if (file.buffer.length > MAX_UPLOAD_BYTES) throw Object.assign(new Error("File exceeds the 10 MB upload limit."), { status: 413 });
}

export function uploadLimitBytes() {
  return MAX_UPLOAD_BYTES + 512_000;
}

async function extractPdf(filePath) {
  if (!existsSync(env.pdfExtractorScript)) {
    return [{ pageNumber: 1, text: "PDF extraction failed: extractor script is missing." }];
  }
  return new Promise((resolve) => {
    const child = spawn(env.pythonBin, [env.pdfExtractorScript, filePath], { windowsHide: true });
    let out = "";
    let err = "";
    child.stdout.on("data", (data) => {
      out += data.toString();
    });
    child.stderr.on("data", (data) => {
      err += data.toString();
    });
    child.on("close", () => {
      try {
        const payload = JSON.parse(out || "{}");
        if (payload.ok) resolve(payload.pages.map((page) => ({ ...page, ocrStatus: payload.ocrStatus || "not_needed" })));
        else resolve([{ pageNumber: 1, text: `PDF extraction failed: ${payload.error || err}`, ocrStatus: payload.ocrStatus || "failed" }]);
      } catch {
        resolve([{ pageNumber: 1, text: `PDF extraction failed: ${err || "Unknown parser error."}`, ocrStatus: "failed" }]);
      }
    });
  });
}

async function extractText(filePath, fileType) {
  if (fileType === "application/pdf" || path.extname(filePath).toLowerCase() === ".pdf") {
    return extractPdf(filePath);
  }
  const buffer = await readFile(filePath);
  return [{ pageNumber: 1, text: buffer.toString("utf8") }];
}

export async function processDocument(documentId) {
  const db = await readDb();
  const document = db.documents.find((item) => item.id === documentId);
  if (!document) throw Object.assign(new Error("Document not found."), { status: 404 });
  document.processingStatus = "processing";
  document.updatedAt = nowIso();
  await writeDb(db);

  try {
    const pages = await extractText(path.join(env.rootDir || path.resolve(env.storageDir, ".."), document.fileUrl), document.fileType);
    const chunks = chunkText(pages);
    const filteredChunks = chunks.filter((chunk) => !chunk.text.startsWith("PDF extraction failed"));
    db.chunks = db.chunks.filter((chunk) => chunk.documentId !== documentId);
    db.chunks.push(
      ...filteredChunks.map((chunk, index) => ({
        id: id("chunk"),
        documentId,
        chunkText: chunk.text,
        chunkIndex: index,
        pageNumber: chunk.pageNumber,
        embedding: embed(chunk.text),
        metadata: { title: document.title, category: document.category, department: document.department },
        createdAt: nowIso()
      }))
    );
    document.processingStatus = filteredChunks.length ? "completed" : "failed";
    document.processingError = filteredChunks.length ? "" : "No extractable text was found.";
    document.chunkCount = filteredChunks.length;
    document.summary = filteredChunks.length ? summarizeText(filteredChunks.map((chunk) => chunk.text).join(" "), 3) : "";
    document.faqs = generateFaqsFromChunks(filteredChunks, 6);
    document.ocrStatus = getOcrStatus(pages, filteredChunks);
    document.updatedAt = nowIso();
    await writeDb(db);
    return document;
  } catch (error) {
    document.processingStatus = "failed";
    document.processingError = error.message;
    document.updatedAt = nowIso();
    await writeDb(db);
    return document;
  }
}

function getOcrStatus(pages, chunks) {
  if (!pages.some((page) => page.ocrStatus)) return "not_needed";
  if (chunks.length) return "text_extracted";
  return "ocr_not_configured";
}

export async function deleteDocumentFile(document) {
  try {
    await unlink(path.join(env.storageDir, path.basename(document.fileUrl)));
  } catch {
    // File may already be gone; metadata cleanup still succeeded.
  }
}
