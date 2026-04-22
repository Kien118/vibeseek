# ARCHITECT_BLUEPRINT.md — VibeSeek

> **Tài liệu kiến trúc tổng thể, duy trì bởi Software Architect.**
> Mọi AI Agent (Claude Code, Cursor, Copilot, v.v.) trước khi thực thi task PHẢI đọc file này.
> Khi kiến trúc thay đổi, cập nhật tại đây TRƯỚC rồi mới sửa code.

- **Project:** VibeSeek — "Catch the Knowledge Vibe"
- **Owner:** WangNhat (đồ án học tập)
- **Last updated:** 2026-04-17
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
│SUPABASE │  │  GEMINI   │  │  GITHUB ACTIONS  │  │SUPABASE STORAGE│
│Postgres │  │  2.0 FLASH│  │  (MP4 Renderer)  │  │  (1GB free)    │
│+pgvector│  │ 1500/day  │  │ ffmpeg + edge-tts│  │ bucket=        │
│(500MB)  │  │  FALLBACK:│  │ 2000 min/mo free │  │ vibeseek-videos│
│         │  │  GROQ     │  │                  │  │                │
│         │  │ llama-3.3 │  │ triggered via    │  │ uploads MP4    │
│         │  │  FREE     │  │ repository_      │  │ returns public │
│         │  │           │  │  dispatch event  │  │ URL            │
└─────────┘  └───────────┘  └─────────┬────────┘  └────────────────┘
                                      │
                                      │ reads storyboard JSON,
                                      │ renders MP4, uploads to Storage,
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
   - Upload MP4 lên **Supabase Storage** bucket `vibeseek-videos` bằng `@supabase/supabase-js` client (dùng `SUPABASE_SERVICE_ROLE_KEY`).
   - POST về `/api/render-callback { jobId, videoUrl, duration }`.
8. `/api/render-callback` update `render_jobs.status=ready, video_url=...`.
9. Client poll `GET /api/render-jobs/{jobId}` mỗi 5s (hoặc dùng Supabase realtime subscription).
10. Khi `status=ready` → button "⬇️ Tải về" xuất hiện, link = public Supabase Storage URL + `<a download>` attribute để browser tải về local.

### 2.3. Quiz flow
1. Khi cards được tạo, `/api/vibefy` **async** trigger sinh quiz (fire-and-forget, không block user).
2. Quiz được insert vào `quiz_questions` với `card_id`.
3. UI hiện quiz sau khi user xem hết cards, chấm điểm → `user_progress` tăng `vibe_points_earned`.

### 2.4. Leaderboard flow
- Guest user → tạo `anon_id` lưu localStorage + một row trong `leaderboard_profiles { anon_id, display_name, total_points }`.
- Sau mỗi quiz đúng, `/api/quiz/submit` cộng điểm vào `leaderboard_profiles`.
- `GET /api/leaderboard` → top 20.

### 2.5. Chatbot flow (RAG) — updated 2026-04-17 (Phase 3 planning, Q-06/Q-07/Q-08/Q-09)

**Embeddings — lazy, idempotent (NOT fire-and-forget from `/api/vibefy`):**
1. Sau khi `/api/vibefy` insert cards xong, **KHÔNG** spawn embedding job (Vercel serverless sẽ kill promise — học từ Phase 2 T-203 quiz).
2. Client `/chat/[documentId]` lần đầu mở → `POST /api/embeddings/ensure { documentId }`.
3. Endpoint idempotent: nếu `card_embeddings` đã có đủ rows khớp `vibe_cards` của doc → return `{ ready: true, count }` ngay. Nếu thiếu → call Gemini `text-embedding-004` batch (tối đa 100 items/request per docs) → insert → return.
4. Gemini free 1500 req/day, `text-embedding-004` dim=768. **Không có Groq fallback cho embeddings** (Groq chưa cung cấp embedding API free) → nếu Gemini fail → return 503, UI hiện "Quota cạn, thử lại 1 phút sau".

**Chat request flow:**
5. User gõ câu hỏi → client `POST /api/chat { documentId, message, history, anonId }`.
6. Server:
   - Embed query bằng `text-embedding-004`.
   - `SELECT card_id, title, content, embedding <=> $query AS distance FROM card_embeddings JOIN vibe_cards USING(card_id) WHERE document_id = $doc ORDER BY distance ASC LIMIT 5`.
   - Build context = **top-5 cards formatted + snippet của `vibe_documents.raw_text`** (≤2000 ký tự, ưu tiên khu vực có keyword từ query; fallback = 2000 đầu nếu không match).
   - Cắt `history` chỉ giữ **6 messages cuối** (3 lượt hội thoại) để giới hạn token.
   - Gọi Gemini `2.0-flash` streaming với system prompt RAG (ràng buộc: chỉ trả lời theo context, không bịa ngoài doc). Fallback chain: `2.0-flash → 2.0-flash-lite → 2.5-flash → Groq llama-3.3-70b streaming`.
7. Server stream chunk về client qua Server-Sent Events (`text/event-stream`).
8. Client append chunk vào message hiện tại, render progressively.

**History persistence:** DB + localStorage hybrid (Phase 5 T-407).
- DB (`chat_messages`) = SSOT, source for cross-device hydrate on mount.
- localStorage = warm cache; survives between DB fetches, prevents flash-of-empty.
- Server-side save in `/api/chat` (user msg before stream, assistant msg only on `done=true` with content).
- Cap 50 per `(anon_id, document_id)`, FIFO delete via best-effort async enforce.

---

## §3. Tech Stack (LOCKED)

Không thay đổi các mục dưới đây khi chưa cập nhật blueprint và được Architect duyệt.

| Layer | Choice | Lý do |
|---|---|---|
| Frontend framework | **Next.js 14 App Router + TypeScript** | Đã có sẵn; Vercel free; full-stack one-repo |
| Styling | **Tailwind CSS 3.4** | Đã có; Gen Z aesthetic nhanh |
| Fonts | **Bricolage Grotesque** (display) · **Be Vietnam Pro** (body) · **Patrick Hand** (handwritten) · **Fraunces** (serif) · **JetBrains Mono** (mono) | P-503 brand rebrand 2026-04-22 — warm academic palette, Vietnamese subset. Loaded via `next/font/google` with `display: 'swap'`. |
| 3D | **three + @react-three/fiber + drei** | DOJO.glb là nhân vật chính landing page |
| Animation | **framer-motion + gsap** | Đã có; dùng cho page transitions + scroll |
| Icon | **lucide-react** | Đã có |
| DB | **Supabase Postgres free** (500MB, 2GB bandwidth) | Đã có; có Auth + Storage + pgvector + Realtime |
| Vector search | **pgvector extension trong Supabase** | Free; không cần Pinecone |
| AI primary | **Google Gemini 2.0 Flash** (1500/day free) | Đã có; tiếng Việt tốt |
| AI fallback | **Groq** (llama-3.3-70b-versatile, 30 RPM, 14.4k req/day free) | Khi Gemini 429; tốc độ rất nhanh |
| Embeddings | **Gemini `gemini-embedding-001`** (free, 100 RPM) với `outputDimensionality: 768` | Successor của `text-embedding-004` trong `@google/genai@1.50.0` (text-embedding-004 404 qua SDK mới). `outputDimensionality: 768` giữ tương thích `vector(768)` column. Updated T-302 Decision D-1 (2026-04-18). |
| PDF parsing | **pdf-parse** (Node) | Đã có |
| Video renderer | **GitHub Actions + ffmpeg + edge-tts** | Private repo: 2000 min/tháng free (~33 video/ngày @ 2 min/video); có shell → chạy ffmpeg |
| TTS | **edge-tts (Microsoft Edge)** voice `vi-VN-HoaiMyNeural` / `vi-VN-NamMinhNeural` | Free, chất lượng tốt nhất cho tiếng Việt free |
| MP4 storage | **Supabase Storage** (1GB free, bucket `vibeseek-videos`) | Không cần thẻ tín dụng; dùng lại Supabase client; auto-cleanup qua cron khi gần cap |
| Hosting app | **Vercel free** (Hobby) | Zero-config Next.js |
| Job queue | **Supabase table `render_jobs`** (poll-based) | Không cần Redis/QStash |
| Rate limit | **Upstash Redis (REST) + @upstash/ratelimit** | Cross-instance fixed-window 10/60s chat + 30/60s history |
| Auth | ❌ **Không dùng MVP** — chỉ `anon_id` localStorage | Public demo; Supabase RLS mở |

### 3.1. Đã loại bỏ khỏi stack (KHÔNG DÙNG)
- ❌ **Python pipeline `pdf2genz`** (`src/pdf2genz/`) — trùng lặp với `lib/ai/video-renderer.ts`; dọn dẹp ở task T-003.
- ❌ **Cloudflare R2** — quyết định ban đầu; user không có thẻ tín dụng, switched back to Supabase Storage 2026-04-17 (1GB đủ cho demo ~200 video 5MB, auto-cleanup sau 30 ngày).
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

-- Chat history — Enabled in Phase 5 T-407 (2026-04-20). Q-09 reinstated as hybrid
-- DB + localStorage cache per Q-01/Q-02/Q-03/Q-04. Service-role-only RLS (see §5.3).
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES vibe_documents(id) ON DELETE CASCADE,
  anon_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Composite index matches hot query: WHERE document_id = $1 AND anon_id = $2 ORDER BY created_at DESC LIMIT 50
CREATE INDEX chat_messages_doc_anon_created_idx
  ON chat_messages(document_id, anon_id, created_at DESC);
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

### 6.6b. `POST /api/embeddings/ensure` (Phase 3, lazy idempotent — thêm 2026-04-17)
**Runtime:** `nodejs`, `maxDuration = 60`
**Input:**
```json
{ "documentId": "uuid" }
```
**Output:**
```json
{ "ready": true, "count": 10 }
```
**Errors:** 404 nếu doc không có card. 503 nếu Gemini embedding quota cạn (không có Groq fallback cho embeddings). Gọi idempotent — nếu đã đủ embeddings thì return ngay không call AI.

### 6.7. `POST /api/chat` (Server-Sent Events)
**Runtime:** `nodejs` (không Edge — Gemini SDK cần Node). `maxDuration = 60` (Vercel Hobby trần).
**Input:**
```json
{
  "documentId": "uuid",
  "message": "Giải thích lại thuật toán Dijkstra?",
  "history": [ { "role": "user"|"assistant", "content": "..." } ],
  "anonId": "uuid"
}
```
**Output:** `text/event-stream` (Content-Type fixed, `Cache-Control: no-cache`, `Connection: keep-alive`)
```
data: {"delta":"Thuật toán Dijkstra là "}

data: {"delta":"một thuật toán..."}

data: {"done":true,"tokensUsed":245}

```
(Double newline `\n\n` sau mỗi event bắt buộc theo SSE spec.)
**Errors trước khi stream mở:** 400 input sai shape, 404 document không tồn tại, 404 chưa có embeddings (UI phải gọi `/api/embeddings/ensure` trước), 429 rate limit (>10 msg/phút/anonId), 503 Gemini + Groq đều fail.
**Error giữa stream:** server gửi `data: {"error":"...","done":true}` rồi close. Client render message lỗi inline, không throw.
**Rate limit note (T-408):** Rate limit là Upstash-backed as of T-408 — consistent across serverless instances on Vercel. `/api/chat/history` dùng separate bucket `chat-history:{anonId}` 30/60s (không ảnh hưởng POST budget).

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
  5. Upload MP4 lên Supabase Storage bucket `vibeseek-videos` qua `@supabase/supabase-js` `storage.from(...).upload()` (dùng SERVICE_ROLE_KEY).
  6. POST `/api/render-callback` với video public URL + duration.
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
- GH Actions secrets cho: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `RENDER_CALLBACK_SECRET`, `APP_CALLBACK_URL`.

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

# Supabase Storage (MP4 output)
SUPABASE_STORAGE_BUCKET=vibeseek-videos    # bucket đã tạo ở Phase 0 prereq

# Render callback (shared với GH Actions)
RENDER_CALLBACK_SECRET=                    # random 32+ char, same value in GH Actions secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
MAX_FILE_SIZE_MB=10
```

### 8.2. GitHub Actions Secrets (Repository Settings → Secrets)
- `SUPABASE_URL` (same as `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` = `vibeseek-videos`
- `GEMINI_API_KEY` (nếu cần retry storyboard trong worker)
- `GROQ_API_KEY` (fallback AI trong worker nếu cần)
- `RENDER_CALLBACK_SECRET` (same as in `.env.local`)
- `APP_CALLBACK_URL` (e.g., `https://vibeseek.vercel.app/api/render-callback` hoặc ngrok URL khi dev local)

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
| Supabase Storage | 1GB free | Auto-delete video > 30 ngày (cron). ~200 video @ 5MB trước khi cần xoá. |
| GitHub Actions | **Private repo: 2000 min/tháng** | Bottleneck chính → rate-limit user ở §7.9 |
| Vercel | 100GB bandwidth/tháng, serverless 10s default | Video render đã off-load sang GH Actions |

**Realistic ước tính (giới hạn bởi GH Actions private 2000 min/tháng):**
- Trần: ~33 video/ngày @ 2 min render → ~66 min/ngày × 30 = 1980 phút ✓.
- Dự kiến demo: 20 user/ngày × 1 video = 40 min/ngày = 1200 min/tháng ✓.
- Gemini cards: 20 req/day ✓ (dưới 1500).
- Gemini storyboard: 20 req/day ✓.
- Gemini embed: 20 × 10 cards = 200 req/day ✓.
- Supabase Storage: 20 × 5MB = 100MB/day → 10 ngày = 1GB. Cron auto-delete video > 30 ngày giữ dưới 500MB buffer.
- **Nếu vượt quota GH Actions** (cuối tháng) → `/api/vibefy-video` trả 429 với message "Kho render đã đầy tháng này, thử lại từ ngày 1 tháng sau". Alert ở §12 R-08.

---

## §10. Roadmap

### Phase 0 — Hygiene (TRƯỚC TIÊN, 1 ngày)
- T-001 Fix `.gitignore` cho `.env.local` (HIGH).
- T-002 ✅ Xóa file rác root (`package-lock.json`, `api.doc`). Done — PR #1 merged 2026-04-17.
- T-003 Xóa `src/pdf2genz/`, `pyproject.toml`, `requirements.txt`.
- T-004 Audit `components/3d/_unused/` và `public/models/*.glb` — xóa file không liên quan DOJO.
- T-005 Reconcile `README.md` + xoá `agent.md` (stale OpenAI/Leonardo stack — mâu thuẫn §3).
- T-006 Fix `Model.tsx` type errors (pre-existing; blocks `npm run build`).

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
- T-203 `lib/ai/quiz.ts` — batch quiz generation (Gemini → Groq).
- T-204 `/api/quiz/generate` (lazy) + `/api/quiz/submit` + `/api/leaderboard` + `/api/leaderboard/profile`.
- T-205 Quiz UI: `QuizCard`, `/quiz/[documentId]`.
- T-206 Leaderboard UI: `LeaderboardTable`, `/leaderboard`, `<VibePointsBadge />` trong `layout.tsx`.

**Dependency graph Phase 2:**
```
Batch A (parallel):  T-201 (DB) · T-202 (anon-id) · T-203 (quiz lib)
Batch B (1 task):    T-204 (API routes — needs A)
Batch C (parallel):  T-205 (quiz UI) · T-206 (leaderboard UI + badge — needs B)
```

**Kiến trúc Phase 2 — quyết định 2026-04-17:**
- **Lazy quiz generation** thay cho fire-and-forget trong `/api/vibefy`. Lý do: Vercel serverless kill function sau response → promise không chạy. Client gọi `/api/quiz/generate` lần đầu vào trang quiz → server check DB, nếu chưa có quiz thì gen sync + cache, lần 2+ chỉ read. Trade-off: user chờ ~10-15s lần đầu vào quiz (chỉ trả giá nếu thực sự làm quiz).
- **Tách T-205 → T-205 + T-206** (vs plan ban đầu): quiz UI và leaderboard UI là 2 feature độc lập; tách ra → 2 agent parallel, PR smaller, reviewer đỡ mệt.
- **VibePointsBadge global trong `layout.tsx`**: dùng `usePathname()` tự ẩn trên `/` thay vì conditional render ở từng page — less code duplication.

### Phase 3 — Chatbot RAG (2–3 ngày) ✅ COMPLETE (2026-04-19)
- T-301 ✅ Enable `pgvector` + `card_embeddings` + `vibe_documents.raw_text` col + `quiz_questions` UNIQUE sync. Merge `d630f8e`.
- T-302 ✅ `lib/ai/embeddings.ts` + `POST /api/embeddings/ensure` (lazy idempotent, Decision D-1 model `gemini-embedding-001@768`). Merge `a9cc2d5`.
- T-303 ✅ `lib/ai/chat.ts` retrieve top-5 + stream Gemini→Groq fallback chain. Merge `7e7ea3a`.
- T-304 ✅ `POST /api/chat` SSE + rate limit 10/min/anon. Merge `1c023f7`.
- T-305 ✅ `ChatPanel` + `/chat/[documentId]` + dashboard link + localStorage history. Merge `08c803a` + hotfix `49f628d`.
- **Phase 3 stats:** 5/5 done, 1 hotfix (vs Phase 2 baseline 8).

### Phase 4 — Polish (ongoing)

**Core polish — ✅ COMPLETE 2026-04-19 (4/4 tasks, 0 hotfix, 2 rebase-rescues):**
- T-401 ✅ Error boundaries + empty states — 6 new files (app/error.tsx, not-found.tsx, 4 route error.tsx) + empty states dashboard + leaderboard. Merge `fbdc577`.
- T-402 ✅ Loading skeletons cho 3D scene — `next/dynamic(ssr:false, loading)` + new CanvasSkeleton.tsx. Merge `9b2b025`.
- T-403 + T-404 ✅ (bundled) — PWA manifest.json + 192/512 icons + app/layout.tsx metadata + untrack 2 debug logs + `*.log` gitignore. Merge `4cfdf7a`.

**Video quality polish (phát hiện sau Phase 1 E2E test 2026-04-17) — ✅ COMPLETE 2026-04-19 (5/5 tasks, 1 hotfix total):**
- **P-401 ✅ Subtitle overflow** — done 2026-04-19 (merge `677fd3b`). Root cause: libass treats SRT with no `[Script Info]` header as default 384×288 canvas → 3-6× font scale-up on 1080×1920 output. **Real fix:** emit `.ass` with explicit `PlayResX: 1080 / PlayResY: 1920` header + embedded `[V4+ Styles]` block; drop `force_style`. Line-split at 36 chars, 2-line cap with `…`. Fontsize=56. Blueprint prescription of `MaxLineCount=2` was invalid (not a libass force_style field).
- **P-402 ✅ English terms mispronounced** — done 2026-04-19 (merge `bcccb47`). Dual-field narration approach: storyboard schema gains `speakable_narration` (Vietnamese-phonetic variant) alongside `narration` (preserves Latin terms for subtitle). TTS reads `speakable_narration || narration` fallback; subtitle unchanged (still `narration`). Rejected SSML voice switching (fragile edge-tts mid-text support) + phonetic-replace (loses student-lookup value). Real Gemini 2.5-flash smoke: 4/4 scenes distinct phonetic ("Bubble Sort → bấp-bồ soóc", "API → ây-pi-ai", "OpenAI → Ô-pần-ây-ai"). 0 hotfix. No DB migration (JSONB schemaless).
- **P-403 ✅ Duration mismatch** — done 2026-04-19 (merge `080b212`). Two-layer fix: (1) `VIDEO_STORYBOARD_SYSTEM_PROMPT` gained explicit `NGÂN SÁCH TỪ` block with formula `narration ≤ duration_sec × 2 từ` + worked examples; (2) `parseStoryboardResponse` safety-net extends `duration_sec = ceil(words/2)` clamped at 15 when Gemini overshoots at `> 2.5 words/sec`. Constants `WORDS_PER_SECOND=2, OVERFLOW_RATIO=2.5`. `console.warn` on extension. Real Gemini 2.5-flash test: 4 scenes, 2 triggered safety-net (6→10, 8→11), final ratios 1.91–2.38 ≤ 2.5. 0 hotfix. Groq parity preserved via shared prompt + parser.
- **P-404 ✅ Background đơn sắc** — done 2026-04-19 (merge `8682a3e`). Architect override of blueprint alternatives (`testsrc2` aesthetically wrong; stock video loop adds supply-chain cost) — chose ffmpeg `gradients` lavfi source: 2-color linear gradient (`#1a1a2e` → `#2d1b4e` dark navy → dark purple) at `speed=0.008` for subtle non-distracting motion. 1-line swap `color=c=...` → `gradients=s=1080x1920:d=...:c0=0x1a1a2e:c1=0x2d1b4e:x0=0:y0=0:x1=1080:y1=1920:speed=0.008:rate=30`. Verified via architect frame-extract at T=0.1s vs 9.9s (clear motion + palette match). 0 hotfix.
- **P-405 ✅ Scene transitions** — done 2026-04-19 (merge `ce8307d`). Architect override blueprint prescription: `xfade` requires 2 video inputs but render has 1 continuous bg. Real tool = ASS libass `{\fad(300,300)}` tag prepended to each Dialogue line — 300ms in + 300ms out subtitle fade. 1-line diff in render.mjs dialogue assembly. Verified via architect anullsrc + frame extract at T=0.15/2.00s showing ~50% vs full opacity. 0 hotfix. **P-501 revisit 2026-04-22:** blueprint's original `xfade` intent now implemented (P-501 B2-Lite) via per-scene gradient palette pool (8 entries) + ffmpeg `xfade` filter_complex chain. Orthogonal to this ASS `\fad` subtitle fade — both coexist. See §13 P-501 entry.

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

### T-101 Tạo migration `render_jobs` — ✅ done by user 2026-04-17
- **Files:** DDL đã chạy trực tiếp trên Supabase Dashboard SQL editor.
- **AC:** Table `render_jobs` tồn tại với indexes + RLS (public SELECT, service_role INSERT/UPDATE).
- **Note:** DDL cần append vào `vibeseek/supabase-schema.sql` để đồng bộ SSOT — delegate vào T-102.

### T-102 Supabase Storage client (thay R2)
- **Context:** User không có thẻ → swap sang Supabase Storage. Bucket `vibeseek-videos` đã tạo public.
- **Files:**
  - `vibeseek/lib/storage/client.ts` (NEW)
  - Cập nhật `vibeseek/supabase-schema.sql` append DDL `render_jobs` từ §5.2 + bucket SQL.
- **Deps:** dùng `@supabase/supabase-js` đã có sẵn — KHÔNG cần `@aws-sdk/*`.
- **Exports:**
  - `uploadVideo(buffer: Buffer, key: string, contentType?: string): Promise<string>` — upload lên bucket, return public URL.
  - `getPublicUrl(key: string): string` — dạng `{SUPABASE_URL}/storage/v1/object/public/vibeseek-videos/{key}`.
- **AC:**
  - Unit test manual: upload file dummy 1MB → fetch public URL bằng curl → status 200, body khớp.
  - `vibeseek/supabase-schema.sql` có block `render_jobs` DDL + bucket policies (dù user đã chạy, schema.sql phải đồng bộ).

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
- **AC:** Trigger thủ công (`gh workflow run`) → MP4 xuất hiện trong Supabase Storage bucket + callback gọi thành công.

### T-105 Render script
- **Files:** `vibeseek/scripts/render/render.ts`, `vibeseek/scripts/render/package.json`.
- **Impl flow:**
  1. Parse `jobId` từ argv.
  2. Fetch `render_jobs.storyboard` từ Supabase.
  3. Update `status='rendering'`.
  4. For each scene: gọi `edge-tts` → narration `.wav`. Gộp thành 1 audio.
  5. Tạo SRT từ timing.
  6. Ffmpeg: background (solid color gradient hoặc `testsrc2`) + audio + subtitles + text overlay.
  7. Upload MP4 lên Supabase Storage bucket `vibeseek-videos` qua `supabase.storage.from(...).upload()`.
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
  - Khi ready: `<video controls>` + button "⬇️ Tải về thiết bị" (link public Storage URL, `download` attribute cho browser force download).
  - Cleanup interval khi unmount.
- **AC:** User upload PDF → thấy bar "Đang render" → ~2 phút sau video hiện → bấm Tải về được file mp4.

### T-005 Reconcile README.md + remove agent.md
- **Context:** `README.md` root có stack cũ (GPT-4o, Claude 3.5/3.7, Leonardo.ai), `agent.md` có constitution cũ mâu thuẫn workflow mới. Blueprint = SSOT.
- **Files:** overwrite `README.md` với canonical content; `git rm agent.md`.
- **Spec chi tiết:** `tasks/T-005-reconcile-readme-agent-md.md`.
- **AC:** README không còn mention Leonardo/GPT-4o/Claude-3.5/skills; `agent.md` đi khỏi tracking.

### T-201 DB migration — `leaderboard_profiles` + `quiz_attempts`
- **Files:** `vibeseek/supabase-schema.sql` (APPEND).
- **Spec chi tiết:** `tasks/T-201-db-migration-leaderboard-quiz.md`.
- **AC:** 2 bảng mới, RLS service_role-only for writes, indexes, idempotent DDL.

### T-202 `utils/anon-id.ts` — SSR-safe localStorage manager
- **Files:** `vibeseek/utils/anon-id.ts` (NEW).
- **Spec chi tiết:** `tasks/T-202-anon-id-util.md`.
- **AC:** Exports `getOrCreateAnonId`, `peekAnonId`, `clearAnonId`. Build không crash SSR.

### T-203 `lib/ai/quiz.ts` — batch quiz generation
- **Files:** `vibeseek/lib/ai/quiz.ts` (NEW), `vibeseek/lib/ai/prompts.ts` (APPEND batch prompts).
- **Spec chi tiết:** `tasks/T-203-quiz-generation-lib.md`.
- **AC:** `generateQuizzesForCards(cards)` → batch 1-prompt, Gemini 3-model chain → Groq fallback, validation shape.

### T-204 Quiz + Leaderboard API routes
- **Files:**
  - `vibeseek/app/api/quiz/generate/route.ts` (NEW — **lazy**, idempotent)
  - `vibeseek/app/api/quiz/submit/route.ts` (NEW)
  - `vibeseek/app/api/leaderboard/route.ts` (NEW)
- **Spec chi tiết:** `tasks/T-204-quiz-leaderboard-api.md`.
- **AC:** Idempotent lazy gen, UNIQUE chặn duplicate attempt, top-N leaderboard.

### T-205 Quiz UI — `<QuizCard />` + `/quiz/[documentId]`
- **Files:** `vibeseek/components/QuizCard.tsx`, `vibeseek/app/quiz/[documentId]/page.tsx`, nhẹ sửa `dashboard/page.tsx` (thêm button "🎯 Làm Quiz").
- **Spec chi tiết:** `tasks/T-205-quiz-ui.md`.
- **AC:** Upload PDF → cards → quiz → trả lời → reveal → score summary end-to-end.

### T-206 Leaderboard UI + `<VibePointsBadge />` in layout
- **Files:**
  - `vibeseek/components/LeaderboardTable.tsx`, `vibeseek/components/VibePointsBadge.tsx` (NEW)
  - `vibeseek/app/leaderboard/page.tsx` (NEW)
  - `vibeseek/app/api/leaderboard/profile/route.ts` (NEW — small helper GET/PATCH)
  - `vibeseek/app/layout.tsx` (MODIFY — mount `<VibePointsBadge />`)
- **Spec chi tiết:** `tasks/T-206-leaderboard-ui-badge.md`.
- **AC:** Badge top-right trên mọi page trừ `/`, `/leaderboard` top-20 + edit display_name.

### T-301 → T-305 (Phase 3 Chatbot RAG)
(Chi tiết hóa khi Phase 2 xong.)

---

## §12. Open Questions & Risks

### Resolved Questions (2026-04-17)
- ✅ **Q-01** Repo **private** → GH Actions 2000 min/tháng (không unlimited). Quota guard §7.9. Risk R-08.
- ✅ **Q-02** R2 ban đầu dùng `r2.dev` dev subdomain. **Re-decided 2026-04-17:** user không có thẻ tín dụng → swap sang Supabase Storage 1GB free. Risk R-09 updated.
- ✅ **Q-03** 50 pages đủ cho MVP. PDF dài hơn → 422 với message "đang phát triển" (§7.8).
- ✅ **Q-04** Vibe Points badge top-right nav trên mọi page (trừ landing). §7.11.
- ✅ **Q-05** DOJO.glb chưa có animation. Tách head/body, head follow mouse ±30°. Chỉ dùng ở landing. §7.11.
- ✅ **Q-06** (Phase 3) Embeddings generate **lazy qua `/api/embeddings/ensure`** — KHÔNG fire-and-forget trong `/api/vibefy` (Vercel serverless terminate promise, học từ T-203). Endpoint idempotent: đếm rows khớp, thiếu mới gọi AI. §2.5.
- ✅ **Q-07** (Phase 3) RAG context = **top-5 cards từ pgvector cosine + snippet ≤2000 ký tự từ `vibe_documents.raw_text`** (ưu tiên khu vực chứa keyword query, fallback 2000 đầu). Cards quá ngắn (~200 char) không đủ context cho câu hỏi phức tạp. §2.5.
- ✅ **Q-08** (Phase 3) SSE route `/api/chat` dùng **`runtime = 'nodejs'` + `maxDuration = 60`**. Edge runtime loại — Gemini SDK cần Node API. 60s khớp Vercel Hobby trần (R-07). §6.7.
- ✅ **Q-09** (Phase 3) Chat history MVP **client-only localStorage** theo key `documentId`. Bảng `chat_messages` §5.2 comment-out, để Phase 4 enable khi cần analytics/cross-device. Giảm DB write load + đơn giản spec. **Resolved 2026-04-20 (T-407):** reinstated as hybrid DB + localStorage cache per Q-01/Q-02/Q-03/Q-04 design approval.

### Open Questions
*(none — tất cả đã close. Thêm mới khi phát sinh.)*

### Risks
- **R-01 🟡 RLS quá mở** — hiện public write qua service_role, nếu `SUPABASE_SERVICE_ROLE_KEY` leak lần nữa → ai cũng insert/delete được. *Mitigate:* scope key chỉ dùng server-side, rotate định kỳ.
- **R-02 🟡 GitHub Dispatch Token leak** → attacker trigger workflow lạm dụng. *Mitigate:* fine-grained PAT, scope chỉ 1 repo, chỉ `actions:write`.
- **R-03 🟡 Gemini quota crash peak hour** — 1500/day ~= 1 req/phút. *Mitigate:* Groq fallback đã có; monitor log 429.
- **R-04 🟡 Supabase Storage chỉ 1GB** (khắt khe hơn R2 10GB) — đầy sau ~200 video @ 5MB. *Mitigate:* Cron cleanup video > 30 ngày (Phase 4 task); giám sát qua Supabase Dashboard; nếu chạm 80% → cảnh báo user, cân nhắc upgrade hoặc dùng R2 nếu có thẻ.
- **R-05 🟡 edge-tts outage** — là service không chính thức của Microsoft, có thể bị block. *Mitigate:* fallback Piper TTS (local model) — hiện đã scaffold.
- **R-06 🟢 3D models nặng bundle** (82MB). *Mitigate:* lazy load, dùng Draco compression cho glb (T-004).
- **R-07 🟡 SSE streaming chatbot bị Vercel Hobby timeout** (10s mặc định, 60s max). *Mitigate:* cấu hình `export const maxDuration = 60` trong route.ts; message dài sẽ bị cắt.
- **R-08 🔴 GH Actions quota cạn giữa tháng** (private = 2000 min). *Mitigate:* Quota guard §7.9; badge "X/2000 min used" trong admin-only endpoint; cuối tháng tạm khoá `/api/vibefy-video`. Plan B: fallback render client-side bằng `@ffmpeg/ffmpeg` (FFmpeg.wasm) — chất lượng kém hơn, chưa implement.
- **R-09 🟢 OBSOLETE** — risk r2.dev rate-limit không còn áp dụng (switched to Supabase Storage 2026-04-17). Giữ ID để không đánh số lại.

---

## §13. Changelog

### 2026-04-22 — P-503 Brand Tokens — fonts + palette foundation (Phase 5 Day 1 Track A)
- **What:** Full palette swap cyberpunk → warm academic. Fonts: Syne/Plus Jakarta/JetBrains → Bricolage Grotesque/Be Vietnam Pro/Patrick Hand/Fraunces/JetBrains Mono. All 5 font families load via `next/font/google` with `vietnamese` subset + `display: 'swap'`.
- **Palette:** Sunflower `#F5B83E` (primary) · Terracotta `#D96C4F` (warm/human/AI) · Sage `#7A9B7E` (success/Feynman) · Lapis `#5B89B0` (info/quiz) · Plum `#9B5675` (rare badges) · Ink `#17140F` (base bg) · Paper `#F5EFE4` (main text) · Stone `#9A928A` (muted).
- **Scope:** 19 code files (3 foundation + 16 component/page) + 3 doc files = 22 files. No new deps, no DB migration, no motion/animation. Mechanical token migration only.
- **AC-4 grep sentinel:** 0 matches for pink/cyan/purple/lime/acid/legacy hex in `components/` + `app/`. tsc exit 0. package.json diff = 0 lines.
- **Foundation batch:** Unblocks P-504 (typing indicator) + P-505 (ambient bg) parallel dispatch Day 1 Track B — both depend on new CSS vars + Tailwind tokens.
- **Dispatch:** claude-sonnet-4-6 executor (mechanical pattern-match task, spec-heavy literal mapping table — right-sized per cost-aware dispatch rule).
- **Flagged out-of-scope:** `LeaderboardTable.tsx`, `QuizCard.tsx`, `VibePointsBadge.tsx`, `VideoPlayer.tsx`, `app/quiz/[documentId]/page.tsx` have residual `text-white` refs — not in P-503 file list. Queued for P-503b or next brand pass.

### 2026-04-22 — P-502 Feynman Dojo Mode (Phase 5)
- **What:** Dual-mode chat — Default (RAG Q&A, unchanged) + Feynman Dojo (student teaches concept → DOJO probes gaps → 3-round verdict flow). Toggle in ChatPanel, no new page.
- **Scope:** 5 code files + 1 DB migration + 4 doc files. ~220 LOC net. No new deps. No new env vars.
- **DB:** `ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'default'` — non-breaking, existing rows auto-populated with `'default'`. Apply in Supabase Dashboard before merging PR.
- **Backend:** `retrieveFeynmanContext()` new sibling (no embedding call — loads card + raw_text snippet by card title). `streamChatResponse()` gains `StreamOptions { mode, round }` param (backward compat default). `/api/chat` accepts `mode`, `conceptCardId`, `round`; validates `round ∈ {1,2,3}` for Feynman; skips embeddings pre-check for Feynman mode; persists `mode` col on both inserts. Cap bumped 50→100.
- **UI:** ChatPanel toggle (Default ⟷ 🥋 Feynman), acid green (lime-500) Feynman theme, mode badge + round counter `🥋 FEYNMAN DOJO • Round X/3`, concept picker fallback, opening template injected client-side only, round counter increments after each response, session-complete CTA after round 3.
- **Prompt:** `FEYNMAN_SYSTEM_PROMPT` added after `CHAT_SYSTEM_PROMPT` — senpai Nhật-TikTok voice, strict Round 1/2/3 flow rules, gap detection against CONTEXT only, max 200 words per response.
- **Dispatch:** claude-sonnet-4-6 executor (spec-heavy pre-audited, pattern-heavy, ~220 LOC — right-sized per cost-aware dispatch rule).

### 2026-04-22 — AC-14 hotfix: render-jobs poll route stale cache (P-501 post-merge)
- **Symptom:** After P-501 merge + redeploy, user uploaded PDF → dashboard kẹt "đang xếp hàng" 20 min → "Lỗi: Render quá lâu" error. AC-14 visual smoke blocked until resolved.
- **Render.mjs P-501 code worked correctly.** GH Actions run `24765471989` executed render.mjs with 6-scene real storyboard (`6 scene(s), xfade=0.3s, palette-pool size=8`), 49.54s audio → 49.49s output (0.05s codec rounding, within tolerance), uploaded Supabase Storage, DB row transitioned to `status=ready` at 07:17:25Z. Verified via direct REST query with service-role key.
- **Root cause:** `/api/render-jobs/[jobId]/route.ts` instantiated its own anon `createClient` inline WITHOUT the `noStoreFetch` wrapper — Next.js 14 fetch cache held stale `status=queued` response indefinitely. Same failure mode as Phase 2 E2E hotfix `eefa538` (supabaseAdmin + leaderboard total_points), just applied to a different client + different route.
- **Hotfix (`57fe62d`):** 1 file, 6 insertions/7 deletions. Replaced inline anon createClient with `import { supabaseAdmin } from '@/utils/supabase'` (that client has `noStoreFetch` wired since `eefa538`). Service role has read access on render_jobs; anon RLS path not needed.
- **Post-hotfix verify:** poll endpoint returns `{"status":"ready","videoUrl":"...","durationSec":49}` ✓. User confirmed *"Visual có chuyển màu"* → **AC-14 PASS** — P-501 palette pool + xfade crossfade visually verified end-to-end on prod.
- **Bonus diagnostic:** manual `curl POST /repos/Kien118/vibeseek/dispatches` confirmed GH token + scope work independently. The earlier "dispatch missing" hypothesis was red-herring — dispatch probably happened, but we can't confirm from logs since Vercel logs rolled out.
- **Latent bug watchlist:** `/api/vibefy-video` + `/api/render-callback` also use inline service-role createClient; not urgent but refactor when touched.
- **Lesson elevated to invariant:** Any server-side Supabase read MUST use `supabaseAdmin` from `utils/supabase.ts`. Saved as `memory/feedback_vibeseek_phase5_supabase_nostore_invariant.md`. Protected-region grep technique extended with `createClient\(` sentinel.
- **Phase 5 progress:** 5/N tasks done, **2 hotfixes total** (T-406 CR env upload + AC-14 poll cache stale).

### 2026-04-22 — P-501 per-scene palette pool + xfade crossfade (Phase 5 B2-Lite)
- **What:** `render.mjs` final ffmpeg invocation rewritten — single continuous gradient input replaced by N per-scene gradient inputs (palette picked from 8-entry pool by scene index) chained via `xfade=transition=fade:duration=0.3` filter_complex. Subtitle overlay applied on final `[vout]` label. Math: gradient input `i=0` dur = `scene_0`; `i≥1` dur = `scene_i + 0.3` (compensates xfade head-eat) → video total = audio total exact. Verified synthetic 3-scene (12.000s) + 10-scene (54.000s) zero drift.
- **Palette pool:** 8 variants (navy-purple P-404 original at index 0 + slate-cyan + purple-fuchsia + crimson-orange + forest-emerald + indigo-fuchsia + slate-sky + rose-amber). Deterministic round-robin by scene index — same storyboard → same video. No stochastic selection.
- **True blueprint §10 P-405 revisit:** P-405 (2026-04-19) overrode xfade → ASS `\fad` because render had 1 continuous gradient. P-501 lifts that constraint by generating N gradients. Both coexist: `\fad` fades subtitle text, xfade fades bg between scenes.
- **Scope:** ~+50 LOC net in `render.mjs` only. No new deps. No new env vars. No schema changes. No Vercel Functions touch (render runs on GH Actions).
- **Architect direct-implement** (no executor dispatch) — feasibility smoke at Bước 2 validated ffmpeg chain + math + subtitle overlay end-to-end, scope small enough.
- **Protected-region grep clean:** P-401 (PlayResX + splitNarrationLines + formatAssTime + [V4+ Styles]) + P-402 (speakable_narration + edge-tts) + P-403 (OVERFLOW_RATIO + WORDS_PER_SECOND) + P-405 (\fad(300,300)) sentinels all 0 matches on diff.
- **Failure modes F-1..F-15 all addressed** in task spec; demo-tolerance offramps A/B unused (feasibility green on first try).
- Demo timeline: 1 tuần from 2026-04-22.

### 2026-04-22 — T-406 Vercel production deploy (Phase 5)
- **Production URL LIVE:** https://vibeseek-five.vercel.app (Hobby free, `sin1` Singapore region).
- Deploy via Vercel CLI direct-from-local (`vercel link --yes --project vibeseek` + `vercel --prod --yes`) after web UI bugs blocked Path A (F-3 OAuth scope mismatch) + Path A1 (Framework Preset field regression during Root Directory setup → Functions tab empty → all routes 404 despite "Compiled successfully" log).
- Deployed under `twangnhat-05s-projects/vibeseek` team scope via CLI — user Vercel account, not Kien118's. URL publicly accessible regardless.
- Code changes: `app/api/vibefy/route.ts` `maxDuration = 60` (prev default 10s → timeout risk); new `vibeseek/vercel.json` with `regions: ["sin1"]` co-located with Supabase + Upstash ap-southeast-1.
- 14 env vars uploaded via stdin-pipe bash script from `.env.local`.
- 1 hotfix: Windows Git Bash preserved `\r` in Upstash URL → client crash → `vercel env rm` + re-add with `tr -d '\r\n'` cleanup + redeploy (D-9 lesson).
- Smoke green: AC-9/10/11 architect curl + AC-12/13/14 user browser E2E (PDF upload, quiz live-badge, chat SSE + F5 hydrate).
- Vercel free-tier unblocker: T-408 Upstash cross-instance rate-limit was prereq (done 2026-04-20). T-406 closes Phase 5 deploy track.

### 2026-04-20 — T-408 Redis rate-limit (Phase 5)
- Replaced in-memory `Map` in `lib/rate-limit.ts` with Upstash `@upstash/ratelimit` fixed-window.
- `consume()` now async — 2 caller sites updated (`/api/chat`, `/api/chat/history`).
- Fail-open on Upstash unreachable (anti-spam, not security).
- Unblocks T-406 Vercel deploy (cross-instance consistency).

### 2026-04-20 — T-407 chat_messages persistence (Phase 5)
- Reinstated chat_messages table (Q-09 resolved hybrid).
- API: /api/chat saves user + assistant msgs; new GET /api/chat/history for cross-device hydrate.
- UI: ChatPanel 2-layer hydrate (localStorage fast + DB slow), hasInteractedRef guard.
- Cap 50 per (anon_id, doc_id), service-role-only RLS.

- **2026-04-19 (🎉 PHASE 4 FULLY COMPLETE — core polish sealed)** — All 4 core polish tasks merged: T-401 (error boundaries + empty states, merge `fbdc577`), T-402 (3D loading skeleton via next/dynamic, merge `9b2b025`), T-403+T-404 bundle (PWA manifest + debug log hygiene, merge `4cfdf7a`). **Phase 4 overall stats: 9/9 tasks, 1 hotfix total (only P-401 libass PlayRes), 3 architect overrides of blueprint prescriptions (P-401/P-405/P-404), 2 rebase-rescues for parallel-dispatch AGENT_LOG append conflicts, 1 multi-agent working-tree contamination scare (resolved without destructive ops).** Parallel dispatch of 3 agents taught a new lesson: AGENT_LOG append-only files guarantee N-1 merge conflicts when N parallel branches share base commit. Architect rebase-rescue after each merge is the required cleanup — cannot be avoided at agent protocol level. Logged as Phase 4 Lesson 18. Phase 4 video quality + core polish sealed. Next: Phase 5 (scope TBD) or Phase 4 E2E full smoke before locking. Previous Phase 4 video-only COMPLETE marker below remains for reference.
- **2026-04-19 (🎉 PHASE 4 COMPLETE)** — Final Phase 4 task P-404 merged. All 5 video quality polish tasks done: P-401 (subtitle overflow via ASS + explicit PlayResX/Y) + P-402 (EN-in-VN TTS via `speakable_narration` dual-field) + P-403 (narration word-count budget with parser safety-net) + P-404 (animated gradient bg via `gradients` lavfi) + P-405 (subtitle fade via ASS `\fad(300,300)`). **Phase stats: 5/5 tasks, 1 hotfix total (only P-401 libass PlayRes), 3 architect overrides of blueprint prescriptions (P-401 `MaxLineCount`, P-405 `xfade`, P-404 `testsrc2`/stock video)** — all overrides because blueprint §10 recommendations were authored before real libass/ffmpeg behavior was validated. Architect frame-extract technique (from `feedback_vibeseek_phase4_lessons.md`) = the review method for every P-40x task after P-401 — bypasses edge-tts env blockers via silent `anullsrc` + extracts PNGs at diagnostic timestamps. Saved an estimated 10+ user round-trips over Phase 4. Merge `8682a3e`. Next: Phase 4 core polish T-401..T-404 (error boundaries, 3D skeleton, PWA, log cleanup) OR Phase 5 (TBD scope).
- **2026-04-19 (P-405 merged)** — Fourth Phase 4 task done. Scene transitions felt abrupt; architect overrode blueprint's `xfade` prescription (requires 2 video inputs, render.mjs has 1 continuous bg) → instead used ASS libass `{\fad(300,300)}` tag prepended to each Dialogue line. Fades subtitle 300ms in + 300ms out per scene block. 1-line diff in render.mjs dialogue assembly; zero touches to ASS header (P-401), TTS path (P-402), or storyboard parser (P-403). Verified via architect anullsrc + frame-extract technique (Phase 4 lesson): T=0.15s shows subtitle ~50% opacity, T=2.00s full opacity — clear visual delta confirms libass honors the tag. 0 hotfix. Merge `ce8307d`. Phase 4 progress: 4/5 video quality tasks done, 1 hotfix total (still only P-401 libass PlayRes). Next: P-404 (background gradient — last Phase 4 task).
- **2026-04-19 (P-402 merged)** — Third Phase 4 task done. English terms in TTS narration. Dual-field approach chosen (vs phonetic replace or SSML voice switching): storyboard schema gains optional `speakable_narration` field; TTS uses it with fallback to `narration` for backward compat; subtitle path unchanged (still shows Latin terms for student reference). Prompt adds `PHIÊN ÂM CHO TTS` block with transliteration examples (Bubble Sort → bấp-bồ soóc, API → ây-pi-ai, etc.). Parser trims whitespace + falls back on missing/empty. `render.mjs` TTS call line swapped to `speakable_narration || narration` with `(phonetic)` log marker; ASS subtitle path from P-401 byte-for-byte untouched. Real Gemini 2.5-flash smoke: 4/4 scenes phonetic-distinct; scene 1 also triggered P-403 safety-net (7→11s extension) confirming no cross-regression. 0 hotfix. No DB migration (JSONB `render_jobs.storyboard` absorbs new field automatically). Merge `bcccb47`. Phase 4 progress: 3/5 video quality tasks done, 1 hotfix total (only P-401 libass PlayRes). Next: P-405 (scene crossfade).
- **2026-04-19 (P-403 merged)** — Second Phase 4 task done. Narration word-count budget vs scene duration — two-layer fix: prompt rule (`narration ≤ duration_sec × 2 từ`, with worked examples) + parser safety-net (`parseStoryboardResponse` extends `duration_sec = ceil(words/2)` capped 15 when Gemini overshoots at `>2.5 words/sec`). Constants `WORDS_PER_SECOND=2, OVERFLOW_RATIO=2.5`. `console.warn` on extension for telemetry. Agent simplified the trigger expression algebraically (`words > wordBudgetAtCurrent × (OVERFLOW_RATIO/WORDS_PER_SECOND)` → `words > originalDuration × OVERFLOW_RATIO` — same math, cleaner). Real Gemini 2.5-flash smoke: 4 scenes, 2 triggered safety-net (6→10s and 8→11s), all final ratios 1.91–2.38 w/s ≤ 2.5. Groq parity preserved (shared prompt + parser). Clamp `[4, 15]` invariant preserved. 0 hotfix. Merge `080b212`. Phase 4 progress: 2/5 video quality tasks done. Next: P-402 (EN-in-VN TTS).
- **2026-04-19 (P-401 merged)** — First Phase 4 task done. P-401 subtitle overflow fixed via SRT → ASS conversion with explicit `PlayResX: 1080 / PlayResY: 1920` header + embedded `[V4+ Styles]` block. Root cause turned out to be a libass scaling quirk, not force_style misconfiguration: SRT input with no `[Script Info]` header defaults to 384×288 canvas, scaling fonts 3-6× when rendering onto 1080×1920. `subtitles=…:original_size=1080x1920` filter option does NOT fix this. Iterated Fontsize 40→32→28→24 + char caps 40→32→28→36 + WrapStyle=0/2 blindly during review — no fix because font was being SCALED, not SET. Real fix: emit `.ass` with explicit PlayRes + styles. This also explains the Phase 1 E2E "subtitle tràn" bug user reported 2026-04-17. Architect bypassed edge-tts env blocker via silent `anullsrc` audio + ffmpeg frame extraction to PNG for visual diagnosis without needing user to re-open video 5 times. 1 hotfix (`339b53e`) after agent's initial spec-compliant PR #28. Merge `677fd3b`. Blueprint §10 P-401 marked complete. Phase 4 lessons memory file created (libass PlayRes gotcha + frame-extract architect technique). Next: P-403 (narration duration).
- **2026-04-19 (🎉 PHASE 3 SEALED — E2E verified)** — All 5 Phase 3 tasks done + all 7 E2E tests pass. T-301 (pgvector + `card_embeddings` + `raw_text` col + quiz UNIQUE sync), T-302 (`embeddings.ts` + `/api/embeddings/ensure` lazy idempotent), T-303 (`chat.ts` RAG retrieve + streaming Gemini→Groq fallback), T-304 (`/api/chat` SSE route + in-memory rate limit 10/min/anon), T-305 (ChatPanel + `/chat/[documentId]` + dashboard link + localStorage history). Merge commits: `d630f8e` / `a9cc2d5` / `7e7ea3a` / `1c023f7` / `08c803a`. **2 hotfixes total vs Phase 2 baseline 8** — (1) `49f628d` pre-merge T-305 fixed Tests 2+3 (input invisible due to `body{color:white}` inherit; localStorage race from mount-time load/persist useEffect ordering → `saveHistory` contract change "skip empty, use `clearHistory` for intentional clears"); (2) `3b3ba5c` post-merge T-305 fixed Test 7 (VibePointsBadge `fixed top-4 right-4 z-50` overlapped "← Về Dashboard" link in chat page header flex-row on mobile/narrow desktop → stack vertically via `space-y-4`). Test 4 rate limit was initially false negative from tester hygiene (Date.now() gave unique anonIds per request + bucket pollution within 60s window); re-run with literal fixed key after 70s wait = 10×200 + 2×429 as expected. Test 5 Strict Mode ensure idempotent, Test 6 error state "Thử lại" UX both pass. 7-step pipeline (failure-modes-section in spec, user-runnable test plan in spec, architect local-run review, three-strikes circuit breaker, E2E formal batch step) validated end-to-end. Decision D-1 (Phase 3): embedding model `text-embedding-004` → `gemini-embedding-001` + `outputDimensionality:768` (SDK compat). Process notes: architect self-inflicted incident — running `npm run build` during user's active dev server corrupted `.next/server/` cache, logged as "DO NOT build during dev". Next: Phase 4 (T-401..T-404 core polish + P-401..P-405 video quality).
- **2026-04-18 (T-302 merged)** — Phase 3 task T-302 done: `lib/ai/embeddings.ts` + `POST /api/embeddings/ensure` (lazy idempotent endpoint). Agent Decision D-1: swapped embedding model from `text-embedding-004` (404 via `@google/genai@1.50.0` SDK) to `gemini-embedding-001` with `outputDimensionality: 768` to preserve `vector(768)` DB column compatibility. Smoke verified 768-dim real-float vectors stored correctly for TTHCM test doc (10 cards → 10 rows in `card_embeddings`). Merge commit `a9cc2d5`. Updated §3 stack table to reflect new model. T-301 merged earlier today (`d630f8e`): pgvector + card_embeddings table + `vibe_documents.raw_text` column + quiz UNIQUE sync. Phase 3 progress: 2/5 tasks done, 0 hotfix (vs Phase 2 baseline 8 hotfix). Next: T-303 (chat.ts RAG retrieval + streaming + RPC `match_card_embeddings`).
- **2026-04-17 (🎉 PHASE 2 E2E VERIFIED)** — User nuke-clean retest after 8 E2E hotfixes: upload PDF → 10 cards (Groq fallback when Gemini quota dry) → 10 quizzes (no duplicates thanks to `UNIQUE(card_id)`) → badge updates live during quiz (custom event broadcast) → leaderboard row matches badge (Next.js fetch cache bypassed on supabaseAdmin). Hotfix chain during E2E: `092d91d` quiz maxTokens + SyntaxError retriable; `f5bda85` maxTokens 16384 + Groq no-json-object + wrapper-key extractor; `e048de9` QuizCard `key` reset per question; `ea198ae` Strict Mode dedup + badge event; `eefa538` supabaseAdmin no-store fetch (fixes stale total_points); `61a54b1` vibefy Groq fallback; `35e6eb4` restore React 18 `ignore` pattern (drop fetchedRef that broke state advancement). DB: added `UNIQUE(card_id)` on `quiz_questions` via Supabase Dashboard for race-safety. Phase 2 feature + reliability both complete.
- **2026-04-17 (🎉 PHASE 2 COMPLETE)** — All 6 Phase 2 tasks done: T-201 + T-202 + T-203 (Batch A foundation), T-204 (Batch B API routes), T-205 + T-206 (Batch C UI). Backend: `leaderboard_profiles` + `quiz_attempts` tables; `generateQuizzesForCards` batch lib (Gemini → Groq); 4 API routes (`/api/quiz/generate` lazy, `/api/quiz/submit`, `/api/leaderboard`, `/api/leaderboard/profile`). Frontend: `QuizCard` + `/quiz/[documentId]` 4-phase state machine; `LeaderboardTable` + `/leaderboard` with display_name edit; global `<VibePointsBadge />` in layout (hidden on landing). Merge commits: `95b3d8d` / `98436dd` / `d733fbe` / `1d019b5` / `49f7f9c` / `7e3afd8`. Process notes: First Batch A round (PRs #14/#15/#16) closed due to scope explosion; redo with stricter "Files to touch" prompts succeeded. PR #18/#19 needed architect rebase-rescue (stale base). Next: Phase 3 Chatbot RAG OR user-driven E2E test of Phase 2 before moving on.
- **2026-04-17 (Batch A complete)** — 🎉 Phase 2 Batch A done: T-201 (DB migration, PR #17 → `95b3d8d`) + T-202 (anon-id util, PR #18 → `98436dd`) + T-203 (quiz gen lib, PR #19 → `d733fbe`) all merged. First round of 3 PRs (#14/#15/#16) closed due to scope explosion — 1 agent mixed 3 tasks, committed PDF + HTML artifacts + smoke scripts + build artifacts. Added root `.gitignore` + extended `vibeseek/.gitignore` (tsconfig.tsbuildinfo, smoke-*.ts, *.pdf, test-pdf/) to prevent recurrence. Redo agents (claude-opus-4-6, one per task, strict "Files to touch" enforcement) succeeded. PR #18 and #19 required architect rebase-rescue onto latest main (stale base after T-201 merged) with AGENT_LOG conflict resolution + force-push. Next: Batch B (T-204 API routes).
- **2026-04-17 (Phase 2 planning)** — Phase 2 task specs authored (T-201 → T-206). **Split T-205 → T-205 + T-206** (quiz UI + leaderboard UI là 2 feature độc lập; parallel agents, smaller PRs). **Lazy quiz generation** replaces fire-and-forget trigger in `/api/vibefy` (Vercel serverless terminates on response → async promise dies). Updated §10 roadmap, §11 task specs for T-201..T-206, added dependency graph + kiến trúc Phase 2 decisions.
- **2026-04-17 (late night)** — **🎉 PHASE 1 VERIFIED END-TO-END.** User upload PDF thật (sorting-algorithms.pdf, 4 pages) → full pipeline chạy: Gemini 2.0-flash quota'd → fell through to 2.5-flash → 10 cards → storyboard → GitHub Actions render → MP4 upload Supabase Storage → UI download. Phát hiện 4 video quality issues — added P-401 đến P-405 vào Phase 4. Hotfix VideoPlayer POLL_MAX_ATTEMPTS 144 → 240 (cold runner + Gemini 429 retries push first render > 12min). Hotfix landing "Start now" button navigate `/dashboard`.
- **2026-04-17 (end of day)** — Phase 0 complete (T-001 → T-006 all merged). Swap **Cloudflare R2 → Supabase Storage** (user không có thẻ tín dụng, R2 bắt nhập payment method). Update §2.1 diagram, §2.2 data flow, §3 stack table, §3.1 removed list, §7.4 rendering steps, §7.10 secrets list, §8.1/8.2 env, §9 quota table (R-04 updated), §11 T-101/T-102 task specs, §12 R-04/R-09. T-101 marked done (user chạy migration + tạo bucket).
- **2026-04-17 (evening)** — T-002 merged (PR #1). Phát hiện `api.doc` chứa OpenAI API key live (đã được user rotate + revoke). Thêm T-005 vào Phase 0 để dọn README.md + agent.md stale.
- **2026-04-17** — Close Q-01 đến Q-05. Repo private → recompute quota GH Actions (2000 min/tháng, ~33 video/ngày). Thêm §7.9 quota guard, §7.11 UI rules (Vibe Points badge + DOJO mascot mouse-follow). Hạ T-001 severity từ CRITICAL → HIGH (private repo). Thêm R-08 (GH quota) + R-09 (r2.dev rate-limit).
- **2026-04-16** — Initial blueprint. Kiến trúc renderer qua GitHub Actions + R2 thay vì Supabase Storage. Loại Python pipeline. Fallback AI Gemini → Groq (bỏ local storyboard). Thêm quiz/leaderboard/chatbot vào roadmap.
