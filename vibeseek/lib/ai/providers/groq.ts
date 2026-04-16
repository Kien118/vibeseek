const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const apiKey = process.env.GROQ_API_KEY!

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function groqChat(
  messages: GroqChatMessage[],
  opts: { model?: string; temperature?: number; responseFormat?: 'json_object' | 'text' } = {}
): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model || 'llama-3.3-70b-versatile',
      messages,
      temperature: opts.temperature ?? 0.7,
      response_format: opts.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Groq API error ${res.status}: ${body}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}
