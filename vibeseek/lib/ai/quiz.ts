import { GoogleGenAI } from '@google/genai'
import { QUIZ_BATCH_SYSTEM_PROMPT, QUIZ_BATCH_USER_PROMPT } from './prompts'
import { groqChat } from './providers/groq'

export interface QuizDraft {
  card_index: number
  question: string
  options: string[]
  correct_index: number
  explanation: string
}

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not configured.')
  }
  return new GoogleGenAI({ apiKey })
}

function isQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return (
    message.includes('429') ||
    message.toLowerCase().includes('quota') ||
    message.includes('RESOURCE_EXHAUSTED')
  )
}

// Treat as retriable: quota (429), JSON parse failure (truncation mid-string),
// transient server errors (500/503 UNAVAILABLE/overloaded), empty responses, and shape validation
// failures. The next model (or Groq fallback) may succeed where this one failed.
function isRetriableModelError(err: unknown): boolean {
  if (isQuotaError(err)) return true
  if (err instanceof SyntaxError) return true
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()
  return (
    message.includes('503') ||
    message.includes('500') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('deadline') ||
    message.includes('Empty response') ||
    message.includes('must have exactly 4 options') ||
    message.includes('correct_index out of range') ||
    message.includes('returned empty array') ||
    message.includes('is not valid JSON')
  )
}

// Try to extract an array of quizzes from the parsed JSON, accepting common wrapper shapes
// (different LLMs wrap arrays under different keys when forced into an object response).
function extractQuizArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    for (const key of ['quizzes', 'questions', 'items', 'results', 'data', 'quiz']) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[]
    }
    // Fallback: pick the first array-valued property.
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) return value
    }
  }
  return []
}

function parseQuizResponse(rawText: string, expectedCount: number): QuizDraft[] {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const parsed = JSON.parse(cleaned)
  const arr = extractQuizArray(parsed)

  if (arr.length === 0) throw new Error('Quiz generation returned empty array')

  return arr.map((raw, idx) => {
    const q = raw as Record<string, unknown>
    const options = Array.isArray(q.options) ? q.options.map(String) : []
    if (options.length !== 4) {
      throw new Error(`Quiz #${idx} must have exactly 4 options (got ${options.length})`)
    }
    const correctIndex = Number(q.correct_index)
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      throw new Error(`Quiz #${idx} correct_index out of range (got ${correctIndex})`)
    }
    return {
      card_index: Number(q.card_index) ?? idx,
      question: String(q.question || '').trim(),
      options,
      correct_index: correctIndex,
      explanation: String(q.explanation || '').trim(),
    }
  }).slice(0, expectedCount)
}

/**
 * Generate one quiz per card. Batch single-request to save quota.
 * Fallback chain: gemini-2.0-flash -> 2.0-flash-lite -> 2.5-flash -> Groq.
 * Throws if all providers fail (caller handles 503 to user).
 */
export async function generateQuizzesForCards(
  cards: Array<{ title: string; content: string }>
): Promise<QuizDraft[]> {
  if (cards.length === 0) return []

  const genAI = getGenAI()
  const fullPrompt = `${QUIZ_BATCH_SYSTEM_PROMPT}\n\n${QUIZ_BATCH_USER_PROMPT(cards)}`
  const geminiModels = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash']

  for (const modelName of geminiModels) {
    try {
      console.log(`[Quiz] Trying ${modelName} for ${cards.length} cards`)
      const response = await genAI.models.generateContent({
        model: modelName,
        contents: fullPrompt,
        config: { temperature: 0.5, maxOutputTokens: 16384 },
      })
      const rawText = response.text
      if (!rawText) throw new Error('Empty response while generating quiz')

      const drafts = parseQuizResponse(rawText, cards.length)
      console.log(`[Quiz] ${modelName} -> ${drafts.length} quizzes`)
      return drafts
    } catch (err) {
      if (!isRetriableModelError(err)) throw err
      const reason = err instanceof Error ? err.message.slice(0, 120) : String(err)
      console.warn(`[Quiz] ${modelName} failed (retriable): ${reason}. Trying next...`)
    }
  }

  console.log('[Quiz] All Gemini exhausted -> fallback Groq')
  // Do NOT use responseFormat: 'json_object' here — Groq's object mode wraps arrays under
  // an LLM-chosen key, which was returning empty results. llama-3.3-70b follows plain JSON
  // instructions in the system prompt reliably and returns the array directly.
  const raw = await groqChat([
    { role: 'system', content: QUIZ_BATCH_SYSTEM_PROMPT },
    { role: 'user', content: QUIZ_BATCH_USER_PROMPT(cards) },
  ])
  console.log(`[Quiz] Groq raw length=${raw.length} chars, preview: ${raw.slice(0, 120)}`)
  return parseQuizResponse(raw, cards.length)
}
