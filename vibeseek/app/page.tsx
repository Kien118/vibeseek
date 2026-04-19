'use client'

import dynamic from 'next/dynamic'
import CanvasSkeleton from '@/components/3d/CanvasSkeleton'

const LandingSceneCanvas = dynamic(
  () => import('@/components/3d/LandingSceneCanvas'),
  {
    ssr: false,
    loading: () => <CanvasSkeleton />,
  }
)

export default function HomePage() {
  return <main className="landing-page"><LandingSceneCanvas /></main>
}
