import "server-only";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

// Next.js may bundle this module into several server chunks in one process.
// Keep a single connection per process on globalThis; this matters for PGlite,
// where two instances on the same directory would not see each other's writes.
const globalForDb = globalThis as unknown as { __legibleDb?: Promise<Db> | null };

/**
 * Production: Neon over HTTP (DATABASE_URL). Local dev without DATABASE_URL:
 * an embedded PGlite database in .data/ so the app runs with zero setup.
 * Migrations run once per process; drizzle's migrator is idempotent.
 */
async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    const { migrate } = await import("drizzle-orm/neon-http/migrator");
    const db = drizzle(neon(url), { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return db as unknown as Db;
  }
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_PGLITE) {
    throw new Error("DATABASE_URL is required in production.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  const client = dataDir === "memory://" ? new PGlite() : new PGlite(dataDir);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  globalForDb.__legibleDb ??= connect().catch((err) => {
    globalForDb.__legibleDb = null;
    throw err;
  });
  return globalForDb.__legibleDb;
}

export { schema };
