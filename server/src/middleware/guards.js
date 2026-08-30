import { jsonResponse } from "../utils/http.js";

export function requireAuth(user, res) {
  if (!user) {
    jsonResponse(res, 401, { error: "Authentication required." });
    return false;
  }
  return true;
}

export function requireAdmin(user, res) {
  if (!requireAuth(user, res)) return false;
  if (user.role !== "admin") {
    jsonResponse(res, 403, { error: "Admin access required." });
    return false;
  }
  return true;
}

