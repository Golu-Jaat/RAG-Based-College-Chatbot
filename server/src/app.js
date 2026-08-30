import { createServer } from "node:http";
import { env, mongoHostLabel } from "./config/env.js";
import { ensureStorage, getMongoDb, readLegacyDb, writeDb } from "./config/db.js";
import { getUserFromRequest, hashPassword, id, nowIso } from "./services/authService.js";
import { handleAuthRoutes } from "./routes/authRoutes.js";
import { handleDocumentRoutes } from "./routes/documentRoutes.js";
import { handleChatRoutes } from "./routes/chatRoutes.js";
import { handleAdminRoutes } from "./routes/adminRoutes.js";
import { jsonResponse, serveStatic } from "./utils/http.js";

async function seedDatabase() {
  await ensureStorage();
  const database = await getMongoDb();
  const userCount = await database.collection("users").countDocuments();
  await database.collection("users").updateOne(
    { email: env.adminEmail },
    {
      $set: {
        name: env.adminName,
        email: env.adminEmail,
        passwordHash: hashPassword(env.adminPassword),
        role: "admin"
      },
      $setOnInsert: {
        id: id("user"),
        createdAt: nowIso()
      }
    },
    { upsert: true }
  );
  if (userCount > 0) return;

  const legacy = await readLegacyDb();
  if (legacy?.users?.length) {
    await writeDb({
      users: legacy.users || [],
      documents: legacy.documents || [],
      chunks: legacy.chunks || [],
      chatSessions: legacy.chatSessions || [],
      chatMessages: legacy.chatMessages || []
    });
    await database.collection("users").updateOne(
      { email: env.adminEmail },
      {
        $set: {
          name: env.adminName,
          email: env.adminEmail,
          passwordHash: hashPassword(env.adminPassword),
          role: "admin"
        },
        $setOnInsert: {
          id: id("user"),
          createdAt: nowIso()
        }
      },
      { upsert: true }
    );
    return;
  }

  await database.collection("users").updateOne(
    { email: "student@college.edu" },
    {
      $setOnInsert: {
      id: id("user"),
      name: "Demo Student",
      email: "student@college.edu",
      passwordHash: hashPassword("Student@12345"),
      role: "student",
      createdAt: nowIso()
    }
    },
    { upsert: true }
  );
}

export async function routeRequest(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const route = url.pathname;

    if (route.startsWith("/api/auth/") && (await handleAuthRoutes(req, res, route))) return;

    if (route.startsWith("/api/")) {
      const user = await getUserFromRequest(req);
      if (await handleAdminRoutes(req, res, route, user)) return;
      if (await handleDocumentRoutes(req, res, route, user)) return;
      if (await handleChatRoutes(req, res, route, user)) return;
      jsonResponse(res, 404, { error: "API route not found." });
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    if (res.headersSent) return res.end();
    jsonResponse(res, error.status || 500, { error: error.message || "Server error." });
  }
}

export async function startServer() {
  try {
    console.log(`Connecting to MongoDB: ${mongoHostLabel()}`);
    await seedDatabase();
    createServer(routeRequest).listen(env.port, () => {
      console.log(`RAG-Based College Chatbot running at http://localhost:${env.port}`);
      console.log("MongoDB database:", env.mongodbDb);
      console.log(`Demo admin: ${env.adminEmail} / ${env.adminPassword}`);
      console.log("Demo student: student@college.edu / Student@12345");
    });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
