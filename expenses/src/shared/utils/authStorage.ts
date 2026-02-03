const STORAGE_KEY = 'currentUser';

export function getStoredCurrentUser(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getStoredToken(): string {
  const user = getStoredCurrentUser();
  return (user?.jwt_token as string) ?? '';
}
