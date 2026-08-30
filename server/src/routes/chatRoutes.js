import { readDb, writeDb } from "../config/db.js";
import { id, nowIso } from "../services/authService.js";
import { buildSuggestedQuestions, generateAnswer, searchChunks } from "../services/ragService.js";
import { requireAuth } from "../middleware/guards.js";
import { chatRateLimit, checkRateLimit } from "../middleware/rateLimit.js";
import { jsonResponse, readJson } from "../utils/http.js";

export async function handleChatRoutes(req, res, route, user) {
  if (route === "/api/chat/suggestions" && req.method === "GET") {
    if (!requireAuth(user, res)) return true;
    const url = new URL(req.url, `http://${req.headers.host}`);
    const db = await readDb();
    const suggestions = buildSuggestedQuestions(db, {
      collection: url.searchParams.get("collection") || "",
      department: url.searchParams.get("department") || "",
      category: url.searchParams.get("category") || ""
    });
    jsonResponse(res, 200, { suggestions });
    return true;
  }

  if (route === "/api/chat/ask" && req.method === "POST") {
    if (!requireAuth(user, res)) return true;
    if (!checkRateLimit(user.id, chatRateLimit)) {
      jsonResponse(res, 429, { error: "Chat rate limit exceeded. Please wait a moment." });
      return true;
    }
    const { question, sessionId, collection, department, category, language } = await readJson(req);
    if (!question || question.trim().length < 3) {
      jsonResponse(res, 400, { error: "Question is required." });
      return true;
    }
    const db = await readDb();
    const existingSession = sessionId ? db.chatSessions.find((session) => session.id === sessionId && session.userId === user.id) : null;
    const session =
      existingSession ||
      {
        id: id("session"),
        userId: user.id,
        title: question.slice(0, 70),
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
    if (!existingSession) db.chatSessions.push(session);

    const filters = { collection, department, category };
    const results = searchChunks(db, question, 5, filters);
    const answer = await generateAnswer(question, results, { language });
    const message = {
      id: id("msg"),
      sessionId: session.id,
      userId: user.id,
      question,
      answer: answer.answer,
      sources: answer.sources,
      filters,
      language: language || "en",
      feedback: null,
      createdAt: nowIso()
    };
    session.updatedAt = nowIso();
    db.chatMessages.push(message);
    await writeDb(db);
    jsonResponse(res, 200, { session, message });
    return true;
  }

  if (route === "/api/chat/stream" && req.method === "POST") {
    if (!requireAuth(user, res)) return true;
    const { question, sessionId, collection, department, category, language } = await readJson(req);
    if (!question || question.trim().length < 3) {
      jsonResponse(res, 400, { error: "Question is required." });
      return true;
    }
    const db = await readDb();
    const existingSession = sessionId ? db.chatSessions.find((session) => session.id === sessionId && session.userId === user.id) : null;
    const session =
      existingSession ||
      {
        id: id("session"),
        userId: user.id,
        title: question.slice(0, 70),
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
    if (!existingSession) db.chatSessions.push(session);
    const filters = { collection, department, category };
    const results = searchChunks(db, question, 5, filters);
    const answer = await generateAnswer(question, results, { language });
    const message = {
      id: id("msg"),
      sessionId: session.id,
      userId: user.id,
      question,
      answer: answer.answer,
      sources: answer.sources,
      filters,
      language: language || "en",
      feedback: null,
      createdAt: nowIso()
    };
    session.updatedAt = nowIso();
    db.chatMessages.push(message);
    await writeDb(db);
    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive"
    });
    for (const token of answer.answer.split(/(\s+)/)) {
      res.write(`data: ${JSON.stringify({ type: "token", token })}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, 12));
    }
    res.write(`data: ${JSON.stringify({ type: "done", session, message })}\n\n`);
    res.end();
    return true;
  }

  if (route === "/api/chat/sessions" && req.method === "GET") {
    if (!requireAuth(user, res)) return true;
    const db = await readDb();
    jsonResponse(res, 200, {
      sessions: db.chatSessions
        .filter((session) => session.userId === user.id)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    });
    return true;
  }

  const sessionMatch = route.match(/^\/api\/chat\/sessions\/([^/]+)$/);
  const exportMatch = route.match(/^\/api\/chat\/sessions\/([^/]+)\/export$/);
  if (exportMatch && req.method === "GET") {
    if (!requireAuth(user, res)) return true;
    const db = await readDb();
    const session = db.chatSessions.find((item) => item.id === exportMatch[1] && item.userId === user.id);
    if (!session) {
      jsonResponse(res, 404, { error: "Chat session not found." });
      return true;
    }
    const messages = db.chatMessages.filter((message) => message.sessionId === session.id);
    jsonResponse(res, 200, { session, messages, exportedAt: nowIso() });
    return true;
  }

  if (sessionMatch && req.method === "GET") {
    if (!requireAuth(user, res)) return true;
    const db = await readDb();
    const session = db.chatSessions.find((item) => item.id === sessionMatch[1] && item.userId === user.id);
    if (!session) {
      jsonResponse(res, 404, { error: "Chat session not found." });
      return true;
    }
    jsonResponse(res, 200, {
      session,
      messages: db.chatMessages.filter((message) => message.sessionId === session.id)
    });
    return true;
  }

  const feedbackMatch = route.match(/^\/api\/chat\/messages\/([^/]+)\/feedback$/);
  if (feedbackMatch && req.method === "POST") {
    if (!requireAuth(user, res)) return true;
    const { rating } = await readJson(req);
    if (!["up", "down"].includes(rating)) {
      jsonResponse(res, 400, { error: "Feedback rating must be up or down." });
      return true;
    }
    const db = await readDb();
    const message = db.chatMessages.find((item) => item.id === feedbackMatch[1] && item.userId === user.id);
    if (!message) {
      jsonResponse(res, 404, { error: "Chat message not found." });
      return true;
    }
    message.feedback = { rating, createdAt: nowIso() };
    await writeDb(db);
    jsonResponse(res, 200, { message });
    return true;
  }

  if (sessionMatch && req.method === "DELETE") {
    if (!requireAuth(user, res)) return true;
    const db = await readDb();
    const session = db.chatSessions.find((item) => item.id === sessionMatch[1] && item.userId === user.id);
    if (!session) {
      jsonResponse(res, 404, { error: "Chat session not found." });
      return true;
    }
    db.chatSessions = db.chatSessions.filter((item) => item.id !== session.id);
    db.chatMessages = db.chatMessages.filter((message) => message.sessionId !== session.id);
    await writeDb(db);
    jsonResponse(res, 200, { ok: true });
    return true;
  }

  return false;
}
