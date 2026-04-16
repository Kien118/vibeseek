import type { Metadata } from 'next'
import { JetBrains_Mono, Plus_Jakarta_Sans, Syne } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const headingFont = Syne({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--font-syne',
})

const bodyFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plus-jakarta',
})

const monoFont = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-jetbrains',
})

export const metadata: Metadata = {
  title: 'VibeSeek — Catch the Knowledge Vibe',
  description: 'Biến PDF khô khan thành micro-content hấp dẫn cho Gen Z.',
  keywords: ['learning', 'AI', 'PDF', 'Gen Z', 'education'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" className="dark">
      <body className={`${headingFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            style: {
              background: 'rgba(10,10,15,0.9)',
              color: 'white',
              border: '1px solid rgba(168,85,247,0.3)',
              backdropFilter: 'blur(20px)',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#A855F7', secondary: 'white' },
            },
            error: {
              iconTheme: { primary: '#F43F5E', secondary: 'white' },
            },
          }}
        />
      </body>
    </html>
  )
}
