# T-205 · Quiz UI — `<QuizCard />` + `/quiz/[documentId]`

**Status:** `review`
**Severity:** MED
**Blueprint ref:** §6.5, §7.5, §11
**Branch:** `task/T-205-quiz-ui`
**Assignee:** _(tba)_
**Depends on:** T-202 (anon-id), T-204 (API routes)

## Context

Trang quiz cho 1 document. Khi user vào lần đầu → gọi `POST /api/quiz/generate` (lazy — server sẽ sinh nếu chưa có). Hiển thị từng câu hỏi (Kahoot-style), user chọn 1 option → `POST /api/quiz/submit` → reveal correct/explanation + progress bar → next câu. Cuối bài: tổng điểm + CTA về dashboard/leaderboard.

## Files to touch
- `vibeseek/components/QuizCard.tsx` (NEW)
- `vibeseek/app/quiz/[documentId]/page.tsx` (NEW)
- `vibeseek/components/VibeCard.tsx` (MODIFY — wire `onQuiz` prop to navigate `/quiz/[documentId]`) **hoặc** thêm 1 button "🎯 Làm Quiz" ở dashboard sau khi cards có.
- Update task file + AGENT_LOG

## Architect's spec

### 1. `vibeseek/components/QuizCard.tsx`

Client component, nhận 1 question + state hiện tại, gọi callback khi user submit.

```tsx
'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

export interface QuizCardQuestion {
  id: string
  question: string
  options: string[]
  correct_index: number   // client nhận nhưng KHÔNG hiển thị cho đến khi submit
  explanation: string
}

interface Props {
  question: QuizCardQuestion
  questionNumber: number
  totalQuestions: number
  onSubmit: (selectedIndex: number) => Promise<{
    correct: boolean
    correctIndex: number
    explanation: string
    pointsEarned: number
    alreadyAttempted: boolean
  }>
  onNext: () => void
}

type Stage = 'answering' | 'revealed'

export default function QuizCard({ question, questionNumber, totalQuestions, onSubmit, onNext }: Props) {
  const [selected, setSelected] = useState<number | null>(null)
  const [stage, setStage] = useState<Stage>('answering')
  const [result, setResult] = useState<Awaited<ReturnType<Props['onSubmit']>> | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (selected === null || submitting) return
    setSubmitting(true)
    try {
      const r = await onSubmit(selected)
      setResult(r)
      setStage('revealed')
    } catch (e) {
      console.error(e)
      alert('Submit thất bại, thử lại sau.')
    } finally {
      setSubmitting(false)
    }
  }

  function classForOption(idx: number) {
    if (stage === 'answering') {
      return selected === idx
        ? 'border-indigo-400 bg-indigo-500/20'
        : 'border-white/10 bg-white/5 hover:border-white/30'
    }
    // revealed
    if (idx === result?.correctIndex) return 'border-green-400 bg-green-500/20'
    if (idx === selected && !result?.correct) return 'border-red-400 bg-red-500/20'
    return 'border-white/10 bg-white/5 opacity-60'
  }

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="glass rounded-3xl p-8 max-w-2xl mx-auto w-full"
    >
      <div className="flex items-center justify-between mb-4 text-sm text-white/50 font-mono">
        <span>Câu {questionNumber} / {totalQuestions}</span>
        {stage === 'revealed' && result && (
          <span className={result.correct ? 'text-green-400' : 'text-red-400'}>
            {result.correct ? '+' : ''}{result.pointsEarned} vibe {result.alreadyAttempted ? '(đã làm)' : ''}
          </span>
        )}
      </div>

      <h2 className="font-display text-2xl text-white mb-6">{question.question}</h2>

      <div className="space-y-3 mb-6">
        {question.options.map((opt, idx) => (
          <button
            key={idx}
            disabled={stage === 'revealed'}
            onClick={() => setSelected(idx)}
            className={`
              w-full text-left px-5 py-3 rounded-2xl border transition
              text-white/90 font-body
              ${classForOption(idx)}
            `}
          >
            <span className="font-mono text-xs text-white/40 mr-3">{String.fromCharCode(65 + idx)}.</span>
            {opt}
            {stage === 'revealed' && idx === result?.correctIndex && (
              <CheckCircle2 className="inline-block w-4 h-4 ml-2 text-green-400" />
            )}
            {stage === 'revealed' && idx === selected && !result?.correct && (
              <XCircle className="inline-block w-4 h-4 ml-2 text-red-400" />
            )}
          </button>
        ))}
      </div>

      {stage === 'revealed' && result?.explanation && (
        <div className="p-4 rounded-2xl border border-white/10 bg-white/5 mb-6 text-sm text-white/70">
          <b className="text-white">Giải thích:</b> {result.explanation}
        </div>
      )}

      <div className="flex justify-end">
        {stage === 'answering' ? (
          <button
            onClick={handleSubmit}
            disabled={selected === null || submitting}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white font-semibold disabled:opacity-40"
          >
            {submitting ? 'Đang chấm...' : 'Chốt đáp án'}
          </button>
        ) : (
          <button
            onClick={onNext}
            className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold"
          >
            {questionNumber === totalQuestions ? 'Xem kết quả' : 'Câu tiếp'}
          </button>
        )}
      </div>
    </motion.div>
  )
}
```

### 2. `vibeseek/app/quiz/[documentId]/page.tsx`

Client page (`'use client'`), orchestrator:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import QuizCard, { QuizCardQuestion } from '@/components/QuizCard'
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

  // Fetch or generate quiz on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/quiz/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: params.documentId }),
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error || 'Lỗi load quiz')
        if (cancelled) return
        if (!body.questions || body.questions.length === 0) {
          throw new Error('Tài liệu này chưa có câu hỏi nào.')
        }
        setQuestions(body.questions)
        setPhase('quizzing')
      } catch (e) {
        if (cancelled) return
        setErrorMsg(e instanceof Error ? e.message : String(e))
        setPhase('error')
      }
    }
    load()
    return () => { cancelled = true }
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
      <main className="min-h-screen flex flex-col items-center justify-center text-white/70 gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-400" />
        <p>Đang chuẩn bị quiz...</p>
        <p className="text-xs text-white/40">Lần đầu có thể mất 10-15s (AI đang sinh câu hỏi).</p>
      </main>
    )
  }

  if (phase === 'error') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-white/80 gap-3 px-6">
        <p className="text-red-400">Lỗi: {errorMsg}</p>
        <button onClick={() => router.back()} className="underline">Quay lại</button>
      </main>
    )
  }

  if (phase === 'done') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-white gap-6 px-6">
        <h1 className="font-display text-4xl">Xong rồi! 🎉</h1>
        <p className="text-white/70">Đúng {correctCount}/{questions.length} câu · +{pointsEarned} vibe points</p>
        <div className="flex gap-3">
          <Link href="/leaderboard" className="px-5 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 font-semibold">
            Xem leaderboard
          </Link>
          <Link href="/dashboard" className="px-5 py-2 rounded-full bg-white/10 font-semibold">
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
        question={questions[currentIdx]}
        questionNumber={currentIdx + 1}
        totalQuestions={questions.length}
        onSubmit={handleSubmit}
        onNext={handleNext}
      />
    </main>
  )
}
```

### 3. Wire từ dashboard → quiz

Dashboard hiện có VibeCard grid. Thêm **1 button đơn giản** trong `dashboard-result-header` sau khi cards tạo xong:

```tsx
// app/dashboard/page.tsx — inside {cards.length > 0 && (...)} block, dashboard-result-header
{documentId && documentId !== 'local' && (
  <Link href={`/quiz/${documentId}`} className="...">
    🎯 Làm Quiz
  </Link>
)}
```

(Agent dùng class có sẵn tương đương — không thêm CSS mới trừ khi cần.)

**KHÔNG** sửa `VibeCard.tsx` — prop `onQuiz` giữ nguyên, có thể wire sau Phase 4. Giữ thay đổi dashboard minimal.

## Acceptance criteria
- [x] AC-1: 2 files mới (`QuizCard.tsx`, `app/quiz/[documentId]/page.tsx`) + 1 sửa nhỏ `app/dashboard/page.tsx`.
- [x] AC-2: `npx tsc --noEmit` + `npm run build` pass.
- [ ] AC-3: E2E manual:
  - Upload PDF → cards → bấm "🎯 Làm Quiz" → navigate `/quiz/<id>`.
  - Thấy loader 10-15s lần đầu → quiz xuất hiện.
  - Chọn option → Chốt đáp án → reveal đúng/sai + explanation + điểm.
  - Câu tiếp → chạy hết → trang "Xong rồi!" với tổng điểm.
- [ ] AC-4: Reload page `/quiz/<id>` → lần này load ngay (< 2s) — `generated: false`, questions cached.
- [ ] AC-5: Làm quiz lần 2 (cùng browser → cùng anon_id) → mọi câu trả về `alreadyAttempted: true`, `pointsEarned: 0`, tổng điểm KHÔNG tăng thêm.
- [ ] AC-6: Không crash nếu document không có quiz (dùng 1 documentId fake) → hiển thị error page.

## Definition of Done
- [ ] All AC pass
- [ ] Screenshot flow đính kèm PR
- [ ] AGENT_LOG.md entry started + completed
- [ ] PR opened
- [ ] Status = `review`

## Questions / Blockers
_(none)_

## Decisions log
- AC-3 E2E: headless agent, no dev server available. User must verify manually post-merge. Quiz button uses gradient style consistent with existing dashboard buttons (from-indigo-500 to-fuchsia-500).
- `correct_index` + `explanation` are present in client state from `/api/quiz/generate` response but are NOT rendered in the DOM during `stage === 'answering'` — only revealed after submit (§7.6 compliant).

## Notes for reviewer
- Quiz page **client component** — cần anon_id từ localStorage. Không server-render.
- `correct_index` + `explanation` leak qua `/api/quiz/generate` response — blueprint §7.6 đã chấp nhận cho MVP. UI **KHÔNG** được hiển thị `correct_index` trước khi user submit (stage === 'answering'). Agent self-check.
- Không thêm animation 3D nặng (blueprint §7.11 rule). Framer Motion enter/exit đơn giản OK.
- Không dùng DOJO model ở đây — blueprint §7.11 rule chỉ landing.
