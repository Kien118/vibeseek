import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/utils/supabase'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { jobId: string } }) {
  // Use supabaseAdmin (service role + noStoreFetch) to bypass Next.js fetch
  // cache — same hotfix pattern as commit eefa538 (Phase 2 hotfix). Anon
  // client with default fetch would serve stale status='queued' forever
  // after render.mjs has already transitioned the row to 'ready' in DB.
  const { data, error } = await supabaseAdmin
    .from('render_jobs')
    .select('id,status,video_url,duration_sec,error_message')
    .eq('id', params.jobId)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 })

  return NextResponse.json({
    jobId: data.id,
    status: data.status,
    videoUrl: data.video_url,
    durationSec: data.duration_sec,
    errorMessage: data.error_message,
  })
}
