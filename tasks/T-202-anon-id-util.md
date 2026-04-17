# T-202 · `utils/anon-id.ts` — SSR-safe localStorage anon_id manager

**Status:** `todo`
**Severity:** MED (foundation — blocks T-204 leaderboard flow + T-205/T-206 UI)
**Blueprint ref:** §2.4, §7.6, §11
**Branch:** `task/T-202-anon-id-util`
**Assignee:** _(tba)_
**Depends on:** _(none — can run parallel with T-201, T-203)_

## Context

MVP không có auth thật. 1 user = 1 `anon_id` (UUID v4 lưu localStorage key `vibeseek:anonId`). Lần đầu vào app → generate + save. Các lần sau → read. Util phải **SSR-safe** (Next.js App Router render server-side → `window` undefined → crash).

## Files to touch
- `vibeseek/utils/anon-id.ts` (NEW)
- Update task file + AGENT_LOG

## Architect's spec

### `vibeseek/utils/anon-id.ts`

```ts
/**
 * Anonymous user identity for VibeSeek guest demo.
 * 1 user = 1 anon_id (UUID v4) persisted in localStorage.
 * Server-side calls return null — only the browser owns the identity.
 */

const STORAGE_KEY = 'vibeseek:anonId'

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/**
 * Read existing anon_id from localStorage, or generate + persist a new one.
 * Safe to call on client mount (useEffect). Returns null on server.
 */
export function getOrCreateAnonId(): string | null {
  if (!isBrowser()) return null

  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing && existing.length > 0) return existing

    const fresh = crypto.randomUUID()
    window.localStorage.setItem(STORAGE_KEY, fresh)
    return fresh
  } catch {
    // localStorage blocked (private mode, iframe, etc.) — degrade gracefully
    return null
  }
}

/** Read-only peek (returns null if not set yet or on server). */
export function peekAnonId(): string | null {
  if (!isBrowser()) return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** For testing / user-requested reset. Clears local identity. */
export function clearAnonId(): void {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // noop
  }
}

export const ANON_ID_STORAGE_KEY = STORAGE_KEY
```

### Usage pattern (docs for UI task agents — không code ở task này)

```tsx
'use client'
import { useEffect, useState } from 'react'
import { getOrCreateAnonId } from '@/utils/anon-id'

function SomeComponent() {
  const [anonId, setAnonId] = useState<string | null>(null)
  useEffect(() => {
    setAnonId(getOrCreateAnonId())
  }, [])
  // Use anonId in fetch body / header
}
```

## Acceptance criteria
- [ ] AC-1: `vibeseek/utils/anon-id.ts` exists, exports `getOrCreateAnonId`, `peekAnonId`, `clearAnonId`, `ANON_ID_STORAGE_KEY`.
- [ ] AC-2: `npx tsc --noEmit` pass.
- [ ] AC-3: `npm run build` pass (critical: no `window is not defined` during build's prerender pass).
- [ ] AC-4: Manual test trong browser DevTools:
  ```js
  // after `npm run dev`, open any page, in console:
  const { getOrCreateAnonId, peekAnonId, clearAnonId } = await import('/utils/anon-id.ts')  // OR use it through a page
  // Easier: just navigate to / and run:
  localStorage.getItem('vibeseek:anonId')  // null initially
  ```
  Agent có thể verify bằng cách thêm 1 tạm `useEffect` trong dashboard page, in console.log, rồi xoá. Hoặc trust review.
- [ ] AC-5: Call server-side (vd trong `app/layout.tsx`) không crash — hàm return `null` graceful.

## Definition of Done
- [ ] All AC pass (AC-4 optional — agent có thể skip nếu khó test, ghi Decisions log)
- [ ] AGENT_LOG.md entry started + completed
- [ ] PR opened
- [ ] Status = `review`

## Questions / Blockers
_(none)_

## Decisions log
_(agent ghi)_

## Notes for reviewer
- Dùng `crypto.randomUUID()` (Web Crypto, browser + Node 19+). Không import thư viện UUID thêm.
- Try/catch localStorage — iframe, private mode, hoặc user disable storage có thể throw.
- Không dùng React Context / hook wrapper — giữ pure function. Component tự wrap trong `useEffect`.
- **KHÔNG** dùng ở server component trực tiếp (return null, không crash, nhưng vô dụng — UI cần call ở client).
