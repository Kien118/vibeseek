# VibeSeek Render Script

Renders a video from a `render_jobs` storyboard: generates Vietnamese narration via `edge-tts`, composites subtitles + background with `ffmpeg`, uploads MP4 to Supabase Storage, and sends a callback.

## Prerequisites

- **Node.js** >= 18
- **ffmpeg** installed and on PATH
- **edge-tts** installed (`pip install edge-tts`)

## Install

```bash
cd vibeseek/scripts/render
npm ci
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `APP_CALLBACK_URL` | Yes | URL to POST render result to (e.g. `https://your-app.vercel.app/api/render-callback`) |
| `RENDER_CALLBACK_SECRET` | Yes | Shared secret for callback auth header |
| `SUPABASE_STORAGE_BUCKET` | No | Storage bucket name (default: `vibeseek-videos`) |

## Usage

```bash
node render.mjs <jobId>
```

The script will:
1. Fetch the render job and storyboard from Supabase
2. Set job status to `rendering`
3. Generate TTS audio for each scene using `edge-tts` (voice: `vi-VN-HoaiMyNeural`)
4. Concatenate audio and generate SRT subtitles (UTF-8 BOM for Vietnamese)
5. Render 1080x1920 (9:16) MP4 with ffmpeg
6. Upload MP4 to Supabase Storage
7. Update job status to `ready` with video URL
8. POST callback to `APP_CALLBACK_URL`

On error, job status is set to `failed` with an error message, and the callback is notified.

## Storyboard JSON format

The `render_jobs.storyboard` column should contain:

```json
{
  "scenes": [
    { "narration": "Xin chao cac ban sinh vien" },
    { "narration": "Day la noi dung scene 2" }
  ]
}
```

Each scene must have a `narration` (or `text`) field with the Vietnamese text to speak and subtitle.
