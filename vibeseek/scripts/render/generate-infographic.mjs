// P-512: Generate per-scene infographic PNG via @napi-rs/canvas.
// Rendered as transparent-bg 1080×1920 PNG, composited over gradient via
// ffmpeg `overlay` filter in render.mjs filter_complex chain.
//
// Design: warm-study brand — ink-surface card @85% alpha, rounded 40px,
// accent border-left 6px, kicker "NN / NN" + dot top-left, title paper-cream
// display large auto-fit, bullet list paper-soft with accent-color circle
// markers, subtle divider stroke above bullets, geometric accent shape
// top-right (no emoji — Arial has no color emoji glyph).

import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Register font ONCE at module load (idempotent — GlobalFonts dedupes)
let fontRegistered = false
function ensureFontRegistered() {
  if (fontRegistered) return
  GlobalFonts.registerFromPath(join(__dirname, 'title-font.ttf'), 'TitleFont')
  fontRegistered = true
}

// Accent palette — round-robin by scene index (matches P-501 GRADIENT_POOL pattern)
const ACCENT_POOL = [
  '#F5B83E', // sunflower
  '#5B89B0', // lapis
  '#7A9B7E', // sage
  '#D96C4F', // terracotta
  '#9B5675', // plum
  '#F5B83E', // sunflower (wrap)
  '#5B89B0',
  '#7A9B7E',
]

const W = 1080
const H = 1920

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/**
 * Wrap text into lines ≤ maxCharsPerLine at word boundaries.
 */
function wrapLines(text, maxCharsPerLine) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const out = []
  let line = ''
  for (const w of words) {
    if (!line) {
      line = w
    } else if ((line + ' ' + w).length <= maxCharsPerLine) {
      line += ' ' + w
    } else {
      out.push(line)
      line = w
    }
  }
  if (line) out.push(line)
  return out
}

/**
 * Render one scene infographic to PNG buffer.
 * Returns Promise<Buffer>.
 *
 * @param {Object}   scene       Scene object from storyboard (needs title + on_screen_text[])
 * @param {number}   index       0-based scene index
 * @param {number}   total       Total scene count (for kicker "NN / NN")
 */
export async function renderInfographic(scene, index, total) {
  ensureFontRegistered()
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, W, H) // transparent bg — ffmpeg overlay composites onto gradient

  const accent = ACCENT_POOL[index % ACCENT_POOL.length]
  const title = (scene.title || `Cảnh ${index + 1}`).trim()
  const bullets = Array.isArray(scene.on_screen_text)
    ? scene.on_screen_text.filter(b => typeof b === 'string' && b.trim()).slice(0, 3)
    : []
  const kicker = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`

  // === Card (ink-surface @85% alpha, rounded, top 60% of frame) ===
  const cardX = 80
  const cardY = 180
  const cardW = W - 160
  const cardH = 820

  ctx.save()
  ctx.globalAlpha = 0.85
  ctx.fillStyle = '#221D17'
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 40)
  ctx.fill()
  ctx.restore()

  // Accent border-left 6px wide, inset 40px top/bottom
  ctx.fillStyle = accent
  ctx.fillRect(cardX, cardY + 40, 6, cardH - 80)

  // === Kicker top-left (mono, accent color, with dot) ===
  ctx.fillStyle = accent
  ctx.font = '700 32px TitleFont'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(kicker, cardX + 50, cardY + 80)
  // Dot after kicker
  const kickerW = ctx.measureText(kicker).width
  ctx.beginPath()
  ctx.arc(cardX + 50 + kickerW + 24, cardY + 70, 6, 0, Math.PI * 2)
  ctx.fill()

  // === Top-right geometric accent shape (diagonal stripe corner) ===
  ctx.save()
  ctx.strokeStyle = accent
  ctx.lineWidth = 3
  ctx.globalAlpha = 0.7
  ctx.beginPath()
  // 3 short diagonal strokes
  for (let i = 0; i < 3; i++) {
    const xStart = cardX + cardW - 120 + i * 20
    ctx.moveTo(xStart, cardY + 60)
    ctx.lineTo(xStart + 40, cardY + 60 + 40)
  }
  ctx.stroke()
  ctx.restore()

  // === Title (paper-cream, display large, auto-fit fontsize) ===
  ctx.fillStyle = '#F5EFE4'
  ctx.textAlign = 'left'
  // Auto-fit: fontsize 72 default, drop to 56 if title > 24 chars, 48 if > 36
  const titleLen = title.length
  const titleFontSize = titleLen > 36 ? 48 : titleLen > 24 ? 56 : 72
  ctx.font = `800 ${titleFontSize}px TitleFont`
  const maxCharsPerLine = titleFontSize >= 72 ? 16 : titleFontSize >= 56 ? 20 : 26
  const titleLines = wrapLines(title, maxCharsPerLine).slice(0, 3)
  const titleLineHeight = Math.round(titleFontSize * 1.15)
  titleLines.forEach((l, i) => {
    ctx.fillText(l, cardX + 50, cardY + 260 + i * titleLineHeight)
  })

  // === Divider stroke above bullets ===
  const bulletStartY = cardY + 260 + titleLines.length * titleLineHeight + 70
  ctx.save()
  ctx.strokeStyle = accent
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.4
  ctx.beginPath()
  ctx.moveTo(cardX + 50, bulletStartY - 40)
  ctx.lineTo(cardX + 250, bulletStartY - 40)
  ctx.stroke()
  ctx.restore()

  // === Bullet list (paper-soft, accent circle markers) ===
  ctx.fillStyle = '#E8DFC9'
  ctx.font = '500 36px TitleFont'
  bullets.forEach((b, i) => {
    const y = bulletStartY + i * 70
    // Marker circle
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(cardX + 62, y - 12, 8, 0, Math.PI * 2)
    ctx.fill()
    // Text — wrap if long (max 1 line visible per bullet, truncate with ellipsis)
    ctx.fillStyle = '#E8DFC9'
    const bulletText = wrapLines(b, 34)[0] || b.slice(0, 34)
    const bulletFinal = wrapLines(b, 34).length > 1 ? bulletText + '…' : bulletText
    ctx.fillText(bulletFinal, cardX + 95, y)
  })

  return canvas.encode('png')
}
