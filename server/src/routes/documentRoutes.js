import path from "node:path";
import { writeFile } from "node:fs/promises";
import { env } from "../config/env.js";
import { readDb, writeDb } from "../config/db.js";
import { deleteDocumentFile, processDocument, sanitizeFilename, uploadLimitBytes, validateUpload } from "../services/documentService.js";
import { id, nowIso } from "../services/authService.js";
import { requireAdmin, requireAuth } from "../middleware/guards.js";
import { checkRateLimit, uploadRateLimit } from "../middleware/rateLimit.js";
import { jsonResponse, parseMultipart, readBody, readJson } from "../utils/http.js";

export async function handleDocumentRoutes(req, res, route, user) {
  if (route === "/api/documents" && req.method === "GET") {
    if (!requireAuth(user, res)) return true;
    const db = await readDb();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const collection = url.searchParams.get("collection");
    const department = url.searchParams.get("department");
    const category = url.searchParams.get("category");
    const documents = db.documents.filter((document) => {
      if (collection && collection !== "All" && document.collection !== collection) return false;
      if (department && department !== "All" && document.department !== department) return false;
      if (category && category !== "All" && document.category !== category) return false;
      return true;
    });
    jsonResponse(res, 200, {
      documents: documents
        .map((document) => ({ ...document, chunkCount: db.chunks.filter((chunk) => chunk.documentId === document.id).length }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    });
    return true;
  }

  if (route === "/api/documents/upload" && req.method === "POST") {
    if (!requireAdmin(user, res)) return true;
    if (!checkRateLimit(user.id, uploadRateLimit)) {
      jsonResponse(res, 429, { error: "Upload rate limit exceeded." });
      return true;
    }
    const body = await readBody(req, uploadLimitBytes());
    const { fields, files } = parseMultipart(body, req.headers["content-type"]);
    const file = files.file;
    validateUpload(file);
    const filename = sanitizeFilename(file.filename);
    const storedPath = path.join(env.storageDir, filename);
    await writeFile(storedPath, file.buffer);
    const db = await readDb();
    const collection = fields.collection || "General Knowledge Base";
    const department = fields.department || "All";
    const title = fields.title || path.basename(file.filename);
    const version =
      db.documents
        .filter((item) => item.title === title && item.collection === collection && item.department === department)
        .reduce((max, item) => Math.max(max, Number(item.version || 1)), 0) + 1;
    const document = {
      id: id("doc"),
      title,
      description: fields.description || "",
      collection,
      category: fields.category || "General",
      department,
      version,
      fileUrl: path.relative(env.rootDir, storedPath).replace(/\\/g, "/"),
      originalFilename: file.filename,
      fileType: file.mime,
      uploadedBy: user.id,
      processingStatus: "pending",
      processingError: "",
      summary: "",
      faqs: [],
      ocrStatus: "pending",
      chunkCount: 0,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    db.documents.push(document);
    await writeDb(db);
    const processed = await processDocument(document.id);
    jsonResponse(res, 201, { document: processed });
    return true;
  }

  const detailMatch = route.match(/^\/api\/documents\/([^/]+)$/);
  if (detailMatch && (req.method === "PATCH" || req.method === "PUT")) {
    if (!requireAdmin(user, res)) return true;
    const updates = await readJson(req);
    const db = await readDb();
    const document = db.documents.find((item) => item.id === detailMatch[1]);
    if (!document) {
      jsonResponse(res, 404, { error: "Document not found." });
      return true;
    }
    for (const field of ["title", "description", "collection", "category", "department"]) {
      if (typeof updates[field] === "string" && updates[field].trim()) document[field] = updates[field].trim();
    }
    document.updatedAt = nowIso();
    await writeDb(db);
    jsonResponse(res, 200, { document });
    return true;
  }

  if (detailMatch && req.method === "GET") {
    if (!requireAuth(user, res)) return true;
    const db = await readDb();
    const document = db.documents.find((item) => item.id === detailMatch[1]);
    if (!document) {
      jsonResponse(res, 404, { error: "Document not found." });
      return true;
    }
    jsonResponse(res, 200, { document, chunks: db.chunks.filter((chunk) => chunk.documentId === document.id) });
    return true;
  }

  if (detailMatch && req.method === "DELETE") {
    if (!requireAdmin(user, res)) return true;
    const db = await readDb();
    const document = db.documents.find((item) => item.id === detailMatch[1]);
    if (!document) {
      jsonResponse(res, 404, { error: "Document not found." });
      return true;
    }
    db.documents = db.documents.filter((item) => item.id !== document.id);
    db.chunks = db.chunks.filter((chunk) => chunk.documentId !== document.id);
    await writeDb(db);
    await deleteDocumentFile(document);
    jsonResponse(res, 200, { ok: true });
    return true;
  }

  const processMatch = route.match(/^\/api\/documents\/([^/]+)\/process$/);
  if (processMatch && req.method === "POST") {
    if (!requireAdmin(user, res)) return true;
    const document = await processDocument(processMatch[1]);
    jsonResponse(res, 200, { document });
    return true;
  }

  return false;
}
