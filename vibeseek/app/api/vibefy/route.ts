import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromBuffer, vibefyText, chunkText } from '@/lib/ai/processor'

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    // ─── 1. Parse multipart form ───────────────────────────
    const formData = await request.formData()
    const file = formData.get('pdf') as File | null
    const title = formData.get('title') as string || 'Untitled Document'
    const maxCards = parseInt(formData.get('maxCards') as string || '10')

    if (!file) {
      return NextResponse.json({ error: 'No PDF file provided' }, { status: 400 })
    }

    if (!file.name.endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max ${process.env.MAX_FILE_SIZE_MB || 10}MB` },
        { status: 413 }
      )
    }

    // ─── 2. Read file buffer ──────────────────────────────
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    // ─── 3. Extract PDF text ──────────────────────────────
    let extractedText: string

    try {
      extractedText = await extractTextFromBuffer(fileBuffer)
    } catch (pdfError) {
      console.error('[Vibefy] PDF extraction failed:', pdfError)
      return NextResponse.json(
        { error: 'Failed to extract text from PDF. Make sure it is not scanned/image-only.' },
        { status: 422 }
      )
    }

    if (!extractedText || extractedText.trim().length < 50) {
      return NextResponse.json(
        { error: 'PDF appears to have no readable text content (too short or empty).' },
        { status: 422 }
      )
    }

    console.log(`[Vibefy] Extracted ${extractedText.length} chars from PDF`)

    // ─── 4. Vibefy! ───────────────────────────────────────
    const chunks = chunkText(extractedText)
    const primaryChunk = chunks[0]
    
    let cards
    try {
      cards = await vibefyText(primaryChunk, maxCards)
    } catch (aiError) {
      console.error('[Vibefy] AI processing failed:', aiError)
      return NextResponse.json(
        { error: 'AI processing failed. Please check your GEMINI_API_KEY in .env.local or try again later.' },
        { status: 503 }
      )
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json(
        { error: 'AI could not generate any cards from this content.' },
        { status: 422 }
      )
    }

    // ─── 5. Optionally save to Supabase ───────────────────
    let documentId: string | null = null
    try {
      const { supabaseAdmin } = await import('@/utils/supabase')
      
      const { data: docRecord, error: docError } = await supabaseAdmin
        .from('vibe_documents')
        .insert({
          title,
          original_filename: file.name,
          status: 'ready',
          total_cards: cards.length,
          raw_text: extractedText,
        })
        .select()
        .single()

      if (!docError && docRecord) {
        documentId = docRecord.id
        
        // Save cards
        const cardsWithDocId = cards.map(card => ({
          ...card,
          document_id: documentId,
        }))
        
        await supabaseAdmin.from('vibe_cards').insert(cardsWithDocId)
        console.log(`[Vibefy] Saved to DB: ${documentId}`)
      }
    } catch (dbError) {
      // DB save is optional - don't fail the whole request
      console.warn('[Vibefy] DB save skipped (non-critical):', dbError)
    }

    // ─── 6. Return result ─────────────────────────────────
    return NextResponse.json({
      success: true,
      documentId: documentId || 'local',
      totalCards: cards.length,
      cards,
      message: `✨ Vibefy thành công! Tạo ra ${cards.length} Vibe Cards từ PDF của bạn.`,
    })

  } catch (error) {
    console.error('[Vibefy] Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 500 }
    )
  }
}
