import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const VN_TZ = 'Asia/Ho_Chi_Minh'

function isoDateInVN(d: Date): string {
  // Format YYYY-MM-DD in VN timezone via Intl
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: VN_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
  return fmt.format(d)
}

function startOfIsoWeekVN(today: Date): Date {
  // ISO week: Monday-anchored. Compute Monday of current week in VN tz.
  const todayIso = isoDateInVN(today)
  const [y, m, d] = todayIso.split('-').map(Number)
  const utcMid = new Date(Date.UTC(y, m - 1, d))
  const dow = utcMid.getUTCDay() // 0 Sun..6 Sat
  const offset = dow === 0 ? -6 : 1 - dow
  return new Date(Date.UTC(y, m - 1, d + offset))
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const anonId = url.searchParams.get('anonId')
  if (!anonId) {
    return NextResponse.json({ error: 'anonId required' }, { status: 400 })
  }

  const docIdsRaw = url.searchParams.get('docIds') ?? ''
  const docIds = docIdsRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
    .slice(0, 50)

  // Ensure profile row exists (mirrors /api/leaderboard/profile upsert pattern)
  await supabaseAdmin
    .from('leaderboard_profiles')
    .upsert({ anon_id: anonId }, { onConflict: 'anon_id', ignoreDuplicates: true })

  const [profileRes, leaderboardRes, latestDocRes, recentCardsRes, quizDatesRes, chatDatesRes] = await Promise.all([
    supabaseAdmin
      .from('leaderboard_profiles')
      .select('display_name, total_points, quiz_correct_count, documents_count')
      .eq('anon_id', anonId)
      .single(),
    supabaseAdmin
      .from('leaderboard_profiles')
      .select('anon_id, display_name, total_points')
      .order('total_points', { ascending: false })
      .limit(20),
    docIds.length > 0
      ? supabaseAdmin
          .from('vibe_documents')
          .select('id, title, total_cards, created_at')
          .in('id', docIds)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    docIds.length > 0
      ? supabaseAdmin
          .from('vibe_cards')
          .select('id, document_id, card_type, title, content, emoji, tags, vibe_points, created_at')
          .in('document_id', docIds)
          .order('created_at', { ascending: false })
          .order('id')
          .limit(4)
      : Promise.resolve({ data: [], error: null }),
    // Activity: distinct quiz_attempt dates last 30 days for this anonId
    supabaseAdmin
      .from('quiz_attempts')
      .select('created_at')
      .eq('anon_id', anonId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    // Activity: distinct chat_message dates last 30 days for this anonId
    // (T-407 adds anon_id column → direct filter, no doc-scope needed)
    supabaseAdmin
      .from('chat_messages')
      .select('created_at')
      .eq('anon_id', anonId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const profile = profileRes.data
  if (profileRes.error || !profile) {
    return NextResponse.json({ error: profileRes.error?.message ?? 'profile not found' }, { status: 500 })
  }

  // Has-video check (separate, cheap, can return early if no latest doc)
  let hasVideo = false
  if (latestDocRes.data) {
    const { data: jobRow } = await supabaseAdmin
      .from('render_jobs')
      .select('id')
      .eq('document_id', latestDocRes.data.id)
      .eq('status', 'ready')
      .limit(1)
      .maybeSingle()
    hasVideo = !!jobRow
  }

  // Compute activity dates set + streak
  const today = new Date()
  const todayIso = isoDateInVN(today)
  const allDates = new Set<string>()
  ;(quizDatesRes.data ?? []).forEach((r: { created_at: string }) => allDates.add(isoDateInVN(new Date(r.created_at))))
  ;(chatDatesRes.data ?? []).forEach((r: { created_at: string }) => allDates.add(isoDateInVN(new Date(r.created_at))))
  const doneDates = Array.from(allDates).sort()

  // Streak: count back from today while consecutive
  let streakDays = 0
  if (allDates.has(todayIso)) {
    streakDays = 1
    for (let i = 1; i < 30; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      if (allDates.has(isoDateInVN(d))) streakDays++
      else break
    }
  }

  // Weekly: count distinct dates in current ISO week
  const weekStart = startOfIsoWeekVN(today)
  let weeklyDone = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart)
    d.setUTCDate(weekStart.getUTCDate() + i)
    if (allDates.has(isoDateInVN(d))) weeklyDone++
  }

  // Month size for streak grid
  const [yy, mm] = todayIso.split('-').map(Number)
  const monthDays = new Date(yy, mm, 0).getDate() // mm is 1-based; new Date(y, m, 0) = last day of m

  // Leaderboard: top 3 + always include current user
  const all = leaderboardRes.data ?? []
  const myIdx = all.findIndex((r) => r.anon_id === anonId)
  const myRow = myIdx >= 0
    ? { rank: myIdx + 1, anonId: all[myIdx].anon_id, displayName: all[myIdx].display_name, totalPoints: all[myIdx].total_points, isMe: true }
    : { rank: -1, anonId, displayName: profile.display_name, totalPoints: profile.total_points, isMe: true }
  const topRows = all.slice(0, 3).map((r, i) => ({
    rank: i + 1,
    anonId: r.anon_id,
    displayName: r.display_name,
    totalPoints: r.total_points,
    isMe: r.anon_id === anonId,
  }))
  const leaderboardTop = topRows.some((r) => r.isMe) ? topRows : [...topRows, myRow]

  return NextResponse.json({
    profile: {
      displayName: profile.display_name,
      totalPoints: profile.total_points,
      quizCorrectCount: profile.quiz_correct_count,
      documentsCount: (profile as { documents_count?: number }).documents_count ?? 0,
    },
    activity: {
      streakDays,
      doneDates,
      monthDays,
      todayIso,
      weeklyTarget: 7,
      weeklyDone,
    },
    latestDoc: latestDocRes.data
      ? {
          documentId: latestDocRes.data.id,
          title: latestDocRes.data.title,
          totalCards: latestDocRes.data.total_cards ?? 0,
          hasVideo,
          createdAt: latestDocRes.data.created_at,
        }
      : null,
    recentCards: (recentCardsRes.data ?? []).map((c) => ({
      id: c.id,
      documentId: c.document_id,
      cardType: c.card_type,
      title: c.title,
      content: c.content,
      emoji: c.emoji,
      tags: c.tags ?? [],
      vibePoints: c.vibe_points,
    })),
    leaderboardTop,
  })
}
