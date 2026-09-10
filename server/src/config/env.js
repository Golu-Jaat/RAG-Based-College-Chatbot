import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const ROOT_DIR = path.resolve(__dirname, "../../..");
const ENV_PATH = path.join(ROOT_DIR, ".env");

loadDotEnv(ENV_PATH);

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

export const env = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-before-production",
  mongodbDb: process.env.MONGODB_DB || "college_rag_chatbot",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  vectorSearchIndex: process.env.MONGODB_VECTOR_INDEX || "",
  pythonBin:
    process.env.PYTHON_BIN ||
    process.env.PYTHON ||
    (process.platform === "win32"
      ? "C:\\Users\\goluj\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe"
      : "python3"),
  adminName: process.env.ADMIN_NAME || "College Admin",
  adminEmail: (process.env.ADMIN_EMAIL || "admin@college.edu").toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || "Admin@12345",
  rootDir: ROOT_DIR,
  clientDir: path.join(ROOT_DIR, "client", "dist"),
  storageDir: process.env.VERCEL ? path.join("/tmp", "rag-college-chatbot-storage") : path.join(ROOT_DIR, "storage"),
  legacyDbPath: path.join(ROOT_DIR, "data", "db.json"),
  pdfExtractorScript: path.join(ROOT_DIR, "scripts", "extract_pdf.py")
};

env.mongodbUri = normalizeMongoUri(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017", env.mongodbDb);

export function redactMongoUri(uri = env.mongodbUri) {
  try {
    const parsed = new URL(uri);
    if (parsed.password) parsed.password = "***";
    if (parsed.username) parsed.username = parsed.username ? "***" : "";
    return parsed.toString();
  } catch {
    return uri.replace(/\/\/([^:@/]+):([^@/]+)@/, "//***:***@");
  }
}

export function mongoHostLabel(uri = env.mongodbUri) {
  try {
    const parsed = new URL(uri);
    return parsed.host || redactMongoUri(uri);
  } catch {
    return redactMongoUri(uri);
  }
}

function normalizeMongoUri(uri, dbName) {
  try {
    const parsed = new URL(uri);
    if ((!parsed.pathname || parsed.pathname === "/") && dbName) parsed.pathname = `/${dbName}`;
    if (parsed.protocol === "mongodb+srv:") {
      if (!parsed.searchParams.has("retryWrites")) parsed.searchParams.set("retryWrites", "true");
      if (!parsed.searchParams.has("w")) parsed.searchParams.set("w", "majority");
      if (!parsed.searchParams.has("authSource")) parsed.searchParams.set("authSource", "admin");
    }
    return parsed.toString();
  } catch {
    return uri;
  }
}
