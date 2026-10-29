const ENABLED_PREFIX = "medical.biometric.enabled:";
const CREDENTIAL_PREFIX = "medical.biometric.credentialId:";
const UNLOCKED_PREFIX = "medical.biometric.unlocked:";
const HIDDEN_AT_PREFIX = "medical.biometric.hiddenAt:";

export const BIOMETRIC_IDLE_MS = 60_000;

function enabledKey(userId: string) {
  return `${ENABLED_PREFIX}${userId}`;
}

function credentialKey(userId: string) {
  return `${CREDENTIAL_PREFIX}${userId}`;
}

function unlockedKey(userId: string) {
  return `${UNLOCKED_PREFIX}${userId}`;
}

function hiddenAtKey(userId: string) {
  return `${HIDDEN_AT_PREFIX}${userId}`;
}

function toBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function randomChallenge() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytes.buffer;
}

function userIdBytes(userId: string) {
  return new TextEncoder().encode(userId).buffer;
}

export function isBiometricSupported() {
  return (
    typeof window !== "undefined" &&
    typeof window.PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.create === "function" &&
    typeof navigator.credentials?.get === "function"
  );
}

export async function isPlatformAuthenticatorAvailable() {
  if (!isBiometricSupported()) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export function isBiometricEnabled(userId: string) {
  if (typeof window === "undefined" || !userId) {
    return false;
  }
  return window.localStorage.getItem(enabledKey(userId)) === "1";
}

export function getStoredCredentialId(userId: string) {
  if (typeof window === "undefined" || !userId) {
    return null;
  }
  return window.localStorage.getItem(credentialKey(userId));
}

export function isUnlocked(userId: string) {
  if (typeof window === "undefined" || !userId) {
    return false;
  }
  return window.sessionStorage.getItem(unlockedKey(userId)) === "1";
}

export function markUnlocked(userId: string) {
  window.sessionStorage.setItem(unlockedKey(userId), "1");
  window.sessionStorage.removeItem(hiddenAtKey(userId));
}

export function clearUnlocked(userId: string) {
  window.sessionStorage.removeItem(unlockedKey(userId));
}

export function markHidden(userId: string) {
  window.sessionStorage.setItem(hiddenAtKey(userId), String(Date.now()));
}

export function shouldRelockAfterIdle(userId: string) {
  if (!isBiometricEnabled(userId)) {
    return false;
  }
  const raw = window.sessionStorage.getItem(hiddenAtKey(userId));
  if (!raw) {
    return false;
  }
  const hiddenAt = Number(raw);
  if (!Number.isFinite(hiddenAt)) {
    return false;
  }
  return Date.now() - hiddenAt >= BIOMETRIC_IDLE_MS;
}

export function disableBiometric(userId: string) {
  window.localStorage.removeItem(enabledKey(userId));
  window.localStorage.removeItem(credentialKey(userId));
  clearUnlocked(userId);
  window.sessionStorage.removeItem(hiddenAtKey(userId));
}

/** Clears unlock state on logout; keeps enroll preference for re-login. */
export function clearUnlockOnLogout(userId: string) {
  clearUnlocked(userId);
  window.sessionStorage.removeItem(hiddenAtKey(userId));
}

export async function enrollBiometric(options: {
  userId: string;
  email: string;
}): Promise<{ error?: string }> {
  const { userId, email } = options;
  if (!isBiometricSupported()) {
    return { error: "Dispozitivul nu suportă deblocare biometrică." };
  }
  const available = await isPlatformAuthenticatorAvailable();
  if (!available) {
    return {
      error: "Nu există Face ID, amprentă sau Windows Hello pe acest dispozitiv.",
    };
  }

  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: {
          name: "Dosar medical",
          id: window.location.hostname,
        },
        user: {
          id: userIdBytes(userId),
          name: email || userId,
          displayName: email || "Utilizator",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "discouraged",
        },
        timeout: 60_000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;

    if (!credential) {
      return { error: "Înregistrarea biometrică a fost anulată." };
    }

    const credentialId = toBase64Url(credential.rawId);
    window.localStorage.setItem(credentialKey(userId), credentialId);
    window.localStorage.setItem(enabledKey(userId), "1");
    markUnlocked(userId);
    return {};
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      return { error: "Înregistrarea a fost anulată." };
    }
    console.error("enrollBiometric", error instanceof Error ? error.name : "unknown");
    return { error: "Biometria nu a putut fi activată pe acest dispozitiv." };
  }
}

export async function assertBiometric(
  userId: string,
): Promise<{ error?: string }> {
  if (!isBiometricEnabled(userId)) {
    return { error: "Deblocarea biometrică nu este activă." };
  }
  const credentialId = getStoredCredentialId(userId);
  if (!credentialId) {
    disableBiometric(userId);
    return { error: "Credentialul biometric lipsește. Reactivează din Profil." };
  }

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        rpId: window.location.hostname,
        allowCredentials: [
          {
            type: "public-key",
            id: fromBase64Url(credentialId),
          },
        ],
        userVerification: "required",
        timeout: 60_000,
      },
    });

    if (!assertion) {
      return { error: "Deblocarea a fost anulată." };
    }

    markUnlocked(userId);
    return {};
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      return { error: "Deblocarea a fost anulată." };
    }
    console.error("assertBiometric", error instanceof Error ? error.name : "unknown");
    return { error: "Deblocarea biometrică a eșuat. Încearcă din nou sau folosește parola." };
  }
}
