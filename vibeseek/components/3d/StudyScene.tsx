'use client'

import { MutableRefObject } from 'react'
import VibeSceneCanvas from '@/components/3d/VibeSceneCanvas'
import { QuizResult, ScrollRigState } from '@/components/3d/types'

interface StudySceneProps {
  rigRef: MutableRefObject<ScrollRigState>
  quizResult: QuizResult
}

export default function StudyScene({ rigRef, quizResult }: StudySceneProps) {
  return <VibeSceneCanvas rigRef={rigRef} quizResult={quizResult} />
}
