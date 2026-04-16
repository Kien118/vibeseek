# T-005 · Reconcile `README.md` + `agent.md` with blueprint

**Status:** `review`
**Blueprint ref:** §3 (locked stack), §3.1 (removed from stack), §0 (workflow supersedes agent.md)
**Branch:** `task/T-005-reconcile-readme-agent-md`
**Assignee:** _(tba)_

## Context

Root có 2 file tài liệu từ first commit **mâu thuẫn với blueprint hiện tại**:

1. **`README.md`** — nói stack là OpenAI GPT-4o + Claude 3.5/3.7 + Leonardo.ai. Blueprint §3 khoá stack là **Gemini 2.0 Flash + Groq fallback + Cloudflare R2 + GitHub Actions**. Cũng tham chiếu folder `/skills` không tồn tại.
2. **`agent.md`** — "VibeSeek AI Agent Constitution" cũ, định nghĩa lại Architect/Executor roles. Đã bị **superseded** bởi `ARCHITECT_BLUEPRINT.md §0` và `tasks/README.md` (workflow mới, chi tiết hơn).

Để blueprint là SSOT duy nhất, dọn dứt điểm.

## Architect's decisions (đã chốt — agent KHÔNG cần tự quyết)

- 🗑 **`agent.md` → XOÁ.** Workflow mới ở blueprint §0 + tasks/README.md đã thay thế.
- ✏️ **`README.md` → REWRITE hoàn toàn** với nội dung ở mục "New README content" dưới đây.

## Files to touch
- Xoá: `README.md` (sẽ ghi đè bằng nội dung mới bên dưới, không phải delete)
- Xoá: `agent.md`
- Update: `tasks/T-005-reconcile-readme-agent-md.md` (status/progress)
- Append: `AGENT_LOG.md`

## Work plan

1. Overwrite `README.md` với nội dung ở mục "New README content" bên dưới. **COPY NGUYÊN VĂN**, không paraphrase, không thêm/bớt section.
2. `git rm agent.md`
3. Verify không có file nào trong repo import/link tới `agent.md`:
   ```bash
   grep -r "agent\.md" . --include="*.md" --include="*.ts" --include="*.tsx" --include="*.json" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git 2>/dev/null
   ```
   Expect: rỗng (hoặc chỉ có trong task file này).
4. Commit: `T-005: reconcile README with blueprint stack, remove superseded agent.md`

## New README content

Nội dung sau đây là canonical — ghi đè hoàn toàn `README.md`:

````markdown
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
````

## Acceptance criteria
- [ ] AC-1: `README.md` nội dung khớp **100%** block canonical ở trên (byte-for-byte, trừ trailing newline).
- [ ] AC-2: `agent.md` không còn tồn tại ở root và không ở `git ls-files`.
- [ ] AC-3: `grep -r "Leonardo\|GPT-4o\|Claude 3.5\|Claude 3.7\|/skills" README.md` rỗng.
- [ ] AC-4: `grep -r "agent\.md" . --include="*.md" --exclude-dir=node_modules --exclude-dir=.git` chỉ match trong `tasks/T-005-*.md` (task file này), không match ở code hoặc README/blueprint.
- [ ] AC-5: `npm run build` trong `vibeseek/` vẫn pass (không ảnh hưởng build).

## Definition of Done
- [ ] All AC pass
- [ ] AGENT_LOG.md có entry started + completed
- [ ] PR opened link task này
- [ ] Status = `review`

## Questions / Blockers
_(none — decisions đã chốt bởi Architect)_

## Decisions log
_(none yet)_

## Notes for reviewer
- Không thêm section mới vào README ngoài những gì Architect đã viết. Không thêm badge, không thêm CI status, không thêm CONTRIBUTING link — blueprint §0 là SSOT cho contribution.
- `agent.md` history vẫn còn trong git (ở commit `736be22`) — không cần scrub, chỉ cần xoá từ main đi trở.
