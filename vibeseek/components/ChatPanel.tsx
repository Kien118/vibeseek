'use client'

import { useEffect, useRef, useState } from 'react'
import { getOrCreateAnonId } from '@/utils/anon-id' // architect audit 2026-04-18 — exact export name
import {
  loadHistory, saveHistory, newMessageId, type ChatHistoryMessage,
} from '@/utils/chat-history'

type Phase = 'ensuring' | 'ready' | 'ensure-error' | 'streaming'

interface Props {
  documentId: string
}

export default function ChatPanel({ documentId }: Props) {
  const [phase, setPhase] = useState<Phase>('ensuring')
  const [ensureError, setEnsureError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([])
  const [input, setInput] = useState('')
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Load history once on mount
  useEffect(() => {
    setMessages(loadHistory(documentId))
  }, [documentId])

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

  async function send() {
    const text = input.trim()
    if (!text || phase === 'streaming' || phase !== 'ready') return

    const userMsg: ChatHistoryMessage = {
      id: newMessageId(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
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
                ? 'bg-pink-500 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}>
              {m.content || (streamingId === m.id ? '...' : '')}
            </div>
          </div>
        ))}
      </div>
      <form
        className="border-t border-gray-200 p-3 flex gap-2"
        onSubmit={e => { e.preventDefault(); send() }}
      >
        <input
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 disabled:opacity-50"
          placeholder="Hỏi DOJO điều gì đó về tài liệu..."
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={phase !== 'ready'}
          maxLength={2000}
        />
        <button
          type="submit"
          className="px-4 py-2 bg-pink-500 text-white rounded-lg disabled:opacity-40"
          disabled={phase !== 'ready' || input.trim().length === 0}
        >
          Gửi
        </button>
      </form>
    </div>
  )
}
