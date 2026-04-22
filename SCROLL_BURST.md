# VibeSeek · Scroll Burst Animation

> Background animation lấp đầy CTA section ở cuối landing page.
> 12 stationery items "bung ra" khi user scroll gần đến cuối trang.

---

## 🎯 Concept

**Vấn đề:** CTA section ở cuối landing page VibeSeek bị trống ở góc trái (vì DOJO 3D nằm bên phải).

**Giải pháp:** Background items (pencil, book, sticky notes, highlighter...) bắt đầu **ẨN** ở hero, và **bung ra dần** từ 60% → 92% scroll progress để lấp đầy CTA.

**Tại sao không xuất hiện ngay từ đầu?**
- Hero section cần **sạch sẽ** để user tập trung vào tagline + CTA chính
- Features/DOJO section không bị nhiễu, dễ đọc content
- CTA được "thưởng" bằng layer items đầy đặn → tạo cảm giác hoàn thành scroll journey

---

## 🏗️ Architecture

### Cơ chế 4 lớp animation của mỗi item

1. **Scale** từ `0.3` → `1` (bung nở từ nhỏ)
2. **Opacity** từ `0` → `1` (fade-in cùng lúc)
3. **Translate** từ góc dưới-trái (`-80px, +80px`) về vị trí cuối (`0, 0`)
4. **Rotation** từ random `±20°` → vị trí CSS final

Cộng **stagger delay** — mỗi item có delay 0–30% khác nhau nên không bung đồng loạt.

### Burst curve

```
progress:      0 ─────── burstStart ────── burstEnd ──── 1
                │              │              │          │
items state:  ẨN HOÀN TOÀN ── BUNG DẦN ─── FULL BURST + parallax nhẹ
                               (stagger)
```

### Sau khi full burst

Items tiếp tục drift nhẹ theo scroll (parallax speed 0.1-0.3) để luôn "sống", không đứng yên cứng.

---

## 📁 Files

```
vibeseek/
├── components/
│   └── atoms/
│       ├── ScrollBurst.tsx          # React component
│       └── scroll-burst.css         # Styles
└── SCROLL_BURST.md                  # File này
```

---

## 🚀 Setup

### Bước 1 — Copy files

```bash
cp components/ScrollBurst.tsx       /path/to/vibeseek/components/atoms/
cp components/scroll-burst.css      /path/to/vibeseek/components/atoms/
cp SCROLL_BURST.md                  /path/to/vibeseek/
```

### Bước 2 — Import CSS

Trong `app/globals.css`:
```css
@import "../components/atoms/scroll-burst.css";
```

### Bước 3 — Mount vào landing page

**CHỈ mount trên landing page, KHÔNG mount global** (vì chỉ landing cần):

```tsx
// app/page.tsx (landing page)
import ScrollBurst from "@/components/atoms/ScrollBurst";

export default function LandingPage() {
  return (
    <>
      <ScrollBurst />
      {/* sections của landing */}
    </>
  );
}
```

### Bước 4 — Đảm bảo z-index đúng

```css
.scroll-burst-bg  { z-index: 1; }   /* Background layer */
section, nav      { z-index: 2+; }  /* Content phải cao hơn */
```

Hoặc trong Tailwind: thêm `relative z-10` cho mỗi section content.

---

## ⚙️ Props

```tsx
interface ScrollBurstProps {
  burstStart?: number;       // 0-1 · scroll % bắt đầu burst · default 0.6
  burstEnd?: number;         // 0-1 · scroll % burst hoàn tất · default 0.92
  showDebugMeter?: boolean;  // Hiện meter góc dưới-trái · default false
}
```

### Ví dụ tinh chỉnh

```tsx
{/* Burst sớm hơn (từ 45% scroll) */}
<ScrollBurst burstStart={0.45} />

{/* Burst gấp gáp (khoảng 75% → 95%) */}
<ScrollBurst burstStart={0.75} burstEnd={0.95} />

{/* Debug mode — hiện meter % realtime */}
<ScrollBurst showDebugMeter={true} />
```

---

## 🎨 12 Items hiện có

| # | Item | Vai trò | Màu |
|---|---|---|---|
| 1 | Pencil lớn | Landmark góc trái-dưới | Sunflower + Terracotta tip |
| 2 | Open Book | Anchor content | Cream + text highlight |
| 3 | Eraser | Label "DOJO" | Terracotta |
| 4 | Sticky Note 1 | "Feynman = dạy lại để hiểu" | Sunflower |
| 5 | Sticky Note 2 | "+40 XP · streak 12 ✨" | Sage |
| 6 | Highlighter | Decorative tool | Sunflower |
| 7-8 | Paper Clips x2 | Small accents | Stone + Lapis |
| 9-11 | Stars x3 | Sparkle accents | Sunflower / Terracotta / Lapis |
| 12 | Ruler | Edge element bên trái | Cream |

**Vị trí cuối của từng item được define trong `scroll-burst.css`** — chỉnh `left`, `top`, `bottom` để di chuyển.

---

## 🎛️ Customization

### Thay đổi vị trí cuối của item

Mở `scroll-burst.css`, tìm class item muốn sửa:
```css
.scroll-burst-bg .item-pencil {
  left: 2%;       /* ← chỉnh đây */
  bottom: -5%;    /* ← và đây */
  width: 200px;   /* ← size */
}
```

### Thêm item mới

1. Thêm SVG trong `ScrollBurst.tsx`:
   ```tsx
   <svg className="float-item item-NEW" viewBox="...">...</svg>
   ```

2. Thêm vị trí cuối trong `scroll-burst.css`:
   ```css
   .scroll-burst-bg .item-NEW {
     left: 20%;
     top: 40%;
     width: 80px;
   }
   ```

### Đổi màu items

Mỗi SVG có `fill` và `stroke` inline — search & replace các mã:
- `#F5B83E` · Sunflower
- `#D96C4F` · Terracotta
- `#7A9B7E` · Sage
- `#5B89B0` · Lapis
- `#17140F` · Ink base (outline)

### Giảm số items trên mobile

Mặc định đã ẩn clips, 1 star, ruler. Muốn ẩn thêm, sửa trong `scroll-burst.css`:
```css
@media (max-width: 768px) {
  .scroll-burst-bg .item-highlighter,  /* thêm vào đây */
  .scroll-burst-bg .item-eraser {
    display: none;
  }
}
```

---

## 📏 Rules & Best Practices

### ✅ NÊN LÀM

1. **CHỈ mount trên landing page** — không mount global (các trang app, dashboard không cần)
2. **Test trên thiết bị yếu** — Android mid-range, kiểm tra fps khi scroll
3. **Dùng `showDebugMeter={true}` khi dev** — dễ tinh chỉnh burstStart/burstEnd
4. **Đảm bảo content có z-index cao** — nếu không items sẽ đè lên CTA button
5. **Giữ tổng số items ≤ 15** — thêm nhiều sẽ ảnh hưởng performance

### ❌ KHÔNG NÊN

1. **Không mount trên mọi page** — performance overhead không đáng
2. **Không animate các property khác `transform`/`opacity`** — drop fps
3. **Không bỏ `will-change`** — browser optimization quan trọng
4. **Không dùng PNG cho items** — SVG nhẹ hơn, scalable
5. **Không remove `prefers-reduced-motion` handler** — accessibility requirement

---

## 🧪 Test Checklist

- [ ] Scroll từ hero → CTA: items ẨN ở đầu, BUNG ở cuối
- [ ] Burst meter (debug) hiển thị 0% ở hero, 100% ở CTA
- [ ] Content (h1, h2, buttons) hiển thị ĐÈ lên items (z-index đúng)
- [ ] Mobile: clips/star-1/ruler ẨN (đỡ rối)
- [ ] DevTools > Rendering > Emulate `prefers-reduced-motion: reduce` → items hiện mờ, không animate
- [ ] DevTools > Performance: scroll 5s, không có dropped frames dưới 60fps
- [ ] Resize window: items không gây horizontal scrollbar

---

## 🐛 Troubleshooting

### Items không xuất hiện ở CTA
→ Check z-index: `.scroll-burst-bg` phải < content. Nếu CTA có `z-index: 1` → đè items.
→ Check CSS đã import chưa: inspect `.float-item` có rule `will-change` không.

### Items animate giật, không mượt
→ Check Framer Motion / GSAP có conflict không (2 lib cùng animate transform).
→ Thử xóa `will-change` xem có khác không — đôi khi gây memory pressure trên iOS.

### Debug meter không hiện
→ Prop `showDebugMeter={true}` phải đúng cú pháp.
→ Check class `.burst-meter` có trong `scroll-burst.css` không.

### Scroll lag trên mobile
→ Thêm `display: none` cho nhiều items hơn trong media query mobile.
→ Giảm `drop-shadow` (nặng): đổi thành `box-shadow` hoặc xóa hẳn.

### Items bị lệch khi resize
→ Check đơn vị — dùng `%` hoặc `vw/vh` thay vì `px` cố định cho `left`/`top`.

---

## 🔗 Related

- `CURSOR_DESIGN.md` — Cursor system
- `VIBESEEK_DESIGN.md` — Color tokens + typography
- Demo HTML: `vibeseek-scroll-burst.html` (standalone test)

---

*VibeSeek · Scroll Burst v1.0 · [CtrlC-CtrlV]*
