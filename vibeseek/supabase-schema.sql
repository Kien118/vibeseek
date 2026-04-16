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
-- STORAGE BUCKET
-- Run separately in Supabase → Storage → New bucket
-- Bucket name: vibeseek-files
-- Public: true (for demo)
-- =============================================
