# T-102 · Supabase Storage client + schema sync

**Status:** `done`
**Severity:** HIGH (foundation — blocks T-105)
**Blueprint ref:** §3 (locked: Supabase Storage), §5 (render_jobs), §11 T-102
**Branch:** `task/T-102-supabase-storage-client`
**Assignee:** _(tba)_

## Context

User đã chạy migration `render_jobs` trực tiếp trên Supabase Dashboard + tạo bucket `vibeseek-videos` public. Nhưng `vibeseek/supabase-schema.sql` (SSOT) chưa được update. Task này:
1. Sync schema file với DB hiện tại.
2. Viết client TypeScript helper để upload MP4 + lấy public URL.

## Files to touch
- `vibeseek/lib/storage/client.ts` (NEW)
- `vibeseek/supabase-schema.sql` (APPEND DDL từ §5.2 + bucket block)
- `vibeseek/.env.local.example` (APPEND `SUPABASE_STORAGE_BUCKET=vibeseek-videos` + `RENDER_CALLBACK_SECRET=`)
- Update task file + AGENT_LOG

## Architect's spec

### 1. `vibeseek/lib/storage/client.ts`

```ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'vibeseek-videos'

// Server-only admin client (uses service_role — DO NOT import from client components)
const storage = createClient(url, serviceKey, {
  auth: { persistSession: false },
}).storage.from(bucket)

/** Upload MP4 to Supabase Storage. Returns public URL. */
export async function uploadVideo(
  buffer: Buffer,
  key: string,
  contentType: string = 'video/mp4'
): Promise<string> {
  const { error } = await storage.upload(key, buffer, {
    contentType,
    upsert: true,
    cacheControl: '3600',
  })
  if (error) throw new Error(`Supabase upload failed: ${error.message}`)
  return getPublicUrl(key)
}

/** Return public URL of a bucket object. */
export function getPublicUrl(key: string): string {
  return `${url}/storage/v1/object/public/${bucket}/${key}`
}
```

### 2. Append to `vibeseek/supabase-schema.sql`

Append ở cuối file, PHẢI idempotent (dùng `IF NOT EXISTS` / `ON CONFLICT`):

```sql
-- =============================================================
-- Phase 1: render_jobs queue for GitHub Actions video renderer
-- =============================================================
CREATE TABLE IF NOT EXISTS render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES vibe_documents(id) ON DELETE CASCADE,
  storyboard JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'rendering', 'ready', 'failed')),
  video_url TEXT,
  duration_sec NUMERIC,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS render_jobs_document_id_idx ON render_jobs(document_id);
CREATE INDEX IF NOT EXISTS render_jobs_status_idx ON render_jobs(status);

ALTER TABLE render_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "render_jobs public read" ON render_jobs;
CREATE POLICY "render_jobs public read" ON render_jobs FOR SELECT USING (true);

DROP POLICY IF EXISTS "render_jobs service insert" ON render_jobs;
CREATE POLICY "render_jobs service insert" ON render_jobs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "render_jobs service update" ON render_jobs;
CREATE POLICY "render_jobs service update" ON render_jobs FOR UPDATE
  USING (auth.role() = 'service_role');

-- =============================================================
-- Phase 1: Supabase Storage bucket for MP4 output
-- =============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('vibeseek-videos', 'vibeseek-videos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can read videos" ON storage.objects;
CREATE POLICY "Public can read videos" ON storage.objects FOR SELECT
  USING (bucket_id = 'vibeseek-videos');

DROP POLICY IF EXISTS "Service can upload videos" ON storage.objects;
CREATE POLICY "Service can upload videos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vibeseek-videos' AND auth.role() = 'service_role');
```

### 3. Append to `vibeseek/.env.local.example`

```
# Render pipeline
SUPABASE_STORAGE_BUCKET=vibeseek-videos
RENDER_CALLBACK_SECRET=<generate-32-char-random>
```

## Acceptance criteria
- [ ] AC-1: `vibeseek/lib/storage/client.ts` exports `uploadVideo` + `getPublicUrl` đúng signature.
- [ ] AC-2: `vibeseek/supabase-schema.sql` chứa đủ 2 block (render_jobs + storage bucket) ở cuối file.
- [ ] AC-3: `.env.local.example` có 2 env mới.
- [ ] AC-4: `npx tsc --noEmit` exit 0 (client.ts type-check pass).
- [ ] AC-5: `npm run build` pass.
- [ ] AC-6: Manual upload test:
  ```bash
  # From vibeseek/, create scripts/test-storage.mjs with sample upload
  # OR run node REPL importing uploadVideo
  # Verify: public URL returns 200 via curl
  ```
  Agent có thể skip AC-6 nếu khó setup, ghi vào Decisions log.

## Definition of Done
- [ ] All AC pass (AC-6 optional)
- [ ] AGENT_LOG.md entry started + completed
- [ ] PR opened
- [ ] Status = `review`

## Questions / Blockers
_(none)_

## Decisions log
_(agent ghi)_

## Notes for reviewer
- Đây là foundation cho T-105 (render script sẽ import `uploadVideo`).
- Client PHẢI server-only — dùng SERVICE_ROLE_KEY. Nếu agent vô tình import từ `'use client'` component → tsc có thể không báo, nhưng runtime sẽ leak key. Thêm comment cảnh báo trong file.
