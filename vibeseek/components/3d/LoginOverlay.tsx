'use client'

import { motion } from 'framer-motion'

interface LoginOverlayProps {
  isTransitioning: boolean
  onLogin: () => void
}

export default function LoginOverlay({ isTransitioning, onLogin }: LoginOverlayProps) {
  return (
    <div className="login-overlay">
      <motion.div
        className="login-panel glass"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      >
        <p className="login-kicker">AI Learning Portal</p>
        <h1 className="login-title">VibeSeek Prism Gateway</h1>
        <p className="login-description">
          Sign in to transform dense PDFs into AI-generated micro learning cards with cinematic knowledge flow.
        </p>

        <button type="button" className="login-button" disabled={isTransitioning} onClick={onLogin}>
          {isTransitioning ? 'Authenticating...' : 'Login'}
        </button>
      </motion.div>
    </div>
  )
}
