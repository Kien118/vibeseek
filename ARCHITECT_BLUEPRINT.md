# ARCHITECT_BLUEPRINT.md — VibeSeek

> **Tài liệu kiến trúc tổng thể, duy trì bởi Software Architect.**
> Mọi AI Agent (Claude Code, Cursor, Copilot, v.v.) trước khi thực thi task PHẢI đọc file này.
> Khi kiến trúc thay đổi, cập nhật tại đây TRƯỚC rồi mới sửa code.

- **Project:** VibeSeek — "Catch the Knowledge Vibe"
- **Owner:** WangNhat (đồ án học tập)
- **Last updated:** 2026-04-16
- **Status:** MVP in progress
- **Root path:** `D:\WangNhat\Study\VibeCode\vibeseek`

---

## §0. Cách dùng tài liệu này

### Cho Software Architect (người viết/sửa)
- Mọi quyết định kiến trúc mới → update §2, §3, §4, §5 TRƯỚC khi cho agent viết code.
- Thêm task mới vào §11 với acceptance criteria rõ ràng.
- Open question mới → thêm vào §12.

### Cho AI Agent (người thực thi)
Trước khi thực thi task, đọc theo thứ tự:
1. **§1 Vision** — hiểu mình đang build cho ai, tại sao.
2. **§2 Architecture** — hiểu component mình đụng vào nằm ở đâu trong hệ thống.
3. **§4 Folder Structure** — đặt file đúng chỗ.
4. **§7 Business Logic** — tuân đúng rule, đặc biệt về free-tier và fallback.
5. **§11 Tasks** — tìm task được giao, đọc acceptance criteria.

**Khi không chắc chắn, DỪNG và hỏi Architect** — không tự quyết định kiến trúc.

---

## §1. Vision & Scope

### 1.1. Mục tiêu sản phẩm
Biến **tài liệu PDF học thuật dài + khô khan** thành **micro-content Gen Z-friendly** để sinh viên Việt Nam dễ tập trung và ghi nhớ:
- **Vibe Cards** (card tóm tắt 2–3 câu, emoji, tag).
- **Video MP4 9:16** (30–90s, có narration tiếng Việt + phụ đề) — **selling point #1, tải được về thiết bị**.
- **Quiz** trắc nghiệm theo card.
- **Leaderboard Vibe Points** (gamification).
- **Chatbot** hỏi đáp dựa trên nội dung tài liệu (RAG).

### 1.2. Đối tượng
- **Primary:** Sinh viên Việt Nam, Gen Z, tự học, dễ mất tập trung với tài liệu dài.
- **Secondary:** (tương lai) Giáo viên tạo nội dung giảng dạy, content creator.

### 1.3. Ngôn ngữ
- UI: **chỉ tiếng Việt**.
- PDF input: tiếng Việt (ưu tiên) và tiếng Anh (prompt AI sẽ tự xử lý).
- Code/comment: **tiếng Anh** (convention chuẩn).
- Prompt AI: **tiếng Việt** (đã có sẵn trong `lib/ai/prompts.ts`).

### 1.4. Ràng buộc bất di bất dịch
- 🟢 **FREE TIER TUYỆT ĐỐI** — không dùng service tính phí dưới mọi hình thức.
- 🟢 **Video MP4 phải render tự động**, không phụ thuộc AI storyboard quota.
- 🟢 **Public demo** — không bắt buộc login.
- 🟢 **Chỉ tiếng Việt** — không cần i18n.
- 🔴 Không cần analytics/telemetry.
- 🔴 Không cần share link public — chỉ cần **download MP4 về thiết bị**.

### 1.5. Out of scope (MVP)
- Authentication đầy đủ (login/signup UI) — giữ **guest mode** với `user_id = null` hoặc session fingerprint tạm.
- Teacher dashboard / lớp học / class management.
- Mobile app native.
- Đa ngôn ngữ UI.
- Payment / subscription.

---

## §2. Architecture Overview

### 2.1. Sơ đồ khối

```
┌──────────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                             │
│  Next.js 14 App Router · Three.js · Framer Motion · react-dropzone   │
│  - Upload PDF  - Xem Cards  - Play/Download Video  - Quiz            │
│  - Leaderboard  - Chatbot UI                                         │
└──────────┬──────────────────────────────────────────────┬────────────┘
           │ multipart/form-data                          │ WebSocket/polling
           │ JSON                                         │ (not used — poll via fetch)
           ▼                                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  VERCEL EDGE/NODE (Next.js API)                      │
│  /api/vibefy            → PDF→text→cards (Gemini)                    │
│  /api/vibefy-video      → cards→storyboard + enqueue render          │
│  /api/render-callback   → nhận webhook từ GitHub Actions khi MP4 xong│
│  /api/quiz/*            → CRUD quiz, chấm điểm                       │
│  /api/leaderboard       → top N theo vibe_points                     │
│  /api/chat              → RAG chatbot (Gemini + pgvector)            │
└────┬───────────┬────────────────────┬────────────────┬───────────────┘
     │           │                    │                │
     │ SQL       │ REST API           │ repo_dispatch  │ presigned URL
     ▼           ▼                    ▼                ▼
┌─────────┐  ┌───────────┐  ┌──────────────────┐  ┌────────────────┐
│SUPABASE │  │  GEMINI   │  │  GITHUB ACTIONS  │  │ CLOUDFLARE R2  │
│Postgres │  │  2.0 FLASH│  │  (MP4 Renderer)  │  │ (10GB free)    │
│+pgvector│  │ 1500/day  │  │ ffmpeg + edge-tts│  │ S3-compatible  │
│(500MB)  │  │  FALLBACK:│  │ 2000 min/mo free │  │                │
│         │  │  GROQ     │  │                  │  │                │
│         │  │ llama-3.3 │  │ triggered via    │  │ uploads MP4    │
│         │  │  FREE     │  │ repository_      │  │ returns URL    │
│         │  │           │  │  dispatch event  │  │                │
└─────────┘  └───────────┘  └─────────┬────────┘  └────────────────┘
                                      │
                                      │ reads storyboard JSON,
                                      │ renders MP4, uploads to R2,
                                      │ webhooks /api/render-callback
                                      ▼
                                 (close the loop)
```

### 2.2. Data flow — Happy path (PDF → Video download)

1. User kéo thả PDF vào `UploadZone`.
2. Client `POST /api/vibefy` (multipart).
3. API route:
   - `extractTextFromBuffer()` (pdf-parse).
   - `vibefyText()` → Gemini sinh Vibe Cards JSON.
   - Insert `vibe_documents` + `vibe_cards` vào Supabase.
   - Return `{ documentId, cards }` cho client.
4. Client hiển thị cards + bấm "🎬 Tạo video".
5. Client `POST /api/vibefy-video { documentId }`.
6. API route:
   - `generateVideoStoryboard()` → Gemini sinh storyboard JSON (fallback Groq nếu 429).
   - Insert row vào `render_jobs` (status=`queued`).
   - Gọi GitHub API `POST /repos/{owner}/{repo}/dispatches` với payload `{ event_type: "render-video", client_payload: { jobId, storyboardUrl } }`.
   - Return `{ jobId }` cho client ngay (202 Accepted).
7. GitHub Actions workflow `render-video.yml`:
   - Checkout tối thiểu (`sparse-checkout`).
   - `apt-get install ffmpeg`, `pip install edge-tts`.
   - Fetch storyboard JSON từ Supabase bằng `jobId`.
   - Chạy script render (Node hoặc Python) → `output.mp4`.
   - Upload MP4 lên Cloudflare R2 bằng `aws s3 cp` (với endpoint R2).
   - POST về `/api/render-callback { jobId, videoUrl, duration }`.
8. `/api/render-callback` update `render_jobs.status=ready, video_url=...`.
9. Client poll `GET /api/render-jobs/{jobId}` mỗi 5s (hoặc dùng Supabase realtime subscription).
10. Khi `status=ready` → button "⬇️ Tải về" xuất hiện, link = presigned R2 URL với header `Content-Disposition: attachment`.

### 2.3. Quiz flow
1. Khi cards được tạo, `/api/vibefy` **async** trigger sinh quiz (fire-and-forget, không block user).
2. Quiz được insert vào `quiz_questions` với `card_id`.
3. UI hiện quiz sau khi user xem hết cards, chấm điểm → `user_progress` tăng `vibe_points_earned`.

### 2.4. Leaderboard flow
- Guest user → tạo `anon_id` lưu localStorage + một row trong `leaderboard_profiles { anon_id, display_name, total_points }`.
- Sau mỗi quiz đúng, `/api/quiz/submit` cộng điểm vào `leaderboard_profiles`.
- `GET /api/leaderboard` → top 20.

### 2.5. Chatbot flow (RAG)
1. Khi cards được tạo, sinh embedding cho mỗi card content bằng **Gemini `text-embedding-004`** (free, 1500 req/day).
2. Lưu vector vào `card_embeddings` (Supabase pgvector).
3. User chat: `/api/chat { documentId, message, history }`.
4. API: embed query → `SELECT ... ORDER BY embedding <-> query LIMIT 5` → prompt Gemini với context.
5. Stream response về client (Server-Sent Events).

---

## §3. Tech Stack (LOCKED)

Không thay đổi các mục dưới đây khi chưa cập nhật blueprint và được Architect duyệt.

| Layer | Choice | Lý do |
|---|---|---|
| Frontend framework | **Next.js 14 App Router + TypeScript** | Đã có sẵn; Vercel free; full-stack one-repo |
| Styling | **Tailwind CSS 3.4** | Đã có; Gen Z aesthetic nhanh |
| 3D | **three + @react-three/fiber + drei** | DOJO.glb là nhân vật chính landing page |
| Animation | **framer-motion + gsap** | Đã có; dùng cho page transitions + scroll |
| Icon | **lucide-react** | Đã có |
| DB | **Supabase Postgres free** (500MB, 2GB bandwidth) | Đã có; có Auth + Storage + pgvector + Realtime |
| Vector search | **pgvector extension trong Supabase** | Free; không cần Pinecone |
| AI primary | **Google Gemini 2.0 Flash** (1500/day free) | Đã có; tiếng Việt tốt |
| AI fallback | **Groq** (llama-3.3-70b-versatile, 30 RPM, 14.4k req/day free) | Khi Gemini 429; tốc độ rất nhanh |
| Embeddings | **Gemini text-embedding-004** (free) | 768-dim; đủ cho pgvector |
| PDF parsing | **pdf-parse** (Node) | Đã có |
| Video renderer | **GitHub Actions + ffmpeg + edge-tts** | Private repo: 2000 min/tháng free (~33 video/ngày @ 2 min/video); có shell → chạy ffmpeg |
| TTS | **edge-tts (Microsoft Edge)** voice `vi-VN-HoaiMyNeural` / `vi-VN-NamMinhNeural` | Free, chất lượng tốt nhất cho tiếng Việt free |
| MP4 storage | **Cloudflare R2** (10GB + 10M req/tháng free) | S3-compatible; không charge egress |
| Hosting app | **Vercel free** (Hobby) | Zero-config Next.js |
| Job queue | **Supabase table `render_jobs`** (poll-based) | Không cần Redis/QStash |
| Auth | ❌ **Không dùng MVP** — chỉ `anon_id` localStorage | Public demo; Supabase RLS mở |

### 3.1. Đã loại bỏ khỏi stack (KHÔNG DÙNG)
- ❌ **Python pipeline `pdf2genz`** (`src/pdf2genz/`) — trùng lặp với `lib/ai/video-renderer.ts`; dọn dẹp ở task T-003.
- ❌ **Supabase Storage cho MP4** — chỉ 1GB; chuyển sang R2.
- ❌ **Local fallback storyboard** (`buildLocalStoryboard`) — chất lượng kém; dùng Groq fallback thay thế.
- ❌ **Root `package-lock.json`** — rỗng; xóa ở T-002.
- ❌ **`api.doc`** — file Word binary không liên quan code; xóa ở T-002.

---

## §4. Target Folder Structure

Sau khi cleanup, cấu trúc dự kiến:

```
VibeCode/
├── ARCHITECT_BLUEPRINT.md          ← file này (ở ROOT)
├── .github/
│   └── workflows/
│       └── render-video.yml        ← MP4 renderer worker
└── vibeseek/                       ← Next.js app (deploy to Vercel)
    ├── .env.local                  ← SECRET (gitignored — xem T-001)
    ├── .env.local.example          ← template public
    ├── .gitignore                  ← phải có .env*.local, !.env.local.example
    ├── next.config.js
    ├── package.json
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── supabase-schema.sql         ← DDL + RLS + indexes (source of truth DB)
    │
    ├── app/                        ← Next.js App Router
    │   ├── layout.tsx
    │   ├── page.tsx                ← Landing (DOJO.glb scene)
    │   ├── globals.css
    │   ├── dashboard/
    │   │   └── page.tsx            ← Upload + Cards + Video
    │   ├── quiz/
    │   │   └── [documentId]/page.tsx
    │   ├── leaderboard/
    │   │   └── page.tsx
    │   ├── chat/
    │   │   └── [documentId]/page.tsx
    │   └── api/
    │       ├── vibefy/route.ts         ← POST: PDF → cards
    │       ├── vibefy-video/route.ts   ← POST: cards → storyboard + enqueue render
    │       ├── render-callback/route.ts ← POST: GitHub Actions webhook
    │       ├── render-jobs/
    │       │   └── [jobId]/route.ts    ← GET: poll job status
    │       ├── quiz/
    │       │   ├── generate/route.ts   ← POST: sinh quiz cho document
    │       │   └── submit/route.ts     ← POST: chấm điểm
    │       ├── leaderboard/route.ts    ← GET: top 20
    │       └── chat/route.ts           ← POST: RAG chatbot (streaming)
    │
    ├── components/
    │   ├── UploadZone.tsx
    │   ├── VibeCard.tsx
    │   ├── ProgressBar.tsx
    │   ├── GlowButton.tsx
    │   ├── VideoPlayer.tsx         ← NEW: play + download MP4
    │   ├── QuizCard.tsx            ← NEW
    │   ├── LeaderboardTable.tsx    ← NEW
    │   ├── ChatPanel.tsx           ← NEW
    │   └── 3d/
    │       ├── DojoModel.tsx       ← nhân vật chính (KEEP)
    │       ├── LandingSceneCanvas.tsx
    │       ├── Experience.tsx
    │       ├── SceneLoader.tsx
    │       ├── Model.tsx
    │       ├── types.ts
    │       ├── useVibeScrollTimeline.ts
    │       └── _unused/            ← audit ở T-004: giữ lại chỉ DOJO-related
    │
    ├── lib/
    │   ├── ai/
    │   │   ├── processor.ts        ← extract + vibefy + storyboard
    │   │   ├── prompts.ts          ← system prompts (tiếng Việt)
    │   │   ├── quiz.ts             ← NEW: sinh quiz
    │   │   ├── embeddings.ts       ← NEW: Gemini embedding + pgvector
    │   │   ├── chat.ts             ← NEW: RAG orchestration
    │   │   ├── providers/
    │   │   │   ├── gemini.ts       ← NEW: tách Gemini client
    │   │   │   └── groq.ts         ← NEW: fallback client
    │   │   └── video-renderer.ts   ← CHỈ code share giữa API và GH Actions
    │   ├── db/
    │   │   └── queries.ts          ← NEW: Supabase query helpers (typed)
    │   ├── r2/
    │   │   └── client.ts           ← NEW: Cloudflare R2 SDK wrapper
    │   └── github/
    │       └── dispatch.ts         ← NEW: trigger repository_dispatch
    │
    ├── utils/
    │   ├── supabase.ts             ← clients (public + admin) + types
    │   └── anon-id.ts              ← NEW: localStorage anon_id manager
    │
    ├── scripts/
    │   └── render/
    │       ├── render.ts           ← entry point chạy trong GH Actions
    │       └── package.json        ← dependencies riêng (minimal) để Actions cài nhanh
    │
    └── public/
        ├── models/
        │   └── DOJO.glb            ← KEEP (nhân vật chính)
        │   (các .glb khác audit ở T-004)
        └── generated/              ← DEPRECATE — chuyển hẳn sang R2, không dùng local folder
```

### 4.1. Rule đặt file
- **API route** → `app/api/<resource>/route.ts`. Dùng kebab-case cho resource.
- **React component** → `components/` nếu tái sử dụng, hoặc co-locate trong `app/<route>/_components/` nếu chỉ dùng 1 chỗ.
- **Business logic / AI / DB** → `lib/`. **Không** đặt logic trong `app/api/route.ts` quá 30 dòng — tách sang `lib/`.
- **Pure utility** (no external dep) → `utils/`.
- **Script chạy ngoài app** (GH Actions, CLI) → `scripts/`.

---

## §5. Data Model

### 5.1. Giữ nguyên từ `supabase-schema.sql`
- `vibe_documents(id, user_id, title, original_filename, file_url, status, total_cards, created_at)`
- `vibe_cards(id, document_id, order_index, card_type, title, content, emoji, tags, vibe_points, created_at)`
- `quiz_questions(id, card_id, question, options, correct_index, explanation, created_at)`
- `user_progress(id, user_id, card_id, viewed, quiz_correct, vibe_points_earned, completed_at)`

### 5.2. Bảng mới cần tạo

```sql
-- Render jobs (queue cho GitHub Actions)
CREATE TABLE render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES vibe_documents(id) ON DELETE CASCADE,
  storyboard JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'rendering', 'ready', 'failed')),
  video_url TEXT,
  duration_sec NUMERIC,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX render_jobs_document_id_idx ON render_jobs(document_id);
CREATE INDEX render_jobs_status_idx ON render_jobs(status);

-- Guest profile (public leaderboard)
CREATE TABLE leaderboard_profiles (
  anon_id TEXT PRIMARY KEY,                 -- client-generated UUID lưu localStorage
  display_name TEXT NOT NULL DEFAULT 'Vibe Rookie',
  total_points INTEGER NOT NULL DEFAULT 0,
  documents_count INTEGER NOT NULL DEFAULT 0,
  quiz_correct_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX leaderboard_profiles_points_idx ON leaderboard_profiles(total_points DESC);

-- Quiz attempts (tracking + anti-cheat cơ bản)
CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id TEXT NOT NULL REFERENCES leaderboard_profiles(anon_id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  selected_index INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 0,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(anon_id, question_id)              -- 1 câu hỏi chỉ tính điểm 1 lần/user
);

-- Vector store cho RAG chatbot
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE card_embeddings (
  card_id UUID PRIMARY KEY REFERENCES vibe_cards(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES vibe_documents(id) ON DELETE CASCADE,
  embedding vector(768) NOT NULL,           -- Gemini text-embedding-004 dim=768
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX card_embeddings_document_idx ON card_embeddings(document_id);
CREATE INDEX card_embeddings_vector_idx ON card_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- Chat history (optional, giữ context trong-session)
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES vibe_documents(id) ON DELETE CASCADE,
  anon_id TEXT,                             -- nullable cho demo
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX chat_messages_doc_idx ON chat_messages(document_id, created_at);
```

### 5.3. RLS Policies (MVP — public demo)
- Tất cả table: `SELECT` public (anon role).
- `INSERT/UPDATE`: chỉ `service_role` (server-side). Client GỌI QUA API, không trực tiếp.
- `leaderboard_profiles.UPDATE`: cho phép anon UPDATE row CỦA CHÍNH MÌNH (WHERE anon_id = request.headers.x-anon-id) — implement trong API, không trong RLS.
- **Sau MVP:** siết lại khi có Supabase Auth thật (§12 risk R-01).

### 5.4. Dẫn xuất & invariant
- `vibe_documents.total_cards` = `COUNT(vibe_cards WHERE document_id = ...)`. Update qua trigger hoặc recompute sau insert batch.
- `leaderboard_profiles.total_points` = `SUM(quiz_attempts.points_earned WHERE anon_id = ...)`. Update transactional khi insert quiz_attempts.
- 1 user = 1 `anon_id` = 1 row `leaderboard_profiles`. Idempotent upsert.

---

## §6. API Contracts

### 6.1. `POST /api/vibefy`
**Input:** `multipart/form-data`
- `pdf: File` (required, ≤ `MAX_FILE_SIZE_MB` = 10MB)
- `title: string` (optional, default = filename)
- `maxCards: number` (optional, default 10, range 5–20)
- Header `x-anon-id: string` (optional, để gắn vào `vibe_documents.user_id` sau này)

**Output 200:**
```json
{
  "success": true,
  "documentId": "uuid",
  "totalCards": 10,
  "cards": [ /* VibeCard[] */ ]
}
```
**Errors:** 400 (no pdf), 413 (too large), 422 (extract failed / empty), 503 (AI down), 500.

**Side effects:**
- Insert `vibe_documents` + `vibe_cards`.
- Async fire: `lib/ai/quiz.ts#generateQuizForDocument(documentId)` (không await — chạy ngầm).
- Async fire: `lib/ai/embeddings.ts#embedCards(documentId)` (không await).

---

### 6.2. `POST /api/vibefy-video`
**Input:** `application/json`
```json
{
  "documentId": "uuid",
  "maxScenes": 6
}
```
**Output 202 Accepted:**
```json
{
  "success": true,
  "jobId": "uuid",
  "status": "queued"
}
```
**Errors:** 400, 404 (document not found), 500.

**Side effects:**
1. Generate storyboard (Gemini → Groq fallback → **fail hard nếu cả 2 hết quota**, không dùng local).
2. Insert `render_jobs` với `status='queued'`.
3. Trigger GH Actions `repository_dispatch` event.

---

### 6.3. `GET /api/render-jobs/[jobId]`
**Output 200:**
```json
{
  "jobId": "uuid",
  "status": "queued" | "rendering" | "ready" | "failed",
  "videoUrl": "https://r2.../video.mp4" | null,
  "durationSec": 45.2 | null,
  "errorMessage": string | null
}
```

---

### 6.4. `POST /api/render-callback`
**Auth:** Header `x-render-secret: <GH_ACTIONS_WEBHOOK_SECRET>` (shared secret, verify constant-time).

**Input:**
```json
{
  "jobId": "uuid",
  "status": "ready" | "failed",
  "videoUrl": "https://...",
  "durationSec": 45.2,
  "errorMessage": null
}
```
**Output:** 200 `{ ok: true }`. 401 nếu sai secret.

---

### 6.5. `POST /api/quiz/submit`
**Input:**
```json
{
  "questionId": "uuid",
  "selectedIndex": 2,
  "anonId": "uuid"
}
```
**Output 200:**
```json
{
  "correct": true,
  "pointsEarned": 10,
  "explanation": "Giải thích...",
  "newTotalPoints": 420
}
```
**Rule:** 1 `questionId` chỉ tính điểm 1 lần/anon_id. Lần 2 → `pointsEarned: 0` nhưng vẫn trả explanation.

---

### 6.6. `GET /api/leaderboard?limit=20`
**Output:**
```json
{
  "top": [
    { "rank": 1, "displayName": "...", "totalPoints": 1200, "documentsCount": 8 }
  ]
}
```

---

### 6.7. `POST /api/chat` (Server-Sent Events)
**Input:**
```json
{
  "documentId": "uuid",
  "message": "Giải thích lại thuật toán Dijkstra?",
  "history": [ { "role": "user"|"assistant", "content": "..." } ]
}
```
**Output:** `text/event-stream`
```
data: {"delta":"Thuật toán Dijkstra là "}
data: {"delta":"một thuật toán..."}
data: {"done":true,"tokensUsed":245}
```

---

## §7. Business Logic Rules

### 7.1. Vibe Card generation (giữ nguyên, đã có trong `lib/ai/prompts.ts`)
- `card_type ∈ {concept, quote, tip, fact, summary}`.
- Title ≤ 10 từ; Content ≤ 3 câu.
- Mỗi card có 1 emoji và ≥1 tag (lowercase, không dấu).
- **Không bịa số liệu** — chỉ dùng fact có trong PDF.

### 7.2. Video storyboard
- 4–8 scene, mỗi scene 4–15 giây, tổng 30–90s.
- Tỉ lệ 9:16 (1080×1920).
- Mỗi scene có: `title`, `visual_prompt`, `narration` (tiếng Việt, ≤ 2 câu), `on_screen_text` (≤ 3 dòng ngắn), `duration_sec`.
- Hook scene đầu (0:00–0:05) PHẢI gây tò mò/shock (theo style TikTok).
- Scene cuối CTA: "Follow VibeSeek để học thêm vibe!".

### 7.3. Fallback chain AI (quan trọng — quyết định reliability)

**Cards & Storyboard:**
```
Gemini 2.0 Flash
   │ 429/5xx (>=2 retry với backoff 5s, 10s)
   ▼
Gemini 2.0 Flash Lite
   │ 429/5xx
   ▼
Gemini 2.5 Flash
   │ 429/5xx
   ▼
Groq llama-3.3-70b-versatile
   │ 429/5xx
   ▼
FAIL — trả 503 cho client, hiển thị "AI đang quá tải, thử lại sau 1 phút"
```

**Embeddings:**
```
Gemini text-embedding-004
   │ fail
   ▼
FAIL gracefully — lưu card không embedding, chatbot trả lời "Không đủ context để trả lời chính xác"
```

**KHÔNG DÙNG `buildLocalStoryboard`** — chất lượng kém, đã quyết bỏ.

### 7.4. Video rendering (GitHub Actions)
- Workflow chạy khi nhận `repository_dispatch` event `render-video`.
- Input: `client_payload.jobId`.
- Steps:
  1. Fetch storyboard từ Supabase REST API (dùng `SUPABASE_SERVICE_ROLE_KEY` secret).
  2. Update `render_jobs.status='rendering'`.
  3. Gọi `edge-tts` sinh `.wav` cho từng narration → concat.
  4. Ffmpeg ghép: background gradient (hoặc stock video loop) + text overlay + narration + subtitles từ SRT.
  5. Upload MP4 lên R2 qua `aws s3 cp` với R2 endpoint.
  6. POST `/api/render-callback` với video URL.
- Timeout: 10 phút.
- Retry: GH Actions có `retry-action` — retry 2 lần.

### 7.5. Quiz generation
- Sinh ngay sau khi cards tạo xong (async, không block UX).
- 1 quiz/card với 4 options, 1 correct, explanation ≤ 2 câu.
- Mỗi câu đúng = `vibe_cards.vibe_points` (default 10).

### 7.6. Leaderboard
- `anon_id` sinh client-side lần đầu vào app, lưu localStorage key `vibeseek:anonId`.
- `display_name` mặc định "Vibe Rookie", cho phép user đổi ở `/leaderboard` (1 input box).
- Không anti-cheat nặng — chỉ `UNIQUE(anon_id, question_id)` chặn farm điểm cùng câu.

### 7.7. Chatbot
- Retrieve top-5 card embedding gần nhất.
- Prompt Gemini: "Bạn là VibeBuddy, giúp sinh viên hiểu bài. Dựa CHỈ vào context sau trả lời. Nếu không có, nói 'Mình không rõ phần này trong tài liệu'. Context: [5 cards]. Câu hỏi: [message]".
- Giới hạn 20 messages/session (tránh burn quota).
- Lưu `chat_messages` cho analytics tương lai (dù không có analytics ở MVP — vẫn lưu là rẻ).

### 7.8. File size & PDF limits
- Max PDF size: **10 MB** (env `MAX_FILE_SIZE_MB=10`).
- Max pages: **50**. Nếu PDF > 50 trang → trả 422 với message **"Tính năng xử lý tài liệu > 50 trang đang được phát triển. Vui lòng thử với PDF ngắn hơn."** (kiểm ở `extractTextFromBuffer` sau khi count pages qua `pdf-parse`).
- Max chars sau extract: **40,000** → nếu hơn, chunk 4000 char và Gemini xử lý từng chunk (đã có sẵn `chunkText()`).

### 7.9. Render quota guard (GH Actions)
- Trước khi trigger `repository_dispatch`, check `render_jobs` count trong 30 ngày gần nhất: `SELECT SUM(duration_sec) / 60 FROM render_jobs WHERE created_at > NOW() - INTERVAL '30 days' AND status IN ('rendering', 'ready')`.
- Nếu tổng ≥ 1800 phút (buffer 10% dưới 2000) → trả 429 "Kho render đã đầy tháng này. Thử lại vào ngày 1 tháng sau.".
- Cron job clean `render_jobs` cũ hơn 30 ngày (Supabase pg_cron hoặc Vercel cron).

### 7.10. Security & secrets
- `.env.local` **PHẢI** nằm trong `.gitignore` (xem T-001 — hiện đang bị commit).
- Tất cả secret server-side chỉ dùng trong API route (`process.env.XXX`). Client chỉ dùng `NEXT_PUBLIC_*`.
- GH Actions secrets cho: `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `RENDER_CALLBACK_SECRET`.

### 7.11. UI rules (bắt buộc tuân thủ)
- **Vibe Points badge:** hiển thị **top-right** navigation trên MỌI page (trừ landing `/`). Component `<VibePointsBadge />` trong `components/`, đọc `total_points` từ `leaderboard_profiles` theo `anon_id` (localStorage). Click vào badge → điều hướng `/leaderboard`.
- **Landing page mascot (DOJO):**
  - DOJO.glb được tách làm 2 group: **head** và **body** (trong `DojoModel.tsx`).
  - **Head xoay theo con trỏ chuột** (mouse-follow), clamp góc xoay ±30° mỗi trục Y/X.
  - **Body giữ nguyên** (idle nhẹ).
  - Chỉ dùng trong `app/page.tsx` (landing). **Không** render DOJO ở dashboard/quiz/leaderboard/chat.
  - Implement bằng `useFrame` trong react-three-fiber + `useRef` trỏ vào head mesh; đọc `mouse.x/y` từ `useThree`.
- **Không** dùng icon emoji nặng hoặc animation nặng trong dashboard — ưu tiên tốc độ.
- **Không** tự thêm 3D vào page ngoài landing trừ khi blueprint cho phép.

---

## §8. Environment & Secrets

### 8.1. `.env.local` (Next.js, local dev — **KHÔNG commit**)
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
GEMINI_API_KEY=
GROQ_API_KEY=                              # NEW

# GitHub dispatch
GITHUB_REPO_OWNER=                         # NEW (e.g. "twangnhat-05")
GITHUB_REPO_NAME=                          # NEW (e.g. "VibeCode")
GITHUB_DISPATCH_TOKEN=                     # NEW (fine-grained PAT, scope: Actions:write)

# Cloudflare R2
R2_ACCOUNT_ID=                             # NEW
R2_ACCESS_KEY_ID=                          # NEW
R2_SECRET_ACCESS_KEY=                      # NEW
R2_BUCKET=vibeseek-videos                  # NEW
R2_PUBLIC_BASE_URL=                        # NEW (custom domain hoặc r2.dev URL)

# Render callback (shared với GH Actions)
RENDER_CALLBACK_SECRET=                    # NEW (random 32+ char)

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
MAX_FILE_SIZE_MB=10
```

### 8.2. GitHub Actions Secrets (Repository Settings → Secrets)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY` (nếu cần retry storyboard trong worker)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`
- `RENDER_CALLBACK_SECRET`
- `APP_CALLBACK_URL` (e.g., `https://vibeseek.vercel.app/api/render-callback`)

### 8.3. `.env.local.example` (commit)
Copy cấu trúc trên, giá trị để trống. Luôn đồng bộ khi thêm env mới.

---

## §9. Free-Tier Budget & Quotas

| Service | Limit | Dự phòng |
|---|---|---|
| Gemini 2.0 Flash | 1500 req/day, 15 RPM, 1M TPM | Fallback Groq |
| Groq llama-3.3-70b | 30 RPM, 14.4k req/day, 500k TPD | Fail hard → user retry |
| Gemini embedding-004 | 1500 req/day | Skip embedding, chatbot downgrade |
| Supabase Postgres | 500MB storage, 2GB egress/tháng | Monitor; prune `chat_messages` cũ |
| Supabase Auth | N/A (không dùng) | — |
| Cloudflare R2 | 10GB storage, 10M Class A + unlimited egress | Auto-delete video > 30 ngày (cron) |
| GitHub Actions | **Private repo: 2000 min/tháng** | Bottleneck chính → rate-limit user ở §7.8 |
| Vercel | 100GB bandwidth/tháng, serverless 10s default | Video render đã off-load sang GH Actions |

**Realistic ước tính (giới hạn bởi GH Actions private 2000 min/tháng):**
- Trần: ~33 video/ngày @ 2 min render → ~66 min/ngày × 30 = 1980 phút ✓.
- Dự kiến demo: 20 user/ngày × 1 video = 40 min/ngày = 1200 min/tháng ✓.
- Gemini cards: 20 req/day ✓ (dưới 1500).
- Gemini storyboard: 20 req/day ✓.
- Gemini embed: 20 × 10 cards = 200 req/day ✓.
- R2: 20 × 5MB = 100MB/day → cleanup 30 ngày là đủ.
- **Nếu vượt quota GH Actions** (cuối tháng) → `/api/vibefy-video` trả 429 với message "Kho render đã đầy tháng này, thử lại từ ngày 1 tháng sau". Alert ở §12 R-08.

---

## §10. Roadmap

### Phase 0 — Hygiene (TRƯỚC TIÊN, 1 ngày)
- T-001 Fix `.gitignore` cho `.env.local` (HIGH).
- T-002 ✅ Xóa file rác root (`package-lock.json`, `api.doc`). Done — PR #1 merged 2026-04-17.
- T-003 Xóa `src/pdf2genz/`, `pyproject.toml`, `requirements.txt`.
- T-004 Audit `components/3d/_unused/` và `public/models/*.glb` — xóa file không liên quan DOJO.
- T-005 Reconcile `README.md` + xoá `agent.md` (stale OpenAI/Leonardo stack — mâu thuẫn §3).

### Phase 1 — MVP Video Renderer (3–5 ngày)
- T-101 Tạo `render_jobs` table.
- T-102 Viết `lib/r2/client.ts` + setup R2 bucket.
- T-103 Viết `lib/github/dispatch.ts`.
- T-104 Viết `.github/workflows/render-video.yml`.
- T-105 Viết `scripts/render/render.ts` (chạy trong Actions).
- T-106 Refactor `/api/vibefy-video` → enqueue thay vì render đồng bộ.
- T-107 Thêm `/api/render-callback` + `/api/render-jobs/[jobId]`.
- T-108 `VideoPlayer.tsx` component với poll + download button.

### Phase 2 — Quiz & Leaderboard (2–3 ngày)
- T-201 `leaderboard_profiles`, `quiz_attempts` tables.
- T-202 `utils/anon-id.ts` manager.
- T-203 `lib/ai/quiz.ts` + trigger trong `/api/vibefy`.
- T-204 `/api/quiz/submit` + `/api/leaderboard`.
- T-205 UI: `QuizCard`, `/quiz/[documentId]`, `LeaderboardTable`, `/leaderboard`.

### Phase 3 — Chatbot RAG (2–3 ngày)
- T-301 Enable `pgvector` extension + `card_embeddings`, `chat_messages` tables.
- T-302 `lib/ai/embeddings.ts` + trigger trong `/api/vibefy`.
- T-303 `lib/ai/chat.ts` (retrieve + stream).
- T-304 `/api/chat` SSE route.
- T-305 UI: `ChatPanel.tsx`, `/chat/[documentId]`.

### Phase 4 — Polish (ongoing)
- T-401 Error boundaries + empty states.
- T-402 Loading skeletons cho 3D scene.
- T-403 PWA manifest (tùy chọn).
- T-404 Dọn log `debug-*.log`.

---

## §11. Tasks for AI Agents

Format: **ID · Title** — Context · Files · Acceptance criteria.

### T-001 🟡 HIGH: Fix `.gitignore` + cân nhắc rotate secret
- **Context:** `vibeseek/.env.local` đã bị commit. Repo **private** → không leak public, nhưng vẫn là bad practice (leak khi convert public, khi collab, khi backup).
- **Files:**
  - Sửa `vibeseek/.gitignore` thêm `.env*.local` và `!.env.local.example`.
  - `git rm --cached vibeseek/.env.local` + commit với message `chore: untrack .env.local`.
  - **Tùy chọn** (nên làm): rotate `GEMINI_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` — giữ thói quen tốt. Update `.env.local` với key mới.
  - **Tùy chọn** (nếu lo ngại): `git filter-repo` xóa file khỏi history.
- **AC:** `git ls-files | grep env.local` chỉ còn `.env.local.example`. File `.env.local` vẫn tồn tại local nhưng untracked.

### T-002 Xóa file rác ở root
- **Files:**
  - Xóa `D:\WangNhat\Study\VibeCode\package-lock.json`.
  - Xóa `D:\WangNhat\Study\VibeCode\api.doc`.
- **AC:** Root VibeCode chỉ còn `vibeseek/`, `.git/`, `ARCHITECT_BLUEPRINT.md`, `.github/` (sẽ tạo ở T-104).

### T-003 Xóa Python pipeline
- **Context:** Trùng lặp với Node renderer, không dùng.
- **Files xóa:** `vibeseek/src/pdf2genz/`, `vibeseek/pyproject.toml`, `vibeseek/requirements.txt`.
- **AC:** `find vibeseek -name "*.py"` trả về rỗng.

### T-004 Audit 3D models
- **Context:** DOJO.glb là nhân vật chính. Các GLB khác (`magic_crystals.glb`, `a_circled_dodecahedron.glb`, `ROBOT1.glb`) có thể không dùng.
- **Steps:**
  1. `grep -r "CrystalCluster\|PrismModel\|Robot" vibeseek/app vibeseek/components` — nếu không có reference nào ngoài `_unused/` → xóa.
  2. Di chuyển file 3D không dùng từ `components/3d/_unused/` ra khỏi codebase.
- **AC:** `public/models/` chỉ còn DOJO.glb (hoặc file thực sự render ra UI). Giảm bundle ≥ 50MB.

### T-101 Tạo migration `render_jobs`
- **Files:** thêm DDL từ §5.2 vào `vibeseek/supabase-schema.sql` + chạy trên Supabase Dashboard SQL editor.
- **AC:** Table tồn tại, indexes ok, RLS `select` public, `insert/update` chỉ service_role.

### T-102 Cloudflare R2 setup + client
- **Files:** `vibeseek/lib/r2/client.ts`
- **Deps:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`.
- **Exports:** `uploadVideo(buffer, key)`, `getPresignedDownloadUrl(key, filename)`.
- **AC:** Unit test manual: upload file 1MB, lấy presigned URL, curl download thành công với header `Content-Disposition: attachment`.

### T-103 GitHub repository_dispatch trigger
- **Files:** `vibeseek/lib/github/dispatch.ts`
- **Export:** `triggerRenderVideo(jobId: string): Promise<void>`.
- **Impl:** POST `https://api.github.com/repos/{owner}/{repo}/dispatches` với `event_type: "render-video"` và header `Authorization: Bearer {GITHUB_DISPATCH_TOKEN}`.
- **AC:** Gọi thành công từ local dev, thấy workflow run trigger trong tab Actions.

### T-104 Workflow `render-video.yml`
- **Files:** `.github/workflows/render-video.yml` (ở ROOT VibeCode, KHÔNG trong vibeseek/).
- **Spec:**
  - Trigger: `on: repository_dispatch: types: [render-video]`.
  - Job: `ubuntu-latest`, steps:
    1. Checkout với `sparse-checkout: vibeseek/scripts vibeseek/lib/ai/prompts.ts`.
    2. Setup Node 20.
    3. `npm ci` trong `vibeseek/scripts/render/`.
    4. Install system: `sudo apt-get install -y ffmpeg && pip install edge-tts`.
    5. Run `node vibeseek/scripts/render/render.ts ${{ github.event.client_payload.jobId }}`.
    6. Step upload — đã làm trong script.
- **AC:** Trigger thủ công (`gh workflow run`) → MP4 xuất hiện trong R2 + callback gọi thành công.

### T-105 Render script
- **Files:** `vibeseek/scripts/render/render.ts`, `vibeseek/scripts/render/package.json`.
- **Impl flow:**
  1. Parse `jobId` từ argv.
  2. Fetch `render_jobs.storyboard` từ Supabase.
  3. Update `status='rendering'`.
  4. For each scene: gọi `edge-tts` → narration `.wav`. Gộp thành 1 audio.
  5. Tạo SRT từ timing.
  6. Ffmpeg: background (solid color gradient hoặc `testsrc2`) + audio + subtitles + text overlay.
  7. Upload MP4 lên R2.
  8. POST callback với `RENDER_CALLBACK_SECRET`.
  9. Catch lỗi → callback `status='failed'` + errorMessage.
- **AC:** Chạy local với jobId giả → MP4 xuất hiện, playable, subtitle hiện đúng tiếng Việt.

### T-106 Refactor `/api/vibefy-video`
- **File:** `vibeseek/app/api/vibefy-video/route.ts`.
- **Change:** Bỏ code render đồng bộ. Chỉ:
  1. Generate storyboard (Gemini → Groq fallback).
  2. Insert `render_jobs`.
  3. Call `triggerRenderVideo(jobId)`.
  4. Return 202 với `jobId`.
- **AC:** Response trả về < 10s (dưới timeout Vercel Hobby).

### T-107 Callback + polling endpoints
- **Files:**
  - `vibeseek/app/api/render-callback/route.ts`
  - `vibeseek/app/api/render-jobs/[jobId]/route.ts`
- **AC:** Callback verify secret (constant-time compare); polling trả job shape đúng §6.3.

### T-108 VideoPlayer component
- **File:** `vibeseek/components/VideoPlayer.tsx`.
- **Behavior:**
  - Nhận `jobId` prop.
  - Poll `/api/render-jobs/{jobId}` mỗi 5s cho đến khi `status='ready'` hoặc `failed`.
  - Hiển thị progress bar giả lập (tăng dần theo thời gian).
  - Khi ready: `<video controls>` + button "⬇️ Tải về thiết bị" (link presigned URL, `download` attribute).
  - Cleanup interval khi unmount.
- **AC:** User upload PDF → thấy bar "Đang render" → ~2 phút sau video hiện → bấm Tải về được file mp4.

### T-005 Reconcile README.md + remove agent.md
- **Context:** `README.md` root có stack cũ (GPT-4o, Claude 3.5/3.7, Leonardo.ai), `agent.md` có constitution cũ mâu thuẫn workflow mới. Blueprint = SSOT.
- **Files:** overwrite `README.md` với canonical content; `git rm agent.md`.
- **Spec chi tiết:** `tasks/T-005-reconcile-readme-agent-md.md`.
- **AC:** README không còn mention Leonardo/GPT-4o/Claude-3.5/skills; `agent.md` đi khỏi tracking.

### T-201 → T-205, T-301 → T-305
(Chi tiết giống pattern trên — sẽ chi tiết hóa khi Phase 1 xong.)

---

## §12. Open Questions & Risks

### Resolved Questions (2026-04-17)
- ✅ **Q-01** Repo **private** → GH Actions 2000 min/tháng (không unlimited). Quota guard §7.9. Risk R-08.
- ✅ **Q-02** R2 dùng `r2.dev` dev subdomain cho MVP. Rate-limit dev subdomain = risk R-09.
- ✅ **Q-03** 50 pages đủ cho MVP. PDF dài hơn → 422 với message "đang phát triển" (§7.8).
- ✅ **Q-04** Vibe Points badge top-right nav trên mọi page (trừ landing). §7.11.
- ✅ **Q-05** DOJO.glb chưa có animation. Tách head/body, head follow mouse ±30°. Chỉ dùng ở landing. §7.11.

### Open Questions
*(none — tất cả đã close. Thêm mới khi phát sinh.)*

### Risks
- **R-01 🟡 RLS quá mở** — hiện public write qua service_role, nếu `SUPABASE_SERVICE_ROLE_KEY` leak lần nữa → ai cũng insert/delete được. *Mitigate:* scope key chỉ dùng server-side, rotate định kỳ.
- **R-02 🟡 GitHub Dispatch Token leak** → attacker trigger workflow lạm dụng. *Mitigate:* fine-grained PAT, scope chỉ 1 repo, chỉ `actions:write`.
- **R-03 🟡 Gemini quota crash peak hour** — 1500/day ~= 1 req/phút. *Mitigate:* Groq fallback đã có; monitor log 429.
- **R-04 🟢 R2 storage đầy** sau vài tháng. *Mitigate:* cron cleanup video > 30 ngày (task ở Phase 4).
- **R-05 🟡 edge-tts outage** — là service không chính thức của Microsoft, có thể bị block. *Mitigate:* fallback Piper TTS (local model) — hiện đã scaffold.
- **R-06 🟢 3D models nặng bundle** (82MB). *Mitigate:* lazy load, dùng Draco compression cho glb (T-004).
- **R-07 🟡 SSE streaming chatbot bị Vercel Hobby timeout** (10s mặc định, 60s max). *Mitigate:* cấu hình `export const maxDuration = 60` trong route.ts; message dài sẽ bị cắt.
- **R-08 🔴 GH Actions quota cạn giữa tháng** (private = 2000 min). *Mitigate:* Quota guard §7.9; badge "X/2000 min used" trong admin-only endpoint; cuối tháng tạm khoá `/api/vibefy-video`. Plan B: fallback render client-side bằng `@ffmpeg/ffmpeg` (FFmpeg.wasm) — chất lượng kém hơn, chưa implement.
- **R-09 🟡 R2 `r2.dev` subdomain bị rate-limit** (không public, ~1000 req/s cap + throttle nếu lạm dụng). *Mitigate:* chấp nhận cho MVP demo; nâng cấp custom domain khi traffic tăng.

---

## §13. Changelog

- **2026-04-17 (evening)** — T-002 merged (PR #1). Phát hiện `api.doc` chứa OpenAI API key live (đã được user rotate + revoke). Thêm T-005 vào Phase 0 để dọn README.md + agent.md stale.
- **2026-04-17** — Close Q-01 đến Q-05. Repo private → recompute quota GH Actions (2000 min/tháng, ~33 video/ngày). Thêm §7.9 quota guard, §7.11 UI rules (Vibe Points badge + DOJO mascot mouse-follow). Hạ T-001 severity từ CRITICAL → HIGH (private repo). Thêm R-08 (GH quota) + R-09 (r2.dev rate-limit).
- **2026-04-16** — Initial blueprint. Kiến trúc renderer qua GitHub Actions + R2 thay vì Supabase Storage. Loại Python pipeline. Fallback AI Gemini → Groq (bỏ local storyboard). Thêm quiz/leaderboard/chatbot vào roadmap.
