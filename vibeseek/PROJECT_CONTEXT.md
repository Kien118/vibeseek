# VibeSeek Project Context

## 1) Project Purpose

VibeSeek is a Next.js app that turns text-based PDF files into short, engaging "Vibe Cards" using Google Gemini.  
Main user flow:

1. Upload a PDF from the web UI.
2. Server extracts text from PDF.
3. AI generates structured cards (`concept`, `quote`, `tip`, `fact`, `summary`).
4. Cards are returned to UI and optionally stored in Supabase.

This document is the single-source context file for future maintenance and upgrades.

## 2) Tech Stack

- Framework: Next.js 14 (App Router)
- Language: TypeScript + React 18
- Styling: Tailwind CSS + PostCSS + Autoprefixer
- AI: `@google/genai` (Gemini models)
- PDF parsing: `pdf-parse`
- Database: Supabase (Postgres + policies)
- Animations/UI: Framer Motion, react-hot-toast, react-dropzone

Package manager: `npm` (lockfile: `package-lock.json`).

## 3) Directory Overview

```text
vibeseek/
├── app/
│   ├── api/vibefy/route.ts       # Main POST API for PDF -> cards
│   ├── globals.css               # Global styles and CSS variables
│   ├── layout.tsx                # Root layout + toaster
│   └── page.tsx                  # Main client UI workflow
├── components/
│   ├── UploadZone.tsx            # Drag-and-drop PDF input
│   ├── ProgressBar.tsx           # Processing progress UI
│   ├── GlowButton.tsx            # Reusable CTA button
│   └── VibeCard.tsx              # Card display component
├── lib/ai/
│   ├── processor.ts              # PDF extraction + Gemini orchestration
│   └── prompts.ts                # Prompt templates
├── utils/
│   └── supabase.ts               # Supabase clients + TS types
├── supabase-schema.sql           # DB tables + indexes + RLS policies
├── .env.local.example            # Env template (placeholders)
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── CHANGELOG_NOTES.md            # Historical debug notes
```

## 4) Runtime Architecture

### Frontend (`app/page.tsx`)

- Client state machine: `idle` -> `file-selected` -> `processing` -> `done` or `error`.
- Uses `fetch('/api/vibefy', { method: 'POST', body: FormData })`.
- Sends: `pdf`, `title`, `maxCards`.
- On success:
  - Renders Vibe Cards grid.
  - Computes total `vibe_points`.
- On failure:
  - Displays toast + error state panel.

### API (`app/api/vibefy/route.ts`)

Request handling:

1. Validate file exists, extension is `.pdf`, and size <= `MAX_FILE_SIZE_MB`.
2. Convert uploaded file to `Buffer`.
3. Extract text via `extractTextFromBuffer`.
4. Reject short/empty text (< 50 chars).
5. Chunk text and process first chunk with `vibefyText`.
6. Return generated cards.
7. Optional DB persistence:
   - Insert row into `vibe_documents`.
   - Insert rows into `vibe_cards`.
   - DB errors are non-fatal and do not fail the request.

### AI layer (`lib/ai/processor.ts`)

- Validates `GEMINI_API_KEY`.
- Model fallback sequence:
  - `gemini-2.0-flash`
  - `gemini-2.0-flash-lite`
  - `gemini-2.5-flash`
- Retry strategy:
  - Up to 2 attempts/model.
  - Waits 5s on quota/rate errors (`429`/`quota` signals).
- Response processing:
  - Strips markdown code fences.
  - Parses JSON.
  - Normalizes card shape with safe defaults.

### Persistence (`utils/supabase.ts` + `supabase-schema.sql`)

Main tables:

- `vibe_documents`: metadata per uploaded document
- `vibe_cards`: generated cards
- `quiz_questions`: reserved for quiz mode
- `user_progress`: reserved for learn-to-earn/progress tracking

RLS is currently permissive for demo; production should tighten policies and enforce auth.

## 5) Environment Variables

Create `.env.local` from `.env.local.example` and fill:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
MAX_FILE_SIZE_MB=10
```

Notes:

- `GEMINI_API_KEY` is required for card generation.
- Supabase keys are required for persistence (API still returns cards even if DB save fails).

## 6) Local Development Runbook

From `vibeseek/`:

```bash
npm install
copy .env.local.example .env.local
# fill real keys in .env.local
npm run dev
```

Open: `http://localhost:3000`.

Other commands:

```bash
npm run build
npm run start
```

## 7) Localhost Troubleshooting Checklist

If localhost does not start:

1. Confirm you are in the correct folder (`vibeseek/`).
2. Confirm Node version is compatible with Next 14 (recommended Node 18.17+ or 20+).
3. Reinstall dependencies:
   - `npm install`
4. Clear build cache and retry:
   - Delete `.next/`
   - `npm run dev`
5. If module resolution errors persist:
   - Delete `node_modules` + `package-lock.json`
   - `npm install`
6. If `3000` port is busy:
   - Run `npm run dev -- -p 3001`.
7. If AI endpoint fails:
   - Verify `GEMINI_API_KEY` in `.env.local`.
8. If DB save fails:
   - Verify Supabase env values and schema has been applied.

## 8) Known Constraints and Risks

- Current logic uses only the first text chunk for AI generation; long PDFs can be partially ignored.
- Scan/image PDFs are not OCR-processed; extraction may fail.
- RLS is demo-friendly and should be hardened in production.
- Lint setup is not initialized yet (`npm run lint` may prompt interactive setup).

## 9) Upgrade Backlog (Recommended Order)

1. Multi-chunk processing for long PDFs.
2. OCR fallback for scanned PDFs.
3. Quiz generation endpoint using existing `QUIZ_*` prompts.
4. User auth + strict RLS policies.
5. Upload source files to Supabase Storage and save `file_url`.
6. Add test coverage for API route and AI output validation.

## 10) Quick "How It Works" Summary

VibeSeek is a single-page Next.js app where the user uploads a PDF, server-side code extracts text, Gemini converts it to structured short cards, and the app displays results immediately while optionally persisting data to Supabase.
