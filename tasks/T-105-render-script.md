# T-105 · Render script (ffmpeg + edge-tts + Supabase Storage)

**Status:** `todo`
**Severity:** HIGH (core pipeline)
**Blueprint ref:** §2.2, §7.4, §11 T-105
**Branch:** `task/T-105-render-script`
**Assignee:** _(tba)_
**Depends on:** T-102 (Storage client)

## Context

Đây là **trái tim** của video pipeline. Script chạy trong GitHub Actions (T-104 workflow), nhận `jobId`, đọc storyboard từ DB, sinh narration bằng edge-tts, ghép với subtitle + background bằng ffmpeg, upload MP4 lên Supabase Storage, và POST callback về API.

## Files to touch
- `vibeseek/scripts/render/render.mjs` (NEW — ESM, chạy được trực tiếp bằng `node render.mjs`)
- `vibeseek/scripts/render/package.json` (NEW — minimal deps, để `npm ci` trong Actions nhanh)
- `vibeseek/scripts/render/README.md` (NEW — ghi cách chạy local)
- Update task file + AGENT_LOG

## Architect's spec

### `vibeseek/scripts/render/package.json`

```json
{
  "name": "@vibeseek/render",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@supabase/supabase-js": "^2.43.4"
  }
}
```

(Ffmpeg + edge-tts là CLI, không cần npm.)

### `vibeseek/scripts/render/render.mjs`

**Top-level flow:**

```
main(jobId):
  1. Load env vars, validate
  2. supabase = createClient(URL, SERVICE_ROLE)
  3. job = fetch render_jobs where id=jobId → storyboard JSON
  4. Update job.status = 'rendering'
  5. For each scene in storyboard.scenes:
       wav = edge-tts(narration, 'vi-VN-HoaiMyNeural') → /tmp/scene-{i}.wav
  6. Concat all wavs → /tmp/audio.mp3
  7. Generate SRT from scene timings → /tmp/subtitles.srt
  8. ffmpeg: 
       -f lavfi -i "color=c=#1a1a2e:s=1080x1920:d={total}" 
       -i /tmp/audio.mp3
       -vf "subtitles=/tmp/subtitles.srt:force_style='Fontsize=48,Alignment=2,MarginV=200'"
       -c:v libx264 -preset fast -pix_fmt yuv420p
       -c:a aac -shortest
       /tmp/output.mp4
  9. uploadVideo(bufferOfMp4, `${jobId}.mp4`) → publicUrl
  10. Update job.status = 'ready', video_url = publicUrl, duration_sec
  11. POST APP_CALLBACK_URL with { jobId, status: 'ready', videoUrl, durationSec }
     Header: x-render-secret: RENDER_CALLBACK_SECRET
  On error:
    Update job.status = 'failed', error_message
    POST callback with status: 'failed', errorMessage
    Exit 1
```

### Detailed implementation hints

**edge-tts invocation (Node child_process):**
```js
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(execFile)

async function tts(text, output) {
  await run('edge-tts', ['--voice', 'vi-VN-HoaiMyNeural', '--text', text, '--write-media', output])
}
```

**SRT format:**
```
1
00:00:00,000 --> 00:00:04,200
Nội dung scene 1 ở đây

2
00:00:04,200 --> 00:00:08,500
Scene 2
```

**Supabase Storage upload:**
Cannot `import` from `vibeseek/lib/storage/client.ts` directly (TS file, script is .mjs). Two options:
- (a) Inline supabase client in render.mjs (simpler, less DRY).
- (b) Compile lib/storage to .mjs first via `tsc` in workflow. Adds complexity.

**Agent chọn (a) — inline client** for simplicity:
```js
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'vibeseek-videos'

async function uploadVideo(buffer, key) {
  const { error } = await supabase.storage.from(bucket).upload(key, buffer, {
    contentType: 'video/mp4',
    upsert: true,
  })
  if (error) throw error
  return `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${key}`
}
```

### Callback POST shape

```js
await fetch(process.env.APP_CALLBACK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-render-secret': process.env.RENDER_CALLBACK_SECRET,
  },
  body: JSON.stringify({
    jobId,
    status: 'ready',
    videoUrl,
    durationSec,
    errorMessage: null,
  }),
})
```

## Acceptance criteria
- [ ] AC-1: Script chạy local được: `cd vibeseek/scripts/render && SUPABASE_URL=... SERVICE_ROLE=... node render.mjs <realJobId>` → MP4 xuất hiện trong Storage, job status = `ready`, callback gọi tới local server qua ngrok.
- [ ] AC-2: Error case — invalid jobId → job status = `failed`, error_message có meaningful text, exit 1.
- [ ] AC-3: SRT subtitle render đúng tiếng Việt có dấu (không bị �).
- [ ] AC-4: MP4 output playable trong VLC/browser, resolution 1080x1920 (9:16).
- [ ] AC-5: `package.json` có đúng 1 dependency (`@supabase/supabase-js`), không bloat.

## Definition of Done
- [ ] All AC pass (có thể AC-1 khó test đầy đủ nếu chưa có ngrok → ghi "partial test" trong Decisions log)
- [ ] AGENT_LOG.md entry started + completed
- [ ] PR opened với sample rendered video link trong description (optional)
- [ ] Status = `review`

## Questions / Blockers
_(none)_

## Decisions log
_(agent ghi nếu gặp issue ffmpeg format, tiếng Việt subtitle, v.v.)_

## Notes for reviewer
- Task này **khó test end-to-end** trong agent's dev env (cần ngrok + real jobId). Agent làm best-effort, note limitation. Architect sẽ test trong review.
- Ffmpeg subtitle tiếng Việt cần font support Unicode. Nếu lỗi box characters → set `force_style='FontName=Arial'` hoặc install `fonts-noto-cjk`.
- Background scene đơn giản (màu nền + subtitle) chấp nhận cho MVP. Đẹp hơn thì Phase 4 polish.
