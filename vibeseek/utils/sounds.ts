/**
 * P-511 item 11: Sound effects via Web Audio API synth.
 * Zero asset files — generates click / ding / fanfare inline.
 * Mặc định TẮT. User toggles via SoundToggle (localStorage persist).
 * Gen Z rất ghét auto-sound per design doc.
 */

const STORAGE_KEY = 'vibeseek:sounds:enabled'

let audioContext: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioContext) {
    try {
      // @ts-expect-error — webkitAudioContext for older Safari
      const Ctor = window.AudioContext || window.webkitAudioContext
      if (!Ctor) return null
      audioContext = new Ctor()
    } catch {
      return null
    }
  }
  return audioContext
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false')
    window.dispatchEvent(new CustomEvent('vibeseek-sounds-toggled', { detail: { enabled } }))
  } catch {
    // ignore
  }
}

function playTone(
  freq: number,
  durationMs: number,
  options: { type?: OscillatorType; gain?: number; attack?: number; release?: number } = {},
) {
  if (!isSoundEnabled()) return
  const ctx = getContext()
  if (!ctx) return
  const { type = 'sine', gain = 0.18, attack = 0.005, release = 0.04 } = options
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  g.gain.value = 0
  osc.connect(g)
  g.connect(ctx.destination)
  const now = ctx.currentTime
  g.gain.linearRampToValueAtTime(gain, now + attack)
  g.gain.linearRampToValueAtTime(0, now + durationMs / 1000 + release)
  osc.start(now)
  osc.stop(now + durationMs / 1000 + release + 0.02)
}

/** Click: short 50ms blip. */
export function playClick(): void {
  playTone(800, 50, { type: 'triangle', gain: 0.1 })
}

/** Ding: bright 200ms bell, 2-note up-interval. */
export function playDing(): void {
  playTone(880, 120, { type: 'sine', gain: 0.18 })
  setTimeout(() => playTone(1318, 180, { type: 'sine', gain: 0.14 }), 60)
}

/** Fanfare: 3-note ascending triad 800ms. Level-up celebration. */
export function playFanfare(): void {
  if (!isSoundEnabled()) return
  playTone(523, 200, { type: 'triangle', gain: 0.15 })  // C5
  setTimeout(() => playTone(659, 200, { type: 'triangle', gain: 0.15 }), 120)  // E5
  setTimeout(() => playTone(784, 400, { type: 'triangle', gain: 0.18 }), 280)  // G5
}
