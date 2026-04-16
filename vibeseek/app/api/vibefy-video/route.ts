import { NextRequest, NextResponse } from 'next/server'
import { generateVideoStoryboard } from '@/lib/ai/processor'
import { renderVideoFromStoryboard } from '@/lib/ai/video-renderer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const cards = Array.isArray(body?.cards) ? body.cards : []
    const title = typeof body?.title === 'string' ? body.title : 'Untitled Document'
    const maxScenes = Number(body?.maxScenes) || 6
    const shouldRenderVideo = Boolean(body?.renderVideo)

    if (cards.length === 0) {
      return NextResponse.json({ error: 'No cards provided for video generation.' }, { status: 400 })
    }

    const storyboard = await generateVideoStoryboard(cards, title, maxScenes)
    let video: { publicUrl: string; filePath: string } | null = null
    if (shouldRenderVideo) {
      video = await renderVideoFromStoryboard(storyboard)
    }

    return NextResponse.json({
      success: true,
      storyboard,
      video,
    })
  } catch (error) {
    console.error('[VibefyVideo] Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Video generation failed: ${message}` }, { status: 500 })
  }
}
