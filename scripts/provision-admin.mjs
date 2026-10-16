import bcrypt from "bcryptjs";
import { MongoClient } from "mongodb";
import { randomBytes, randomUUID } from "node:crypto";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;
const email = (process.env.ADMIN_EMAIL || "admin@lawazia.campus").trim().toLowerCase();
const name = (process.env.ADMIN_NAME || "Lawazia Administrator").trim();
const password = process.env.ADMIN_PASSWORD || randomBytes(24).toString("base64url");

if (!uri) throw new Error("Set MONGODB_URI in .env.local or the process environment first.");
if (databaseName !== "lawazia_transit") {
  throw new Error("Admin bootstrap is pinned to MONGODB_DB=lawazia_transit and refused the configured database.");
}
if (!email.includes("@") || name.length < 2 || password.length < 16) {
  throw new Error("Provide a valid admin email/name and a password with at least 16 characters.");
}

const client = new MongoClient(uri);
try {
  await client.connect();
  const users = client.db(databaseName).collection("users");
  await users.createIndex({ id: 1 }, { unique: true });
  await users.createIndex({ email: 1 }, { unique: true });

  const existing = await users.findOne({ email });
  if (existing) {
    throw new Error(`An account already exists for ${email}; no account or password was changed.`);
  }

  await users.insertOne({
    id: `usr-${randomUUID()}`,
    name,
    email,
    role: "admin",
    passwordHash: await bcrypt.hash(password, 12),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  console.log(JSON.stringify({ status: "created", name, email, password }));
} finally {
  await client.close();
}
