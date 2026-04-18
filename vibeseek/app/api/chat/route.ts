import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase' // architect audit 2026-04-18 — verified
import { retrieveContext, streamChatResponse, type ChatMessage } from '@/lib/ai/chat'
import { consume } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface ChatReqBody {
  documentId?: string
  message?: string
  history?: ChatMessage[]
  anonId?: string
}

function sseEvent(payload: unknown): Uint8Array {
  const text = `data: ${JSON.stringify(payload)}\n\n`
  return new TextEncoder().encode(text)
}

function jsonError(status: number, code: string, detail?: string) {
  return new Response(JSON.stringify({ error: code, detail }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(req: NextRequest) {
  let body: ChatReqBody
  try {
    body = await req.json()
  } catch {
    return jsonError(400, 'invalid_json')
  }

  const { documentId, message, history = [], anonId } = body

  if (!documentId || typeof documentId !== 'string') {
    return jsonError(400, 'documentId_required')
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return jsonError(400, 'message_required')
  }
  if (message.length > 2000) {
    return jsonError(400, 'message_too_long', 'max 2000 chars')
  }
  if (!anonId || typeof anonId !== 'string') {
    return jsonError(400, 'anonId_required')
  }
  if (!Array.isArray(history)) {
    return jsonError(400, 'history_must_be_array')
  }

  // Rate limit per anonId
  const rl = consume(`chat:${anonId}`)
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ error: 'rate_limited', retryAfterMs: rl.retryAfterMs }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)),
        },
      },
    )
  }

  // Ensure document exists + has embeddings before we open stream
  const { count: embCount, error: embErr } = await supabaseAdmin
    .from('card_embeddings')
    .select('card_id', { count: 'exact', head: true })
    .eq('document_id', documentId)

  if (embErr) return jsonError(500, 'db_error', embErr.message)
  if (!embCount || embCount === 0) return jsonError(404, 'no_embeddings', 'run /api/embeddings/ensure first')

  // Retrieve context BEFORE opening stream so retrieve errors map to HTTP codes
  let ctx
  try {
    ctx = await retrieveContext(documentId, message)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'document_not_found') return jsonError(404, 'document_not_found')
    if (msg === 'no_embeddings') return jsonError(404, 'no_embeddings')
    console.error('[chat] retrieve failed', err)
    return jsonError(503, 'retrieval_unavailable', msg)
  }

  // Open SSE stream
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const gen = streamChatResponse(ctx, history, message)
        let tokensUsed = 0
        while (true) {
          const { value, done } = await gen.next()
          if (done) {
            tokensUsed = (value && 'tokensUsed' in value) ? value.tokensUsed : 0
            break
          }
          // Backpressure / disconnect guard: client may have closed reader.
          // `desiredSize === null` means the stream has been cancelled.
          if (controller.desiredSize === null) {
            await gen.return?.(undefined as never)
            return
          }
          controller.enqueue(sseEvent({ delta: value.delta }))
        }
        controller.enqueue(sseEvent({ done: true, tokensUsed }))
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[chat] stream failed', err)
        try {
          controller.enqueue(sseEvent({ error: msg, done: true }))
        } catch {}
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
