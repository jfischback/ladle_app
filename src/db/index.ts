import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";
import { seedStarterSet } from "./seed";

export type DB = PostgresJsDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  let db: DB;
  if (url) {
    // Vercel Postgres / Neon / any Postgres
    const client = postgres(url, { prepare: false, max: 5 });
    db = drizzlePostgres(client, { schema });
    await migratePostgres(db, { migrationsFolder: MIGRATIONS });
  } else {
    // Local development: embedded Postgres (PGlite) stored on disk
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
    mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    const local = drizzle(client, { schema });
    await migrate(local, { migrationsFolder: MIGRATIONS });
    db = local as unknown as DB;
  }
  await seedStarterSet(db);
  return db;
}

const globalForDb = globalThis as unknown as { ladleDb?: Promise<DB> };

export function getDb(): Promise<DB> {
  if (!globalForDb.ladleDb) {
    globalForDb.ladleDb = connect().catch((err) => {
      globalForDb.ladleDb = undefined;
      throw err;
    });
  }
  return globalForDb.ladleDb;
}

export { schema };
