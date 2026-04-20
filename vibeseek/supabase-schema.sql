-- =============================================
-- VIBESEEK - Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- =============================================

-- 1. Vibe Documents table
CREATE TABLE IF NOT EXISTS vibe_documents (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_url    TEXT,
  status      TEXT NOT NULL DEFAULT 'processing' 
              CHECK (status IN ('processing', 'ready', 'error')),
  total_cards INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. Vibe Cards table  
CREATE TABLE IF NOT EXISTS vibe_cards (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES vibe_documents(id) ON DELETE CASCADE NOT NULL,
  order_index INTEGER NOT NULL,
  card_type   TEXT NOT NULL 
              CHECK (card_type IN ('concept', 'quote', 'tip', 'fact', 'summary')),
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  emoji       TEXT DEFAULT '⚡',
  tags        TEXT[] DEFAULT '{}',
  vibe_points INTEGER DEFAULT 10,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 3. Quiz Questions table
CREATE TABLE IF NOT EXISTS quiz_questions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id       UUID REFERENCES vibe_cards(id) ON DELETE CASCADE NOT NULL,
  question      TEXT NOT NULL,
  options       TEXT[] NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation   TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 4. User Progress table (for Learn-to-Earn)
CREATE TABLE IF NOT EXISTS user_progress (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  card_id       UUID REFERENCES vibe_cards(id) ON DELETE CASCADE NOT NULL,
  viewed        BOOLEAN DEFAULT false,
  quiz_correct  BOOLEAN,
  vibe_points_earned INTEGER DEFAULT 0,
  completed_at  TIMESTAMPTZ,
  UNIQUE(user_id, card_id)
);

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX idx_vibe_cards_document_id ON vibe_cards(document_id);
CREATE INDEX idx_vibe_cards_order ON vibe_cards(document_id, order_index);
CREATE INDEX idx_user_progress_user ON user_progress(user_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE vibe_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vibe_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- Allow all reads (public demo) - tighten for production
CREATE POLICY "Public read documents" ON vibe_documents FOR SELECT USING (true);
CREATE POLICY "Service insert documents" ON vibe_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Service update documents" ON vibe_documents FOR UPDATE USING (true);

CREATE POLICY "Public read cards" ON vibe_cards FOR SELECT USING (true);
CREATE POLICY "Service insert cards" ON vibe_cards FOR INSERT WITH CHECK (true);

CREATE POLICY "Public read quiz" ON quiz_questions FOR SELECT USING (true);
CREATE POLICY "Service insert quiz" ON quiz_questions FOR INSERT WITH CHECK (true);

CREATE POLICY "Users own progress" ON user_progress 
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- STORAGE BUCKET (Phase 0)
-- Bucket name: vibeseek-files
-- =============================================

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

-- =============================================================
-- Phase 3 (T-301) — pgvector + card_embeddings + raw_text column
-- Run on Supabase Dashboard SQL Editor before merging this PR
-- =============================================================

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

-- =============================================================
-- Phase 5 (T-407) — chat_messages persistence
-- Reinstates Q-09 deferred table (blueprint §5.2). Service-role-only RLS
-- (privacy: anon A must not read anon B's chat via public API).
-- Run on Supabase Dashboard SQL Editor before merging this PR.
-- =============================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES vibe_documents(id) ON DELETE CASCADE,
  anon_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite index matches the hot query pattern:
--   SELECT ... WHERE document_id = $1 AND anon_id = $2 ORDER BY created_at DESC LIMIT 50
CREATE INDEX IF NOT EXISTS chat_messages_doc_anon_created_idx
  ON chat_messages(document_id, anon_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Service-role only — no public read (unlike quiz_attempts / card_embeddings).
-- API routes use supabaseAdmin; browser never queries chat_messages directly.
DROP POLICY IF EXISTS "chat_messages service only" ON chat_messages;
CREATE POLICY "chat_messages service only" ON chat_messages
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
