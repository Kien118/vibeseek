'use client'

/**
 * P-504: 3-dot wave animation for chat streaming state.
 * Terracotta (#D96C4F) dots, staggered bounce at 0ms/150ms/300ms.
 * Used inside assistant bubble when streaming before any content arrives.
 */
export default function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-label="DOJO đang suy nghĩ">
      <span
        className="inline-block w-1.5 h-1.5 rounded-full bg-terracotta animate-bounce"
        style={{ animationDelay: '0ms', animationDuration: '900ms' }}
      />
      <span
        className="inline-block w-1.5 h-1.5 rounded-full bg-terracotta animate-bounce"
        style={{ animationDelay: '150ms', animationDuration: '900ms' }}
      />
      <span
        className="inline-block w-1.5 h-1.5 rounded-full bg-terracotta animate-bounce"
        style={{ animationDelay: '300ms', animationDuration: '900ms' }}
      />
    </span>
  )
}
