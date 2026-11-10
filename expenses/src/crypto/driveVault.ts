// Google Drive App Data vault: encryption key, preference files, and optional
// user-triggered full backups (expenses-backup.json). Uses a Google Identity
// Services popup, so the page state (e.g. a generated key) survives.
import { normalizeKey } from './keyFormat';

const GOOGLE_CLIENT_ID =
  '14695610160-ui3d8l2qa7tdjfi4s1t46hfl609qcmie.apps.googleusercontent.com';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'expenses-key.json';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

export class DriveKeyConflictError extends Error {
  constructor(public existingKey: string) {
    super('A different key is already saved in your Google Drive.');
    this.name = 'DriveKeyConflictError';
  }
}

export class DriveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriveError';
  }
}

interface VaultFile {
  v: 1;
  uid: string;
  key: string;
  createdAt: string;
}

type DriveToken = { value: string; expiresAt: number };

const TOKEN_STORAGE_KEY = 'driveAppDataToken';

const readStoredToken = (): DriveToken | null => {
  try {
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DriveToken>;
    if (
      typeof parsed.value === 'string' &&
      typeof parsed.expiresAt === 'number' &&
      parsed.expiresAt - Date.now() > 60 * 1000
    ) {
      return { value: parsed.value, expiresAt: parsed.expiresAt };
    }
  } catch {
    /* ignore */
  }
  return null;
};

const persistToken = (token: DriveToken) => {
  cachedToken = token;
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
  } catch {
    /* ignore */
  }
};

const clearToken = () => {
  cachedToken = null;
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
};

let cachedToken: DriveToken | null = readStoredToken();

/** True when a usable Drive appData token is already in this browser session. */
export const hasDriveAccessToken = (): boolean => {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60 * 1000) {
    return true;
  }
  cachedToken = readStoredToken();
  return Boolean(cachedToken);
};

const gsiReady = () => Boolean((window as any).google?.accounts?.oauth2);

const waitForGsi = (ms: number) =>
  new Promise<boolean>((resolve) => {
    if (gsiReady()) {
      resolve(true);
      return;
    }
    if (ms <= 0) {
      resolve(false);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (gsiReady()) {
        window.clearInterval(timer);
        resolve(true);
      } else if (Date.now() - started >= ms) {
        window.clearInterval(timer);
        resolve(false);
      }
    }, 50);
  });

/**
 * The login provider already inserts the GIS script, and React StrictMode
 * removes that tag once. A second insert for the same URL fails in Chrome
 * with a script error, which was shown as "Couldn't load Google sign-in".
 * Wait for the script that is already on the page.
 */
export const preloadGoogleIdentity = async (): Promise<void> => {
  if (await waitForGsi(0)) return;
  const selector = `script[src^="${GIS_SRC}"]`;
  if (!document.querySelector(selector)) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new DriveError("Couldn't load Google sign-in. Check your connection."));
      document.head.appendChild(script);
    });
  }
  if (!(await waitForGsi(8000))) {
    throw new DriveError("Couldn't load Google sign-in. Check your connection.");
  }
};

/**
 * Interactive token request — call only from a user gesture (click/save).
 * Uses prompt:'' so Google skips the account picker when access was already granted.
 */
const getAccessToken = async (): Promise<string> => {
  if (hasDriveAccessToken() && cachedToken) {
    return cachedToken.value;
  }
  await preloadGoogleIdentity();
  const oauth2 = (window as any).google?.accounts?.oauth2;
  if (!oauth2) throw new DriveError("Couldn't load Google sign-in.");

  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      include_granted_scopes: true,
      callback: (response: any) => {
        if (response?.error || !response?.access_token) {
          reject(new DriveError('Google Drive access was not granted.'));
          return;
        }
        if (!oauth2.hasGrantedAllScopes(response, SCOPE)) {
          reject(new DriveError('Allow access to app data in Google Drive to continue.'));
          return;
        }
        persistToken({
          value: response.access_token,
          expiresAt: Date.now() + Number(response.expires_in || 3600) * 1000,
        });
        resolve(response.access_token);
      },
      error_callback: () => reject(new DriveError('The Google window was closed.')),
    });
    // Empty prompt: no account chooser if the Drive scope was already granted.
    client.requestAccessToken({ prompt: '' });
  });
};

/** Asks for Drive access now (inside a click), so a later step can use it without a popup. */
export const authorizeDrive = async () => {
  await getAccessToken();
};

const driveFetch = async (
  url: string,
  init: RequestInit = {},
  interactive = true
) => {
  let token: string | null = null;
  if (interactive) {
    token = await getAccessToken();
  } else if (hasDriveAccessToken() && cachedToken) {
    token = cachedToken.value;
  }
  if (!token) {
    throw new DriveError('No Drive token');
  }
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  if (response.status === 401 || response.status === 403) clearToken();
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error?.message ? `: ${body.error.message}` : '';
    } catch {
      detail = '';
    }
    throw new DriveError(`Google Drive request failed (${response.status})${detail}`);
  }
  return response;
};

const findFileByName = async (
  name: string,
  interactive = true
): Promise<string | null> => {
  const query = encodeURIComponent(`name='${name}'`);
  const response = await driveFetch(
    `${API}?spaces=appDataFolder&q=${query}&fields=files(id,name)&pageSize=10`,
    {},
    interactive
  );
  const { files } = await response.json();
  return files?.[0]?.id ?? null;
};

const findFile = async (): Promise<string | null> => findFileByName(FILE_NAME);

const readFile = async (id: string): Promise<VaultFile | null> => {
  const response = await driveFetch(`${API}/${id}?alt=media`);
  try {
    const data = await response.json();
    return data?.key ? data : null;
  } catch {
    return null;
  }
};

/** Read a JSON file from Drive appDataFolder, or null if missing. */
export const readAppDataJson = async (
  name: string,
  options?: { silent?: boolean }
): Promise<unknown | null> => {
  const interactive = !options?.silent;
  if (!interactive && !hasDriveAccessToken()) return null;
  const id = await findFileByName(name, interactive);
  if (!id) return null;
  const response = await driveFetch(`${API}/${id}?alt=media`, {}, interactive);
  try {
    return await response.json();
  } catch {
    return null;
  }
};

/** Read a JSON file by Drive file id. */
export const readAppDataJsonById = async (
  id: string,
  options?: { silent?: boolean }
): Promise<unknown | null> => {
  const interactive = !options?.silent;
  if (!interactive && !hasDriveAccessToken()) return null;
  const response = await driveFetch(`${API}/${id}?alt=media`, {}, interactive);
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export interface AppDataFileMeta {
  id: string;
  name: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
}

/** List App Data files whose name contains `nameContains` (newest first). */
export const listAppDataFiles = async (
  nameContains: string,
  options?: { silent?: boolean; pageSize?: number }
): Promise<AppDataFileMeta[]> => {
  const interactive = !options?.silent;
  if (!interactive && !hasDriveAccessToken()) return [];
  const pageSize = options?.pageSize ?? 50;
  const query = encodeURIComponent(`name contains '${nameContains.replace(/'/g, "\\'")}'`);
  const fields = encodeURIComponent(
    'files(id,name,createdTime,modifiedTime,size)'
  );
  const response = await driveFetch(
    `${API}?spaces=appDataFolder&q=${query}&fields=${fields}&pageSize=${pageSize}&orderBy=modifiedTime desc`,
    {},
    interactive
  );
  const body = await response.json();
  const files = Array.isArray(body?.files) ? body.files : [];
  return files
    .filter(
      (f: Partial<AppDataFileMeta>) =>
        typeof f?.id === 'string' && typeof f?.name === 'string'
    )
    .map((f: AppDataFileMeta) => ({
      id: f.id,
      name: f.name,
      createdTime: f.createdTime,
      modifiedTime: f.modifiedTime,
      size: f.size,
    }));
};

/** Create or overwrite a JSON file in Drive appDataFolder. */
export const writeAppDataJson = async (
  name: string,
  content: object
): Promise<void> => {
  const body = new Blob([JSON.stringify(content)], {
    type: 'application/json',
  });
  const id = await findFileByName(name);
  if (id) {
    await driveFetch(`${UPLOAD_API}/${id}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return;
  }
  const metadata = {
    name,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  };
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', body);
  await driveFetch(`${UPLOAD_API}?uploadType=multipart&fields=id`, {
    method: 'POST',
    body: form,
  });
};

/** Returns the stored key for this user, or null if there's none. */
export const readKeyFromDrive = async (uid: string): Promise<string | null> => {
  const id = await findFile();
  if (!id) return null;
  const file = await readFile(id);
  if (!file) return null;
  if (String(file.uid) !== String(uid)) {
    throw new DriveError('The key in this Google Drive belongs to a different account.');
  }
  return normalizeKey(file.key);
};

/** Saves the key and reads it back. Never overwrites a different key. */
export const saveKeyToDrive = async (uid: string, keyText: string): Promise<void> => {
  const key = await normalizeKey(keyText);
  const existing = await readKeyFromDrive(uid);
  if (existing && existing !== key) {
    throw new DriveKeyConflictError(existing);
  }
  if (!existing) {
    const content: VaultFile = {
      v: 1,
      uid: String(uid),
      key,
      createdAt: new Date().toISOString(),
    };
    await writeAppDataJson(FILE_NAME, content);
  }
  if ((await readKeyFromDrive(uid)) !== key) {
    throw new DriveError("The key couldn't be verified in Google Drive. Copy it somewhere safe instead.");
  }
};

export const deleteKeyFromDrive = async (): Promise<void> => {
  const id = await findFile();
  if (id) {
    await driveFetch(`${API}/${id}`, { method: 'DELETE' });
  }
};

/** Delete an App Data file by id. */
export const deleteAppDataFileById = async (id: string): Promise<void> => {
  await driveFetch(`${API}/${id}`, { method: 'DELETE' });
};
