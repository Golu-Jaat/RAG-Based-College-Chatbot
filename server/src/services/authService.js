import crypto from "node:crypto";
import { env } from "../config/env.js";
import { readDb } from "../config/db.js";
import { parseCookies } from "../utils/http.js";

export function id(prefix) {
  return `${prefix}_${crypto.randomBytes(10).toString("hex")}`;
}

export function nowIso() {
  return new Date().toISOString();
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

export function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 }));
  const signature = crypto.createHmac("sha256", env.jwtSecret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token) {
  if (!token) return null;
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) return null;
  const expected = crypto.createHmac("sha256", env.jwtSecret).update(`${header}.${body}`).digest("base64url");
  if (signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, passwordHash) {
  const [salt, stored] = passwordHash.split(":");
  const calculated = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(stored), Buffer.from(calculated));
}

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

export async function getUserFromRequest(req) {
  const auth = req.headers.authorization || "";
  const cookieToken = parseCookies(req).token;
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : cookieToken;
  const payload = verifyToken(token);
  if (!payload) return null;
  const db = await readDb();
  return db.users.find((user) => user.id === payload.sub) || null;
}

