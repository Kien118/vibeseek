# T-002 · Cleanup root junk files

**Status:** `blocked`
**Blueprint ref:** §11 T-002, §3.1 (đã loại khỏi stack)
**Branch:** `task/T-002-cleanup-root-junk`
**Assignee:** _(tba)_

## Context

Root `D:\WangNhat\Study\VibeCode` có 2 file rác không liên quan app:
- `package-lock.json` — 6 dòng boilerplate rỗng (`{ "name": "VibeCode", "packages": {} }`), không có `package.json` đi kèm.
- `api.doc` — file Word binary 172 bytes, không ai đọc.

Blueprint §3.1 đã chốt: xoá.

## Files to touch
- Xoá `D:\WangNhat\Study\VibeCode\package-lock.json`
- Xoá `D:\WangNhat\Study\VibeCode\api.doc`
- Update `D:\WangNhat\Study\VibeCode\tasks\T-002-cleanup-root-junk.md` (status/progress)
- Append `D:\WangNhat\Study\VibeCode\AGENT_LOG.md` (executor journal)

## Work plan

1. Verify hai file thật sự không dùng:
   ```bash
   # từ root VibeCode
   grep -r "api.doc" vibeseek/ 2>/dev/null | head
   ```
   Expect: empty.
2. `git rm package-lock.json api.doc`
3. Commit: `T-002: remove unused root-level junk (empty lockfile, stray .doc)`

## Acceptance criteria
- [x] AC-1: `ls D:\WangNhat\Study\VibeCode` không còn `package-lock.json` và `api.doc`.
- [x] AC-2: `git ls-files | grep -E "^(package-lock.json|api.doc)$"` rỗng.
- [x] AC-3: `vibeseek/` không bị ảnh hưởng — `vibeseek/package-lock.json` VẪN TỒN TẠI (file đó 269KB, là lockfile thật).

## Definition of Done
- [x] All AC pass
- [x] AGENT_LOG.md có entry
- [ ] PR opened
- [x] Status = `review`

## Questions / Blockers
- [BLOCKED 2026-04-17] Không thể mở PR tự động vì môi trường hiện tại không có `gh` CLI (`gh: not recognized`).

## Decisions log
_(none yet)_

## Notes for reviewer
Hai file này an toàn xoá hoàn toàn: không có reference nào trong code, không có script build nào phụ thuộc.
