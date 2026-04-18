import { GoogleGenAI } from '@google/genai'

// text-embedding-004 has been superseded by gemini-embedding-001 in the new @google/genai SDK.
// outputDimensionality: 768 keeps the same vector dimension as text-embedding-004 so the
// existing card_embeddings column (vector(768)) in T-301 remains compatible.
const EMBED_MODEL = 'gemini-embedding-001'
const EMBED_DIM = 768
const BATCH_SIZE = 100 // Gemini embedContent API limit per request

const forceFailGemini = () => process.env.DEBUG_FORCE_GEMINI_FAIL === 'true'

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || apiKey === 'your-gemini-api-key-here') {
    throw new Error('GEMINI_API_KEY is not configured.')
  }
  return new GoogleGenAI({ apiKey })
}

function isRetriableEmbedError(err: unknown): boolean {
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
 * Embed a batch of text inputs. Returns an array of 768-dim vectors in same order.
 * Retries up to 2 times on retriable errors with exponential backoff.
 * Throws if still failing — caller (API route) maps to 503 for UI.
 */
export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return []
  if (forceFailGemini()) {
    throw new Error('DEBUG_FORCE_GEMINI_FAIL active — simulating Gemini outage')
  }

  const genAI = getGenAI()
  const results: number[][] = []

  for (let start = 0; start < inputs.length; start += BATCH_SIZE) {
    const batch = inputs.slice(start, start + BATCH_SIZE)
    let lastErr: unknown = null

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await genAI.models.embedContent({
          model: EMBED_MODEL,
          contents: batch, // @google/genai accepts string[] directly
          config: { outputDimensionality: EMBED_DIM }, // request 768-dim to match vector(768) DB column
        })
        const embeds = response.embeddings
        if (!embeds || embeds.length !== batch.length) {
          throw new Error(
            `Embedding count mismatch: expected ${batch.length}, got ${embeds?.length ?? 0}`
          )
        }
        for (const item of embeds) {
          const values = item.values
          if (!values || values.length !== EMBED_DIM) {
            throw new Error(
              `Embedding dim mismatch: expected ${EMBED_DIM}, got ${values?.length ?? 0}`
            )
          }
          results.push(values)
        }
        lastErr = null
        break
      } catch (err) {
        lastErr = err
        if (!isRetriableEmbedError(err) || attempt === 2) {
          throw err
        }
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
      }
    }
    if (lastErr) throw lastErr
  }

  return results
}

export const EMBEDDING_DIM = EMBED_DIM
