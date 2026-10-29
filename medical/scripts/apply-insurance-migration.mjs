/**
 * Applies medical_insurances migration via Postgres connection string.
 *
 *   DATABASE_URL=postgresql://... node scripts/apply-insurance-migration.mjs
 *
 * Or paste supabase/migrations/20261029120000_medical_insurances.sql
 * into Supabase → SQL Editor → Run.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

function loadEnvFile(filename) {
  const path = resolve(filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const sqlPath = resolve("supabase/migrations/20261029120000_medical_insurances.sql");
const sql = readFileSync(sqlPath, "utf8");
const databaseUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.SUPABASE_DB_URL?.trim() ||
  process.env.POSTGRES_URL?.trim();

if (!databaseUrl) {
  console.error(`
Lipsește DATABASE_URL (connection string Postgres din Supabase → Settings → Database).

Alternativ, deschide SQL Editor în Supabase și rulează fișierul:
  ${sqlPath}
`);
  process.exit(1);
}

const psql = spawnSync(
  "psql",
  [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", sql],
  { encoding: "utf8" },
);
if (psql.error) {
  console.error("psql nu este disponibil:", psql.error.message);
  console.error("Rulează SQL-ul manual din", sqlPath);
  process.exit(1);
}
if (psql.status !== 0) {
  console.error(psql.stderr || psql.stdout);
  process.exit(psql.status ?? 1);
}
console.log("Migrare medical_insurances aplicată.");
console.log(psql.stdout);
