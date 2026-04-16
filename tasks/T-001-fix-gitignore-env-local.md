# T-001 · Fix `.gitignore` for `.env.local`

**Status:** `in-progress`
**Severity:** HIGH
**Blueprint ref:** §11 T-001, §7.10, §8.3
**Branch:** `task/T-001-fix-gitignore-env-local`
**Assignee:** _(tba — anh giao agent nào điền vào)_

## Context

`vibeseek/.env.local` hiện **đang bị tracked trong git** (commit đầu tiên). Repo private → chưa leak public, nhưng vẫn là bad practice:
- Nếu repo chuyển public hoặc thêm collaborator, secret lộ ngay.
- Key backup / clone về máy khác → lộ.

`.gitignore` hiện chỉ có `node_modules/` và `.next/`.

## Files to touch
- `vibeseek/.gitignore` — thêm rule
- Git index: remove `vibeseek/.env.local` khỏi tracking (KHÔNG xoá file local)

**Tuyệt đối KHÔNG** sửa nội dung file `.env.local` (user tự rotate nếu muốn).

## Work plan

1. Mở `vibeseek/.gitignore`, append:
   ```gitignore
   # Local env (never commit real secrets)
   .env*.local
   !.env.local.example
   ```
2. Chạy `git rm --cached vibeseek/.env.local` (lưu ý: `--cached` để giữ file trên disk).
3. `git status` — verify `.env.local` hiện thị ở "deleted" trong staged và **KHÔNG** ở untracked.
4. Commit: `T-001: untrack .env.local and ignore local env files`.

## Acceptance criteria
- [ ] AC-1: `git ls-files vibeseek/ | grep env` chỉ in ra `vibeseek/.env.local.example`, KHÔNG có `vibeseek/.env.local`.
- [ ] AC-2: File `vibeseek/.env.local` vẫn tồn tại trên disk, nội dung không đổi.
- [ ] AC-3: `vibeseek/.gitignore` có cả 2 dòng mới (`.env*.local` và `!.env.local.example`).
- [ ] AC-4: Thử sửa `vibeseek/.env.local` → `git status` KHÔNG hiển thị.
- [ ] AC-5: Thử sửa `vibeseek/.env.local.example` → `git status` có hiển thị (không bị ignore nhầm).

## Definition of Done
- [ ] All AC pass
- [ ] Commit message đúng format `T-001: ...`
- [ ] AGENT_LOG.md có 2 entry: started + completed
- [ ] PR opened với template
- [ ] Status ở file này = `review`

## Test plan

```bash
# Run từ D:\WangNhat\Study\VibeCode
git ls-files vibeseek/ | grep env    # chỉ .env.local.example
ls vibeseek/.env.local                # file vẫn tồn tại
echo "# test" >> vibeseek/.env.local
git status                            # KHÔNG thấy .env.local
# revert test edit
git checkout -- vibeseek/.env.local 2>/dev/null || head -n -1 vibeseek/.env.local > /tmp/x && mv /tmp/x vibeseek/.env.local
```

## Questions / Blockers
<!-- [BLOCKED YYYY-MM-DD] ... -->
_(none)_

## Decisions log
<!-- YYYY-MM-DD: <what, why> -->
_(none yet)_

## Notes for reviewer
Sau khi merge, **user nên** (tùy chọn) rotate `GEMINI_API_KEY` và `SUPABASE_SERVICE_ROLE_KEY` trên dashboard — agent không tự làm bước này.
