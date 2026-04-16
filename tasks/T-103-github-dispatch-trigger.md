# T-103 · GitHub repository_dispatch trigger

**Status:** `review`
**Severity:** HIGH (foundation — blocks T-106)
**Blueprint ref:** §2.2 step 6, §11 T-103
**Branch:** `task/T-103-github-dispatch-trigger`
**Assignee:** Antigravity

## Context

Khi `/api/vibefy-video` enqueue một render job, nó cần trigger GitHub Actions workflow `render-video.yml` (sẽ viết ở T-104). GitHub có endpoint `POST /repos/{owner}/{repo}/dispatches` nhận `event_type` + `client_payload`.

Task này viết helper TypeScript gọi endpoint đó.

## Files to touch
- `vibeseek/lib/github/dispatch.ts` (NEW)
- Update task file + AGENT_LOG

## Architect's spec

### `vibeseek/lib/github/dispatch.ts`

```ts
const owner = process.env.GITHUB_REPO_OWNER!
const repo = process.env.GITHUB_REPO_NAME!
const token = process.env.GITHUB_DISPATCH_TOKEN!

/**
 * Trigger the render-video workflow via repository_dispatch.
 * Throws if GitHub API returns non-204.
 */
export async function triggerRenderVideo(jobId: string): Promise<void> {
  if (!owner || !repo || !token) {
    throw new Error('Missing GITHUB_REPO_OWNER / GITHUB_REPO_NAME / GITHUB_DISPATCH_TOKEN')
  }

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: 'render-video',
      client_payload: { jobId },
    }),
  })

  if (res.status !== 204) {
    const body = await res.text()
    throw new Error(`GitHub dispatch failed: ${res.status} ${body}`)
  }
}
```

## Acceptance criteria
- [ ] AC-1: `vibeseek/lib/github/dispatch.ts` exports `triggerRenderVideo`.
- [ ] AC-2: `npx tsc --noEmit` pass.
- [ ] AC-3: Manual integration test:
  ```bash
  # From vibeseek/, create scripts/test-dispatch.mjs:
  #   import { triggerRenderVideo } from '../lib/github/dispatch.ts' (compile first)
  #   await triggerRenderVideo('test-job-id')
  # Run it, then check https://github.com/Kien118/vibeseek/actions
  ```
  - Expected: workflow run **would** appear if `render-video.yml` existed (T-104). Cho MVP task này, chỉ cần verify API trả 204.
  - Shortcut: dùng `curl` trực tiếp với fake payload — 204 status code = OK.
- [ ] AC-4: Error case — khi token sai, function throws với message chứa status code.

## Definition of Done
- [ ] All AC pass
- [ ] AGENT_LOG.md entry started + completed
- [ ] PR opened
- [ ] Status = `review`

## Questions / Blockers
_(none)_

## Decisions log
_(agent ghi)_

## Notes for reviewer
- File này **chỉ** được import từ server code (API routes, scripts). KHÔNG import từ client components — sẽ leak `GITHUB_DISPATCH_TOKEN`.
- GitHub API trả **204 No Content** khi success (không có body). Đừng dùng `await res.json()` — sẽ crash vì body rỗng.
