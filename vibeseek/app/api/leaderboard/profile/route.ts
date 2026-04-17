import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const anonId = new URL(request.url).searchParams.get('anonId')
  if (!anonId) return NextResponse.json({ error: 'anonId required' }, { status: 400 })

  // Upsert ensures the row exists for first-time visitors.
  await supabaseAdmin
    .from('leaderboard_profiles')
    .upsert({ anon_id: anonId }, { onConflict: 'anon_id', ignoreDuplicates: true })

  const { data, error } = await supabaseAdmin
    .from('leaderboard_profiles')
    .select('anon_id, display_name, total_points, quiz_correct_count, documents_count')
    .eq('anon_id', anonId)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}

export async function PATCH(request: NextRequest) {
  const { anonId, displayName } = await request.json()
  if (!anonId || typeof displayName !== 'string') {
    return NextResponse.json({ error: 'anonId + displayName required' }, { status: 400 })
  }
  const trimmed = displayName.trim().slice(0, 40)
  if (trimmed.length < 1) {
    return NextResponse.json({ error: 'displayName too short' }, { status: 400 })
  }
  const { error } = await supabaseAdmin
    .from('leaderboard_profiles')
    .upsert({ anon_id: anonId, display_name: trimmed, updated_at: new Date().toISOString() }, { onConflict: 'anon_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, displayName: trimmed })
}
