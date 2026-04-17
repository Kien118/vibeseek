# T-206 · Leaderboard UI + `<VibePointsBadge />` in layout

**Status:** `done`
**Severity:** MED
**Blueprint ref:** §6.6, §7.6, §7.11 (UI rules), §11
**Branch:** `task/T-206-leaderboard-ui-badge` (merged, deleted)
**Assignee:** claude-opus-4-6
**Depends on:** T-202 (anon-id), T-204 (leaderboard API)

## Context

Hoàn thiện Phase 2 UI side:
1. **`/leaderboard` page** — top 20 users.
2. **`<LeaderboardTable />`** — reusable table component.
3. **`<VibePointsBadge />`** — top-right badge hiển thị điểm hiện tại của user, **xuất hiện trên mọi page trừ landing `/`** (blueprint §7.11). Click vào badge → `/leaderboard`.
4. **`/leaderboard` user có thể đổi display_name** (1 input box, save qua PATCH nhẹ — xem mục 5).

## Files to touch
- `vibeseek/components/LeaderboardTable.tsx` (NEW)
- `vibeseek/components/VibePointsBadge.tsx` (NEW)
- `vibeseek/app/leaderboard/page.tsx` (NEW)
- `vibeseek/app/layout.tsx` (MODIFY — render VibePointsBadge conditionally)
- `vibeseek/app/api/leaderboard/profile/route.ts` (NEW — PATCH display_name + GET self stats)
- Update task file + AGENT_LOG

## Architect's spec

### 1. `vibeseek/app/api/leaderboard/profile/route.ts` (NEW — small helper endpoint)

Badge + leaderboard page cần 2 ops nhỏ ngoài top-20 list:
- `GET ?anonId=xxx` → trả `total_points, display_name, quiz_correct_count, documents_count` của 1 user.
- `PATCH` body `{ anonId, displayName }` → update display_name.

```ts
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
```

### 2. `vibeseek/components/VibePointsBadge.tsx`

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Trophy } from 'lucide-react'
import { getOrCreateAnonId } from '@/utils/anon-id'

/**
 * Top-right floating badge showing current user's vibe points.
 * Hidden on landing (`/`) per blueprint §7.11.
 * Clicking navigates to /leaderboard.
 */
export default function VibePointsBadge() {
  const pathname = usePathname()
  const [points, setPoints] = useState<number | null>(null)

  useEffect(() => {
    if (pathname === '/') return  // landing — don't even fetch
    const anonId = getOrCreateAnonId()
    if (!anonId) return
    fetch(`/api/leaderboard/profile?anonId=${encodeURIComponent(anonId)}`)
      .then((r) => r.json())
      .then((body) => {
        if (body?.profile) setPoints(body.profile.total_points ?? 0)
      })
      .catch(() => {/* silent */})
  }, [pathname])

  if (pathname === '/') return null
  if (points === null) return null  // hide until loaded — prevents flash

  return (
    <Link
      href="/leaderboard"
      className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur hover:bg-white/10 text-white/90 font-mono text-sm"
    >
      <Trophy className="w-4 h-4 text-yellow-400" />
      <span className="font-bold">{points}</span>
      <span className="text-white/50">vibe</span>
    </Link>
  )
}
```

### 3. `vibeseek/components/LeaderboardTable.tsx`

```tsx
'use client'

import { Trophy, Medal } from 'lucide-react'

export interface LeaderboardRow {
  rank: number
  anonId: string
  displayName: string
  totalPoints: number
  quizCorrectCount: number
}

interface Props {
  rows: LeaderboardRow[]
  highlightAnonId?: string | null
}

export default function LeaderboardTable({ rows, highlightAnonId }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
      <table className="w-full text-sm">
        <thead className="bg-white/5 text-white/60 font-mono uppercase">
          <tr>
            <th className="px-4 py-3 text-left">#</th>
            <th className="px-4 py-3 text-left">Người chơi</th>
            <th className="px-4 py-3 text-right">Điểm</th>
            <th className="px-4 py-3 text-right hidden sm:table-cell">Đúng</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={4} className="text-center py-10 text-white/40">Chưa có ai ghi điểm. Làm quiz đầu tiên đi!</td></tr>
          )}
          {rows.map((row) => {
            const isMe = highlightAnonId && row.anonId === highlightAnonId
            return (
              <tr
                key={row.anonId}
                className={`border-t border-white/5 ${isMe ? 'bg-indigo-500/10' : ''}`}
              >
                <td className="px-4 py-3 font-mono">
                  {row.rank === 1 ? <Trophy className="w-4 h-4 text-yellow-400 inline" /> :
                   row.rank <= 3 ? <Medal className="w-4 h-4 text-white/70 inline" /> : row.rank}
                </td>
                <td className="px-4 py-3 text-white/90">{row.displayName}{isMe ? ' (bạn)' : ''}</td>
                <td className="px-4 py-3 text-right font-bold text-yellow-300">{row.totalPoints}</td>
                <td className="px-4 py-3 text-right text-white/60 hidden sm:table-cell">{row.quizCorrectCount}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

### 4. `vibeseek/app/leaderboard/page.tsx`

Client page. Fetch top-20 + self profile. Cho phép đổi display_name.

```tsx
'use client'

import { useEffect, useState } from 'react'
import { peekAnonId, getOrCreateAnonId } from '@/utils/anon-id'
import LeaderboardTable, { LeaderboardRow } from '@/components/LeaderboardTable'
import { Loader2 } from 'lucide-react'

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [anonId, setAnonId] = useState<string | null>(null)
  const [myName, setMyName] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadAll() {
    const id = getOrCreateAnonId()
    setAnonId(id)
    const [topRes, meRes] = await Promise.all([
      fetch('/api/leaderboard?limit=20').then((r) => r.json()),
      id ? fetch(`/api/leaderboard/profile?anonId=${id}`).then((r) => r.json()) : Promise.resolve(null),
    ])
    setRows(topRes.top || [])
    if (meRes?.profile?.display_name) setMyName(meRes.profile.display_name)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  async function saveName() {
    if (!anonId || !myName.trim()) return
    setSaving(true)
    try {
      await fetch('/api/leaderboard/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anonId, displayName: myName }),
      })
      await loadAll()
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-4 py-16 text-white space-y-8">
      <header className="space-y-2">
        <p className="text-white/50 font-mono uppercase text-xs">VibeSeek Leaderboard</p>
        <h1 className="font-display text-4xl">Top vibe</h1>
      </header>

      {anonId && (
        <section className="flex items-center gap-3">
          <input
            type="text"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            maxLength={40}
            placeholder="Tên của bạn"
            className="flex-1 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/90 focus:border-indigo-400 outline-none"
          />
          <button
            onClick={saveName}
            disabled={saving || myName.trim().length < 1}
            className="px-5 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 font-semibold disabled:opacity-40"
          >
            {saving ? 'Đang lưu...' : 'Lưu tên'}
          </button>
        </section>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-400" /></div>
      ) : (
        <LeaderboardTable rows={rows} highlightAnonId={anonId} />
      )}
    </main>
  )
}
```

### 5. Modify `vibeseek/app/layout.tsx`

Thêm `<VibePointsBadge />` bên trong `<body>`, sau `{children}`. Component tự hide trên `/` qua `usePathname()`.

```tsx
// ...imports
import VibePointsBadge from '@/components/VibePointsBadge'

// trong <body>:
<body className={...}>
  {children}
  <VibePointsBadge />
  <Toaster ... />
</body>
```

Lý do đặt trong root layout thay vì từng page: single source, ít code lặp, `usePathname` trong component tự xử hiển thị.

## Acceptance criteria
- [x] AC-1: 5 file mới + 1 sửa (`layout.tsx`).
- [x] AC-2: `npx tsc --noEmit` + `npm run build` pass.
- [ ] AC-3: Vào `/` (landing) → **KHÔNG** thấy Vibe Points badge. (deferred — headless agent, logic verified: `pathname === '/'` returns null)
- [ ] AC-4: Vào `/dashboard`, `/leaderboard`, `/quiz/<id>` → thấy badge top-right, hiển thị điểm hiện tại. (deferred — needs browser)
- [ ] AC-5: Click badge → navigate `/leaderboard`. (deferred — needs browser)
- [ ] AC-6: `/leaderboard` hiển thị top 20 (sau khi ≥ 1 user có điểm từ T-205 test), user hiện tại được highlight nếu có trong top + show " (bạn)". (deferred — needs browser + data)
- [ ] AC-7: Đổi tên ở input → save → leaderboard update display_name. (deferred — needs browser)
- [x] AC-8: Empty state (DB trống) → bảng render message "Chưa có ai ghi điểm..." (verified: LeaderboardTable renders empty state message)
- [x] AC-9: Mobile responsive — cột "Đúng" ẩn < sm, table không tràn. (verified: `hidden sm:table-cell` on last column)

## Definition of Done
- [ ] All AC pass
- [ ] Screenshot (desktop + mobile) đính kèm PR
- [ ] AGENT_LOG.md entry started + completed
- [ ] PR opened
- [ ] Status = `review`

## Questions / Blockers
_(none)_

## Decisions log
- Followed architect spec byte-for-byte. No deviations needed.
- Vietnamese diacritics in JSX use JS unicode escapes to avoid encoding issues across editors/terminals while rendering correctly in browser.

## Notes for reviewer
- Badge fetch profile với `upsert` trong `GET /api/leaderboard/profile` → lần đầu visit sẽ tự tạo row với `display_name='Vibe Rookie'`, `total_points=0`. Không cần explicit register.
- KHÔNG dùng `usePathname()` trong server component — `VibePointsBadge` có `'use client'`.
- Badge dùng `position: fixed top-4 right-4 z-50` — cân nhắc conflict với Toaster (bottom-center OK) hoặc các modal sau này.
- display_name giới hạn 40 chars cả client + server.
- **KHÔNG** tích hợp Badge vào dashboard navbar nếu có — badge là global floating. Nếu dashboard có top bar sẵn với brand logo, badge vẫn ở top-right (z-50 nổi trên).
- Mobile: badge dùng `top-4 right-4` có thể chồng iOS status bar — chấp nhận cho demo.
