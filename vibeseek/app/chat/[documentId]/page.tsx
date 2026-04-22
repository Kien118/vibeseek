import Link from 'next/link'
import ChatPanel from '@/components/ChatPanel'
import { supabaseAdmin } from '@/utils/supabase'

export const dynamic = 'force-dynamic'

interface Props {
  params: { documentId: string }
}

export default async function ChatPage({ params }: Props) {
  const { documentId } = params

  // P-502 hotfix: fetch cards server-side so ChatPanel's Feynman concept picker
  // has data. Without this, cards prop is undefined → picker shows empty.
  const { data: cards } = await supabaseAdmin
    .from('vibe_cards')
    .select('id, title')
    .eq('document_id', documentId)
    .order('order_index', { ascending: true })

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <Link href="/dashboard" className="inline-block text-sm text-[#F5B83E] underline">← Về Dashboard</Link>
      <h1 className="text-2xl font-bold text-[#F5EFE4]">💬 Chat với DOJO</h1>
      <ChatPanel documentId={documentId} cards={cards ?? []} />
      <p className="text-xs text-[#9A928A]">
        DOJO chỉ trả lời dựa trên tài liệu bạn đã upload. Câu trả lời có thể sai — kiểm tra chéo với tài liệu gốc.
      </p>
    </main>
  )
}
