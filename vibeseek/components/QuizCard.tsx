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
        ? 'border-sunflower bg-sunflower/20'
        : 'border-paper-cream/10 bg-paper-cream/5 hover:border-paper-cream/30'
    }
    // revealed
    if (idx === result?.correctIndex) return 'border-sage bg-sage/20 shadow-glow-sage'
    if (idx === selected && !result?.correct) return 'border-error-terra bg-error-terra/20'
    return 'border-paper-cream/10 bg-paper-cream/5 opacity-60'
  }

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="glass rounded-3xl p-8 max-w-2xl mx-auto w-full"
    >
      <div className="flex items-center justify-between mb-4 text-sm text-paper-cream/50 font-mono">
        <span>Câu {questionNumber} / {totalQuestions}</span>
        {stage === 'revealed' && result && (
          <span className={result.correct ? 'text-sage' : 'text-error-terra'}>
            {result.correct ? '+' : ''}{result.pointsEarned} vibe {result.alreadyAttempted ? '(đã làm)' : ''}
          </span>
        )}
      </div>

      <h2 className="font-display text-2xl text-paper-cream mb-6">{question.question}</h2>

      <div className="space-y-3 mb-6">
        {question.options.map((opt, idx) => (
          <motion.button
            key={idx}
            disabled={stage === 'revealed'}
            onClick={() => setSelected(idx)}
            animate={
              stage === 'revealed' && idx === result?.correctIndex
                ? {
                    scale: [1, 1.03, 1],
                    transition: {
                      duration: 0.5,
                      delay: result?.correct ? 0 : 0.5,
                    },
                  }
                : stage === 'revealed' && idx === selected && !result?.correct
                  ? { x: [0, -4, 4, -4, 4, 0], transition: { duration: 0.4 } }
                  : {}
            }
            className={`
              w-full text-left px-5 py-3 rounded-2xl border transition
              text-paper-cream/90 font-body
              ${classForOption(idx)}
            `}
          >
            <span className="font-mono text-xs text-paper-cream/40 mr-3">{String.fromCharCode(65 + idx)}.</span>
            {opt}
            {stage === 'revealed' && idx === result?.correctIndex && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: result?.correct ? 0.2 : 0.7, type: 'spring', stiffness: 260, damping: 18 }}
                className="inline-block"
              >
                <CheckCircle2 className="inline-block w-4 h-4 ml-2 text-sage" />
              </motion.span>
            )}
            {stage === 'revealed' && idx === selected && !result?.correct && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className="inline-block"
              >
                <XCircle className="inline-block w-4 h-4 ml-2 text-error-terra" />
              </motion.span>
            )}
          </motion.button>
        ))}
      </div>

      {stage === 'revealed' && result?.explanation && (
        <div className="p-4 rounded-2xl border border-paper-cream/10 bg-paper-cream/5 mb-6 text-sm text-paper-cream/70">
          <b className="text-paper-cream">Giải thích:</b> {result.explanation}
        </div>
      )}

      <div className="flex justify-end">
        {stage === 'answering' ? (
          <button
            onClick={handleSubmit}
            disabled={selected === null || submitting}
            className="px-6 py-2.5 rounded-full bg-gradient-to-r from-sunflower to-terracotta text-paper-cream font-semibold disabled:opacity-40"
          >
            {submitting ? 'Đang chấm...' : 'Chốt đáp án'}
          </button>
        ) : (
          <button
            onClick={onNext}
            className="px-6 py-2.5 rounded-full bg-paper-cream/10 hover:bg-paper-cream/20 text-paper-cream font-semibold"
          >
            {questionNumber === totalQuestions ? 'Xem kết quả' : 'Câu tiếp'}
          </button>
        )}
      </div>
    </motion.div>
  )
}
