import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filename) {
  const path = resolve(filename);
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error(
    "Lipsește NEXT_PUBLIC_SUPABASE_URL sau NEXT_PUBLIC_SUPABASE_ANON_KEY în .env.",
  );
  process.exit(1);
}

async function probe(path) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
    },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: response.status, code: body?.code ?? null };
}

function exists(result, missingCodes) {
  if (missingCodes.includes(result.code)) {
    return false;
  }
  if (result.status === 200 || result.status === 401 || result.status === 406) {
    return true;
  }
  if (result.code === "42501" || result.code === "PGRST301") {
    return true;
  }
  return null;
}

const [documents, connection] = await Promise.all([
  probe("medical_documents?select=drive_file_id&limit=0"),
  probe("google_drive_connections?select=family_id&limit=0"),
]);

const missing = ["PGRST204", "PGRST205", "42703", "42P01"];
const hasDriveFileId = exists(documents, missing);
const hasConnection = exists(connection, missing);

if (hasDriveFileId === null || hasConnection === null) {
  console.error("Verificarea nu a putut fi interpretată.");
  console.error(
    `medical_documents: HTTP ${documents.status} ${documents.code ?? ""}`.trim(),
  );
  console.error(
    `google_drive_connections: HTTP ${connection.status} ${connection.code ?? ""}`.trim(),
  );
  process.exit(1);
}

console.log(`drive_file_id: ${hasDriveFileId ? "există" : "lipsește"}`);
console.log(
  `google_drive_connections: ${hasConnection ? "există" : "lipsește"}`,
);

if (hasDriveFileId && hasConnection) {
  console.log("Migrația pentru Google Drive este deja aplicată.");
  process.exit(0);
}

console.log(
  "Aplică medical/supabase/migrations/20261013120000_init_medical.sql în SQL Editor.",
);
process.exit(2);
