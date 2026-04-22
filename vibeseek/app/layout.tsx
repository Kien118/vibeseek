import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Be_Vietnam_Pro, Patrick_Hand, Fraunces, JetBrains_Mono } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import VibePointsBadge from '@/components/VibePointsBadge'
// AmbientBackground removed 2026-04-22 per user request (blur too heavy).
// Keep component file for future re-enable.
// import AmbientBackground from '@/components/AmbientBackground'
import SoundToggle from '@/components/SoundToggle'
import ThemeToggle from '@/components/ThemeToggle'
import PageTransition from '@/components/PageTransition'
import './globals.css'

const displayFont = Bricolage_Grotesque({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

const bodyFont = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

const handwrittenFont = Patrick_Hand({
  subsets: ['latin', 'vietnamese'],
  weight: ['400'],
  variable: '--font-handwritten',
  display: 'swap',
})

const serifFont = Fraunces({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '600', '700'],
  variable: '--font-serif',
  display: 'swap',
})

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'VibeSeek — Catch the Knowledge Vibe',
  description: 'Biến PDF khô khan thành micro-content hấp dẫn cho Gen Z.',
  keywords: ['learning', 'AI', 'PDF', 'Gen Z', 'education'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'VibeSeek',
  },
}

export const viewport: Viewport = {
  themeColor: '#17140F', // ink base
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" className="dark">
      <body className={`${displayFont.variable} ${bodyFont.variable} ${handwrittenFont.variable} ${serifFont.variable} ${monoFont.variable}`}>
        <PageTransition>{children}</PageTransition>
        <VibePointsBadge />
        <SoundToggle />
        <ThemeToggle />
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: 'rgba(23,20,15,0.9)',          // ink base with alpha
              color: '#F5EFE4',                           // paper cream
              border: '1px solid rgba(245,184,62,0.3)',   // sunflower border
              backdropFilter: 'blur(20px)',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#7A9B7E', secondary: '#F5EFE4' },   // sage
            },
            error: {
              iconTheme: { primary: '#C85A3C', secondary: '#F5EFE4' },   // terracotta error
            },
          }}
        />
      </body>
    </html>
  )
}
