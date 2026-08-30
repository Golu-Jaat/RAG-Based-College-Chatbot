import { readDb } from "../config/db.js";
import { requireAdmin } from "../middleware/guards.js";
import { jsonResponse } from "../utils/http.js";

export async function handleAdminRoutes(req, res, route, user) {
  if (route === "/api/admin/analytics" && req.method === "GET") {
    if (!requireAdmin(user, res)) return true;
    const db = await readDb();
    const feedback = db.chatMessages.map((message) => message.feedback?.rating).filter(Boolean);
    const unknownCount = db.chatMessages.filter((message) => !message.sources?.length).length;
    jsonResponse(res, 200, {
      totals: {
        users: db.users.length,
        documents: db.documents.length,
        chunks: db.chunks.length,
        chatSessions: db.chatSessions.length,
        chatMessages: db.chatMessages.length,
        unanswered: unknownCount,
        feedbackUp: feedback.filter((rating) => rating === "up").length,
        feedbackDown: feedback.filter((rating) => rating === "down").length
      },
      byCollection: countBy(db.documents, "collection"),
      byDepartment: countBy(db.documents, "department"),
      byCategory: countBy(db.documents, "category"),
      recentQuestions: db.chatMessages
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 8)
        .map((message) => ({
          question: message.question,
          answered: Boolean(message.sources?.length),
          createdAt: message.createdAt,
          feedback: message.feedback?.rating || null
        }))
    });
    return true;
  }
  return false;
}

function countBy(items, field) {
  return items.reduce((acc, item) => {
    const key = item[field] || "Unassigned";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}
