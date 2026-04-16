import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!   // public RLS read is fine
)

export async function GET(_req: NextRequest, { params }: { params: { jobId: string } }) {
  const { data, error } = await supabase
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
