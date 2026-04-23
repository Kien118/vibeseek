'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  latestDocId: string | null
  onUpload: () => void
  onGenerateVideo: (documentId: string) => void
}

export default function QuickActionGrid({ latestDocId, onUpload, onGenerateVideo }: Props) {
  const router = useRouter()
  // Treat 'local' as null (F-8)
  const docId = latestDocId === 'local' ? null : latestDocId

  const handleQuiz = () => {
    if (docId) router.push(`/quiz/${docId}`)
    else alert('Chưa có tài liệu để làm quiz.')
  }

  const handleChat = () => {
    if (docId) router.push(`/chat/${docId}`)
    else alert('Upload PDF trước để chat với DOJO.')
  }

  const handleVideo = () => {
    if (docId) onGenerateVideo(docId)
    else alert('Upload PDF trước để tạo video.')
  }

  // Hotkey listener (F-11)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const tag = (document.activeElement as HTMLElement)?.tagName?.toUpperCase()
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const key = e.key.toLowerCase()
      if (key === 'q') { e.preventDefault(); handleQuiz() }
      else if (key === 'c') { e.preventDefault(); handleChat() }
      else if (key === 'u') { e.preventDefault(); onUpload() }
      else if (key === 'v') { e.preventDefault(); handleVideo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  const actions = [
    {
      key: 'Q',
      label: 'Quiz 5 phút',
      desc: 'Ôn nhanh kiến thức',
      icon: '🎯',
      tone: 'accent' as const,
      onClick: handleQuiz,
      disabled: false,
      title: undefined,
    },
    {
      key: 'C',
      label: 'Chat với DOJO',
      desc: 'Hỏi bất cứ điều gì',
      icon: '💬',
      tone: 'terra' as const,
      onClick: handleChat,
      disabled: false,
      title: undefined,
    },
    {
      key: 'U',
      label: 'Upload PDF',
      desc: 'Thêm tài liệu mới',
      icon: '📄',
      tone: 'sage' as const,
      onClick: onUpload,
      disabled: false,
      title: undefined,
    },
    {
      key: 'V',
      label: 'Tạo video',
      desc: 'Xuất video 9:16',
      icon: '🎬',
      tone: 'lapis' as const,
      onClick: handleVideo,
      disabled: !docId,
      title: docId ? undefined : 'Cần tài liệu trước',
    },
  ]

  const iconBoxClass: Record<string, string> = {
    accent: 'bg-sunflower/12 border-sunflower/30 text-sunflower',
    terra:  'bg-terracotta/12 border-terracotta/30 text-terracotta-soft',
    sage:   'bg-sage/12 border-sage/30 text-sage-bright',
    lapis:  'bg-lapis/12 border-lapis/30 text-lapis-soft',
  }

  return (
    <div>
      <div className="mb-3">
        <h2 className="font-display font-bold text-paper-cream text-lg">Làm gì nhanh?</h2>
        <p className="text-stone text-xs font-mono mt-0.5">4 phím tắt hay dùng nhất</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map((action) => (
          <button
            key={action.key}
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.title}
            className={`p-4 rounded-2xl bg-ink-surface/55 border border-paper-cream/10 flex flex-col gap-2 items-start text-left transition hover:-translate-y-0.5 ${
              action.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-paper-cream/20'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl grid place-items-center text-xl border ${iconBoxClass[action.tone]}`}>
              {action.icon}
            </div>
            <h4 className="font-display font-bold text-paper-cream text-sm leading-tight">{action.label}</h4>
            <p className="text-stone text-[11.5px]">{action.desc}</p>
            <span className="mt-auto font-mono text-[10px] text-stone uppercase tracking-wider">
              [{action.key}]
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
