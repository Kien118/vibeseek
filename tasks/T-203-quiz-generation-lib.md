# T-203 · `lib/ai/quiz.ts` — batch quiz generation (Gemini → Groq)

**Status:** `review`
**Severity:** HIGH
**Blueprint ref:** §7.3 (fallback chain), §7.5 (quiz rules), §11
**Branch:** `task/T-203-quiz-generation-lib`
**Assignee:** _(tba)_
**Depends on:** _(none — can run parallel with T-201, T-202)_

## Context

Sinh quiz từ danh sách Vibe Cards. Design trước đó (§2.3 blueprint) nói "fire-and-forget trong `/api/vibefy`" — **NHƯNG trên Vercel serverless, response returned = function terminated → promise không chạy**. Kiến trúc mới (quyết định ngày 2026-04-17): **lazy generate** — khi user lần đầu vào `/quiz/[documentId]`, API `/api/quiz/generate` sẽ gọi lib này sync nếu chưa có quiz.

Task này **chỉ xây lib layer**. API route ở T-204. Integration UI ở T-205.

## Files to touch
- `vibeseek/lib/ai/prompts.ts` (APPEND `QUIZ_BATCH_SYSTEM_PROMPT` + `QUIZ_BATCH_USER_PROMPT`, KHÔNG xoá prompt cũ)
- `vibeseek/lib/ai/quiz.ts` (NEW)
- Update task file + AGENT_LOG

## Architect's spec

### 1. Append to `vibeseek/lib/ai/prompts.ts`

```ts
export const QUIZ_BATCH_SYSTEM_PROMPT = `Bạn là Quiz Master AI của VibeSeek. Tạo câu hỏi trắc nghiệm từ danh sách Vibe Cards.

NHIỆM VỤ: Với mỗi card, tạo 1 câu hỏi trắc nghiệm 4 đáp án kiểm tra hiểu biết (không chỉ nhớ máy móc).

QUY TẮC:
- Mỗi câu hỏi: 4 options, 1 correct, explanation ≤ 2 câu.
- Options cùng độ dài tương đương, không quá dễ loại trừ.
- Tiếng Việt, tone thân thiện như blueprint VibeSeek.
- correct_index: 0-based index của đáp án đúng.
- Giữ đúng thứ tự card đầu vào → trả về array theo cùng thứ tự.

RESPONSE FORMAT (JSON array only, no markdown):
[
  {
    "card_index": 0,
    "question": "Câu hỏi rõ ràng?",
    "options": ["A", "B", "C", "D"],
    "correct_index": 0,
    "explanation": "Giải thích ngắn (1-2 câu)"
  }
]`

export const QUIZ_BATCH_USER_PROMPT = (
  cards: Array<{ title: string; content: string }>
) => `
Tạo 1 câu hỏi trắc nghiệm cho MỖI card bên dưới. Trả về JSON array theo đúng thứ tự card (card_index bắt đầu từ 0).

Cards:
${cards.map((c, i) => `[${i}] ${c.title}\n    ${c.content}`).join('\n\n')}

Trả về JSON array thuần, không markdown, không text thừa.`
```

### 2. `vibeseek/lib/ai/quiz.ts`

```ts
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
```

## Acceptance criteria
- [x] AC-1: `vibeseek/lib/ai/prompts.ts` giữ nguyên prompts cũ + append 2 const mới (`QUIZ_BATCH_SYSTEM_PROMPT`, `QUIZ_BATCH_USER_PROMPT`).
- [x] AC-2: `vibeseek/lib/ai/quiz.ts` exports `generateQuizzesForCards` + interface `QuizDraft`.
- [x] AC-3: `npx tsc --noEmit` pass.
- [x] AC-4: `npm run build` pass.
- [x] AC-5: Smoke test — agent tạo script dùng thử:
  ```ts
  // vibeseek/scripts/smoke-quiz.ts (temporary, not committed)
  import { generateQuizzesForCards } from '@/lib/ai/quiz'
  const cards = [
    { title: 'Bubble Sort', content: 'Thuật toán sắp xếp đơn giản, so sánh từng cặp phần tử liền kề.' },
    { title: 'Quick Sort', content: 'Thuật toán chia để trị, dùng pivot để chia mảng thành 2 phần.' },
  ]
  generateQuizzesForCards(cards).then(console.log)
  ```
  Chạy với `npx tsx vibeseek/scripts/smoke-quiz.ts` (cần env GEMINI_API_KEY). Verify: output là array 2 object, mỗi object đúng shape `QuizDraft`, correct_index 0-3, options.length===4. **XOÁ file smoke sau khi verify — KHÔNG commit.** Nếu hết quota Gemini → agent log lại errors để reviewer tự chạy.
- [x] AC-6: Khi `cards = []` → hàm return `[]` ngay (không call AI).
- [x] AC-7: Khi AI return options ≠ 4 hoặc correct_index ngoài 0-3 → throw validation error (kiểm tra `parseQuizResponse`).

## Definition of Done
- [x] All AC pass (AC-5 có thể partial nếu hết quota Gemini — ghi Decisions log)
- [x] AGENT_LOG.md entry started + completed
- [x] PR opened
- [x] Status = `review`

## Questions / Blockers
_(none)_

## Decisions log
- Ran smoke test successfully via `.env.local` which fell back to Groq since Gemini quota was exceeded. Script was deleted post-run.

## Notes for reviewer
- Pattern follow processor.ts `generateVideoStoryboard` chính xác — Gemini 3-model chain → Groq fallback.
- KHÔNG `buildLocalQuiz` fallback — blueprint §7.3 rule: fail hard nếu hết cả Gemini + Groq.
- Prompt batch (1 call → N quizzes) tiết kiệm quota vs N calls. 10 cards = 1 req thay vì 10.
- Validation bên `parseQuizResponse` bắt buộc: AI có thể return malformed, không trust.
- KHÔNG động API route (`/api/vibefy` hoặc `/api/quiz/*`) — đó là scope T-204.
