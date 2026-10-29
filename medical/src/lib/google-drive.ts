import "server-only";

import { randomBytes } from "crypto";

import { createClient } from "@/lib/supabase/server";
import { decryptToken, getGoogleConfig } from "@/lib/google-oauth";

const FILE_ID = /^[A-Za-z0-9_-]{10,128}$/;
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const healthCache = new Map<
  string,
  { health: DriveHealth; expiresAt: number }
>();

type DriveFile = { id?: string };
type DriveList = { files?: DriveFile[] };

export type DriveHealth =
  | { status: "ok" }
  | { status: "missing" }
  | { status: "expired" }
  | { status: "unavailable" };

function rememberHealth(familyId: string, health: DriveHealth, ttlMs: number) {
  healthCache.set(familyId, { health, expiresAt: Date.now() + ttlMs });
  return health;
}

function clearHealth(familyId: string) {
  healthCache.delete(familyId);
}

function assertFileId(fileId: string) {
  if (!FILE_ID.test(fileId)) {
    throw new Error("Identificatorul fișierului nu este valid.");
  }
}

export function folderName(value: string) {
  const cleaned = value
    .replace(/[\\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || "Fără categorie";
}

function driveStatusError(status: number) {
  if (status === 401) {
    return "Conectează din nou Google Drive.";
  }
  if (status === 403) {
    return "Google Drive a refuzat accesul. Încearcă din nou peste câteva minute.";
  }
  if (status === 404) {
    return "Dosarul Google Drive nu a fost găsit.";
  }
  if (status === 429) {
    return "Google Drive este ocupat. Încearcă din nou peste câteva minute.";
  }
  return `Drive a răspuns cu ${status}.`;
}

export function isMissingFolder(error: unknown) {
  return error instanceof Error && error.message.includes("nu a fost găsit");
}

async function driveRequest(
  accessToken: string,
  url: string,
  init?: RequestInit,
) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  const request = { ...init, headers, cache: "no-store" as const };
  let response = await fetch(url, request);
  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    response = await fetch(url, request);
  }
  if (response.status === 401) {
    tokenCache.clear();
  }
  if (!response.ok) {
    throw new Error(driveStatusError(response.status));
  }
  return response;
}

async function getAccessToken(
  familyId: string,
  refreshToken: string,
  forceRefresh = false,
) {
  const config = getGoogleConfig();
  if (!config) {
    throw new Error("Configurația Google lipsește.");
  }

  if (!forceRefresh) {
    const cached = tokenCache.get(familyId);
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return cached.token;
    }
  }

  const request = {
    method: "POST" as const,
    cache: "no-store" as const,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  };

  let response = await fetch("https://oauth2.googleapis.com/token", request);
  if (response.status === 429 || response.status >= 500) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    response = await fetch("https://oauth2.googleapis.com/token", request);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!response.ok || !payload.access_token) {
    tokenCache.delete(familyId);
    console.error("googleToken", response.status, payload.error ?? "no_token");
    if (
      response.status === 400 ||
      response.status === 401 ||
      payload.error === "invalid_grant" ||
      payload.error === "invalid_client"
    ) {
      rememberHealth(familyId, { status: "expired" }, 60_000);
      throw new Error("Conectează din nou Google Drive. Accesul a expirat.");
    }
    if (response.status === 429) {
      throw new Error("Google Drive este ocupat. Încearcă din nou peste câteva minute.");
    }
    throw new Error("Conectează din nou Google Drive.");
  }

  tokenCache.set(familyId, {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  });
  rememberHealth(familyId, { status: "ok" }, 5 * 60_000);
  return payload.access_token;
}

async function loadConnection(familyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("google_drive_connections")
    .select("refresh_token_ciphertext, root_folder_id")
    .eq("family_id", familyId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as {
    refresh_token_ciphertext: string;
    root_folder_id: string | null;
  };

  return {
    refreshToken: decryptToken(row.refresh_token_ciphertext),
    rootFolderId: row.root_folder_id,
  };
}

async function createFolder(
  accessToken: string,
  parentId: string,
  name: string,
) {
  const response = await driveRequest(
    accessToken,
    "https://www.googleapis.com/drive/v3/files?fields=id",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: folderName(name),
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    },
  );
  const body = (await response.json()) as DriveFile;
  if (!body.id) {
    throw new Error("Dosarul Google Drive nu a putut fi creat.");
  }
  return body.id;
}

const ROOT_FOLDER_NAME = "Dosar medical";
/** Canonical My Drive folder for this family. Prefer env; falls back to known id. */
const CANONICAL_ROOT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID?.trim() ||
  "1q-yQh0PN3kyRZMXVxF6SuTnjwn8u6uVc";

async function findFolder(
  accessToken: string,
  parentId: string,
  name: string,
) {
  if (parentId !== "root") {
    assertFileId(parentId);
  }
  const safeName = folderName(name).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const query = [
    `name = '${safeName}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    `'${parentId}' in parents`,
    "trashed = false",
  ].join(" and ");
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", query);
  url.searchParams.set("fields", "files(id)");
  url.searchParams.set("pageSize", "1");
  // Prefer the oldest folder when duplicates already exist.
  url.searchParams.set("orderBy", "createdTime");
  url.searchParams.set("spaces", "drive");

  const response = await driveRequest(accessToken, url.toString());
  const body = (await response.json()) as DriveList;
  return body.files?.[0]?.id ?? null;
}

export async function ensureFolder(
  accessToken: string,
  parentId: string,
  name: string,
) {
  const existing = await findFolder(accessToken, parentId, name);
  if (existing) {
    return existing;
  }
  return createFolder(accessToken, parentId, name);
}

async function saveRootFolderId(familyId: string, rootFolderId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("google_drive_connections")
    .update({
      root_folder_id: rootFolderId,
      updated_at: new Date().toISOString(),
    })
    .eq("family_id", familyId);

  if (error) {
    throw new Error("Dosarul Google Drive nu a putut fi salvat.");
  }
}

async function folderAccessible(accessToken: string, folderId: string) {
  if (!FILE_ID.test(folderId)) {
    return false;
  }
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,trashed`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  if (response.status === 404 || response.status === 403) {
    return false;
  }
  if (!response.ok) {
    throw new Error(driveStatusError(response.status));
  }
  const body = (await response.json()) as { id?: string; trashed?: boolean };
  return Boolean(body.id) && body.trashed !== true;
}

export async function ensureDriveRoot(familyId: string) {
  const connection = await loadConnection(familyId);
  if (!connection) {
    return null;
  }

  const accessToken = await getAccessToken(familyId, connection.refreshToken);

  // Always prefer the known "Dosar medical" folder when it is reachable.
  if (
    FILE_ID.test(CANONICAL_ROOT_FOLDER_ID) &&
    (await folderAccessible(accessToken, CANONICAL_ROOT_FOLDER_ID))
  ) {
    if (connection.rootFolderId !== CANONICAL_ROOT_FOLDER_ID) {
      await saveRootFolderId(familyId, CANONICAL_ROOT_FOLDER_ID);
    }
    return { accessToken, rootFolderId: CANONICAL_ROOT_FOLDER_ID };
  }

  if (
    connection.rootFolderId &&
    (await folderAccessible(accessToken, connection.rootFolderId))
  ) {
    return { accessToken, rootFolderId: connection.rootFolderId };
  }

  const existing = await findFolder(accessToken, "root", ROOT_FOLDER_NAME);
  const rootFolderId =
    existing ?? (await createFolder(accessToken, "root", ROOT_FOLDER_NAME));
  // If two requests raced and both created folders, keep the oldest.
  const canonical =
    (await findFolder(accessToken, "root", ROOT_FOLDER_NAME)) ?? rootFolderId;

  await saveRootFolderId(familyId, canonical);
  return { accessToken, rootFolderId: canonical };
}

export async function uploadDriveFile(input: {
  accessToken: string;
  parentId: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}) {
  assertFileId(input.parentId);
  const boundary = `medical-${randomBoundary()}`;
  const metadata = JSON.stringify({
    name: input.filename,
    mimeType: input.mimeType,
    parents: [input.parentId],
  });
  const encoder = new TextEncoder();
  const preamble = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`,
  );
  const ending = encoder.encode(`\r\n--${boundary}--`);
  const fileBytes = new Uint8Array(input.bytes);
  const body = new Uint8Array(preamble.byteLength + fileBytes.byteLength + ending.byteLength);
  body.set(preamble, 0);
  body.set(fileBytes, preamble.byteLength);
  body.set(ending, preamble.byteLength + fileBytes.byteLength);

  const response = await driveRequest(
    input.accessToken,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  const created = (await response.json()) as DriveFile;
  if (!created.id || !FILE_ID.test(created.id)) {
    throw new Error("Fișierul nu a putut fi încărcat în Google Drive.");
  }
  return created.id;
}

export async function renameDriveFolder(
  familyId: string,
  folderId: string,
  name: string,
) {
  assertFileId(folderId);
  const connection = await loadConnection(familyId);
  if (!connection) {
    return;
  }
  const accessToken = await getAccessToken(familyId, connection.refreshToken);
  await driveRequest(
    accessToken,
    `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: folderName(name) }),
    },
  );
}

export async function trashDriveFile(familyId: string, fileId: string) {
  assertFileId(fileId);
  const connection = await loadConnection(familyId);
  if (!connection) {
    throw new Error("Google Drive nu este conectat.");
  }
  const accessToken = await getAccessToken(familyId, connection.refreshToken);
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}`,
    {
      method: "PATCH",
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trashed: true }),
    },
  );
  if (response.status === 404) {
    return;
  }
  if (!response.ok) {
    throw new Error("Fișierul nu a putut fi șters din Google Drive.");
  }
}

export async function downloadDriveFile(familyId: string, fileId: string) {
  assertFileId(fileId);
  const connection = await loadConnection(familyId);
  if (!connection) {
    throw new Error("Google Drive nu este conectat.");
  }
  const accessToken = await getAccessToken(familyId, connection.refreshToken);
  return driveRequest(
    accessToken,
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
  );
}

export async function getDriveConnectionMeta(familyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("google_drive_connections")
    .select("root_folder_id, updated_at")
    .eq("family_id", familyId)
    .maybeSingle();
  if (error) {
    console.error("getDriveConnectionMeta", error.code);
    return { error: "Starea Google Drive nu a putut fi încărcată." as const };
  }
  const row = data as { root_folder_id: string | null; updated_at: string } | null;
  if (!row) {
    return { connected: false as const, error: null };
  }
  return {
    connected: true as const,
    rootFolderId: row.root_folder_id,
    updatedAt: row.updated_at,
    error: null,
  };
}

export async function getDriveHealth(familyId: string): Promise<DriveHealth> {
  const cached = healthCache.get(familyId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.health;
  }

  let connection: Awaited<ReturnType<typeof loadConnection>>;
  try {
    connection = await loadConnection(familyId);
  } catch (error) {
    console.error(
      "getDriveHealth",
      error instanceof Error ? error.message : "load_failed",
    );
    return rememberHealth(familyId, { status: "expired" }, 60_000);
  }

  if (!connection) {
    return rememberHealth(familyId, { status: "missing" }, 60_000);
  }

  try {
    await getAccessToken(familyId, connection.refreshToken);
    return rememberHealth(familyId, { status: "ok" }, 5 * 60_000);
  } catch (error) {
    const after = healthCache.get(familyId);
    if (after && after.expiresAt > Date.now() && after.health.status === "expired") {
      return after.health;
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("expirat")) {
      return rememberHealth(familyId, { status: "expired" }, 60_000);
    }
    console.error("getDriveHealth", message || "unavailable");
    return rememberHealth(familyId, { status: "unavailable" }, 30_000);
  }
}

export async function disconnectDrive(familyId: string) {
  tokenCache.delete(familyId);
  clearHealth(familyId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("google_drive_connections")
    .delete()
    .eq("family_id", familyId);
  if (error) {
    console.error("disconnectDrive", error.code);
    throw new Error("Google Drive nu a putut fi deconectat.");
  }
}

function randomBoundary() {
  return randomBytes(12).toString("hex");
}
