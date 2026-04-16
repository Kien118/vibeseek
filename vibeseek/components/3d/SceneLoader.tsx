'use client'

export default function SceneLoader() {
  return (
    <div className="scene-loader" role="status" aria-live="polite">
      <div className="scene-loader-dot" />
      <p>Initializing VibeSeek Neural Stage...</p>
    </div>
  )
}
