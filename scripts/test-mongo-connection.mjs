import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

async function main() {
  if (!uri) {
    console.error("Set MONGODB_URI in .env.local or the process environment first.");
    process.exit(1);
  }

  console.log("Connecting to the configured MongoDB cluster...");
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8000,
  });

  try {
    await client.connect();
    console.log("✓ Successfully connected to MongoDB Atlas!");

    const db = client.db("lawazia_transit");
    const ping = await db.command({ ping: 1 });
    console.log("✓ Database Ping result:", ping);

    const collections = await db.listCollections().toArray();
    console.log("✓ Existing collections:", collections.map((c) => c.name));

    await client.close();
    console.log("✓ Connection closed cleanly.");
  } catch {
    console.error("✗ Could not connect. Check the configured MongoDB URI and Atlas network access.");
    process.exit(1);
  } finally {
    await client.close().catch(() => {});
  }
}

main();
