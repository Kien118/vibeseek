import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'
import { generateQuizzesForCards } from '@/lib/ai/quiz'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json()
    if (!documentId) {
      return NextResponse.json({ error: 'documentId required' }, { status: 400 })
    }

    // 1. Load cards for document (ordered)
    const { data: cards, error: cardsErr } = await supabaseAdmin
      .from('vibe_cards')
      .select('id, title, content, order_index')
      .eq('document_id', documentId)
      .order('order_index', { ascending: true })

    if (cardsErr) throw cardsErr
    if (!cards || cards.length === 0) {
      return NextResponse.json({ error: 'document not found or empty' }, { status: 404 })
    }

    // 2. Check existing quiz
    const cardIds = cards.map((c) => c.id)
    const { data: existing } = await supabaseAdmin
      .from('quiz_questions')
      .select('id, card_id, question, options, correct_index, explanation')
      .in('card_id', cardIds)

    if (existing && existing.length >= cards.length) {
      // All cards already have quizzes — return existing
      return NextResponse.json({ success: true, generated: false, questions: existing })
    }

    // 3. Generate for cards missing quiz
    const existingCardIds = new Set((existing || []).map((q) => q.card_id))
    const missingCards = cards.filter((c) => !existingCardIds.has(c.id))

    const drafts = await generateQuizzesForCards(
      missingCards.map((c) => ({ title: c.title, content: c.content }))
    )

    // 4. Insert into quiz_questions
    const rows = drafts.map((d, idx) => ({
      card_id: missingCards[idx].id,
      question: d.question,
      options: d.options,
      correct_index: d.correct_index,
      explanation: d.explanation,
    }))
    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('quiz_questions')
      .insert(rows)
      .select('id, card_id, question, options, correct_index, explanation')
    if (insertErr) throw insertErr

    // 5. Merge with existing, return all questions for this document
    const all = [...(existing || []), ...(inserted || [])]
    return NextResponse.json({ success: true, generated: true, questions: all })
  } catch (err) {
    console.error('[quiz/generate]', err)
    const detail = err instanceof Error ? err.message : String(err)
    const status =
      detail.toLowerCase().includes('gemini') || detail.toLowerCase().includes('groq')
        ? 503
        : 500
    return NextResponse.json({ error: 'Quiz generation failed', detail }, { status })
  }
}
