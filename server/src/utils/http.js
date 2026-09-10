import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

export function jsonResponse(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    ...securityHeaders(),
    "content-type": "application/json; charset=utf-8",
    "content-length": data.length
  });
  res.end(data);
}

export function textResponse(res, status, text, contentType = "text/plain; charset=utf-8") {
  const data = Buffer.from(text);
  res.writeHead(status, { ...securityHeaders(), "content-type": contentType, "content-length": data.length });
  res.end(data);
}

export function securityHeaders() {
  return {
    "x-content-type-options": "nosniff",
    "referrer-policy": "same-origin",
    "x-frame-options": "DENY"
  };
}

export async function readBody(req, maxBytes = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Request body is too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req) {
  const body = await readBody(req);
  if (!body.length) return {};
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON payload."), { status: 400 });
  }
}

export function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((item) => item.trim().split("="))
      .filter(([key]) => key)
      .map(([key, value]) => [key, decodeURIComponent(value || "")])
  );
}

export function parseMultipart(buffer, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!match) throw Object.assign(new Error("Missing multipart boundary."), { status: 400 });
  const boundary = `--${match[1] || match[2]}`;
  const raw = buffer.toString("latin1");
  const parts = raw.split(boundary).slice(1, -1);
  const fields = {};
  const files = {};

  for (const part of parts) {
    const trimmed = part.replace(/^\r\n/, "");
    const splitIndex = trimmed.indexOf("\r\n\r\n");
    if (splitIndex === -1) continue;
    const header = trimmed.slice(0, splitIndex);
    let content = trimmed.slice(splitIndex + 4);
    content = content.replace(/\r\n$/, "");
    const name = /name="([^"]+)"/i.exec(header)?.[1];
    const filename = /filename="([^"]*)"/i.exec(header)?.[1];
    const mime = /content-type:\s*([^\r\n]+)/i.exec(header)?.[1]?.trim() || "application/octet-stream";
    if (!name) continue;
    if (filename) {
      files[name] = { filename: path.basename(filename), mime, buffer: Buffer.from(content, "latin1") };
    } else {
      fields[name] = Buffer.from(content, "latin1").toString("utf8").trim();
    }
  }
  return { fields, files };
}

export async function serveStatic(req, res) {
  const requested = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const safePath = requested === "/" ? "/index.html" : requested;
  const filePath = path.normalize(path.join(env.clientDir, safePath));
  if (!filePath.startsWith(env.clientDir)) return textResponse(res, 403, "Forbidden");
  try {
    const fileStats = await stat(filePath);
    if (fileStats.isDirectory()) return textResponse(res, 404, "Not found");
    const ext = path.extname(filePath);
    const contentType =
      {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".svg": "image/svg+xml"
      }[ext] || "application/octet-stream";
    res.writeHead(200, { ...securityHeaders(), "content-type": contentType });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(200, { ...securityHeaders(), "content-type": "text/html; charset=utf-8" });
    createReadStream(path.join(env.clientDir, "index.html")).pipe(res);
  }
}
