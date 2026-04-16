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
