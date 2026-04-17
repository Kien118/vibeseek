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

function parseQuizResponse(rawText: string, expectedCount: number): QuizDraft[] {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  const parsed = JSON.parse(cleaned)
  const arr: unknown[] = Array.isArray(parsed) ? parsed : (parsed as { quizzes?: unknown[] }).quizzes || []

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
 * Fallback chain: gemini-2.0-flash → 2.0-flash-lite → 2.5-flash → Groq.
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
        config: { temperature: 0.5, maxOutputTokens: 4096 },
      })
      const rawText = response.text
      if (!rawText) throw new Error('Empty response while generating quiz')

      const drafts = parseQuizResponse(rawText, cards.length)
      console.log(`[Quiz] ✅ ${modelName} → ${drafts.length} quizzes`)
      return drafts
    } catch (err) {
      if (!isQuotaError(err)) throw err
      console.warn(`[Quiz] ❌ ${modelName} quota exceeded, trying next...`)
    }
  }

  console.log('[Quiz] All Gemini exhausted → fallback Groq')
  const raw = await groqChat(
    [
      { role: 'system', content: QUIZ_BATCH_SYSTEM_PROMPT },
      { role: 'user', content: QUIZ_BATCH_USER_PROMPT(cards) },
    ],
    { responseFormat: 'json_object' }
  )
  return parseQuizResponse(raw, cards.length)
}
