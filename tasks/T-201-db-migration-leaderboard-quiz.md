# T-201 · DB migration — `leaderboard_profiles` + `quiz_attempts`

**Status:** `done`
**Severity:** HIGH (foundation — blocks T-204)
**Blueprint ref:** §5.2, §5.3, §5.4, §7.6, §11
**Branch:** `task/T-201-db-migration-leaderboard-quiz` (merged, deleted)
**Assignee:** claude-opus-4-6
**Depends on:** _(none — can run parallel with T-202, T-203)_

## Context

Phase 2 cần 2 bảng mới để lưu điểm leaderboard + attempt quiz. User sẽ chạy migration tay trên Supabase Dashboard (giống T-101). Task này là **sync `supabase-schema.sql` (SSOT)** với DDL cần có — đồng thời cung cấp bản SQL idempotent để user paste-run 1 phát.

Bảng `quiz_questions` đã tồn tại từ `supabase-schema.sql` gốc (§5.1), **không cần tạo lại** — T-203 sẽ insert vào đó.

## Files to touch
- `vibeseek/supabase-schema.sql` (APPEND ở cuối file, sau block `Phase 1: Supabase Storage bucket`)
- Update task file + AGENT_LOG

## Architect's spec

### Append to `vibeseek/supabase-schema.sql`

PHẢI idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ON CONFLICT`).

```sql
-- =============================================================
-- Phase 2: Leaderboard (guest profiles) + quiz attempts
-- =============================================================

-- 1. leaderboard_profiles — 1 row per anonymous user
CREATE TABLE IF NOT EXISTS leaderboard_profiles (
  anon_id            TEXT PRIMARY KEY,
  display_name       TEXT NOT NULL DEFAULT 'Vibe Rookie',
  total_points       INTEGER NOT NULL DEFAULT 0,
  documents_count    INTEGER NOT NULL DEFAULT 0,
  quiz_correct_count INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leaderboard_profiles_points_idx
  ON leaderboard_profiles(total_points DESC);

ALTER TABLE leaderboard_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leaderboard_profiles public read" ON leaderboard_profiles;
CREATE POLICY "leaderboard_profiles public read" ON leaderboard_profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "leaderboard_profiles service write" ON leaderboard_profiles;
CREATE POLICY "leaderboard_profiles service write" ON leaderboard_profiles
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2. quiz_attempts — 1 row per (anon_id, question_id) thanks to UNIQUE
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id        TEXT NOT NULL REFERENCES leaderboard_profiles(anon_id) ON DELETE CASCADE,
  question_id    UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  selected_index INTEGER NOT NULL,
  is_correct     BOOLEAN NOT NULL,
  points_earned  INTEGER NOT NULL DEFAULT 0,
  attempted_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(anon_id, question_id)
);

CREATE INDEX IF NOT EXISTS quiz_attempts_anon_idx
  ON quiz_attempts(anon_id);
CREATE INDEX IF NOT EXISTS quiz_attempts_question_idx
  ON quiz_attempts(question_id);

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quiz_attempts public read" ON quiz_attempts;
CREATE POLICY "quiz_attempts public read" ON quiz_attempts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "quiz_attempts service write" ON quiz_attempts;
CREATE POLICY "quiz_attempts service write" ON quiz_attempts
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

### Why `FOR ALL` + service_role
- Blueprint §5.3: client NEVER writes directly. API route uses `SUPABASE_SERVICE_ROLE_KEY` → bypasses RLS anyway, nhưng explicit policy giúp attack surface rõ ràng nếu key leak (RLS vẫn filter public clients).
- Public SELECT để `/leaderboard` có thể query trực tiếp nếu cần (hiện tại sẽ qua API, nhưng giữ mở cho polish).

### Why `anon_id TEXT` (not UUID)
- Client tự generate (crypto.randomUUID()) → dạng string đã đủ. Không constraint UUID để tương thích nếu sau này đổi format (vd device fingerprint).

## Acceptance criteria
- [x] AC-1: Block SQL trên append **ĐÚNG CUỐI FILE** `supabase-schema.sql`, KHÔNG sửa bất kỳ dòng nào phía trên.
- [ ] AC-2: Agent chạy SQL block đó trong Supabase Dashboard SQL Editor → không lỗi. (Nếu agent không có quyền Supabase Dashboard → skip, ghi Decisions log, user sẽ chạy lúc merge.)
- [ ] AC-3: Sau khi chạy, query test pass:
  ```sql
  SELECT * FROM leaderboard_profiles LIMIT 1;  -- empty OK
  SELECT * FROM quiz_attempts LIMIT 1;         -- empty OK
  INSERT INTO leaderboard_profiles (anon_id) VALUES ('test-001');
  DELETE FROM leaderboard_profiles WHERE anon_id = 'test-001';  -- cleanup
  ```
- [ ] AC-4: Chạy lại block SQL lần 2 → không lỗi (idempotent check).
- [x] AC-5: `git diff vibeseek/supabase-schema.sql` chỉ có dòng **thêm ở cuối**, không có thay đổi ở giữa file.

## Definition of Done
- [ ] All AC pass (AC-2 có thể defer cho user)
- [ ] AGENT_LOG.md entry started + completed
- [ ] PR opened (chỉ 1 file thay đổi — `supabase-schema.sql`)
- [ ] Status = `review`

## Questions / Blockers
_(none)_

## Decisions log
- AC-2/AC-3/AC-4: Skipped — agent has no Supabase Dashboard access. User should paste-run the Phase 2 SQL block in Supabase SQL Editor at merge time. DDL is idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`) so re-run is safe.

## Notes for reviewer
- Task này rất nhỏ (append DDL). Thời gian dự kiến < 15 phút.
- Không động đến code TypeScript → build sẽ pass trivially.
- Reviewer check: (a) idempotent, (b) RLS policy đúng service_role, (c) FK cascade đúng.
