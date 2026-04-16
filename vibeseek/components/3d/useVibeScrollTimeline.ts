'use client'

import { MutableRefObject, RefObject, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/dist/ScrollTrigger'
import { ScrollRigState } from '@/components/3d/types'

gsap.registerPlugin(ScrollTrigger)

const INITIAL_RIG_STATE: ScrollRigState = {
  progress: 0,
  cameraZ: 6.2,
  absorption: 0,
  shake: 0,
  glow: 0.25,
  burst: 0,
  focus: 0,
  reward: 0,
  crystalZ: -7,
}

interface UseVibeScrollTimelineReturn {
  rigRef: MutableRefObject<ScrollRigState>
  progress: number
}

export function useVibeScrollTimeline(
  containerRef: RefObject<HTMLElement>
): UseVibeScrollTimelineReturn {
  const [progress, setProgress] = useState(0)
  const rigRef = useRef<ScrollRigState>({ ...INITIAL_RIG_STATE })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const rig = rigRef.current
    Object.assign(rig, INITIAL_RIG_STATE)

    const timeline = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        invalidateOnRefresh: true,
      },
    })

    timeline.to(
      rig,
      {
        progress: 1,
        ease: 'none',
        onUpdate: () => setProgress(rig.progress),
      },
      0
    )

    timeline.to(rig, { cameraZ: 4.3, ease: 'none' }, 0)
    timeline.to(rig, { absorption: 1, shake: 1, glow: 1, ease: 'none' }, 0.1)
    timeline.to(rig, { burst: 1, crystalZ: 2.5, ease: 'none' }, 0.3)
    timeline.to(rig, { focus: 1, ease: 'none' }, 0.6)
    timeline.to(rig, { reward: 1, cameraZ: 3.1, crystalZ: 7.2, ease: 'none' }, 0.9)

    return () => {
      timeline.scrollTrigger?.kill()
      timeline.kill()
    }
  }, [containerRef])

  return { rigRef, progress }
}
