import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with elevated privileges
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ===================================
// DATABASE TYPES
// ===================================
export interface VibeDocument {
  id: string
  user_id?: string
  title: string
  original_filename: string
  file_url?: string
  status: 'processing' | 'ready' | 'error'
  total_cards: number
  created_at: string
}

export interface VibeCard {
  id: string
  document_id: string
  order_index: number
  card_type: 'concept' | 'quote' | 'tip' | 'summary' | 'fact'
  title: string
  content: string
  emoji: string
  tags: string[]
  vibe_points: number
  created_at: string
}

export interface QuizQuestion {
  id: string
  card_id: string
  question: string
  options: string[]
  correct_index: number
  explanation: string
}
