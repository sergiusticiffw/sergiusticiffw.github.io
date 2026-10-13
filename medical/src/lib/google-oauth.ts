import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";

import { getSiteUrl } from "@/lib/env";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const STATE_TTL_MS = 10 * 60 * 1000;

type OAuthState = {
  userId: string;
  familyId: string;
  exp: number;
};

export function getGoogleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const keyRaw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  const key = keyRaw ? Buffer.from(keyRaw, "base64") : null;

  if (!clientId || !clientSecret || !key || key.length !== 32) {
    return null;
  }

  return { clientId, clientSecret, key };
}

export function googleRedirectUri() {
  return `${getSiteUrl()}/api/google/callback`;
}

export function encryptToken(token: string) {
  const config = getGoogleConfig();
  if (!config) {
    throw new Error("Configurația Google lipsește.");
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config.key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptToken(payload: string) {
  const config = getGoogleConfig();
  if (!config) {
    throw new Error("Configurația Google lipsește.");
  }

  const [ivRaw, tagRaw, dataRaw] = payload.split(".");
  if (!ivRaw || !tagRaw || !dataRaw) {
    throw new Error("Tokenul salvat nu poate fi citit.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    config.key,
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function createOAuthState(input: { userId: string; familyId: string }) {
  const config = getGoogleConfig();
  if (!config) {
    throw new Error("Configurația Google lipsește.");
  }

  const payload = Buffer.from(
    JSON.stringify({
      userId: input.userId,
      familyId: input.familyId,
      exp: Date.now() + STATE_TTL_MS,
    } satisfies OAuthState),
  ).toString("base64url");
  const signature = createHmac("sha256", config.key)
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

export function readOAuthState(state: string | null): OAuthState | null {
  const config = getGoogleConfig();
  if (!config || !state) {
    return null;
  }

  const [payload, signature] = state.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = createHmac("sha256", config.key)
    .update(payload)
    .digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as OAuthState;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.familyId !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Date.now()
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function googleAuthUrl(state: string) {
  const config = getGoogleConfig();
  if (!config) {
    throw new Error("Configurația Google lipsește.");
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DRIVE_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeAuthCode(code: string) {
  const config = getGoogleConfig();
  if (!config) {
    throw new Error("Configurația Google lipsește.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error("Schimbul codului Google a eșuat.");
  }

  const body = (await response.json()) as { refresh_token?: string };
  return body.refresh_token ?? null;
}
