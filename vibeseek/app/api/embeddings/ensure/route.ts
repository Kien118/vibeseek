import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'
import { embedTexts } from '@/lib/ai/embeddings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  let body: { documentId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const documentId = body.documentId
  if (!documentId || typeof documentId !== 'string') {
    return NextResponse.json({ error: 'documentId required' }, { status: 400 })
  }

  // Fetch cards for this document
  const { data: cards, error: cardsErr } = await supabaseAdmin
    .from('vibe_cards')
    .select('id, title, content')
    .eq('document_id', documentId)
    .order('order_index', { ascending: true })

  if (cardsErr) {
    console.error('[ensure] cards query error', cardsErr)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }
  if (!cards || cards.length === 0) {
    return NextResponse.json({ error: 'no_cards_for_document' }, { status: 404 })
  }

  // Check which cards already have embeddings
  const { data: existing, error: existErr } = await supabaseAdmin
    .from('card_embeddings')
    .select('card_id')
    .eq('document_id', documentId)

  if (existErr) {
    console.error('[ensure] existing query error', existErr)
    return NextResponse.json({ error: 'db_error' }, { status: 500 })
  }

  const existingIds = new Set((existing ?? []).map(r => r.card_id))
  const missing = cards.filter(c => !existingIds.has(c.id))

  if (missing.length === 0) {
    return NextResponse.json({ ready: true, count: cards.length, generated: 0 })
  }

  // Generate embeddings for missing cards
  const texts = missing.map(c => `${c.title}\n${c.content}`)
  let vectors: number[][]
  try {
    vectors = await embedTexts(texts)
  } catch (err) {
    console.error('[ensure] embed failed', err)
    return NextResponse.json(
      { error: 'embedding_unavailable', detail: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    )
  }

  // Insert — pgvector accepts array-as-JSON via supabase-js when column type is vector.
  // Use "upsert onConflict: card_id ignoreDuplicates" in case of race.
  const rows = missing.map((card, idx) => ({
    card_id: card.id,
    document_id: documentId,
    embedding: vectors[idx] as unknown as string, // supabase-js serializes as JSON, postgres casts to vector
  }))

  const { error: insertErr } = await supabaseAdmin
    .from('card_embeddings')
    .upsert(rows, { onConflict: 'card_id', ignoreDuplicates: true })

  if (insertErr) {
    console.error('[ensure] insert failed', insertErr)
    return NextResponse.json({ error: 'db_insert_error', detail: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    ready: true,
    count: cards.length,
    generated: missing.length,
  })
}
