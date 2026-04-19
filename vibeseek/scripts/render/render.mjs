#!/usr/bin/env node

/**
 * VibeSeek Render Script
 *
 * Reads a render_jobs row from Supabase, generates narration via edge-tts,
 * composites video with ffmpeg (background + subtitles + audio), uploads
 * the MP4 to Supabase Storage, and POSTs the callback.
 *
 * Usage: node render.mjs <jobId>
 *
 * Required env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   APP_CALLBACK_URL, RENDER_CALLBACK_SECRET
 * Optional:
 *   SUPABASE_STORAGE_BUCKET (default: vibeseek-videos)
 */

import { createClient } from '@supabase/supabase-js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

const run = promisify(execFile)

// ---------------------------------------------------------------------------
// 1. Validate env + args
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_CALLBACK_URL = process.env.APP_CALLBACK_URL
const RENDER_CALLBACK_SECRET = process.env.RENDER_CALLBACK_SECRET
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'vibeseek-videos'

const requiredEnv = {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  APP_CALLBACK_URL,
  RENDER_CALLBACK_SECRET,
}
for (const [name, value] of Object.entries(requiredEnv)) {
  if (!value) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
}

const jobId = process.argv[2]
if (!jobId) {
  console.error('Usage: node render.mjs <jobId>')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// 2. Supabase client (inline — cannot import TS lib from .mjs)
// ---------------------------------------------------------------------------

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function updateJobStatus(status, extra = {}) {
  const { error } = await supabase
    .from('render_jobs')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', jobId)
  if (error) console.error(`Failed to update job status to ${status}:`, error.message)
}

async function uploadVideo(buffer, key) {
  const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
    contentType: 'video/mp4',
    upsert: true,
  })
  if (error) throw error
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`
}

async function postCallback(payload) {
  try {
    await fetch(APP_CALLBACK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-render-secret': RENDER_CALLBACK_SECRET,
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('Callback POST failed:', err.message)
  }
}

/**
 * Run edge-tts to generate a wav file for a piece of text.
 */
async function tts(text, output) {
  await run('edge-tts', [
    '--voice', 'vi-VN-HoaiMyNeural',
    '--text', text,
    '--write-media', output,
  ])
}

/**
 * Get duration of an audio/video file in seconds via ffprobe.
 */
async function probeDuration(filePath) {
  const { stdout } = await run('ffprobe', [
    '-v', 'quiet',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    filePath,
  ])
  return parseFloat(stdout.trim())
}

/**
 * Split a narration string into lines ≤ maxCharsPerLine at word boundaries.
 * Single words longer than the cap get their own line (no mid-word break).
 * Returns [] for empty / whitespace-only input.
 */
function splitNarrationLines(text, maxCharsPerLine = 36) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines = []
  let current = ''
  for (const w of words) {
    if (!current) {
      current = w
    } else if ((current + ' ' + w).length <= maxCharsPerLine) {
      current += ' ' + w
    } else {
      lines.push(current)
      current = w
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * Format seconds to ASS timestamp: H:MM:SS.cc (centiseconds).
 */
function formatAssTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const cs = Math.round((seconds % 1) * 100)
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  // 3. Fetch job
  console.log(`Fetching render job: ${jobId}`)
  const { data: job, error: fetchErr } = await supabase
    .from('render_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (fetchErr || !job) {
    const msg = fetchErr?.message || 'Job not found'
    console.error(`Failed to fetch job: ${msg}`)
    await updateJobStatus('failed', { error_message: msg })
    await postCallback({ jobId, status: 'failed', videoUrl: null, durationSec: null, errorMessage: msg })
    process.exit(1)
  }

  const storyboard = job.storyboard
  if (!storyboard || !Array.isArray(storyboard.scenes) || storyboard.scenes.length === 0) {
    const msg = 'Invalid storyboard: missing or empty scenes array'
    console.error(msg)
    await updateJobStatus('failed', { error_message: msg })
    await postCallback({ jobId, status: 'failed', videoUrl: null, durationSec: null, errorMessage: msg })
    process.exit(1)
  }

  // 4. Set status = rendering
  console.log('Setting job status to rendering...')
  await updateJobStatus('rendering')

  // Create temp working directory
  const workDir = join(tmpdir(), `vibeseek-render-${randomUUID()}`)
  await mkdir(workDir, { recursive: true })
  console.log(`Working directory: ${workDir}`)

  try {
    const scenes = storyboard.scenes

    // 5. Generate TTS audio for each scene
    console.log(`Generating TTS for ${scenes.length} scenes...`)
    const wavFiles = []
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      const narration = scene.narration || scene.text || ''
      if (!narration) {
        console.warn(`Scene ${i} has no narration text, skipping TTS`)
        continue
      }
      const speakable = (typeof scene.speakable_narration === 'string' && scene.speakable_narration.trim())
        ? scene.speakable_narration
        : narration
      const wavPath = join(workDir, `scene-${i}.wav`)
      console.log(`  TTS scene ${i}: "${speakable.substring(0, 50)}..."${speakable !== narration ? ' (phonetic)' : ''}`)
      await tts(speakable, wavPath)
      wavFiles.push(wavPath)
    }

    if (wavFiles.length === 0) {
      throw new Error('No audio generated — all scenes have empty narration')
    }

    // 6. Concat all wavs into a single mp3
    console.log('Concatenating audio files...')
    const concatListPath = join(workDir, 'concat.txt')
    const concatContent = wavFiles.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n')
    await writeFile(concatListPath, concatContent, 'utf-8')

    const audioPath = join(workDir, 'audio.mp3')
    await run('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c:a', 'libmp3lame',
      '-q:a', '2',
      audioPath,
    ])

    // Get total audio duration
    const totalDuration = await probeDuration(audioPath)
    console.log(`Total audio duration: ${totalDuration.toFixed(2)}s`)

    // 7. Generate ASS subtitles (explicit PlayResX/Y so libass doesn't scale up
    // from its default 384x288 canvas — root cause of the Phase 1 overflow bug).
    console.log('Generating ASS subtitles...')
    const assPath = join(workDir, 'subtitles.ass')
    let dialogueLines = ''
    let cumulativeTime = 0

    // Get individual scene durations for accurate timing
    const sceneDurations = []
    for (const wavFile of wavFiles) {
      const dur = await probeDuration(wavFile)
      sceneDurations.push(dur)
    }

    let wavIdx = 0
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      const narration = scene.narration || scene.text || ''
      if (!narration) continue

      const dur = sceneDurations[wavIdx] || 4.0
      const startTime = cumulativeTime
      const endTime = cumulativeTime + dur
      cumulativeTime = endTime

      const allLines = splitNarrationLines(narration, 36)
      let displayLines
      if (allLines.length <= 2) {
        displayLines = allLines
      } else {
        // Cap at 2 lines — line 2 gets ellipsis. Narration audio still plays full.
        displayLines = [allLines[0], allLines[1].replace(/[.,!?…\s]*$/, '') + '…']
      }
      // ASS uses `\N` for hard newline; join our manually-split lines with it.
      const text = displayLines.join('\\N')
      dialogueLines += `Dialogue: 0,${formatAssTime(startTime)},${formatAssTime(endTime)},Default,,0,0,0,,{\\fad(300,300)}${text}\n`
      wavIdx++
    }

    const assHeader = [
      '[Script Info]',
      'ScriptType: v4.00+',
      'PlayResX: 1080',
      'PlayResY: 1920',
      'WrapStyle: 2',
      'ScaledBorderAndShadow: yes',
      '',
      '[V4+ Styles]',
      'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
      // FontSize=56 reads as 56/1920 ≈ 2.9% of height — legible in 9:16 vertical format.
      // Alignment=2 bottom-center. MarginV=160 from bottom edge.
      'Style: Default,Arial,56,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,2,2,40,40,160,1',
      '',
      '[Events]',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ].join('\n') + '\n'

    await writeFile(assPath, assHeader + dialogueLines, 'utf-8')

    // 8. Render video with ffmpeg
    // Use relative paths for the subtitles filter to avoid Windows drive-letter
    // colon being parsed as an ffmpeg filter option separator.
    console.log('Rendering video with ffmpeg...')
    const outputPath = join(workDir, 'output.mp4')

    await run('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=#1a1a2e:s=1080x1920:d=${Math.ceil(totalDuration)}`,
      '-i', audioPath,
      '-vf', `subtitles=subtitles.ass`,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-shortest',
      outputPath,
    ], { cwd: workDir, timeout: 600_000 }) // 10 min timeout

    // Verify output exists and get final duration
    const finalDuration = await probeDuration(outputPath)
    console.log(`Output video duration: ${finalDuration.toFixed(2)}s`)

    // 9. Upload to Supabase Storage
    console.log('Uploading to Supabase Storage...')
    const videoBuffer = await readFile(outputPath)
    const videoKey = `${jobId}.mp4`
    const publicUrl = await uploadVideo(videoBuffer, videoKey)
    console.log(`Uploaded: ${publicUrl}`)

    // 10. Update job status to ready
    await updateJobStatus('ready', {
      video_url: publicUrl,
      duration_sec: Math.round(finalDuration),
    })

    // 11. POST callback
    console.log('Sending callback...')
    await postCallback({
      jobId,
      status: 'ready',
      videoUrl: publicUrl,
      durationSec: Math.round(finalDuration),
      errorMessage: null,
    })

    console.log('Render complete!')
  } catch (err) {
    // On error: update job, callback, exit 1
    const msg = err.message || String(err)
    console.error('Render failed:', msg)
    await updateJobStatus('failed', { error_message: msg })
    await postCallback({
      jobId,
      status: 'failed',
      videoUrl: null,
      durationSec: null,
      errorMessage: msg,
    })
    process.exit(1)
  } finally {
    // Cleanup temp dir
    try {
      await rm(workDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  }
}

main()
