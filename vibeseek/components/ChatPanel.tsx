'use client'

import { useEffect, useRef, useState } from 'react'
import { getOrCreateAnonId, peekAnonId } from '@/utils/anon-id' // architect audit 2026-04-18 — exact export names
import {
  loadHistory, saveHistory, newMessageId, type ChatHistoryMessage,
  loadFeynmanConcept, saveFeynmanConcept, clearFeynmanConcept,
} from '@/utils/chat-history'

type Phase = 'ensuring' | 'ready' | 'ensure-error' | 'streaming'

interface Props {
  documentId: string
  cards?: Array<{ id: string; title: string }> // P-502: needed for concept picker
  initialMode?: 'default' | 'feynman'          // P-502: set by caller when user clicks "Feynman" button on card
  initialConceptCardId?: string                 // P-502: card user clicked
}

export default function ChatPanel({ documentId, cards, initialMode, initialConceptCardId }: Props) {
  const [phase, setPhase] = useState<Phase>('ensuring')
  const [ensureError, setEnsureError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([])
  const [input, setInput] = useState('')
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const hasInteractedRef = useRef(false)
  const [mode, setMode] = useState<'default' | 'feynman'>(initialMode ?? 'default')
  const [conceptCardId, setConceptCardId] = useState<string | null>(initialConceptCardId ?? null)
  const [round, setRound] = useState(1) // 1..3 in Feynman mode, unused in default
  const [needConceptPicker, setNeedConceptPicker] = useState(false)

  // T-407 hydrate strategy:
  //   Fast path: paint localStorage cache immediately (no flash-of-empty).
  //   Slow path: fetch DB authoritative history; replace cache if user hasn't
  //              interacted yet. localStorage is write-through cache for next mount.
  useEffect(() => {
    let ignore = false
    hasInteractedRef.current = false  // reset per doc (route change may not remount)
    const cached = loadHistory(documentId)
    if (cached.length > 0) setMessages(cached)

    const anonId = peekAnonId()
    if (!anonId) return () => { ignore = true }

    const qs = new URLSearchParams({ documentId, anonId }).toString()
    fetch(`/api/chat/history?${qs}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (ignore) return
        if (hasInteractedRef.current) return  // user already typed — don't clobber
        if (data && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages)
          saveHistory(documentId, data.messages)  // write-through cache
        }
      })
      .catch(err => {
        console.warn('[chat] history fetch failed, using localStorage cache', err)
      })

    return () => { ignore = true }
  }, [documentId])

  // P-502: Hydrate Feynman concept from localStorage on mount
  useEffect(() => {
    if (mode === 'feynman' && !conceptCardId) {
      const saved = loadFeynmanConcept(documentId)
      if (saved) setConceptCardId(saved)
    }
  }, [documentId, mode, conceptCardId])

  // Ensure embeddings on mount (idempotent)
  useEffect(() => {
    let ignore = false
    setPhase('ensuring')
    setEnsureError(null)

    fetch('/api/embeddings/ensure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId }),
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}))
        if (ignore) return
        if (!res.ok) {
          setEnsureError(data.error || `HTTP ${res.status}`)
          setPhase('ensure-error')
          return
        }
        setPhase('ready')
      })
      .catch(err => {
        if (ignore) return
        setEnsureError(err instanceof Error ? err.message : String(err))
        setPhase('ensure-error')
      })

    return () => { ignore = true }
  }, [documentId])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamingId])

  // Persist history on change
  useEffect(() => {
    saveHistory(documentId, messages)
  }, [documentId, messages])

  const handleToggleMode = (nextMode: 'default' | 'feynman') => {
    if (nextMode === 'feynman') {
      const picked = conceptCardId ?? loadFeynmanConcept(documentId)
      if (!picked) {
        setNeedConceptPicker(true)
        return
      }
      startFeynmanSession(picked)
    } else {
      setMode('default')
      setRound(1)
      setNeedConceptPicker(false)
      clearFeynmanConcept(documentId)
    }
  }

  const startFeynmanSession = (cardId: string) => {
    const card = cards?.find(c => c.id === cardId)
    const conceptTitle = card?.title ?? 'concept này'
    saveFeynmanConcept(documentId, cardId)
    setConceptCardId(cardId)
    setMode('feynman')
    setRound(1)
    setNeedConceptPicker(false)

    // Inject opening template as first assistant message (client-side only — NOT persisted to DB).
    const openingText = `Ok! Hôm nay tôi giả vờ là đứa bé lớp 5 chưa biết gì về **${conceptTitle}**. Hãy giải thích ${conceptTitle} cho tôi theo cách đơn giản nhất — như thể đang kể chuyện. Đừng dùng từ kỹ thuật, hãy dùng ví dụ đời thường nếu có. Tôi sẽ hỏi lại nếu chỗ nào tôi chưa hiểu. 🥋`

    const opening: ChatHistoryMessage = {
      id: newMessageId(),
      role: 'assistant',
      content: openingText,
      createdAt: Date.now(),
      mode: 'feynman',
    }
    setMessages(prev => [...prev, opening])
  }

  async function send() {
    const text = input.trim()
    if (!text || phase === 'streaming' || phase !== 'ready') return
    // Feynman mode: block input after round 3
    if (mode === 'feynman' && round > 3) return
    hasInteractedRef.current = true  // T-407: lock out DB hydrate overwrite

    const userMsg: ChatHistoryMessage = {
      id: newMessageId(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
      mode: mode === 'feynman' ? 'feynman' : undefined,
    }
    const assistantId = newMessageId()
    const historyForApi = messages.map(m => ({ role: m.role, content: m.content })) // keep full history; server trims

    setMessages(prev => [
      ...prev,
      userMsg,
      { id: assistantId, role: 'assistant', content: '', createdAt: Date.now() },
    ])
    setInput('')
    setStreamingId(assistantId)
    setPhase('streaming')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          message: text,
          history: historyForApi,
          anonId: getOrCreateAnonId() ?? 'anon-unknown',
          // P-502 extensions:
          mode,
          ...(mode === 'feynman' ? { conceptCardId, round } : {}),
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        const errText = `Lỗi: ${errBody.error || res.status}${errBody.detail ? ' — ' + errBody.detail : ''}`
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: errText } : m))
        return
      }

      if (!res.body) {
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: '⚠️ Không đọc được stream' } : m))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let done = false
      let assistantText = ''

      while (!done) {
        const { value, done: rDone } = await reader.read()
        done = rDone
        if (value) buf += decoder.decode(value, { stream: true })

        // Parse SSE events separated by \n\n
        let idx
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const rawEvent = buf.slice(0, idx)
          buf = buf.slice(idx + 2)
          const line = rawEvent.split('\n').find(l => l.startsWith('data: '))
          if (!line) continue
          try {
            const payload = JSON.parse(line.slice(6))
            if (payload.error) {
              assistantText += `\n\n⚠️ ${payload.error}`
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantText } : m))
              done = true
              break
            }
            if (payload.delta) {
              assistantText += payload.delta
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: assistantText } : m))
            }
            if (payload.done) { done = true; break }
          } catch { /* ignore malformed line */ }
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        const msg = err instanceof Error ? err.message : String(err)
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: `⚠️ ${msg}` } : m))
      }
    } finally {
      // After successful round in Feynman mode, increment for next send
      if (mode === 'feynman' && round <= 3) {
        setRound(prev => prev + 1)
      }
      abortRef.current = null
      setStreamingId(null)
      setPhase('ready')
    }
  }

  // Cleanup: abort in-flight on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  return (
    <div className="flex flex-col h-[70vh] bg-white rounded-xl shadow-sm border border-gray-200">
      {/* P-502: Mode toggle header */}
      <div className={`border-b px-4 py-2 flex items-center justify-between ${mode === 'feynman' ? 'border-lime-300 bg-lime-50' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center gap-2 text-xs">
          {mode === 'feynman' && (
            <span className="font-mono text-lime-700">🥋 FEYNMAN DOJO • Round {Math.min(round, 3)}/3</span>
          )}
          {mode === 'default' && (
            <span className="font-mono text-gray-500">DEFAULT CHAT</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <button
            className={`px-2 py-0.5 rounded ${mode === 'default' ? 'bg-pink-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            onClick={() => handleToggleMode('default')}
          >Default</button>
          <button
            className={`px-2 py-0.5 rounded ${mode === 'feynman' ? 'bg-lime-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            onClick={() => handleToggleMode('feynman')}
          >🥋 Feynman</button>
        </div>
      </div>

      {/* P-502: Concept picker overlay */}
      {needConceptPicker && (
        <div className="px-4 py-3 border-b border-lime-300 bg-lime-50">
          <p className="text-sm mb-2 text-gray-700">Bạn muốn ôn concept nào?</p>
          <div className="flex flex-wrap gap-2">
            {(cards ?? []).length === 0 && (
              <p className="text-xs text-gray-500">Chưa có card nào. Quay lại dashboard để upload.</p>
            )}
            {(cards ?? []).slice(0, 8).map(c => (
              <button
                key={c.id}
                className="px-3 py-1 text-xs rounded-full border border-lime-400 text-lime-800 hover:bg-lime-100"
                onClick={() => startFeynmanSession(c.id)}
              >🥋 {c.title}</button>
            ))}
            <button
              className="px-3 py-1 text-xs rounded-full text-gray-500"
              onClick={() => setNeedConceptPicker(false)}
            >Hủy</button>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {phase === 'ensuring' && (
          <p className="text-gray-500 text-sm">⏳ Đang chuẩn bị bộ nhớ cho DOJO...</p>
        )}
        {phase === 'ensure-error' && (
          <div className="text-red-600 text-sm">
            ⚠️ Không chuẩn bị được embeddings: {ensureError}.
            <button
              className="ml-2 underline"
              onClick={() => window.location.reload()}
            >
              Thử lại
            </button>
          </div>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            className={m.role === 'user' ? 'text-right' : 'text-left'}
          >
            <div className={`inline-block max-w-[80%] px-3 py-2 rounded-lg whitespace-pre-wrap ${
              m.role === 'user'
                ? (m.mode === 'feynman' ? 'bg-lime-500 text-white' : 'bg-pink-500 text-white')
                : 'bg-gray-100 text-gray-900'
            }`}>
              {m.content || (streamingId === m.id ? '...' : '')}
            </div>
          </div>
        ))}
      </div>

      {/* P-502: Session complete CTA */}
      {mode === 'feynman' && round > 3 && (
        <div className="px-4 py-3 border-t border-lime-300 bg-lime-50 flex items-center justify-between text-xs">
          <span className="text-lime-800">🥋 Session hoàn tất!</span>
          <div className="flex gap-2">
            <button
              className="px-3 py-1 rounded border border-lime-500 text-lime-700 hover:bg-lime-100"
              onClick={() => { clearFeynmanConcept(documentId); setNeedConceptPicker(true) }}
            >Concept khác</button>
            <button
              className="px-3 py-1 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
              onClick={() => handleToggleMode('default')}
            >Chat thường</button>
          </div>
        </div>
      )}

      <form
        className="border-t border-gray-200 p-3 flex gap-2"
        onSubmit={e => { e.preventDefault(); send() }}
      >
        <input
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 disabled:opacity-50"
          placeholder={mode === 'feynman' ? 'Giải thích concept cho DOJO...' : 'Hỏi DOJO điều gì đó về tài liệu...'}
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={phase !== 'ready'}
          maxLength={2000}
        />
        <button
          type="submit"
          className={`px-4 py-2 text-white rounded-lg disabled:opacity-40 ${mode === 'feynman' ? 'bg-lime-500' : 'bg-pink-500'}`}
          disabled={phase !== 'ready' || input.trim().length === 0 || (mode === 'feynman' && round > 3)}
        >
          {mode === 'feynman' && round > 3 ? 'Xong' : 'Gửi'}
        </button>
      </form>
    </div>
  )
}
