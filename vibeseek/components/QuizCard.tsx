'use client'

import { motion } from 'framer-motion'
import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

export interface QuizCardQuestion {
  id: string
  question: string
  options: string[]
  correct_index: number   // client receives but MUST NOT display until submit
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
