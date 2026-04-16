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

    // 2. Quota guard (§7.9) — block if GH Actions minutes near limit
    const { data: jobs } = await supabase
      .from('render_jobs').select('duration_sec')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
      .in('status', ['rendering', 'ready'])
    const totalMin = (jobs || []).reduce(
      (s: number, j: { duration_sec: number | null }) => s + ((j.duration_sec ?? 120) / 60),
      0
    )
    if (totalMin >= 1800) {
      return NextResponse.json({
        error: 'Kho render đã đầy tháng này. Thử lại vào ngày 1 tháng sau.'
      }, { status: 429 })
    }

    // 3. Generate storyboard (Gemini → Groq fallback chain)
    const storyboard = await generateVideoStoryboard(doc.vibe_cards, doc.title, maxScenes)

    // 4. Insert render_jobs
    const { data: job, error } = await supabase
      .from('render_jobs')
      .insert({ document_id: documentId, storyboard, status: 'queued' })
      .select('id').single()
    if (error) throw error

    // 5. Trigger GitHub Actions workflow
    try {
      await triggerRenderVideo(job.id)
    } catch (dispatchErr) {
      const errMsg = dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr)
      await supabase.from('render_jobs').update({
        status: 'failed',
        error_message: `Dispatch failed: ${errMsg}`,
      }).eq('id', job.id)
      throw dispatchErr
    }

    return NextResponse.json({ success: true, jobId: job.id, status: 'queued' }, { status: 202 })
  } catch (err) {
    console.error('[vibefy-video]', err)
    return NextResponse.json({ error: 'Video generation failed', detail: String(err) }, { status: 500 })
  }
}
