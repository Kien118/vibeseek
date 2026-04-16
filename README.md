# VibeSeek — Catch the Knowledge Vibe

> Biến PDF học thuật khô khan thành **Vibe Cards + video ngắn 9:16** cho sinh viên Việt Nam Gen Z.
> Đồ án học tập · Stack 100% free-tier.

## Tại sao VibeSeek?

Sinh viên Gen Z dễ mất tập trung với tài liệu dài. VibeSeek tự động chuyển PDF thành:

- **Vibe Cards** — tóm tắt bite-sized (2-3 câu, emoji, tag) theo 5 loại: concept, quote, tip, fact, summary.
- **Auto MP4 Video 9:16** — storyboard AI + TTS tiếng Việt + render tự động (selling point #1, tải về thiết bị).
- **Smart Quiz** — sinh tự động theo từng card, chấm điểm realtime.
- **Leaderboard Vibe Points** — Learn-to-Earn, guest-friendly (không cần login).
- **VibeBuddy Chatbot** — hỏi đáp RAG trên chính nội dung tài liệu.

## Tech Stack (Free Tier)

| Layer | Choice |
|---|---|
| Framework | Next.js 14 App Router, TypeScript |
| Styling | Tailwind CSS 3, Framer Motion, GSAP |
| 3D | three + @react-three/fiber (landing mascot DOJO) |
| DB | Supabase Postgres + pgvector |
| AI primary | Google Gemini 2.0 Flash |
| AI fallback | Groq (llama-3.3-70b) |
| Embeddings | Gemini text-embedding-004 |
| Video renderer | GitHub Actions + ffmpeg + edge-tts |
| Storage | Cloudflare R2 |
| Hosting | Vercel |

## Project Structure

- `vibeseek/` — Next.js app (deploy target)
  - `app/` — routes + API
  - `components/` — UI + 3D scenes
  - `lib/ai/` — Gemini/Groq processors, prompts
  - `utils/supabase.ts` — DB client
- `tasks/` — executor task specs (see [`tasks/README.md`](./tasks/README.md))
- `ARCHITECT_BLUEPRINT.md` — architectural source of truth
- `AGENT_LOG.md` — execution journal

## Getting Started

1. Clone: `git clone https://github.com/Kien118/vibeseek`
2. Install: `cd vibeseek && npm install`
3. Env: copy `.env.local.example` → `.env.local`, điền Supabase + Gemini + R2 keys. **Không commit `.env.local`.**
4. Schema: chạy `vibeseek/supabase-schema.sql` trên Supabase Dashboard SQL editor.
5. Dev: `npm run dev` → http://localhost:3000

Xem `ARCHITECT_BLUEPRINT.md` để biết chi tiết kiến trúc, data model, API contracts, và roadmap.

## For AI Agents

Đây là dự án multi-agent. Mọi AI Agent (Cursor / Copilot / Claude Code) phải đọc theo thứ tự:

1. `ARCHITECT_BLUEPRINT.md` — kiến trúc cố định.
2. `tasks/README.md` — workflow convention + prompt template.
3. `tasks/T-XXX.md` — task cụ thể được giao.

KHÔNG tự quyết định kiến trúc — hỏi Architect khi blocked.

## License

Educational project — all rights reserved by owner.
