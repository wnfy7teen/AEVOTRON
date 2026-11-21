import pg from "pg";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: true } : undefined,
});

export async function migrate() {
  const migrationPath = fileURLToPath(new URL("../migrations/001_initial.sql", import.meta.url));
  const sql = await readFile(migrationPath, "utf8");
  await pool.query(sql);
}

export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
