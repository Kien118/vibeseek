# T-403 + T-404 bundle · PWA manifest + debug log hygiene

**Status:** `todo`
**Severity:** LOW (Phase 4 core polish — hygiene)
**Blueprint ref:** §10 Phase 4 Core polish · T-403 + T-404
**Branch:** `task/T-403-T-404-pwa-manifest-log-cleanup`
**Assignee:** _(TBD)_
**Depends on:** none — no runtime coupling.

## Context

**Current state (main `e54f5f7`):**

T-404 — debug log hygiene:
- `vibeseek/debug-7de032.log` (3861 B) tracked in git.
- `vibeseek/.cursor/debug-7de032.log` (18884 B) tracked in git.
- Both are editor-side artifacts (Cursor/IDE debug logs) committed unintentionally.
- Root `.gitignore`: only covers `*.pdf` + `test-pdf/`. No log pattern.
- `vibeseek/.gitignore`: covers `node_modules/`, `.next/`, `tsconfig.tsbuildinfo`, `scripts/smoke-*.ts`, `.env*.local`. No log pattern.

T-403 — PWA manifest:
- No `vibeseek/public/manifest.json`.
- No `vibeseek/public/icons/` directory.
- `app/layout.tsx` exports `metadata` object but has no `<link rel="manifest">` — Next.js App Router supports `metadata.manifest` field.

**Why bundle:** both are <30 LOC pure file operations with zero risk of interaction. One PR saves dispatch overhead.

## Files to touch

### T-404 side
- `.gitignore` (root) — add `*.log` pattern
- `vibeseek/.gitignore` — add `*.log` + `.cursor/` patterns
- **Delete**: `vibeseek/debug-7de032.log`
- **Delete**: `vibeseek/.cursor/debug-7de032.log`
- (If `.cursor/` directory is empty after log deletion, delete the directory too)

### T-403 side
- `vibeseek/public/manifest.json` (NEW)
- `vibeseek/public/icons/icon-192.png` (NEW — 192×192 PWA icon)
- `vibeseek/public/icons/icon-512.png` (NEW — 512×512 PWA icon)
- `vibeseek/app/layout.tsx` — add `manifest: '/manifest.json'` to the `metadata` export; add `themeColor` + `viewport`

### Meta
- `tasks/T-403-T-404-pwa-manifest-log-cleanup.md` (status)
- `AGENT_LOG.md` (start + done entries)

## Files NOT to touch
- `vibeseek/scripts/render/*` — unrelated
- `vibeseek/lib/**` — unrelated
- Any route file beyond `app/layout.tsx` — unrelated
- `package.json` — NO new deps (don't install `next-pwa`; use native App Router manifest support)
- Any component file (no VibePointsBadge, no ChatPanel, etc.)

## Architect's spec

### 1. T-404 · gitignore patterns

**Root `.gitignore`** — append at bottom:
```
# Editor / debug artifacts
*.log
.cursor/
```

**`vibeseek/.gitignore`** — append at bottom:
```
# Editor / debug artifacts
*.log
.cursor/
```

### 2. T-404 · delete tracked logs

```bash
cd D:/WangNhat/Study/VibeCode
git rm vibeseek/debug-7de032.log
git rm -r vibeseek/.cursor
```

(The `git rm` above both removes from index AND deletes working copy. No manual `rm` needed.)

### 3. T-403 · `vibeseek/public/manifest.json`

```json
{
  "name": "VibeSeek",
  "short_name": "VibeSeek",
  "description": "Biến PDF khô khan thành micro-content hấp dẫn cho Gen Z.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#050505",
  "theme_color": "#a855f7",
  "orientation": "portrait",
  "lang": "vi",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

Colors match blueprint §2.1 (bg `#050505`, purple accent `#a855f7`). `display: standalone` so Android Chrome + iOS Safari "Add to Home Screen" launches as app-like full-screen.

### 4. T-403 · minimal icons

Create `vibeseek/public/icons/icon-192.png` and `vibeseek/public/icons/icon-512.png`.

**Generation approach (agent chooses):**
- **Preferred**: use ImageMagick or `sharp` if available on agent's machine to produce a `#050505` bg + centered purple `#a855f7` rounded square with bold "V" glyph. Size 192 + 512.
- **Fallback**: generate solid-color PNG with purple center and export at two sizes. Even minimal icons (solid purple square with lighter center) are acceptable — focus is on PWA installability, not branding pixel perfection.
- **Emergency fallback**: if no image tooling available, use ffmpeg (already a dep for render script):
  ```bash
  ffmpeg -f lavfi -i color=c=#050505:s=192x192 -frames:v 1 -y icon-192.png
  ffmpeg -f lavfi -i color=c=#050505:s=512x512 -frames:v 1 -y icon-512.png
  ```
  Pure dark squares are valid PWA icons (Chrome accepts them). Design polish deferred to Phase 5.

Note for reviewer: icons are placeholders. Polish comes later.

### 5. T-403 · wire manifest into `app/layout.tsx`

Modify the existing `metadata` export. Change:
```typescript
export const metadata: Metadata = {
  title: 'VibeSeek — Catch the Knowledge Vibe',
  description: 'Biến PDF khô khan thành micro-content hấp dẫn cho Gen Z.',
  keywords: ['learning', 'AI', 'PDF', 'Gen Z', 'education'],
}
```

To:
```typescript
export const metadata: Metadata = {
  title: 'VibeSeek — Catch the Knowledge Vibe',
  description: 'Biến PDF khô khan thành micro-content hấp dẫn cho Gen Z.',
  keywords: ['learning', 'AI', 'PDF', 'Gen Z', 'education'],
  manifest: '/manifest.json',
  themeColor: '#a855f7',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VibeSeek',
  },
}
```

Next.js App Router auto-renders `<link rel="manifest" href="/manifest.json">` + `<meta name="theme-color" content="#a855f7">` + Apple PWA meta tags from this object.

**Note on Next.js 14 viewport separation:** Next.js 14.2+ deprecated `themeColor` + `viewport` in `metadata` and introduced a separate `export const viewport = {...}` export. Agent should check the installed Next.js version:
```bash
cd vibeseek && node -p "require('next/package.json').version"
```
If ≥14.2, use the newer pattern:
```typescript
export const viewport: Viewport = {
  themeColor: '#a855f7',
}
```
and omit `themeColor` from `metadata`. Agent imports `Viewport` from `next` if needed.

## Acceptance criteria
- [ ] **AC-1:** `git ls-files | grep debug-7de032` returns empty (both logs untracked).
- [ ] **AC-2:** `git ls-files | grep -E "\.cursor/"` returns empty.
- [ ] **AC-3:** Root `.gitignore` contains `*.log` pattern; `vibeseek/.gitignore` contains `*.log` pattern. `grep '^\*\.log$' .gitignore vibeseek/.gitignore` returns 2 matches.
- [ ] **AC-4:** `vibeseek/public/manifest.json` exists, valid JSON, passes `node -e "console.log(JSON.parse(require('fs').readFileSync('vibeseek/public/manifest.json')))"` without error.
- [ ] **AC-5:** `vibeseek/public/icons/icon-192.png` + `vibeseek/public/icons/icon-512.png` exist, nonzero size, valid PNG (file header `\x89PNG`).
- [ ] **AC-6:** `app/layout.tsx` Metadata export (or Viewport export for Next.js ≥14.2) includes `manifest: '/manifest.json'` + theme color.
- [ ] **AC-7:** `cd vibeseek && npx tsc --noEmit` exit 0.
- [ ] **AC-8:** `cd vibeseek && npm run build` pass.
- [ ] **AC-9 (User-runnable, post-merge):** Chrome DevTools → Application tab → Manifest. Should show "VibeSeek" with theme color `#a855f7`, icons 192 + 512. Chrome should display "Add to Home Screen" prompt eligibility.
- [ ] **AC-10:** No stray files in diff beyond the 5-7 expected: 2 `.gitignore` (root + vibeseek), 1 manifest.json, 2 PNGs, 1 layout.tsx edit, task md + AGENT_LOG.

## Definition of Done
- All AC pass
- AGENT_LOG start + done entries
- Task status → `review`
- PR opened against `main`
- 2 debug log files NO LONGER present (both working copy AND git index)
- No new deps in `package.json`

## Failure modes

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | Agent uses `rm` instead of `git rm` → file deleted from working copy but still tracked | Spec explicit `git rm` commands in §2. |
| F-2 | `.gitignore` pattern `*.log` also ignores legitimate log files (e.g., if future debug features add `vibeseek/logs/app.log`) | Accept trade-off. Future logs can use a different extension or explicit `!logs/` un-ignore if needed. |
| F-3 | Icons aren't valid PNG / Chrome rejects manifest | Use ffmpeg fallback (verified produces valid PNG). AC-5 file-header check catches invalid. |
| F-4 | Next.js version is 14.0/14.1 (old themeColor pattern) vs 14.2+ (Viewport export) | Agent checks version per §5 spec note + applies correct pattern. |
| F-5 | Agent commits new `.cursor/` dir as Cursor IDE writes a new log mid-task | `.cursor/` pattern in gitignore blocks all future files. |
| F-6 | `app/layout.tsx` has existing `themeColor` elsewhere → duplicate | Current layout.tsx (verified) has zero `themeColor` mentions. Safe. |
| F-7 | Icons too small to pass PWA manifest criteria (Chrome requires 192 + 512 minimum) | Spec mandates exactly these sizes. |
| F-8 | `manifest.json` has trailing comma or comment (JSON5) → invalid | Spec provides pure JSON. AC-4 parse check catches. |
| F-9 | Gitignore patterns apply retroactively? (No — gitignore only affects untracked files) | Spec requires `git rm` first THEN gitignore addition. Order preserves behavior. |
| F-10 | Agent adds `next-pwa` or similar plugin | Non-goal section explicit. Native App Router manifest support is sufficient for MVP. |

## Local test plan

### Test 1 — Manifest JSON validity
```bash
cd vibeseek
node -e "JSON.parse(require('fs').readFileSync('public/manifest.json', 'utf8'))"
```
Expected: no output, exit 0.

### Test 2 — Icon file headers
```bash
cd vibeseek
head -c 8 public/icons/icon-192.png | xxd
head -c 8 public/icons/icon-512.png | xxd
```
Expected: first bytes `89 50 4e 47 0d 0a 1a 0a` (PNG signature).

### Test 3 — tsc + build
```bash
cd vibeseek && npx tsc --noEmit && npm run build
```
Expected: no errors. Build output shows `/manifest.json` served as static asset.

### Test 4 — Untrack verification
```bash
cd D:/WangNhat/Study/VibeCode
git ls-files | grep -E "debug-7de032|\.cursor/"
```
Expected: empty.

### Test 5 (User-runnable, post-merge) — Chrome DevTools Manifest
Open dashboard in Chrome → F12 → Application tab → Manifest section.
Expected:
- Name: "VibeSeek"
- Start URL: `/`
- Theme color: purple `#a855f7`
- Icons: 192 + 512 both render preview
- No manifest errors in Console tab

## Non-goals (KHÔNG làm)
- KHÔNG install `next-pwa` or any PWA plugin
- KHÔNG implement service worker / offline support (Phase 5)
- KHÔNG design fancy icons — placeholder dark + purple is fine
- KHÔNG touch any route file beyond `app/layout.tsx`
- KHÔNG globally delete all `.log` via broad shell (use explicit `git rm` per file)
- KHÔNG add `manifest.webmanifest` alternative (single `manifest.json` suffices)
- KHÔNG add Apple touch icons at more sizes (Apple manifest support is limited; 512 suffices for home-screen install)
- KHÔNG refactor layout.tsx beyond adding to metadata/viewport

## Questions / Blockers
_(none — spec self-contained)_

## Decisions log
_(agent fills)_

## Notes for reviewer
- Reviewer greps final PR diff for `next-pwa`, new deps, new log files — all should be absent.
- tsc + build verify in architect review (no user dev server running risk since this is layout.tsx change, not render-time).
- AC-9 Chrome Application tab check is user-runnable post-merge; architect can't open Chrome.
- Architect can verify PNG headers + manifest JSON via CLI Read tool.
- If user's Cursor IDE writes a new `.cursor/debug-*.log` mid-task, agent should NOT manually delete it — `.cursor/` ignore pattern handles future.
