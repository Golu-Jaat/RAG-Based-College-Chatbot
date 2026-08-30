import { getMongoDb } from "../config/db.js";
import { env, mongoHostLabel } from "../config/env.js";

try {
  console.log(`Checking MongoDB host: ${mongoHostLabel()}`);
  console.log(`Database name: ${env.mongodbDb}`);
  const db = await getMongoDb();
  await db.command({ ping: 1 });
  console.log("MongoDB connection OK.");
  process.exit(0);
} catch (error) {
  console.error(error.message);
  console.error("If this is MongoDB Atlas, use a Database Access user password, not your Atlas login password.");
  console.error("If the password has special characters like @, #, /, ?, &, or %, URL-encode the password in MONGODB_URI.");
  console.error("Also confirm Network Access allows your current IP address.");
  process.exit(1);
}
