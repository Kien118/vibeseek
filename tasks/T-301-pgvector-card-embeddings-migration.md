# T-301 · Migration — enable `pgvector` + create `card_embeddings`

**Status:** `done`
**Severity:** HIGH (foundation cho Phase 3)
**Blueprint ref:** §2.5 RAG flow, §5.2 schema, §12 Q-06/Q-07
**Branch:** `task/T-301-pgvector-card-embeddings-migration`
**Assignee:** _(TBD — likely user runs SQL on Supabase Dashboard giống T-101 + agent syncs `supabase-schema.sql`)_
**Depends on:** _(none — first Phase 3 task, foundation)_

## Context

Phase 3 Chatbot RAG cần:
1. `card_embeddings` table + `vector` extension để lưu 768-dim embeddings từ Gemini `text-embedding-004`.
2. `vibe_documents.raw_text` column — để RAG context có thể trích đoạn tài liệu gốc (Q-07) ngoài 5 Vibe Cards (cards ngắn ~200 chars × 5 không đủ cho câu hỏi phức tạp). Schema hiện tại không lưu raw text — extract xong thì discard sau khi AI tạo cards.
3. Sync cleanup: `UNIQUE(card_id)` trên `quiz_questions` (đã apply manual trong Phase 2 E2E, chưa sync `supabase-schema.sql`).

**Scope mở rộng có chủ ý:** task này ĐỘNG `/api/vibefy/route.ts` (~3 dòng thêm) để INSERT raw text khi tạo doc mới. Phá nguyên tắc "migration-only" nhưng cần thiết để tránh tạo task T-301b chỉ cho 3 dòng code. Doc CŨ trước migration sẽ có `raw_text = NULL` — T-303 `pickSnippet` đã defensive `doc.raw_text ?? ''` → fallback chỉ dùng cards, user muốn chất lượng chat cao hơn thì re-upload.

Pattern "user chạy SQL trên Dashboard → agent sync `supabase-schema.sql`" (T-101, T-201) vẫn áp dụng cho DDL. Phần code `.ts` agent edit + commit bình thường.

## Files to touch
- `vibeseek/supabase-schema.sql` (APPEND DDL: `vector` ext + `card_embeddings` + `raw_text` column + `quiz_questions` UNIQUE sync)
- `vibeseek/app/api/vibefy/route.ts` (MODIFY INSERT để bao gồm `raw_text: extractedText`)
- `tasks/T-301-pgvector-card-embeddings-migration.md` (status updates)
- `AGENT_LOG.md` (start + done entries)

## Files NOT to touch
- `vibeseek/lib/ai/*` — T-302/T-303 scope
- `vibeseek/app/api/chat/**`, `vibeseek/app/api/embeddings/**` — T-302/T-304 scope
- `vibeseek/app/chat/**`, any ChatPanel component — T-305 scope

## Architect's spec

### 1. SQL to run on Supabase Dashboard (SQL Editor)

**Paste EXACTLY this block (không sửa, không split):**

```sql
-- Phase 3 foundation: pgvector + card_embeddings + raw_text column + quiz UNIQUE sync

-- 1. Vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. card_embeddings table
CREATE TABLE IF NOT EXISTS card_embeddings (
  card_id UUID PRIMARY KEY REFERENCES vibe_cards(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES vibe_documents(id) ON DELETE CASCADE,
  embedding vector(768) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS card_embeddings_document_idx
  ON card_embeddings(document_id);

-- HNSW index cho cosine similarity — fast ANN search ngay cả khi bảng nhỏ.
-- vector_cosine_ops khớp distance operator `<=>` dùng trong query RAG.
CREATE INDEX IF NOT EXISTS card_embeddings_vector_idx
  ON card_embeddings USING hnsw (embedding vector_cosine_ops);

-- RLS: public read, service_role only write (giống table khác MVP)
ALTER TABLE card_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "card_embeddings_public_read" ON card_embeddings
  FOR SELECT USING (true);

CREATE POLICY "card_embeddings_service_write" ON card_embeddings
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Add raw_text column to vibe_documents (nullable — doc cũ không có)
ALTER TABLE vibe_documents
  ADD COLUMN IF NOT EXISTS raw_text TEXT;

-- 4. Sync cleanup: UNIQUE(card_id) on quiz_questions đã được apply manual Phase 2 E2E,
-- nhưng chưa có trong file SSOT. Nếu đã tồn tại thì command sau sẽ lỗi — bỏ qua.
ALTER TABLE quiz_questions
  ADD CONSTRAINT quiz_questions_card_id_unique UNIQUE (card_id);
```

**Nếu câu `ALTER TABLE quiz_questions ADD CONSTRAINT ...` báo lỗi `already exists`:** bỏ qua, constraint đã có rồi. Đó là trường hợp bình thường.

### 1b. Modify `vibeseek/app/api/vibefy/route.ts`

Tìm block INSERT `vibe_documents` (hiện khoảng line 80-88):

```ts
const { data: docRecord, error: docError } = await supabaseAdmin
  .from('vibe_documents')
  .insert({
    title,
    original_filename: file.name,
    status: 'ready',
    total_cards: cards.length,
  })
```

Thêm `raw_text: extractedText` vào object insert:

```ts
const { data: docRecord, error: docError } = await supabaseAdmin
  .from('vibe_documents')
  .insert({
    title,
    original_filename: file.name,
    status: 'ready',
    total_cards: cards.length,
    raw_text: extractedText,
  })
```

**Lưu ý:** `extractedText` đã có sẵn trong scope (từ `extractTextFromBuffer` đầu function). Nếu `extractedText > 1MB` (tài liệu dài), Postgres TEXT chịu được (max ~1GB) nhưng ảnh hưởng row size. Blueprint §7.8 giới hạn PDF 50 pages → raw text thường <500KB. KHÔNG cần truncate.

### 2. Append to `vibeseek/supabase-schema.sql`

Ở cuối file (sau khối `chat_messages` commented-out nếu có), append exact block SQL từ mục 1 ở trên (không bao gồm comment "Nếu câu..."). File SSOT = file prod Dashboard, không được lệch.

## Acceptance criteria

- [ ] **AC-1 (User-runnable):** User paste SQL block từ mục 1 vào Supabase Dashboard → SQL Editor → New query → Run. Expected: "Success. No rows returned" (hoặc warning "constraint already exists" với câu UNIQUE cuối cùng — OK).
- [ ] **AC-2 (User-runnable):** Chạy tiếp trên SQL Editor:
  ```sql
  SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
  ```
  Expected: 1 row trả về, `extname = vector`.
- [ ] **AC-3 (User-runnable):** Chạy tiếp:
  ```sql
  SELECT column_name, data_type, udt_name
  FROM information_schema.columns
  WHERE table_name = 'card_embeddings'
  ORDER BY ordinal_position;
  ```
  Expected 4 rows: `card_id uuid`, `document_id uuid`, `embedding USER-DEFINED vector`, `created_at timestamp with time zone`.
- [ ] **AC-4 (User-runnable):** Chạy tiếp:
  ```sql
  SELECT indexname FROM pg_indexes
  WHERE tablename = 'card_embeddings'
  ORDER BY indexname;
  ```
  Expected 3 rows: `card_embeddings_document_idx`, `card_embeddings_pkey`, `card_embeddings_vector_idx`.
- [ ] **AC-5 (User-runnable):** Verify RLS:
  ```sql
  SELECT policyname FROM pg_policies WHERE tablename = 'card_embeddings';
  ```
  Expected 2 rows: `card_embeddings_public_read`, `card_embeddings_service_write`.
- [ ] **AC-6 (Agent):** `vibeseek/supabase-schema.sql` append đúng block SQL (ext + table + indexes + RLS + `raw_text` ALTER + quiz UNIQUE). `git diff` chỉ show append — không xoá dòng cũ nào.
- [ ] **AC-7 (User-runnable):** Sau khi SQL apply, verify `raw_text` column exists:
  ```sql
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_name = 'vibe_documents' AND column_name = 'raw_text';
  ```
  Expected: 1 row `raw_text | text`.
- [ ] **AC-8 (Agent):** `vibeseek/app/api/vibefy/route.ts` INSERT bao gồm `raw_text: extractedText`. `git diff` chỉ show +1 dòng trong object insert, không side effect khác.
- [ ] **AC-9 (Agent):** `cd vibeseek && npx tsc --noEmit` pass.
- [ ] **AC-10 (User-runnable):** Upload 1 PDF mới qua dashboard → check DB:
  ```sql
  SELECT id, title, length(raw_text) AS txt_len
  FROM vibe_documents ORDER BY created_at DESC LIMIT 1;
  ```
  Expected: `txt_len > 100` (tuỳ PDF, thường vài nghìn).

## Definition of Done
- [ ] All AC pass (AC-1..5 do user; AC-6..7 do agent)
- [ ] AGENT_LOG.md entry `started` + `completed`
- [ ] Task status → `review` sau khi PR mở
- [ ] PR opened targeting `main`

## Failure modes (defensive checklist — BẮT BUỘC pre-empt)

| # | Failure mode | Defensive action |
|---|---|---|
| F-1 | User quên Run SQL, chỉ update `supabase-schema.sql` → prod DB vẫn thiếu table | PR description PHẢI ghi checklist: "(1) Run SQL trên Dashboard — xong chưa? (2) Verify bằng AC-2..5". Architect review kiểm tra 5 verify queries đã chạy. |
| F-2 | `CREATE EXTENSION vector` fail vì Supabase plan không bật sẵn pgvector | Supabase Free tier có pgvector từ 2023 (confirmed hiện tại). Nếu fail → báo blocker, KHÔNG tự enable qua phương pháp khác. |
| F-3 | `CREATE TABLE` fail vì đã tồn tại (ví dụ user đã thử migration) | `CREATE TABLE IF NOT EXISTS` handles it. OK. |
| F-4 | Schema file trôi lệch prod vì developer khác chạy DDL manual lần sau | Ghi comment trong `supabase-schema.sql` đầu khối: `-- Phase 3 (T-301) — run on Supabase Dashboard 2026-04-XX`. Khi merge AGENT_LOG note rõ "user đã run trên Dashboard trước khi merge". |
| F-5 | Embedding vector dim sai (768 vs 1536) | Blueprint §3 chốt `text-embedding-004` = 768. Nếu Phase 4 đổi model phải migrate + re-embed. Hardcode 768 giờ không retrofit khi đổi. |
| F-6 | HNSW index chậm lúc table rỗng → user nghĩ broken | HNSW có M/ef params mặc định ổn cho <10k rows. Không cần tune. Chỉ phản ánh khi perf issue thực tế. |
| F-7 | ON DELETE CASCADE từ `vibe_cards` → mất embeddings khi user xoá card | Hiện MVP không có UI xoá card. Nếu Phase 4 thêm → tự động chạy đúng semantics. |
| F-8 | RLS policy block service_role insert vì misconfigured | `auth.role() = 'service_role'` là pattern chuẩn Supabase, đã dùng ở table khác — copy y hệt. Test bằng T-302 smoke sau. |

## Local test plan (10 phút, chạy ngay sau khi SQL apply)

```bash
# 1. Verify extension + table shape qua psql-equivalent (Dashboard SQL Editor đủ)
# Đã cover bởi AC-2..5

# 2. Manual insert + select (verify vector col accepts Array shape)
# SQL Editor chạy:
INSERT INTO card_embeddings (card_id, document_id, embedding)
VALUES (
  (SELECT id FROM vibe_cards LIMIT 1),
  (SELECT document_id FROM vibe_cards LIMIT 1),
  array_fill(0.1, ARRAY[768])::vector
);
# Expected: 1 row inserted.

SELECT card_id, document_id, vector_dims(embedding), created_at
FROM card_embeddings LIMIT 1;
# Expected: vector_dims=768, created_at mới tạo.

# 3. Cleanup test row
DELETE FROM card_embeddings WHERE embedding = array_fill(0.1, ARRAY[768])::vector;
```

Nếu step 2 fail (`array_fill ... cannot cast to vector`) → vector extension bản quá cũ. Supabase nên đã pgvector ≥0.5, không cần fix. Report blocker nếu thực sự lỗi.

## Non-goals (KHÔNG làm trong task này)
- KHÔNG viết embedding function — đó là T-302.
- KHÔNG tạo API route nào — đó là T-302/T-304.
- KHÔNG tạo `chat_messages` table — Q-09 đã chốt defer Phase 4.
- KHÔNG thêm trigger tự động sinh embedding sau insert `vibe_cards` — lazy pattern (T-302).
- KHÔNG seed data giả — embeddings thật phát sinh từ text-embedding-004 ở T-302 smoke.
- KHÔNG backfill `raw_text` cho doc cũ — accept NULL, user re-upload nếu cần chat chất lượng cao.
- KHÔNG refactor `/api/vibefy/route.ts` ngoài 1 dòng thêm `raw_text` vào INSERT object.

## Questions / Blockers
_(none at spec time)_

## Decisions log
_(agent fills during execution)_

## Notes for reviewer
- Pattern bám T-101 + T-201: user chạy DDL, agent sync file.
- HNSW chọn thay IVFFlat vì không cần train trước, phù hợp table bắt đầu rỗng.
- `<=>` cosine distance operator — match với `vector_cosine_ops` index.
- Nếu agent tự ý `DROP TABLE IF EXISTS card_embeddings` trước `CREATE` → **reject**, destructive trên prod.
