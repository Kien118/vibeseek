import type { CSSProperties } from 'react'

interface Props {
  size?: number          // px square
  className?: string
  style?: CSSProperties
}

export default function DojoFace({ size = 96, className = '', style }: Props) {
  return (
    <div
      className={`dojo-face inline-grid place-items-center rounded-3xl border ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #D96C4F 0%, #9B5675 100%)',
        borderColor: 'rgba(255,200,180,0.3)',
        boxShadow: '0 12px 32px rgba(217,108,79,0.35), inset 0 1px 0 rgba(255,220,200,0.3)',
        ...style,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" fill="none" style={{ width: '78%', height: '78%' }}>
        <rect x="20" y="28" width="60" height="52" rx="16" fill="rgba(23,20,15,0.35)" stroke="rgba(245,239,228,0.9)" strokeWidth="2" />
        <ellipse cx="38" cy="52" rx="5" ry="6.5" fill="#F5EFE4" />
        <ellipse cx="62" cy="52" rx="5" ry="6.5" fill="#F5EFE4" />
        <circle cx="38" cy="52" r="2" fill="#17140F" />
        <circle cx="62" cy="52" r="2" fill="#17140F" />
        <path d="M40 68 Q50 74 60 68" stroke="#F5EFE4" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <circle cx="50" cy="22" r="3" fill="#F5B83E" />
        <line x1="50" y1="25" x2="50" y2="30" stroke="#F5B83E" strokeWidth="2" />
      </svg>
    </div>
  )
}
