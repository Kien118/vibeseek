import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'
import { consume } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Separate rate-limit key from POST /api/chat so mount-time hydrate doesn't
// eat into the user's send budget. Higher limit since this is read-only.
const HISTORY_RATE_LIMIT = 30
const HISTORY_RATE_WINDOW_MS = 60_000
const HISTORY_FETCH_LIMIT = 50

function jsonError(status: number, code: string, detail?: string) {
  return new Response(JSON.stringify({ error: code, detail }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const documentId = url.searchParams.get('documentId')
  const anonId = url.searchParams.get('anonId')

  if (!documentId) return jsonError(400, 'documentId_required')
  if (!anonId) return jsonError(400, 'anonId_required')

  const rl = consume(`chat-history:${anonId}`, HISTORY_RATE_LIMIT, HISTORY_RATE_WINDOW_MS)
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

  const { data, error } = await supabaseAdmin
    .from('chat_messages')
    .select('id, role, content, created_at')
    .eq('document_id', documentId)
    .eq('anon_id', anonId)
    .order('created_at', { ascending: true })
    .limit(HISTORY_FETCH_LIMIT)

  if (error) return jsonError(500, 'db_error', error.message)

  const messages = (data ?? []).map(row => ({
    id: row.id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    createdAt: new Date(row.created_at).getTime(),
  }))

  return new Response(JSON.stringify({ messages }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
