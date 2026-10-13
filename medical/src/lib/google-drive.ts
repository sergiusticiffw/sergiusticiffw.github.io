import "server-only";

import { randomBytes } from "crypto";

import { createClient } from "@/lib/supabase/server";
import { decryptToken, getGoogleConfig } from "@/lib/google-oauth";

const FILE_ID = /^[A-Za-z0-9_-]{10,128}$/;
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

type DriveFile = { id?: string };
type DriveList = { files?: DriveFile[] };

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

async function driveRequest(
  accessToken: string,
  url: string,
  init?: RequestInit,
) {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    throw new Error(`Drive a răspuns cu ${response.status}.`);
  }
  return response;
}

async function getAccessToken(familyId: string, refreshToken: string) {
  const config = getGoogleConfig();
  if (!config) {
    throw new Error("Configurația Google lipsește.");
  }

  const cached = tokenCache.get(familyId);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Reînnoirea accesului Google a eșuat.");
  }

  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!body.access_token) {
    throw new Error("Reînnoirea accesului Google a eșuat.");
  }

  tokenCache.set(familyId, {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  });
  return body.access_token;
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

async function findFolder(
  accessToken: string,
  parentId: string,
  name: string,
) {
  assertFileId(parentId);
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

export async function ensureDriveRoot(familyId: string) {
  const connection = await loadConnection(familyId);
  if (!connection) {
    return null;
  }

  const accessToken = await getAccessToken(familyId, connection.refreshToken);
  if (connection.rootFolderId) {
    return { accessToken, rootFolderId: connection.rootFolderId };
  }

  const response = await driveRequest(
    accessToken,
    "https://www.googleapis.com/drive/v3/files?fields=id",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Dosar medical",
        mimeType: "application/vnd.google-apps.folder",
        parents: ["root"],
      }),
    },
  );
  const created = (await response.json()) as DriveFile;
  if (!created.id) {
    throw new Error("Dosarul Google Drive nu a putut fi creat.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("google_drive_connections")
    .update({ root_folder_id: created.id, updated_at: new Date().toISOString() })
    .eq("family_id", familyId);

  if (error) {
    throw new Error("Dosarul Google Drive nu a putut fi salvat.");
  }

  return { accessToken, rootFolderId: created.id };
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
  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${input.mimeType}\r\n\r\n`,
  );
  const ending = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([preamble, Buffer.from(input.bytes), ending]);

  const response = await driveRequest(
    input.accessToken,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body: new Uint8Array(body),
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

function randomBoundary() {
  return randomBytes(12).toString("hex");
}
