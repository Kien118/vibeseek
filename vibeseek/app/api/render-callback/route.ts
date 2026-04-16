import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { safeEqual } from '@/lib/constant-time'

export const dynamic = 'force-dynamic'

const secret = process.env.RENDER_CALLBACK_SECRET!
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const provided = req.headers.get('x-render-secret') || ''
  if (!safeEqual(provided, secret)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { jobId, status, videoUrl, durationSec, errorMessage } = await req.json()
  if (!jobId || !status) return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  if (!['ready', 'failed'].includes(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 })
  }

  const { error } = await supabase.from('render_jobs').update({
    status,
    video_url: videoUrl ?? null,
    duration_sec: durationSec ?? null,
    error_message: errorMessage ?? null,
    updated_at: new Date().toISOString(),
  }).eq('id', jobId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
