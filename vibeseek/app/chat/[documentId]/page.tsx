import Link from 'next/link'
import ChatPanel from '@/components/ChatPanel'

export const dynamic = 'force-dynamic'

interface Props {
  params: { documentId: string }
}

export default function ChatPage({ params }: Props) {
  const { documentId } = params
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <Link href="/dashboard" className="inline-block text-sm text-pink-600 underline">← Về Dashboard</Link>
      <h1 className="text-2xl font-bold">💬 Chat với DOJO</h1>
      <ChatPanel documentId={documentId} />
      <p className="text-xs text-gray-500">
        DOJO chỉ trả lời dựa trên tài liệu bạn đã upload. Câu trả lời có thể sai — kiểm tra chéo với tài liệu gốc.
      </p>
    </main>
  )
}
