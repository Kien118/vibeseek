/**
 * Anonymous user identity for VibeSeek guest demo.
 * 1 user = 1 anon_id (UUID v4) persisted in localStorage.
 * Server-side calls return null — only the browser owns the identity.
 */

const STORAGE_KEY = 'vibeseek:anonId'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/**
 * Read existing anon_id from localStorage, or generate + persist a new one.
 * Safe to call on client mount (useEffect). Returns null on server.
 */
export function getOrCreateAnonId(): string | null {
  if (!isBrowser()) return null

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing && existing.length > 0) return existing

    const fresh = crypto.randomUUID()
    window.localStorage.setItem(STORAGE_KEY, fresh)
    return fresh
  } catch {
    // localStorage blocked (private mode, iframe, etc.) — degrade gracefully
    return null
  }
}

/** Read-only peek (returns null if not set yet or on server). */
export function peekAnonId(): string | null {
  if (!isBrowser()) return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** For testing / user-requested reset. Clears local identity. */
export function clearAnonId(): void {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // noop
  }
}

export const ANON_ID_STORAGE_KEY = STORAGE_KEY
