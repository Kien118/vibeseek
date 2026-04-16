# T-106 · Refactor `/api/vibefy-video` (enqueue pattern + Groq fallback)

**Status:** `in-progress`
**Severity:** HIGH
**Blueprint ref:** §2.2 step 6, §6.2, §7.3, §7.9, §11 T-106
**Branch:** `task/T-106-refactor-vibefy-video-api`
**Assignee:** claude-opus-4-6
**Depends on:** T-103 (dispatch trigger)

## Context

Hiện tại `/api/vibefy-video` render video **đồng bộ** trong route → sẽ timeout Vercel 10s. Refactor:
1. Generate storyboard với Gemini → fallback Groq khi 429.
2. Insert `render_jobs` row.
3. Trigger GitHub Actions workflow.
4. Return 202 + jobId ngay.
5. Thêm **quota guard** (§7.9) — block nếu GH Actions gần cạn.

## Files to touch
- `vibeseek/lib/ai/providers/groq.ts` (NEW)
- `vibeseek/lib/ai/processor.ts` (MODIFY — thêm Groq fallback trong `generateVideoStoryboard`)
- `vibeseek/app/api/vibefy-video/route.ts` (MODIFY — enqueue pattern)
- Update task file + AGENT_LOG

## Architect's spec

### 1. `vibeseek/lib/ai/providers/groq.ts` (NEW)

```ts
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
```

### 2. Modify `vibeseek/lib/ai/processor.ts` — `generateVideoStoryboard`

Thêm Groq fallback sau Gemini chain. **BỎ** `buildLocalStoryboard()` call (blueprint §7.3).

Pseudo:
```ts
export async function generateVideoStoryboard(cards, title, maxScenes) {
  try {
    return await callGemini('gemini-2.0-flash', ...)
  } catch (e) {
    if (!is429(e)) throw e
    try { return await callGemini('gemini-2.0-flash-lite', ...) } catch (e2) {
      if (!is429(e2)) throw e2
      try { return await callGemini('gemini-2.5-flash', ...) } catch (e3) {
        if (!is429(e3)) throw e3
        // Fallback to Groq
        const raw = await groqChat([
          { role: 'system', content: VIDEO_STORYBOARD_SYSTEM_PROMPT },
          { role: 'user', content: buildStoryboardUserPrompt(cards, title, maxScenes) },
        ], { responseFormat: 'json_object' })
        return validateStoryboard(JSON.parse(raw))
      }
    }
  }
}
```

(Exact structure agent figure out by reading existing `processor.ts`.)

### 3. Refactor `vibeseek/app/api/vibefy-video/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateVideoStoryboard } from '@/lib/ai/processor'
import { triggerRenderVideo } from '@/lib/github/dispatch'

export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { documentId, maxScenes = 6 } = await request.json()
    if (!documentId) return NextResponse.json({ error: 'documentId required' }, { status: 400 })

    // 1. Load document + cards
    const { data: doc } = await supabase
      .from('vibe_documents').select('*, vibe_cards(*)').eq('id', documentId).single()
    if (!doc) return NextResponse.json({ error: 'document not found' }, { status: 404 })

    // 2. Quota guard (§7.9)
    const { data: recent } = await supabase.rpc('sum_render_duration_30d')  // OR inline SQL
    // OR simple:
    const { data: jobs } = await supabase
      .from('render_jobs').select('duration_sec')
      .gte('created_at', new Date(Date.now() - 30*24*3600*1000).toISOString())
      .in('status', ['rendering', 'ready'])
    const totalMin = (jobs || []).reduce((s, j) => s + (j.duration_sec || 120) / 60, 0)
    if (totalMin >= 1800) {
      return NextResponse.json({
        error: 'Kho render đã đầy tháng này. Thử lại vào ngày 1 tháng sau.'
      }, { status: 429 })
    }

    // 3. Generate storyboard (Gemini → Groq)
    const storyboard = await generateVideoStoryboard(doc.vibe_cards, doc.title, maxScenes)

    // 4. Insert render_jobs
    const { data: job, error } = await supabase
      .from('render_jobs')
      .insert({ document_id: documentId, storyboard, status: 'queued' })
      .select('id').single()
    if (error) throw error

    // 5. Trigger workflow (fire-and-forget intent, but await to catch dispatch errors)
    try {
      await triggerRenderVideo(job.id)
    } catch (dispatchErr) {
      await supabase.from('render_jobs').update({
        status: 'failed',
        error_message: `Dispatch failed: ${dispatchErr.message}`,
      }).eq('id', job.id)
      throw dispatchErr
    }

    return NextResponse.json({ success: true, jobId: job.id, status: 'queued' }, { status: 202 })
  } catch (err) {
    console.error('[vibefy-video]', err)
    return NextResponse.json({ error: 'Video generation failed', detail: String(err) }, { status: 500 })
  }
}
```

## Acceptance criteria
- [ ] AC-1: `npx tsc --noEmit` pass.
- [ ] AC-2: `npm run build` pass.
- [ ] AC-3: POST `/api/vibefy-video { documentId: "<real-doc>" }` → response ≤ 10s, body = `{ success: true, jobId, status: "queued" }`.
- [ ] AC-4: `render_jobs` row được insert với storyboard JSONB hợp lệ, status=queued.
- [ ] AC-5: GitHub Actions tab có workflow run xuất hiện ngay sau request (sau khi T-104 merged).
- [ ] AC-6: Khi Gemini trả 429 (khó force), Groq fallback kick in — verify bằng unit test mock hoặc để AC trust review. Agent có thể skip AC-6, ghi Decisions log.
- [ ] AC-7: Quota guard trả 429 khi mock `totalMin >= 1800` (test bằng insert nhiều render_jobs fake → call API).

## Definition of Done
- [ ] All AC pass (AC-6/7 có thể partial)
- [ ] AGENT_LOG.md entry started + completed
- [ ] PR opened
- [ ] Status = `review`

## Questions / Blockers
_(none)_

## Decisions log
_(agent ghi)_

## Notes for reviewer
- `buildLocalStoryboard` trong processor.ts phải BỎ (không fallback). Nếu cả Gemini + Groq fail → throw, user retry.
- Quota guard SQL — nếu `duration_sec` null cho job đang rendering, approximate bằng 120 (2 phút default).
- Nếu agent thấy `processor.ts` phức tạp, đụng nhiều hơn dự kiến → ghi Decisions log, đừng lặng lẽ refactor lớn.
