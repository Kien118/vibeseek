# T-006 · Fix `Model.tsx` type errors (pre-existing)

**Status:** `review`
**Severity:** HIGH (blocks `npm run build` → blocks any future AC-5)
**Blueprint ref:** §7.11 (DojoModel spec), §4 (landing component)
**Branch:** `task/T-006-fix-model-tsx-type-errors`
**Assignee:** _(tba)_

## Context

`npx tsc --noEmit` trong `vibeseek/` báo 2 lỗi ở `components/3d/Model.tsx` — cả hai **tồn tại trước T-005**, phát hiện khi review PR #2. Nếu không fix, mọi task Phase 1+ có AC `npm run build pass` sẽ bị chặn.

```
Model.tsx(80,21): error TS2352: Conversion of type 'GLTF & ObjectMap' to type 'GLTFResult' may be a mistake
Model.tsx(158,51): error TS2554: Expected 3 arguments, but got 4.
```

## Files to touch
- `vibeseek/components/3d/Model.tsx`
- Update task file + AGENT_LOG

## Architect's guidance (fixes đã chốt)

### Fix 1 — Line 80 (TS2352)

**Problem:** `useGLTF` returns generic type, `GLTFResult` expects named nodes `DOJO_Head` / `DOJO_Body`. TypeScript không thể trực tiếp cast.

**Fix:** cast qua `unknown` trung gian.

```ts
// BEFORE (line 80)
const { scene } = useGLTF('/models/DOJO.glb') as GLTFResult

// AFTER
const { scene } = useGLTF('/models/DOJO.glb') as unknown as GLTFResult
```

Đây là pattern chuẩn cho GLTF cast với react-three-fiber khi type mở rộng.

### Fix 2 — Line 158 (TS2554)

**Problem:** `MathUtils.lerp(a, b, t)` nhận 3 args nhưng đang gọi với 4: `MathUtils.lerp(2, 4, 0.42, p)`.

**Context:** dòng dưới dùng pattern `lerp(start, end, p)` với `p` = scroll progress. Vậy `0.42` là typo hoặc intent ban đầu không rõ.

**Fix:** đổi thành `MathUtils.lerp(2, 4, p)` (simplest — khớp pattern các dòng xung quanh).

```ts
// BEFORE (line 158)
const targetScale = MathUtils.lerp(2,4, 0.42, p)

// AFTER
const targetScale = MathUtils.lerp(2, 4, p)
```

Nếu agent thử và thấy scale animation không đúng như trước (visual regression), ghi vào Decisions log và báo user — có thể intent khác, ví dụ `lerp(2, 4, p * 0.42)`. Nhưng ưu tiên simplest fix trước.

## Work plan

1. Đọc `vibeseek/components/3d/Model.tsx` để nắm context.
2. Áp 2 fix như spec.
3. `cd vibeseek && npx tsc --noEmit` → verify 0 errors.
4. `npm run build` → verify pass.
5. `npm run dev` → mở http://localhost:3000/ → xác nhận DOJO mascot vẫn hiển thị, head follow mouse, scroll animation không vỡ.
6. Commit: `T-006: fix Model.tsx type errors (GLTF cast + MathUtils.lerp arity)`

## Acceptance criteria
- [ ] AC-1: `npx tsc --noEmit` trong `vibeseek/` exit 0, không có error liên quan `Model.tsx`.
- [ ] AC-2: `npm run build` trong `vibeseek/` pass.
- [ ] AC-3: Landing page `http://localhost:3000/` hiển thị DOJO bình thường, không console error.
- [ ] AC-4: DOJO head vẫn rotate theo mouse (theo §7.11 blueprint); scroll animation vẫn chạy mượt.
- [ ] AC-5: Diff chỉ thay đổi 2 dòng trong `Model.tsx` — không đụng file khác.

## Definition of Done
- [ ] All AC pass
- [ ] AGENT_LOG.md entry started + completed
- [ ] PR opened, link task này
- [ ] Status = `review`

## Questions / Blockers
_(none — fix đã chốt)_

## Decisions log
_(agent ghi nếu phải chọn intent khác cho Fix 2)_

## Notes for reviewer
Task này bảo vệ tính ổn định của AC-5 cho mọi task tương lai. Fix nhỏ nhưng critical.
