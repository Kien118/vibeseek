'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function QuizError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[quiz] error:', error)
  }, [error])

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <div className="text-6xl">🎯</div>
        <h1 className="text-2xl font-bold text-[#F5EFE4]">Lỗi tải Quiz</h1>
        <p className="text-[#F5EFE4]/70 text-sm">
          Không tạo được câu hỏi cho tài liệu này. Có thể do quota AI hết — thử lại sau 1 phút.
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <button
            onClick={() => reset()}
            className="px-5 py-2 rounded-full bg-gradient-to-r from-[#D96C4F] to-[#F5B83E] text-[#F5EFE4] font-semibold text-sm hover:opacity-90"
          >
            Thử lại
          </button>
          <Link
            href="/dashboard"
            className="px-5 py-2 rounded-full border border-[#F5EFE4]/20 text-[#F5EFE4]/80 text-sm hover:bg-[#F5EFE4]/5"
          >
            Về Dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
