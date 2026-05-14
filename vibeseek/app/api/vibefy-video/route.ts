import { NextRequest, NextResponse } from 'next/server'
import { generateVideoStoryboard } from '@/lib/ai/processor'
import { triggerRenderVideo } from '@/lib/github/dispatch'
import { supabaseAdmin } from '@/utils/supabase'

export const maxDuration = 30

type StartRequest = {
  documentId?: unknown
  maxScenes?: unknown
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

function jsonError(error: string, detail: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, detail, ...extra }, { status })
}

export async function POST(request: NextRequest) {
  let body: StartRequest

  try {
    body = (await request.json()) as StartRequest
  } catch (err) {
    return jsonError('Invalid request body', errorMessage(err), 400)
  }

  const documentId = typeof body.documentId === 'string' ? body.documentId.trim() : ''
  const maxScenes = typeof body.maxScenes === 'number' && Number.isFinite(body.maxScenes)
    ? body.maxScenes
    : 6

  if (!documentId) {
    return jsonError('documentId required', 'Request body must include a documentId string.', 400)
  }

  console.info('[vibefy-video] start', { documentId, maxScenes })

  try {
    const { data: doc, error: docError } = await supabaseAdmin
      .from('vibe_documents')
      .select('*, vibe_cards(*)')
      .eq('id', documentId)
      .maybeSingle()

    if (docError) {
      console.error('[vibefy-video] document load failed', { documentId, error: docError.message })
      return jsonError('Document load failed', docError.message, 500)
    }

    if (!doc) {
      return jsonError('Document not found', `No vibe_documents row found for ${documentId}.`, 404)
    }

    const cards = Array.isArray(doc.vibe_cards) ? doc.vibe_cards : []
    if (cards.length === 0) {
      return jsonError('Document has no cards', `Document ${documentId} has no vibe_cards to turn into a storyboard.`, 422)
    }

    const { data: jobs, error: quotaError } = await supabaseAdmin
      .from('render_jobs')
      .select('duration_sec')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
      .in('status', ['rendering', 'ready'])

    if (quotaError) {
      console.error('[vibefy-video] quota check failed', { documentId, error: quotaError.message })
      return jsonError('Quota check failed', quotaError.message, 500)
    }

    const totalMin = (jobs || []).reduce(
      (sum: number, job: { duration_sec: number | null }) => sum + ((job.duration_sec ?? 120) / 60),
      0
    )

    if (totalMin >= 1800) {
      return jsonError(
        'Render quota exhausted',
        'Kho render đã đầy tháng này. Thử lại vào ngày 1 tháng sau.',
        429
      )
    }

    let storyboard: Awaited<ReturnType<typeof generateVideoStoryboard>>
    try {
      storyboard = await generateVideoStoryboard(cards, doc.title, maxScenes)
    } catch (err) {
      const detail = errorMessage(err)
      console.error('[vibefy-video] storyboard failed', { documentId, error: detail })
      return jsonError('Storyboard generation failed', detail, 502)
    }

    const { data: job, error: insertError } = await supabaseAdmin
      .from('render_jobs')
      .insert({ document_id: documentId, storyboard, status: 'queued' })
      .select('id')
      .single()

    if (insertError || !job?.id) {
      const detail = insertError?.message ?? 'Supabase did not return a render job id.'
      console.error('[vibefy-video] render job insert failed', { documentId, error: detail })
      return jsonError('Render job insert failed', detail, 500)
    }

    const jobId = job.id as string
    console.info('[vibefy-video] render job queued', { documentId, jobId })

    try {
      await triggerRenderVideo(jobId)
      console.info('[vibefy-video] dispatch ok', { documentId, jobId, workflow: 'render-video' })
    } catch (dispatchErr) {
      const detail = errorMessage(dispatchErr)
      const { error: updateError } = await supabaseAdmin
        .from('render_jobs')
        .update({
          status: 'failed',
          error_message: `Dispatch failed: ${detail}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      console.error('[vibefy-video] dispatch failed', {
        documentId,
        jobId,
        error: detail,
        updateError: updateError?.message ?? null,
      })

      return jsonError('GitHub dispatch failed', detail, 502, { jobId })
    }

    return NextResponse.json({ success: true, jobId, status: 'queued' }, { status: 202 })
  } catch (err) {
    const detail = errorMessage(err)
    console.error('[vibefy-video] unexpected failure', { documentId, error: detail })
    return jsonError('Video generation failed', detail, 500)
  }
}
