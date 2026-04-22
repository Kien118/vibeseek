import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase' // architect audit 2026-04-18 — verified
import { retrieveContext, retrieveFeynmanContext, streamChatResponse, type ChatMessage } from '@/lib/ai/chat'
import { consume } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface ChatReqBody {
  documentId?: string
  message?: string
  history?: ChatMessage[]
  anonId?: string
  mode?: 'default' | 'feynman'       // P-502
  conceptCardId?: string              // P-502: required if mode='feynman'
  round?: number                      // P-502: 1..3 for feynman
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

// T-407: cap chat_messages rows per (document_id, anon_id) pair, FIFO delete oldest.
const CHAT_HISTORY_CAP = 100 // P-502: bumped from 50 to accommodate Feynman sessions

async function enforceCap(docId: string, anonId: string): Promise<void> {
  const { count, error: countErr } = await supabaseAdmin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', docId)
    .eq('anon_id', anonId)

  if (countErr || !count || count <= CHAT_HISTORY_CAP) return

  const overflow = count - CHAT_HISTORY_CAP
  const { data: victims } = await supabaseAdmin
    .from('chat_messages')
    .select('id')
    .eq('document_id', docId)
    .eq('anon_id', anonId)
    .order('created_at', { ascending: true })
    .limit(overflow)

  if (!victims || victims.length === 0) return

  await supabaseAdmin
    .from('chat_messages')
    .delete()
    .in('id', victims.map(v => v.id))
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

  const mode = body.mode ?? 'default'
  if (mode !== 'default' && mode !== 'feynman') {
    return jsonError(400, 'invalid_mode')
  }
  const conceptCardId = body.conceptCardId
  const round = body.round ?? 1
  if (mode === 'feynman') {
    if (!conceptCardId || typeof conceptCardId !== 'string') {
      return jsonError(400, 'conceptCardId_required')
    }
    if (!Number.isInteger(round) || round < 1 || round > 3) {
      return jsonError(400, 'invalid_round', 'round must be 1, 2, or 3')
    }
  }

  // Rate limit per anonId
  const rl = await consume(`chat:${anonId}`)
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

  // Ensure document exists + has embeddings before we open stream (default mode only)
  if (mode === 'default') {
    const { count: embCount, error: embErr } = await supabaseAdmin
      .from('card_embeddings')
      .select('card_id', { count: 'exact', head: true })
      .eq('document_id', documentId)

    if (embErr) return jsonError(500, 'db_error', embErr.message)
    if (!embCount || embCount === 0) return jsonError(404, 'no_embeddings', 'run /api/embeddings/ensure first')
  }

  // Retrieve context BEFORE opening stream so retrieve errors map to HTTP codes
  let ctx
  try {
    ctx = mode === 'feynman'
      ? await retrieveFeynmanContext(documentId, conceptCardId!)
      : await retrieveContext(documentId, message)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'document_not_found') return jsonError(404, 'document_not_found')
    if (msg === 'concept_card_not_found') return jsonError(404, 'concept_card_not_found')
    if (msg === 'no_embeddings') return jsonError(404, 'no_embeddings')
    console.error('[chat] retrieve failed', err)
    return jsonError(503, 'retrieval_unavailable', msg)
  }

  // Open SSE stream
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = ''
      try {
        // T-407: Persist user message before opening stream (best-effort — don't block on failure).
        const userInsert = await supabaseAdmin.from('chat_messages').insert({
          document_id: documentId,
          anon_id: anonId,
          role: 'user',
          content: message.trim(),
          mode,  // P-502
        })
        if (userInsert.error) {
          console.warn('[chat] user msg persist failed', userInsert.error.message)
        }

        const gen = streamChatResponse(ctx, history, message, { mode, round })
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
          assistantText += value.delta
          controller.enqueue(sseEvent({ delta: value.delta }))
        }

        // T-407: Persist assistant message ONLY on successful completion with content.
        // Reaching here means while-loop broke on `done=true` (not `desiredSize===null` abort).
        if (tokensUsed > 0 && assistantText.length > 0) {
          const asstInsert = await supabaseAdmin.from('chat_messages').insert({
            document_id: documentId,
            anon_id: anonId,
            role: 'assistant',
            content: assistantText,
            mode,  // P-502
          })
          if (asstInsert.error) {
            console.warn('[chat] assistant msg persist failed', asstInsert.error.message)
          }

          // Best-effort cap enforce — don't block SSE close.
          enforceCap(documentId, anonId).catch(err =>
            console.warn('[chat] enforceCap failed', err)
          )
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
