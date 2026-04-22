export interface ChatHistoryMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  mode?: 'default' | 'feynman' // P-502 — absent = 'default' for backward compat
}

const KEY_PREFIX = 'vibeseek:chat:'
const FEYNMAN_CONCEPT_KEY_PREFIX = 'vibeseek:feynman:concept:'

export function loadHistory(documentId: string): ChatHistoryMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + documentId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(m =>
      m && typeof m.id === 'string'
        && (m.role === 'user' || m.role === 'assistant')
        && typeof m.content === 'string',
    )
  } catch {
    return []
  }
}

export function saveHistory(documentId: string, messages: ChatHistoryMessage[]): void {
  if (typeof window === 'undefined') return
  // Never overwrite with empty — prevents mount-time race wiping localStorage
  // before the load effect's setState commits. Use clearHistory() to explicitly clear.
  if (messages.length === 0) return
  try {
    const trimmed = messages.slice(-50)
    window.localStorage.setItem(KEY_PREFIX + documentId, JSON.stringify(trimmed))
  } catch {
    // quota exceeded or privacy mode — silently ignore
  }
}

export function clearHistory(documentId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY_PREFIX + documentId)
  } catch {}
}

export function newMessageId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// P-502: persist Feynman session's concept card id per document across reloads.
export function loadFeynmanConcept(documentId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(FEYNMAN_CONCEPT_KEY_PREFIX + documentId)
  } catch {
    return null
  }
}

export function saveFeynmanConcept(documentId: string, conceptCardId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FEYNMAN_CONCEPT_KEY_PREFIX + documentId, conceptCardId)
  } catch {}
}

export function clearFeynmanConcept(documentId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(FEYNMAN_CONCEPT_KEY_PREFIX + documentId)
  } catch {}
}
