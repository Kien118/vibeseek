'use client'

import dynamic from 'next/dynamic'
import { MutableRefObject } from 'react'
import { QuizResult, ScrollRigState } from '@/components/3d/types'

interface StudySceneHostProps {
  rigRef: MutableRefObject<ScrollRigState>
  quizResult: QuizResult
}

const StudyScene = dynamic(() => import('@/components/3d/StudyScene'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-black/40" />,
})

export default function StudySceneHost({ rigRef, quizResult }: StudySceneHostProps) {
  return (
    <div className="fixed inset-0 z-0">
      <StudyScene rigRef={rigRef} quizResult={quizResult} />
    </div>
  )
}
