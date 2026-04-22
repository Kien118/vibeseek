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
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        hand: ['var(--font-handwritten)', 'cursive'],
        serif: ['var(--font-serif)', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        // Warm ink background system — theme-aware via CSS vars (dark default,
        // inverts under html[data-theme='light']). RGB triplets let Tailwind
        // /opacity utilities (e.g. bg-ink-surface/80) work in both themes.
        ink: {
          base:     'rgb(var(--color-ink-rgb) / <alpha-value>)',
          surface:  'rgb(var(--color-surface-rgb) / <alpha-value>)',
          elevated: 'rgb(var(--color-elevated-rgb) / <alpha-value>)',
          border:   'rgb(var(--color-ink-border-rgb) / <alpha-value>)',
        },
        // Paper text system — theme-aware
        paper: {
          cream: 'rgb(var(--color-paper-rgb) / <alpha-value>)',
          soft:  'rgb(var(--color-paper-soft-rgb) / <alpha-value>)',
        },
        stone: 'rgb(var(--color-stone-rgb) / <alpha-value>)',
        // Accents
        sunflower: {
          DEFAULT: '#F5B83E',
          bright:  '#FFCE5E',
          deep:    '#C48920',
        },
        terracotta: {
          DEFAULT: '#D96C4F',
          soft:    '#E89478',
        },
        sage: {
          DEFAULT: '#7A9B7E',
          bright:  '#9ABDA0',
        },
        lapis: {
          DEFAULT: '#5B89B0',
          soft:    '#88A9C5',
        },
        plum: '#9B5675',
        // Error (preserved from P-503)
        'error-terra': '#C85A3C',
      },
      backgroundImage: {
        'glow-sunflower': 'radial-gradient(circle at 50% 50%, rgba(245,184,62,0.15) 0%, transparent 70%)',
        'glow-terracotta': 'radial-gradient(circle at 50% 50%, rgba(217,108,79,0.15) 0%, transparent 70%)',
        'mesh-gradient': 'linear-gradient(135deg, #17140F 0%, #1E1912 50%, #221D17 100%)',
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
          '0%, 100%': { boxShadow: '0 0 20px rgba(245,184,62,0.3)' },
          '50%': { boxShadow: '0 0 60px rgba(245,184,62,0.6), 0 0 100px rgba(217,108,79,0.2)' },
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
        'glass': '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(245,239,228,0.1)',
        'glow-sun':   '0 0 30px rgba(245,184,62,0.30), 0 0 60px rgba(245,184,62,0.12)',
        'glow-terra': '0 0 30px rgba(217,108,79,0.28), 0 0 60px rgba(217,108,79,0.12)',
        'glow-sage':  '0 0 30px rgba(122,155,126,0.28), 0 0 60px rgba(122,155,126,0.12)',
      },
    },
  },
  plugins: [],
}
export default config
