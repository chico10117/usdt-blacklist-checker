import "server-only";

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "@/lib/db/schema";

type DbClient = ReturnType<typeof createDbClient>;

function createDbClient(databaseUrl: string) {
  const sql = postgres(databaseUrl, {
    max: process.env.NODE_ENV === "production" ? 10 : 1,
  });

  return drizzle(sql, { schema });
}

const globalForDb = globalThis as unknown as {
  dbClient?: DbClient;
};

export function getDb(): DbClient | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;

  if (!globalForDb.dbClient) globalForDb.dbClient = createDbClient(databaseUrl);
  return globalForDb.dbClient;
}

export function requireDb(): DbClient {
  const db = getDb();
  if (!db) throw new Error("Persistence is disabled (DATABASE_URL not set).");
  return db;
}

export { schema };

