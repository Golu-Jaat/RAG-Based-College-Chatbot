import { readDb, writeDb } from "../config/db.js";
import { getUserFromRequest, hashPassword, id, nowIso, publicUser, signToken, verifyPassword } from "../services/authService.js";
import { jsonResponse, readJson } from "../utils/http.js";

export async function handleAuthRoutes(req, res, route) {
  if (route === "/api/auth/register" && req.method === "POST") {
    const { name, email, password } = await readJson(req);
    if (!name || !email || !password || password.length < 8) {
      jsonResponse(res, 400, { error: "Name, email, and a password of at least 8 characters are required." });
      return true;
    }
    const db = await readDb();
    if (db.users.some((user) => user.email === email.toLowerCase())) {
      jsonResponse(res, 409, { error: "A user with this email already exists." });
      return true;
    }
    const user = {
      id: id("user"),
      name,
      email: email.toLowerCase(),
      passwordHash: hashPassword(password),
      role: "student",
      createdAt: nowIso()
    };
    db.users.push(user);
    await writeDb(db);
    jsonResponse(res, 201, { token: signToken({ sub: user.id, role: user.role }), user: publicUser(user) });
    return true;
  }

  if (route === "/api/auth/login" && req.method === "POST") {
    const { email, password } = await readJson(req);
    const db = await readDb();
    const user = db.users.find((item) => item.email === String(email || "").toLowerCase());
    if (!user || !verifyPassword(password || "", user.passwordHash)) {
      jsonResponse(res, 401, { error: "Invalid email or password." });
      return true;
    }
    jsonResponse(res, 200, { token: signToken({ sub: user.id, role: user.role }), user: publicUser(user) });
    return true;
  }

  if (route === "/api/auth/me" && req.method === "GET") {
    const user = await getUserFromRequest(req);
    jsonResponse(res, user ? 200 : 401, user ? { user: publicUser(user) } : { error: "Authentication required." });
    return true;
  }

  if (route === "/api/auth/logout" && req.method === "POST") {
    jsonResponse(res, 200, { ok: true });
    return true;
  }

  return false;
}

