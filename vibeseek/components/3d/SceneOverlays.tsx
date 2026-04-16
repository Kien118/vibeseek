'use client'

import { motion } from 'framer-motion'
import { QuizResult } from '@/components/3d/types'

interface SceneOverlaysProps {
  progress: number
  quizResult: QuizResult
  onAnswer: (isCorrect: boolean) => void
}

export default function SceneOverlays({ progress, quizResult, onAnswer }: SceneOverlaysProps) {
  const showHeading = progress < 0.25
  const showInsights = progress >= 0.3 && progress < 0.62
  const showQuiz = progress >= 0.62 && progress < 0.9
  const showReward = progress >= 0.9

  return (
    <div className="overlay-layer">
      {showHeading && (
        <motion.div className="overlay-heading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <h1 className="glitch-text" data-text="VibeSeek">
            VibeSeek
          </h1>
          <p className="overlay-subtitle">Micro-Learning Social Commerce</p>
        </motion.div>
      )}

      {showInsights && (
        <div className="insight-stack">
          <div className="insight-card">Insight: 80% retention tăng khi học bằng visual chunks.</div>
          <div className="insight-card">Insight: AI Prism tái cấu trúc nội dung thành micro-units.</div>
          <div className="insight-card">Insight: Data shards map trực tiếp sang quiz outcomes.</div>
        </div>
      )}

      {showQuiz && (
        <div className="quiz-card">
          <p className="quiz-kicker">AI Quiz</p>
          <h3>Mục tiêu của Scene 3 là gì?</h3>
          <div className="quiz-actions">
            <button type="button" onClick={() => onAnswer(false)}>
              Hiệu ứng trang trí thuần túy
            </button>
            <button type="button" onClick={() => onAnswer(true)}>
              Biến insights thành mảnh kiến thức tương tác
            </button>
          </div>
          <p className={`quiz-feedback ${quizResult}`}>
            {quizResult === 'correct' && 'Correct: Hero crystal chuyển Electric Teal.'}
            {quizResult === 'wrong' && 'Wrong: Crystal chuyển Red/Pulse, thử lại insight flow.'}
            {quizResult === 'idle' && 'Chọn đáp án để khóa trạng thái crystal.'}
          </p>
        </div>
      )}

      {showReward && (
        <div className="reward-panel">
          <p className="reward-kicker">Reward Unlocked</p>
          <h3>+120 Vibe Tokens • New Badge: Prism Runner</h3>
          <button type="button">Start Next Vibe</button>
        </div>
      )}
    </div>
  )
}
