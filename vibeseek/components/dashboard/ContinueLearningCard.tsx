import Link from 'next/link'

interface Props {
  latestDoc: {
    documentId: string
    title: string
    totalCards: number
    hasVideo: boolean
    createdAt: string
  }
  recentCardsCount: number
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffDay >= 1) return `${diffDay} ngày trước`
  if (diffHr >= 1) return `${diffHr} giờ trước`
  if (diffMin >= 1) return `${diffMin} phút trước`
  return 'vừa xong'
}

export default function ContinueLearningCard({ latestDoc, recentCardsCount }: Props) {
  const { documentId, title, totalCards, hasVideo, createdAt } = latestDoc
  const shortTitle = title.length > 20 ? title.slice(0, 20) + '…' : title

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-display font-bold text-paper-cream text-lg">Đang học · 1 tài liệu</h2>
          <p className="text-stone text-xs font-mono mt-0.5">Chọn lên tiếp</p>
        </div>
        <a href="#" className="text-xs text-sunflower font-mono hover:underline">Tất cả thư viện →</a>
      </div>

      <div className="glass rounded-3xl border border-sunflower/22 p-5 grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-5 items-center">
        {/* LEFT thumb */}
        <div
          className="relative aspect-[4/3] rounded-2xl border border-sunflower/30 grid place-items-center overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(245,184,62,0.35) 0%, rgba(217,108,79,0.25) 100%)' }}
        >
          <span className="absolute top-2 left-2 font-mono text-[10px] text-paper-cream/65 bg-ink-base/40 px-1.5 py-0.5 rounded">
            PDF · {totalCards} thẻ
          </span>
          <span className="font-display font-extrabold text-paper-cream text-center px-3 leading-tight text-sm">
            {shortTitle}
          </span>
        </div>

        {/* MIDDLE body */}
        <div className="space-y-2 min-w-0">
          <span className="inline-flex gap-1.5 px-2.5 py-1.5 rounded-full font-mono text-[11px] font-bold tracking-wider uppercase border border-sunflower/35 bg-sunflower/10 text-sunflower">
            ⚡ ĐANG DỞ
          </span>
          <h3 className="font-display font-bold text-xl text-paper-cream truncate">{title}</h3>
          <div className="flex gap-2.5 text-stone text-xs items-center flex-wrap">
            <span>{totalCards} thẻ</span>
            <span className="text-paper-cream/20">·</span>
            <span>{recentCardsCount} mới hôm nay</span>
            <span className="text-paper-cream/20">·</span>
            <span>{hasVideo ? 'Có video' : 'Chưa có video'}</span>
          </div>
          {/* Info strip — no progress bar (R1 invariant) */}
          <div className="text-[11.5px] font-mono text-stone mt-2 flex justify-between">
            <span>Cập nhật lần cuối</span>
            <span>{formatRelativeTime(createdAt)}</span>
          </div>
        </div>

        {/* RIGHT actions */}
        <div className="flex flex-col gap-2">
          <Link
            href={`/chat/${documentId}`}
            className="btn-polish px-4 py-2.5 rounded-xl text-center font-display font-bold text-ink-base text-sm"
            style={{ background: 'linear-gradient(135deg, #F5B83E 0%, #FFCE5E 100%)' }}
          >
            Tiếp tục
          </Link>
          <Link
            href={`/quiz/${documentId}`}
            className="px-3 py-2 rounded-xl text-center text-xs font-display font-bold text-paper-cream border border-paper-cream/18 bg-paper-cream/5 hover:bg-paper-cream/10 transition"
          >
            Quiz chương
          </Link>
        </div>
      </div>
    </div>
  )
}
