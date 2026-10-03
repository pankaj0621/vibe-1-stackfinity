import dns from "node:dns";
import { MongoClient, type Db } from "mongodb";
import { getEnv } from "@/lib/env";

// Kuch ISP/router DNS SRV queries refuse karte hain (querySrv ECONNREFUSED).
// Local dev mein Google/Cloudflare DNS use karo.
if (process.env.NODE_ENV !== "production") {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
}

const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>;
};

export function getClient(): Promise<MongoClient> {
  if (!globalForMongo._mongoClientPromise) {
    const { MONGODB_URI } = getEnv();
    const promise = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    }).connect();

    // Connection fail ho to cache clear karo, taaki agli request retry kare
    promise.catch(() => {
      globalForMongo._mongoClientPromise = undefined;
    });

    globalForMongo._mongoClientPromise = promise;
  }
  return globalForMongo._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(getEnv().MONGODB_DB);
}