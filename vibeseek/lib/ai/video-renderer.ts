import { mkdir, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import crypto from 'node:crypto'

import type { VideoStoryboard } from './processor'

function toSrtTime(seconds: number): string {
  const totalMs = Math.max(0, Math.floor(seconds * 1000))
  const ms = totalMs % 1000
  const totalSec = Math.floor(totalMs / 1000)
  const sec = totalSec % 60
  const totalMin = Math.floor(totalSec / 60)
  const min = totalMin % 60
  const hour = Math.floor(totalMin / 60)
  return `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}

function sceneToSubtitle(scene: VideoStoryboard['scenes'][number]): string {
  const lineA = scene.title?.trim() || 'Untitled Scene'
  const lineB = scene.narration?.trim() || scene.on_screen_text?.join(' - ') || ''
  return `${lineA}\n${lineB}`.trim()
}

function buildSrt(storyboard: VideoStoryboard): string {
  let cursor = 0
  return storyboard.scenes
    .map((scene, idx) => {
      const start = cursor
      const end = cursor + Math.max(3, scene.duration_sec || 6)
      cursor = end
      return `${idx + 1}\n${toSrtTime(start)} --> ${toSrtTime(end)}\n${sceneToSubtitle(scene)}\n`
    })
    .join('\n')
}

function runCmd(bin: string, args: string[], stdinText?: string): Promise<{ stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stderr = ''
    let stdout = ''
    if (stdinText) {
      child.stdin.write(stdinText)
      child.stdin.end()
    } else {
      child.stdin.end()
    }
    child.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    child.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    child.on('error', (err) => {
      reject(err)
    })
    child.on('close', (code) => {
      if (code === 0) return resolve({ stderr, stdout })
      reject(new Error(stderr || `${bin} exited with code ${code}`))
    })
  })
}

function normalizeNarrationText(storyboard: VideoStoryboard): string {
  return storyboard.scenes
    .map((scene, idx) => {
      const title = scene.title?.trim() || `Canh ${idx + 1}`
      const narration = scene.narration?.trim() || scene.on_screen_text.join(', ')
      return `${title}. ${narration}`.trim()
    })
    .join('\n')
}

async function tryEdgeTts(voiceText: string, outPath: string): Promise<boolean> {
  const voice = process.env.EDGE_TTS_VOICE || 'vi-VN-HoaiMyNeural'
  try {
    await runCmd('edge-tts', ['--voice', voice, '--text', voiceText, '--write-media', outPath])
    return true
  } catch {
    return false
  }
}

async function tryPiper(voiceText: string, outPath: string): Promise<boolean> {
  const modelPath = process.env.PIPER_MODEL_PATH
  if (!modelPath) return false
  try {
    await runCmd('piper', ['--model', modelPath, '--output_file', outPath], voiceText)
    return true
  } catch {
    return false
  }
}

async function synthesizeVietnameseVoice(storyboard: VideoStoryboard, outBasePath: string): Promise<{ audioPath: string | null; provider: string }> {
  const voiceText = normalizeNarrationText(storyboard)
  const edgePath = `${outBasePath}.mp3`
  const piperPath = `${outBasePath}.wav`

  const edgeOk = await tryEdgeTts(voiceText, edgePath)
  if (edgeOk) return { audioPath: edgePath, provider: 'edge-tts' }

  const piperOk = await tryPiper(voiceText, piperPath)
  if (piperOk) return { audioPath: piperPath, provider: 'piper' }

  return { audioPath: null, provider: 'none' }
}

export async function renderVideoFromStoryboard(storyboard: VideoStoryboard): Promise<{ publicUrl: string; filePath: string; audioProvider: string }> {
  const generatedDir = path.join(process.cwd(), 'public', 'generated')
  await mkdir(generatedDir, { recursive: true })

  const id = crypto.randomBytes(6).toString('hex')
  const baseName = `vibeseek-${Date.now()}-${id}`
  const srtPath = path.join(generatedDir, `${baseName}.srt`)
  const mp4Path = path.join(generatedDir, `${baseName}.mp4`)
  const srtEscapedForFilter = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:')

  const srt = buildSrt(storyboard)
  await writeFile(srtPath, srt, 'utf-8')
  const { audioPath, provider } = await synthesizeVietnameseVoice(storyboard, path.join(generatedDir, `${baseName}-voice`))

  const totalDuration = Math.max(
    8,
    storyboard.total_duration_sec ||
      storyboard.scenes.reduce((sum, scene) => sum + Math.max(3, scene.duration_sec || 6), 0)
  )

  const args = [
    '-y',
    '-f',
    'lavfi',
    '-i',
    `testsrc2=s=1080x1920:r=30:d=${totalDuration}`,
  ]

  if (audioPath) {
    args.push('-i', audioPath)
  }

  args.push(
    '-vf',
    `subtitles='${srtEscapedForFilter}':force_style='FontSize=42,PrimaryColour=&H00FFFFFF,OutlineColour=&H00202020,BorderStyle=1,Outline=2,Alignment=2,MarginV=120'`,
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p'
  )

  if (audioPath) {
    args.push('-c:a', 'aac', '-shortest')
  }

  args.push(mp4Path)

  try {
    await runCmd('ffmpeg', args)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Render video failed. Ensure ffmpeg is installed and available in PATH. Details: ${msg.substring(0, 500)}`
    )
  }

  return {
    publicUrl: `/generated/${baseName}.mp4`,
    filePath: mp4Path,
    audioProvider: provider,
  }
}

