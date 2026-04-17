import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Next.js augments global fetch with its own data cache. Supabase-js calls
// use that fetch by default, so server-side reads can serve stale rows even
// when the route is marked `dynamic = 'force-dynamic'`. Override with a fetch
// that opts out of the Next.js cache for every Supabase request.
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store' })

// Server-side client with elevated privileges
export const supabaseAdmin = createClient(
  supabaseUrl,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
    global: { fetch: noStoreFetch },
  }
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
