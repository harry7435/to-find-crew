const STORAGE_KEY = 'guest_favorite_sessions';

export function getFavoriteSessionIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function addFavoriteSessionId(sessionId: string): void {
  if (typeof window === 'undefined') return;
  const ids = getFavoriteSessionIds();
  if (ids.includes(sessionId)) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids, sessionId]));
}

export function removeFavoriteSessionId(sessionId: string): void {
  if (typeof window === 'undefined') return;
  const ids = getFavoriteSessionIds().filter((id) => id !== sessionId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}
