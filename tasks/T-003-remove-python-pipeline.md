# T-003 · Remove Python pipeline (`pdf2genz`)

**Status:** `todo`
**Blueprint ref:** §11 T-003, §3.1 (đã loại khỏi stack)
**Branch:** `task/T-003-remove-python-pipeline`
**Assignee:** _(tba)_

## Context

`vibeseek/src/pdf2genz/` là một CLI Python độc lập render PDF → video với Gemini/Ollama/OpenRouter. Trùng lặp với `vibeseek/lib/ai/video-renderer.ts` (Node). Blueprint §3.1 chốt: giữ Node renderer, bỏ Python.

Ba file cần xoá thuộc về Python pipeline:
- `vibeseek/src/pdf2genz/` (folder)
- `vibeseek/pyproject.toml`
- `vibeseek/requirements.txt`

## Files to touch
Xoá:
- `vibeseek/src/pdf2genz/` (toàn bộ folder)
- `vibeseek/pyproject.toml`
- `vibeseek/requirements.txt`

Nếu `vibeseek/src/` sau khi xoá chỉ còn rỗng → xoá luôn folder `src/`.

## Work plan

1. Verify không có import nào trong code Node/TS tham chiếu tới Python:
   ```bash
   grep -rn "pdf2genz\|pyproject\|requirements.txt" vibeseek/app vibeseek/lib vibeseek/components vibeseek/utils 2>/dev/null
   ```
   Expect: empty.
2. Verify không có script `package.json` gọi Python:
   ```bash
   grep -E "python|pip|pdf2genz" vibeseek/package.json
   ```
   Expect: empty.
3. `git rm -r vibeseek/src/pdf2genz vibeseek/pyproject.toml vibeseek/requirements.txt`
4. Nếu `vibeseek/src/` rỗng: `rmdir vibeseek/src` (hoặc để git tự xoá vì git không track folder rỗng).
5. Commit: `T-003: remove standalone Python pipeline (superseded by lib/ai/video-renderer.ts)`

## Acceptance criteria
- [ ] AC-1: `find vibeseek -name "*.py" -not -path "*/node_modules/*"` rỗng.
- [ ] AC-2: `vibeseek/pyproject.toml` và `vibeseek/requirements.txt` không còn.
- [ ] AC-3: `vibeseek/src/pdf2genz/` không còn.
- [ ] AC-4: `npm run build` trong `vibeseek/` vẫn pass (không break gì).
- [ ] AC-5: `npm run lint` pass.

## Definition of Done
- [ ] All AC pass
- [ ] AGENT_LOG.md có entry
- [ ] PR opened với output của AC-4 (build log) trong PR description
- [ ] Status = `review`

## Questions / Blockers
_(none)_

## Decisions log
_(none yet)_

## Notes for reviewer
Nếu có reference sót (AC-1 không pass) → DỪNG, viết `[BLOCKED]`, vì có thể pipeline đã được wire-in mà blueprint chưa biết.
