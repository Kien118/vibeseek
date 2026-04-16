import { GoogleGenAI } from '@google/genai'
import {
  VIBEFY_SYSTEM_PROMPT,
  VIBEFY_USER_PROMPT,
  VIDEO_STORYBOARD_SYSTEM_PROMPT,
  VIDEO_STORYBOARD_USER_PROMPT,
} from './prompts'
import { groqChat } from './providers/groq'
import type { VibeCard } from '@/utils/supabase'

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Get a free key at https://aistudio.google.com/apikey and add it to .env.local'
    )
  }
  return new GoogleGenAI({ apiKey })
}

// ===================================
// PDF TEXT EXTRACTION
// ===================================
export async function extractTextFromBuffer(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid edge runtime issues
  const pdfParse = (await import('pdf-parse')).default
  const data = await pdfParse(buffer)
  return data.text
}

// ===================================
// VIBEFY: Convert text → Vibe Cards
// Uses Google Gemini (free tier)
// ===================================
export async function vibefyText(
  text: string,
  maxCards: number = 10
): Promise<Omit<VibeCard, 'id' | 'document_id' | 'created_at'>[]> {

  const genAI = getGenAI()
  const fullPrompt = `${VIBEFY_SYSTEM_PROMPT}\n\n${VIBEFY_USER_PROMPT(text, maxCards)}`

  // Models to try in order (all free tier)
  const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash']

  let lastError: Error | null = null

  for (const modelName of models) {
    // Retry each model up to 2 times (with delay for rate limits)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Vibefy] Model: ${modelName}, attempt ${attempt}`)

        const response = await genAI.models.generateContent({
          model: modelName,
          contents: fullPrompt,
          config: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        })

        const rawText = response.text
        if (!rawText) throw new Error('Empty response from Gemini')

        // Strip markdown code fences if present
        const cleaned = rawText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim()

        const parsed = JSON.parse(cleaned)
        const cards = Array.isArray(parsed) ? parsed : parsed.cards || []

        if (cards.length === 0) throw new Error('AI returned empty cards array')

        console.log(`[Vibefy] ✅ Success: ${modelName} → ${cards.length} cards`)
        return validateAndTransformCards(cards)

      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.error(`[Vibefy] ❌ ${modelName} attempt ${attempt}:`, lastError.message?.substring(0, 200))

        // If rate limited, wait before retry
        if (lastError.message?.includes('429') || lastError.message?.includes('quota')) {
          if (attempt < 2) {
            console.log(`[Vibefy] Rate limited, waiting 5s before retry...`)
            await new Promise(r => setTimeout(r, 5000))
          }
        } else {
          // Non-rate-limit error, skip to next model
          break
        }
      }
    }
  }

  throw new Error(
    `All AI models failed. Last error: ${lastError?.message?.substring(0, 200) || 'unknown'}. ` +
    `Please check your GEMINI_API_KEY quota at https://aistudio.google.com/apikey`
  )
}

// ===================================
// CHUNK TEXT for large PDFs
// ===================================
export function chunkText(text: string, chunkSize: number = 4000): string[] {
  const chunks: string[] = []
  const sentences = text.split(/[.!?]+\s/)
  let current = ''

  for (const sentence of sentences) {
    if ((current + sentence).length > chunkSize && current.length > 0) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += sentence + '. '
    }
  }

  if (current.trim()) chunks.push(current.trim())
  return chunks
}

// ===================================
// VALIDATION: Ensure proper card shape
// ===================================
function validateAndTransformCards(
  raw: unknown[]
): Omit<VibeCard, 'id' | 'document_id' | 'created_at'>[] {
  const VALID_TYPES = ['concept', 'quote', 'tip', 'fact', 'summary'] as const

  return raw.map((card: unknown, index: number) => {
    const c = card as Record<string, unknown>
    return {
      order_index: Number(c.order_index) || index + 1,
      card_type: VALID_TYPES.includes(c.card_type as typeof VALID_TYPES[number])
        ? (c.card_type as typeof VALID_TYPES[number])
        : 'concept',
      title: String(c.title || 'Untitled Vibe'),
      content: String(c.content || ''),
      emoji: String(c.emoji || '⚡'),
      tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
      vibe_points: Number(c.vibe_points) || 10,
    }
  })
}

export interface VideoScene {
  scene_index: number
  title: string
  visual_prompt: string
  narration: string
  on_screen_text: string[]
  duration_sec: number
}

export interface VideoStoryboard {
  video_title: string
  total_duration_sec: number
  style: string
  scenes: VideoScene[]
}

// Helper: check if error is a rate-limit / quota error
function isQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return (
    message.includes('429') ||
    message.toLowerCase().includes('quota') ||
    message.includes('RESOURCE_EXHAUSTED')
  )
}

// Helper: parse and validate raw storyboard JSON text
function parseStoryboardResponse(
  rawText: string,
  documentTitle: string
): VideoStoryboard {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const parsed = JSON.parse(cleaned) as Partial<VideoStoryboard>

  const normalizedScenes = Array.isArray(parsed.scenes)
    ? parsed.scenes.map((scene, idx) => ({
        scene_index: Number(scene?.scene_index) || idx + 1,
        title: String(scene?.title || `Scene ${idx + 1}`),
        visual_prompt: String(scene?.visual_prompt || ''),
        narration: String(scene?.narration || ''),
        on_screen_text: Array.isArray(scene?.on_screen_text) ? scene.on_screen_text.map(String) : [],
        duration_sec: Math.min(15, Math.max(4, Number(scene?.duration_sec) || 6)),
      }))
    : []

  if (normalizedScenes.length === 0) {
    throw new Error('Video storyboard generation returned no scenes')
  }

  const totalDuration = normalizedScenes.reduce((sum, scene) => sum + scene.duration_sec, 0)

  return {
    video_title: String(parsed.video_title || `${documentTitle} - AI Video`),
    style: String(parsed.style || 'Neon educational motion graphics'),
    total_duration_sec: Number(parsed.total_duration_sec) || totalDuration,
    scenes: normalizedScenes,
  }
}

// Fallback chain: gemini-2.0-flash → gemini-2.0-flash-lite → gemini-2.5-flash → Groq
export async function generateVideoStoryboard(
  cards: Array<Pick<VibeCard, 'title' | 'content' | 'card_type'>>,
  documentTitle: string,
  maxScenes: number = 6
): Promise<VideoStoryboard> {
  const genAI = getGenAI()
  const fullPrompt = `${VIDEO_STORYBOARD_SYSTEM_PROMPT}\n\n${VIDEO_STORYBOARD_USER_PROMPT(cards, documentTitle, maxScenes)}`

  const geminiModels = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash']

  for (const modelName of geminiModels) {
    try {
      console.log(`[Storyboard] Trying ${modelName}`)
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: fullPrompt,
        config: {
          temperature: 0.6,
          maxOutputTokens: 4096,
        },
      })

      const rawText = response.text
      if (!rawText) throw new Error('Empty response while generating video storyboard')

      const storyboard = parseStoryboardResponse(rawText, documentTitle)
      console.log(`[Storyboard] ✅ Success with ${modelName}`)
      return storyboard
    } catch (err) {
      if (!isQuotaError(err)) throw err
      console.warn(`[Storyboard] ❌ ${modelName} quota exceeded, trying next...`)
    }
  }

  // Final fallback: Groq
  console.log('[Storyboard] All Gemini models exhausted, falling back to Groq')
  const raw = await groqChat(
    [
      { role: 'system', content: VIDEO_STORYBOARD_SYSTEM_PROMPT },
      {
        role: 'user',
        content: VIDEO_STORYBOARD_USER_PROMPT(cards, documentTitle, maxScenes),
      },
    ],
    { responseFormat: 'json_object' }
  )
  return parseStoryboardResponse(raw, documentTitle)
}
