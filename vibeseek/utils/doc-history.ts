export interface DocHistoryEntry {
  documentId: string
  title: string
  createdAt: number
}

const KEY = 'vibeseek:docs'
const MAX_ENTRIES = 20

export function loadDocHistory(): DocHistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (d) =>
        d &&
        typeof d.documentId === 'string' &&
        d.documentId.length > 0 &&
        d.documentId !== 'local' &&
        typeof d.title === 'string' &&
        typeof d.createdAt === 'number',
    )
  } catch {
    return []
  }
}

export function addDocToHistory(entry: DocHistoryEntry): void {
  if (typeof window === 'undefined') return
  if (!entry.documentId || entry.documentId === 'local' || !entry.title) return
  try {
    const current = loadDocHistory()
    const filtered = current.filter((d) => d.documentId !== entry.documentId)
    const updated = [entry, ...filtered].slice(0, MAX_ENTRIES)
    window.localStorage.setItem(KEY, JSON.stringify(updated))
  } catch {
    // quota exceeded or privacy mode — silent ignore (match chat-history pattern)
  }
}

export function removeDocFromHistory(documentId: string): void {
  if (typeof window === 'undefined') return
  try {
    const filtered = loadDocHistory().filter((d) => d.documentId !== documentId)
    window.localStorage.setItem(KEY, JSON.stringify(filtered))
  } catch {}
}

export function clearDocHistory(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
  } catch {}
}
