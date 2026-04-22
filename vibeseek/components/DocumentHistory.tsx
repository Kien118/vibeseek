'use client'

import Link from 'next/link'
import type { DocHistoryEntry } from '@/utils/doc-history'

function formatRelative(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)
  if (diffMin < 1) return 'vừa xong'
  if (diffMin < 60) return `${diffMin} phút trước`
  if (diffHours < 24) return `${diffHours} giờ trước`
  if (diffDays < 7) return `${diffDays} ngày trước`
  return new Date(timestamp).toLocaleDateString('vi-VN')
}

interface Props {
  entries: DocHistoryEntry[]
  onRemove: (documentId: string) => void
}

export default function DocumentHistory({ entries, onRemove }: Props) {
  if (entries.length === 0) return null
  return (
    <section className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-paper-cream">Tài liệu gần đây</h2>
        <span className="text-xs text-paper-cream/40 font-mono">{entries.length}/20</span>
      </div>
      <ul className="space-y-2">
        {entries.map((doc) => (
          <li
            key={doc.documentId}
            className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-paper-cream/5 border border-paper-cream/10"
          >
            <div className="flex-1 min-w-0">
              <p className="text-paper-cream font-medium truncate" title={doc.title}>
                {doc.title}
              </p>
              <p className="text-xs text-paper-cream/50 font-mono">{formatRelative(doc.createdAt)}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Link
                href={`/quiz/${doc.documentId}`}
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-sunflower to-terracotta text-paper-cream text-xs font-semibold hover:opacity-90"
              >
                🎯 Quiz
              </Link>
              <Link
                href={`/chat/${doc.documentId}`}
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-sunflower to-terracotta text-paper-cream text-xs font-semibold hover:opacity-90"
              >
                💬 Chat
              </Link>
              <button
                onClick={() => onRemove(doc.documentId)}
                className="px-2 py-1.5 rounded-full text-paper-cream/40 hover:text-paper-cream/80 hover:bg-paper-cream/10 text-xs"
                title="Xóa khỏi danh sách (không xóa trong DB)"
                aria-label={`Xóa ${doc.title} khỏi danh sách`}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-paper-cream/40">
        Danh sách lưu local trên trình duyệt. Xóa cookies/localStorage sẽ reset.
      </p>
    </section>
  )
}
