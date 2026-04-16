# T-004 · Audit 3D models — giữ DOJO, xoá phần không dùng

**Status:** `todo`
**Blueprint ref:** §11 T-004, §7.11 (DOJO là mascot chính, chỉ landing)
**Branch:** `task/T-004-audit-3d-models`
**Assignee:** _(tba)_

## Context

`vibeseek/public/models/` có 4 GLB (~82MB tổng):
- `DOJO.glb` (18MB) — **KEEP**: mascot chính landing page.
- `magic_crystals.glb` (31MB)
- `a_circled_dodecahedron.glb` (16MB)
- `ROBOT1.glb` (19MB)

Và `vibeseek/components/3d/` có nhiều component (`PrismModel`, `CrystalCluster`, `DojoModel`, `Model`, `SceneLoader`, các Scene variants, folder `_unused/`).

Blueprint §7.11 chốt: chỉ DOJO dùng ở landing, page khác KHÔNG 3D. Dọn để giảm bundle.

## Files to touch
**Giữ nguyên (không đụng):**
- `vibeseek/public/models/DOJO.glb`
- `vibeseek/components/3d/DojoModel.tsx`
- `vibeseek/components/3d/LandingSceneCanvas.tsx` (scene chứa DOJO ở landing)
- `vibeseek/components/3d/Experience.tsx` — **audit trước**, xem có phụ thuộc vào DOJO không
- `vibeseek/components/3d/SceneLoader.tsx` — **audit trước**
- `vibeseek/components/3d/Model.tsx` — **audit trước**
- `vibeseek/components/3d/types.ts`
- `vibeseek/components/3d/useVibeScrollTimeline.ts` — **audit trước**

**Candidates xoá (verify trước):**
- `vibeseek/public/models/magic_crystals.glb`
- `vibeseek/public/models/a_circled_dodecahedron.glb`
- `vibeseek/public/models/ROBOT1.glb`
- `vibeseek/components/3d/_unused/` (toàn bộ)
- Các file `components/3d/*` match pattern `Prism*`, `Crystal*`, `Robot*`, và các `VibeScene*`, `StudyScene*`, `LoginScene*` CanvasSceneVariants nếu không được import ở `app/`.

Script `package.json` có command `gltf:prism`, `gltf:crystals` — **xoá** các script đó cùng, chỉ giữ `gltf:dojo`.

## Work plan

1. **Audit reference** — run từ `vibeseek/`:
   ```bash
   # Tìm mọi import/use của component 3D trong app/
   grep -rn "from.*components/3d" app/ 2>/dev/null
   grep -rn "public/models" app/ components/ lib/ 2>/dev/null
   ```
2. Ghi kết quả vào "Decisions log" bên dưới: component nào được import từ `app/`, component nào chỉ được import nội bộ trong `components/3d/`.
3. **Rule xoá:** component nào **không** trace ngược được đến `app/page.tsx` (landing) hoặc `app/layout.tsx` → xoá.
4. **Rule giữ:** bất kỳ file nào được import (trực tiếp hoặc gián tiếp) bởi landing → giữ.
5. **Xoá theo thứ tự an toàn:**
   - Xoá component TSX trước
   - Xoá GLB không còn reference
   - Xoá `components/3d/_unused/` (folder này theo convention = file user đã đánh dấu nghi ngờ)
6. Xoá npm scripts `gltf:prism`, `gltf:crystals` trong `vibeseek/package.json`.
7. Chạy `npm run build` — verify không broken.
8. Commit: `T-004: drop unused 3D models and components; keep DOJO mascot for landing`

## Acceptance criteria
- [ ] AC-1: `ls vibeseek/public/models/*.glb` chỉ in `DOJO.glb` (và `README.md` nếu còn).
- [ ] AC-2: `vibeseek/components/3d/_unused/` không còn.
- [ ] AC-3: `npm run build` trong `vibeseek/` pass.
- [ ] AC-4: `npm run dev` + mở `http://localhost:3000/` — landing hiển thị DOJO bình thường, không console error.
- [ ] AC-5: Bundle size sau build (folder `.next/static`) giảm ≥ 40MB so với trước task (verify bằng `du -sh vibeseek/.next/static`).
- [ ] AC-6: `package.json` không còn script `gltf:prism`, `gltf:crystals`.
- [ ] AC-7: Grep `PrismModel\|CrystalCluster\|Robot` trong `app/` và `components/` (ngoài file bị xoá) → rỗng.

## Definition of Done
- [ ] All AC pass
- [ ] AGENT_LOG.md entry có ghi số MB giảm được
- [ ] PR description có screenshot landing + `du -sh` trước/sau
- [ ] Status = `review`

## Questions / Blockers
_(none)_

## Decisions log
<!-- Ghi kết quả audit ở đây -->
**Reference map (to fill):**
- `app/page.tsx` imports: _(tba sau khi grep)_
- `app/layout.tsx` imports: _(tba)_
- Components dùng từ app/: _(tba)_

## Notes for reviewer

Task này **rủi ro break landing** — test kỹ manually (AC-4). Nếu không chắc component nào đó có được dùng gián tiếp không, **đừng xoá** — ghi vào Decisions log và hỏi Architect.

Quy tắc vàng: **đừng xoá file nếu không chắc**. Bundle size dư 20MB chấp nhận được; một component thiếu làm vỡ landing thì không.
