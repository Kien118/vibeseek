'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import CanvasSkeleton from '@/components/3d/CanvasSkeleton'

const LandingSceneCanvas = dynamic(
  () => import('@/components/3d/LandingSceneCanvas'),
  {
    ssr: false,
    loading: () => <CanvasSkeleton />,
  }
)

export default function HomePage() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <div className="landing-header-inner">
          <Link href="/" className="landing-header-brand">
            <span className="landing-header-logo-dot" aria-hidden="true" />
            <span className="landing-header-name">VibeSeek</span>
            <span className="landing-header-tag">/ DOJO</span>
          </Link>
          <nav className="landing-header-nav">
            <Link href="/leaderboard" className="landing-header-nav-link">Leaderboard</Link>
            <Link href="/dashboard" className="btn-polish landing-header-cta">
              Bắt đầu học <span aria-hidden="true">✦</span>
            </Link>
          </nav>
        </div>
      </header>
      <LandingSceneCanvas />
    </main>
  )
}
