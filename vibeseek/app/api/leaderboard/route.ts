import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 20)))

  const { data, error } = await supabaseAdmin
    .from('leaderboard_profiles')
    .select('anon_id, display_name, total_points, quiz_correct_count')
    .order('total_points', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    top: (data || []).map((p, idx) => ({
      rank: idx + 1,
      anonId: p.anon_id,
      displayName: p.display_name,
      totalPoints: p.total_points,
      quizCorrectCount: p.quiz_correct_count,
    })),
  })
}
