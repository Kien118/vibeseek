import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { anonId, questionId, selectedIndex, displayName } = body as {
      anonId?: string
      questionId?: string
      selectedIndex?: number
      displayName?: string
    }

    if (!anonId || !questionId || typeof selectedIndex !== 'number') {
      return NextResponse.json(
        { error: 'anonId, questionId, selectedIndex required' },
        { status: 400 }
      )
    }

    // 1. Load question (with card → vibe_points)
    const { data: question, error: qErr } = await supabaseAdmin
      .from('quiz_questions')
      .select('id, correct_index, explanation, card_id, vibe_cards(vibe_points)')
      .eq('id', questionId)
      .single()
    if (qErr || !question) {
      return NextResponse.json({ error: 'question not found' }, { status: 404 })
    }

    const correct = selectedIndex === question.correct_index
    const cardPoints =
      (question.vibe_cards as unknown as { vibe_points?: number } | null)?.vibe_points ?? 10
    const pointsEarned = correct ? cardPoints : 0

    // 2. Upsert profile (idempotent; creates row first time, updates display_name if provided)
    const profileUpdate: Record<string, unknown> = { anon_id: anonId }
    if (displayName && displayName.trim().length > 0) {
      profileUpdate.display_name = displayName.trim().slice(0, 40)
    }
    const { error: upsertErr } = await supabaseAdmin
      .from('leaderboard_profiles')
      .upsert(profileUpdate, { onConflict: 'anon_id', ignoreDuplicates: false })
    if (upsertErr) throw upsertErr

    // 3. Try insert attempt (UNIQUE on anon_id + question_id)
    const { error: attemptErr } = await supabaseAdmin
      .from('quiz_attempts')
      .insert({
        anon_id: anonId,
        question_id: questionId,
        selected_index: selectedIndex,
        is_correct: correct,
        points_earned: pointsEarned,
      })

    const alreadyAttempted =
      attemptErr?.code === '23505' /* unique_violation */ ||
      (attemptErr?.message || '').toLowerCase().includes('duplicate')

    if (attemptErr && !alreadyAttempted) throw attemptErr

    // 4. If first attempt + correct → bump profile totals (JS fallback, no RPC)
    if (!alreadyAttempted && correct) {
      const { data: cur } = await supabaseAdmin
        .from('leaderboard_profiles')
        .select('total_points, quiz_correct_count')
        .eq('anon_id', anonId)
        .single()
      await supabaseAdmin
        .from('leaderboard_profiles')
        .update({
          total_points: (cur?.total_points ?? 0) + pointsEarned,
          quiz_correct_count: (cur?.quiz_correct_count ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('anon_id', anonId)
    }

    // 5. Return latest totals
    const { data: profile } = await supabaseAdmin
      .from('leaderboard_profiles')
      .select('total_points')
      .eq('anon_id', anonId)
      .single()

    return NextResponse.json({
      correct,
      pointsEarned: alreadyAttempted ? 0 : pointsEarned,
      correctIndex: question.correct_index,
      explanation: question.explanation,
      newTotalPoints: profile?.total_points ?? 0,
      alreadyAttempted,
    })
  } catch (err) {
    console.error('[quiz/submit]', err)
    return NextResponse.json(
      { error: 'Submit failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
