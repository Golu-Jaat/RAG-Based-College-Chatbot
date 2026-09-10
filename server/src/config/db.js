import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { GridFSBucket, MongoClient, ObjectId } from "mongodb";
import { env, redactMongoUri } from "./env.js";

export const collectionNames = ["users", "documents", "chunks", "chatSessions", "chatMessages"];

let mongoClient;
let mongoDatabase;
let mongoIndexesReady = false;

export async function getMongoDb() {
  if (mongoDatabase) return mongoDatabase;
  mongoClient = new MongoClient(env.mongodbUri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000
  });
  try {
    await mongoClient.connect();
  } catch (error) {
    throw new Error(
      `Could not connect to MongoDB at ${redactMongoUri()}. Start MongoDB locally, check your Atlas username/password, and whitelist your current IP address. ${error.message}`
    );
  }
  mongoDatabase = mongoClient.db(env.mongodbDb);
  await ensureIndexes();
  return mongoDatabase;
}

export async function saveFileToGridFs(file) {
  const database = await getMongoDb();
  const bucket = new GridFSBucket(database, { bucketName: "uploads" });
  return new Promise((resolve, reject) => {
    const upload = bucket.openUploadStream(file.filename, {
      contentType: file.mime,
      metadata: { uploadedAt: new Date().toISOString() }
    });
    upload.on("error", reject);
    upload.on("finish", () => resolve(upload.id.toString()));
    upload.end(file.buffer);
  });
}

export async function readFileFromGridFs(fileId) {
  const database = await getMongoDb();
  const bucket = new GridFSBucket(database, { bucketName: "uploads" });
  const chunks = [];
  return new Promise((resolve, reject) => {
    const stream = bucket.openDownloadStream(new ObjectId(fileId));
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export async function deleteFileFromGridFs(fileId) {
  if (!fileId) return;
  try {
    const database = await getMongoDb();
    const bucket = new GridFSBucket(database, { bucketName: "uploads" });
    await bucket.delete(new ObjectId(fileId));
  } catch {
    // Metadata cleanup should still succeed if the stored file is already gone.
  }
}

export async function ensureIndexes() {
  if (mongoIndexesReady || !mongoDatabase) return;
  await Promise.all([
    mongoDatabase.collection("users").createIndex({ email: 1 }, { unique: true }),
    mongoDatabase.collection("documents").createIndex({ id: 1 }, { unique: true }),
    mongoDatabase.collection("chunks").createIndex({ documentId: 1 }),
    mongoDatabase.collection("chatSessions").createIndex({ userId: 1, updatedAt: -1 }),
    mongoDatabase.collection("chatMessages").createIndex({ sessionId: 1, createdAt: 1 })
  ]);
  mongoIndexesReady = true;
}

export async function ensureStorage() {
  await mkdir(env.storageDir, { recursive: true });
}

export async function readDb() {
  const database = await getMongoDb();
  const [users, documents, chunks, chatSessions, chatMessages] = await Promise.all(
    collectionNames.map((name) => database.collection(name).find({}, { projection: { _id: 0 } }).toArray())
  );
  return { users, documents, chunks, chatSessions, chatMessages };
}

export async function writeDb(db) {
  const database = await getMongoDb();
  await Promise.all(
    collectionNames.map(async (name) => {
      const collection = database.collection(name);
      await collection.deleteMany({});
      const documents = (db[name] || []).map(stripMongoId);
      if (documents.length) await collection.insertMany(documents);
    })
  );
}

export async function readLegacyDb() {
  if (!existsSync(env.legacyDbPath)) return null;
  try {
    return JSON.parse(await readFile(env.legacyDbPath, "utf8"));
  } catch {
    return null;
  }
}

export function stripMongoId(document) {
  const { _id, ...rest } = document;
  return rest;
}
