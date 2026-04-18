export interface ChatHistoryMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

const KEY_PREFIX = 'vibeseek:chat:'

export function loadHistory(documentId: string): ChatHistoryMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + documentId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(m =>
      m && typeof m.id === 'string' && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string',
    )
  } catch {
    return []
  }
}

export function saveHistory(documentId: string, messages: ChatHistoryMessage[]): void {
  if (typeof window === 'undefined') return
  try {
    // Cap at 50 messages to avoid localStorage bloat
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
