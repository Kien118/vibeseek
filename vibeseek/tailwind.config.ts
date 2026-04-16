import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-syne)', 'sans-serif'],
        body: ['var(--font-dm-sans)', 'sans-serif'],
        mono: ['var(--font-space-mono)', 'monospace'],
      },
      colors: {
        vibe: {
          purple: '#A855F7',
          cyan: '#22D3EE',
          pink: '#EC4899',
          green: '#10B981',
          dark: '#0A0A0F',
          glass: 'rgba(255,255,255,0.05)',
        },
      },
      backgroundImage: {
        'glow-purple': 'radial-gradient(circle at 50% 50%, rgba(168,85,247,0.15) 0%, transparent 70%)',
        'glow-cyan': 'radial-gradient(circle at 50% 50%, rgba(34,211,238,0.15) 0%, transparent 70%)',
        'mesh-gradient': 'linear-gradient(135deg, #0A0A0F 0%, #0F0A1E 50%, #0A0F1E 100%)',
      },
      backdropBlur: {
        xs: '2px',
        glass: '20px',
      },
      animation: {
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'scan-line': 'scanLine 2s linear infinite',
        'vibe-spin': 'vibeSpin 20s linear infinite',
      },
      keyframes: {
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(168,85,247,0.3)' },
          '50%': { boxShadow: '0 0 60px rgba(168,85,247,0.6), 0 0 100px rgba(34,211,238,0.2)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        vibeSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        'glow-sm': '0 0 20px rgba(168,85,247,0.4)',
        'glow-md': '0 0 40px rgba(168,85,247,0.5), 0 0 80px rgba(34,211,238,0.2)',
        'glow-cyan': '0 0 30px rgba(34,211,238,0.4)',
      },
    },
  },
  plugins: [],
}
export default config
