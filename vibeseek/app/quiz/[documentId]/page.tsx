'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import QuizCard, { QuizCardQuestion } from '@/components/QuizCard'
import Confetti from '@/components/Confetti'
import { getOrCreateAnonId } from '@/utils/anon-id'

type Phase = 'loading' | 'quizzing' | 'done' | 'error'

export default function QuizPage() {
  const params = useParams<{ documentId: string }>()
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('loading')
  const [questions, setQuestions] = useState<QuizCardQuestion[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Fetch or generate quiz on mount.
  // React Strict Mode in dev remounts components; each remount gets its own
  // `ignore` flag. Duplicate inserts are prevented at the DB layer by the
  // UNIQUE(card_id) constraint on quiz_questions plus the "return existing"
  // path in /api/quiz/generate — so letting both requests run is safe.
  useEffect(() => {
    let ignore = false
    async function load() {
      try {
        const res = await fetch('/api/quiz/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: params.documentId }),
        })
        const body = await res.json()
        if (ignore) return
        if (!res.ok) throw new Error(body.error || 'Lỗi load quiz')
        if (!body.questions || body.questions.length === 0) {
          throw new Error('Tài liệu này chưa có câu hỏi nào.')
        }
        setQuestions(body.questions)
        setPhase('quizzing')
      } catch (e) {
        if (ignore) return
        setErrorMsg(e instanceof Error ? e.message : String(e))
        setPhase('error')
      }
    }
    load()
    return () => { ignore = true }
  }, [params.documentId])

  async function handleSubmit(selectedIndex: number) {
    const anonId = getOrCreateAnonId()
    if (!anonId) throw new Error('Không tạo được danh tính guest. Bật localStorage.')
    const current = questions[currentIdx]
    const res = await fetch('/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anonId,
        questionId: current.id,
        selectedIndex,
      }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error || 'Submit failed')
    if (body.correct && !body.alreadyAttempted) {
      setPointsEarned((p) => p + body.pointsEarned)
      setCorrectCount((c) => c + 1)
    }
    // Tell the global <VibePointsBadge /> to refresh — pathname hasn't changed,
    // so the badge's own useEffect won't re-fire on its own.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vibe-points-updated'))
    }
    return {
      correct: body.correct,
      correctIndex: body.correctIndex,
      explanation: body.explanation,
      pointsEarned: body.pointsEarned,
      alreadyAttempted: body.alreadyAttempted,
    }
  }

  function handleNext() {
    if (currentIdx + 1 >= questions.length) {
      setPhase('done')
      return
    }
    setCurrentIdx((i) => i + 1)
  }

  if (phase === 'loading') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-paper-cream/70 gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-sunflower" />
        <p>Đang chuẩn bị quiz...</p>
        <p className="text-xs text-paper-cream/40">Lần đầu có thể mất 10-15s (AI đang sinh câu hỏi).</p>
      </main>
    )
  }

  if (phase === 'error') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-paper-cream/80 gap-3 px-6">
        <p className="text-error-terra">Lỗi: {errorMsg}</p>
        <button onClick={() => router.back()} className="underline">Quay lại</button>
      </main>
    )
  }

  if (phase === 'done') {
    const scoreRatio = questions.length > 0 ? correctCount / questions.length : 0
    const celebrate = scoreRatio >= 0.7
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-paper-cream gap-6 px-6">
        {celebrate && <Confetti trigger={celebrate} />}
        <h1 className="font-display text-4xl">Xong rồi! 🎉</h1>
        <p className="text-paper-cream/70">Đúng {correctCount}/{questions.length} câu · +{pointsEarned} vibe points</p>
        <div className="flex gap-3">
          <Link href="/leaderboard" className="btn-polish px-5 py-2 rounded-full bg-gradient-to-r from-sunflower to-terracotta text-ink-base font-semibold">
            Xem leaderboard
          </Link>
          <Link href="/dashboard" className="btn-polish-sage px-5 py-2 rounded-full bg-sage text-ink-base font-semibold">
            Về dashboard
          </Link>
        </div>
      </main>
    )
  }

  // phase === 'quizzing'
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <QuizCard
        key={questions[currentIdx].id}
        question={questions[currentIdx]}
        questionNumber={currentIdx + 1}
        totalQuestions={questions.length}
        onSubmit={handleSubmit}
        onNext={handleNext}
      />
    </main>
  )
}
