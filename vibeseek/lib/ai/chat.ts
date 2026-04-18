import { GoogleGenAI } from '@google/genai'
import { supabaseAdmin } from '@/utils/supabase' // architect audit 2026-04-18 — verified path
import { embedTexts } from './embeddings'
import { CHAT_SYSTEM_PROMPT } from './prompts'
import { groqChat } from './providers/groq' // note: current groqChat returns string non-streaming — see §4 below

export interface RetrievedCard {
  card_id: string
  title: string
  content: string
  distance: number
}

export interface RetrievedContext {
  cards: RetrievedCard[]
  textSnippet: string
  documentTitle: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const MAX_HISTORY_MESSAGES = 6
const MAX_SNIPPET_CHARS = 2000
const TOP_K = 5

// Two independent flags. `DEBUG_FORCE_GEMINI_FAIL` blocks EVERYTHING Gemini
// (including embed + chat) — useful to simulate complete Gemini outage.
// `DEBUG_FORCE_CHAT_GEMINI_FAIL` blocks only the chat streaming block, so
// retrieveContext (which uses embed) still works → lets you test Groq
// streaming fallback without also killing RAG retrieval.
const forceFailGemini = () => process.env.DEBUG_FORCE_GEMINI_FAIL === 'true'
const forceFailChatGemini = () =>
  forceFailGemini() || process.env.DEBUG_FORCE_CHAT_GEMINI_FAIL === 'true'

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not configured.')
  }
  return new GoogleGenAI({ apiKey })
}

function isRetriableError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()
  return (
    message.includes('429') ||
    message.includes('500') ||
    message.includes('503') ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('unavailable') ||
    lower.includes('overloaded') ||
    lower.includes('deadline')
  )
}

/**
 * Retrieve RAG context for a chat query.
 * 1. Embed the query (1 call).
 * 2. kNN search top-5 cards via pgvector cosine (`<=>` operator).
 * 3. Fetch document title + raw_text snippet (keyword-biased).
 *
 * Throws if no cards found or embedding fails — caller (route) maps to 404/503.
 */
export async function retrieveContext(
  documentId: string,
  query: string,
): Promise<RetrievedContext> {
  // 1. Document metadata + raw text
  const { data: doc, error: docErr } = await supabaseAdmin
    .from('vibe_documents')
    .select('id, title, raw_text')
    .eq('id', documentId)
    .maybeSingle()

  if (docErr) throw new Error(`document query failed: ${docErr.message}`)
  if (!doc) throw new Error('document_not_found')

  // 2. Embed query
  const [queryVec] = await embedTexts([query])
  if (!queryVec) throw new Error('query embedding failed')

  // 3. kNN via RPC or direct SQL. Use rpc('match_card_embeddings', ...) — see §3.
  const { data: matches, error: matchErr } = await supabaseAdmin.rpc(
    'match_card_embeddings',
    {
      p_document_id: documentId,
      p_query_embedding: queryVec,
      p_match_count: TOP_K,
    },
  )

  if (matchErr) throw new Error(`knn rpc failed: ${matchErr.message}`)
  if (!matches || matches.length === 0) throw new Error('no_embeddings')

  const cards: RetrievedCard[] = matches.map((m: { card_id: string; title: string; content: string; distance: number }) => ({
    card_id: m.card_id,
    title: m.title,
    content: m.content,
    distance: Number(m.distance),
  }))

  // 4. Raw text snippet biased by first keyword of query (≥4 chars, Vietnamese-friendly)
  const rawText: string = doc.raw_text ?? ''
  const textSnippet = pickSnippet(rawText, query, MAX_SNIPPET_CHARS)

  return {
    cards,
    textSnippet,
    documentTitle: doc.title ?? 'Tài liệu',
  }
}

function pickSnippet(rawText: string, query: string, maxChars: number): string {
  if (rawText.length <= maxChars) return rawText
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length >= 4)
  const lower = rawText.toLowerCase()
  for (const kw of keywords) {
    const pos = lower.indexOf(kw)
    if (pos >= 0) {
      const start = Math.max(0, pos - Math.floor(maxChars / 2))
      return rawText.slice(start, start + maxChars)
    }
  }
  return rawText.slice(0, maxChars)
}

function buildUserPrompt(context: RetrievedContext, history: ChatMessage[], message: string): string {
  const trimmedHistory = history.slice(-MAX_HISTORY_MESSAGES)
  const contextBlock = [
    `=== TÀI LIỆU: ${context.documentTitle} ===`,
    '',
    '# Vibe Cards liên quan (sắp xếp theo độ gần nhất):',
    ...context.cards.map((c, i) => `[${i + 1}] ${c.title}\n    ${c.content}`),
    '',
    '# Trích đoạn tài liệu gốc:',
    context.textSnippet,
    '=== HẾT CONTEXT ===',
  ].join('\n')

  const historyBlock = trimmedHistory.length
    ? '\n# Lịch sử trò chuyện (gần nhất):\n' +
      trimmedHistory.map(m => `${m.role === 'user' ? 'User' : 'DOJO'}: ${m.content}`).join('\n')
    : ''

  return `${contextBlock}${historyBlock}\n\n# Câu hỏi hiện tại của User:\n${message}\n\n# Trả lời của DOJO:`
}

export interface StreamChunk {
  delta: string
}

/**
 * Stream a chat response. Yields text chunks. Swallows per-provider errors
 * to try next in chain, but only IF no chunk has been yielded yet.
 * If a provider yields ≥1 chunk then fails mid-stream, error propagates to caller.
 *
 * Consumer (route) is responsible for writing chunks into SSE stream.
 */
export async function* streamChatResponse(
  context: RetrievedContext,
  history: ChatMessage[],
  message: string,
): AsyncGenerator<StreamChunk, { tokensUsed: number }, void> {
  const userPrompt = buildUserPrompt(context, history, message)
  const geminiModels = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash']

  let yieldedAny = false
  let totalChars = 0
  let lastErr: unknown = null

  if (!forceFailChatGemini()) {
    const genAI = getGenAI()
    for (const modelName of geminiModels) {
      if (yieldedAny) break
      try {
        const stream = await genAI.models.generateContentStream({
          model: modelName,
          contents: `${CHAT_SYSTEM_PROMPT}\n\n${userPrompt}`,
          config: { temperature: 0.7, maxOutputTokens: 2048 },
        })
        for await (const chunk of stream) {
          const text = chunk.text
          if (text) {
            yieldedAny = true
            totalChars += text.length
            yield { delta: text }
          }
        }
        return { tokensUsed: Math.ceil(totalChars / 4) }
      } catch (err) {
        lastErr = err
        if (yieldedAny) {
          // already sent partial — don't fall through, let caller handle
          throw err
        }
        if (!isRetriableError(err)) throw err
        console.warn(`[chat] ${modelName} failed, trying next`, err)
      }
    }
  }

  // Groq fallback — non-streaming now, simulate stream by yielding in chunks.
  // (Blueprint note: if performance suffers, upgrade groqChat to real streaming later.)
  if (!yieldedAny) {
    console.log('[chat] falling back to Groq')
    const full = await groqChat(
      [
        { role: 'system', content: CHAT_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { model: 'llama-3.3-70b-versatile', temperature: 0.7 },
    )
    // chunk every ~40 chars to simulate progressive render
    const CHUNK = 40
    for (let i = 0; i < full.length; i += CHUNK) {
      yield { delta: full.slice(i, i + CHUNK) }
      totalChars += Math.min(CHUNK, full.length - i)
    }
    return { tokensUsed: Math.ceil(totalChars / 4) }
  }

  // Unreachable — if yielded, we returned earlier. Kept for type safety.
  throw lastErr ?? new Error('chat providers exhausted')
}
