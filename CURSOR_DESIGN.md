# VibeSeek · Cursor System Design

> Hệ thống con trỏ chuột chủ đề "Stationery Cursors" — 11 học cụ di động.
> File này là Single Source of Truth cho mọi logic cursor trong VibeSeek.

---

## 🎯 Concept

Mỗi con trỏ là một **học cụ di động** — bút chì, cục tẩy, highlighter, kính lúp...
Người dùng cảm nhận được "ngôn ngữ học tập" qua từng chuyển động chuột.

**Bám bảng màu Warm Study v2:**
- Sunflower `#F5B83E` · chủ đạo (bút chì, ngôi sao click)
- Terracotta `#D96C4F` · Bé Vibe, eraser
- Paper Cream `#F5EFE4` · default, hand open
- Lapis `#5B89B0` · magnifier lens
- Stone `#9A928A` · disabled

---

## 🏗️ Kiến trúc 2 tầng

VibeSeek dùng **2 hệ thống song song**:

### Tầng 1 — Static CSS Cursors (`cursors.css`)
- **Cơ chế:** SVG file → `cursor: url()`
- **Ưu điểm:** Nhẹ, không JS, hoạt động ngay cả trước khi React hydrate
- **Nhược điểm:** Không animate được
- **Khi nào dùng:** Mặc định cho tất cả pages — đảm bảo UX không bị "flash" trước khi JS load

### Tầng 2 — Animated Cursor Component (`AnimatedCursor.tsx`)
- **Cơ chế:** React component render `<div>` theo `mousemove`
- **Ưu điểm:** Animate được (nháy mắt, spin, pulse), context-aware
- **Nhược điểm:** Cần JS, chỉ active sau khi hydrate
- **Khi nào dùng:** Overlay lên tầng 1 — hoạt động khi component mount

**Cả 2 cùng chạy → CSS là fallback, JS là enhancement.**

---

## 📦 Files Structure

```
vibeseek/
├── public/
│   └── cursors/
│       ├── default.svg       # 24×24 · hotspot 12,12
│       ├── pointer.svg       # 32×32 · hotspot 16,16
│       ├── pencil.svg        # 32×32 · hotspot 16,28
│       ├── hand-open.svg     # 32×32 · hotspot 16,16
│       ├── hand-fist.svg     # 32×32 · hotspot 16,18
│       ├── highlighter.svg   # 36×36 · hotspot 18,30
│       ├── eraser.svg        # 32×32 · hotspot 16,16
│       ├── disabled.svg      # 28×28 · hotspot 14,14
│       ├── loading.svg       # 32×32 · hotspot 16,16
│       ├── bevibe.svg        # 36×36 · hotspot 18,18
│       ├── zoom.svg          # 32×32 · hotspot 13,13
│       └── cursors.css       # Static CSS cursor rules
└── components/
    └── AnimatedCursor.tsx    # JS animated cursor
```

---

## 🎨 Cursor Catalog

| # | Tên | Variant ID | Trigger | Animation |
|---|---|---|---|---|
| 01 | **Pencil Dot** | `default` | Mặc định toàn web | Static |
| 02 | **Spark Star** | `pointer` | `button`, `a`, `[role="button"]`, `.clickable` | Xoay 360° / 8s |
| 03 | **Pencil Tilt** | `text` | `input`, `textarea`, `[contenteditable]` | Chớp đầu bút (caret) |
| 04 | **Open Hand** | `grab` | `.draggable`, `.grab` | Static |
| 05 | **Fist Hold** | `grabbing` | `.dragging`, mouse-down trên `.draggable` | Scale pulse |
| 06 | **Highlighter** | `highlight` | `.highlight-mode` container | Static |
| 07 | **Eraser Block** | `eraser` | `.eraser-mode`, `.btn-delete:hover` | Static (CSS only) |
| 08 | **Ghost Block** | `disabled` | `:disabled`, `.locked`, `[aria-disabled]` | Shake khi hover |
| 09 | **Spinner Arc** | `loading` | `body.loading` | Xoay 360° / 1s |
| 10 | **Bé Vibe Face** | `bevibe` | `.feynman-mode` container | Nháy mắt + bob |
| 11 | **Magnifier** | `zoom` | `.zoomable`, `img.zoomable`, `.diagram` | Scale pulse |

---

## 🚀 Setup Instructions

### Bước 1 — Copy SVG files vào public folder

```bash
# Từ root của project VibeSeek
mkdir -p public/cursors
# Copy toàn bộ 11 SVG + cursors.css vào public/cursors/
```

### Bước 2 — Import CSS cursors vào global

Trong `app/globals.css`:
```css
@import "./cursors.css";
/* ... rest of globals */
```

**Hoặc** trong `app/layout.tsx`:
```tsx
import "/public/cursors/cursors.css";
```

### Bước 3 — Install dependencies cho AnimatedCursor

```bash
npm install framer-motion
```

### Bước 4 — Thêm AnimatedCursor vào root layout

```tsx
// app/layout.tsx
import AnimatedCursor from "@/components/AnimatedCursor";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <AnimatedCursor />
        {children}
      </body>
    </html>
  );
}
```

### Bước 5 — Apply context classes cho elements đặc biệt

```tsx
// Feynman chat page
<div className="feynman-mode">
  <FeynmanChat />
</div>

// Draggable feed card
<div className="draggable">
  <VibeCard />
</div>

// Zoomable image
<img src="/diagram.png" className="zoomable" />

// Highlight mode (toggle bằng state)
<div className={isHighlightMode ? "highlight-mode" : ""}>
  <BookContent />
</div>

// Loading state (khi gọi API)
// Trong component:
useEffect(() => {
  if (isLoading) document.body.classList.add("loading");
  else document.body.classList.remove("loading");
}, [isLoading]);
```

---

## 📏 Rules & Conventions

### ✅ NÊN LÀM

1. **Luôn có fallback cursor keyword** — mọi `cursor: url()` phải kèm `pointer`/`text`/`grab`:
   ```css
   cursor: url("/cursors/pointer.svg") 16 16, pointer;
   /*                                         ^^^^^^^ fallback */
   ```

2. **Hotspot phải chính xác** — điểm click trong SVG phải trùng với tọa độ hotspot:
   - Pencil (bút chì): hotspot ở ĐẦU BÚT (16,28 = góc dưới)
   - Magnifier (kính lúp): hotspot ở TÂM LENS (13,13)
   - Hand open: hotspot ở TÂM lòng bàn tay (16,16)

3. **Giữ size trong khoảng 24-36px** — quá nhỏ khó thấy, quá lớn chắn nội dung.

4. **Test trên retina display** — SVG scale tự động, nhưng stroke-width cần check ở @2x.

5. **Cursor "Bé Vibe" CHỈ dùng trong `.feynman-mode`** — giữ độ đặc biệt, không spam.

### ❌ KHÔNG NÊN

1. **Không dùng cursor trên mobile** — iOS/Android ignore, nhưng AnimatedCursor phải early-return để không tốn RAM.

2. **Không animate SVG cursor qua CSS `cursor: url()`** — browser không render animation trong cursor. Muốn animate → dùng AnimatedCursor component.

3. **Không override cursor của form elements bằng `!important`** — trừ khi là `:disabled` (phải override `cursor: pointer` của button).

4. **Không dùng PNG cho cursor** — SVG nhẹ hơn, scalable, inline được qua data URI.

5. **Không quá 5 cursor variants trong một màn** — quá nhiều = confusing. Mỗi page chỉ 2-3 context cursor.

---

## 🧪 Test Checklist

Trước khi merge, test các case sau:

- [ ] **Desktop** — hover qua button, input, card — cursor đổi đúng
- [ ] **Drag** — mouse-down trên `.draggable` → cursor thành `grabbing`
- [ ] **Feynman mode** — vào trang Feynman chat → cursor thành Bé Vibe (có nháy mắt)
- [ ] **Loading** — trigger API call → cursor thành spinner xoay
- [ ] **Disabled** — hover nút disabled → cursor Ghost (không phải Spark Star)
- [ ] **Mobile** — mở trên iPhone/Android → không có cursor custom nào (AnimatedCursor return null)
- [ ] **prefers-reduced-motion** — bật trong OS settings → CSS cursor về native (`auto`, `pointer`...)
- [ ] **Retina** — test trên Mac Retina hoặc mobile emulator 2x — stroke không bị mờ
- [ ] **Performance** — mở DevTools Performance, move chuột liên tục 30s → không drop frame

---

## 🐛 Troubleshooting

### Cursor không đổi khi hover button
→ Check `cursors.css` đã import chưa. Inspect element xem `cursor` có `url()` không.

### Bé Vibe cursor không xuất hiện trong Feynman chat
→ Component Feynman chat phải có class `.feynman-mode` ở wrapper ngoài cùng.
→ Hoặc: AnimatedCursor chưa mount (JS chưa hydrate) — kiểm tra `<AnimatedCursor />` ở `app/layout.tsx`.

### Native cursor vẫn hiện cùng lúc với AnimatedCursor
→ CSS `body { cursor: none; }` chưa áp. Check AnimatedCursor useEffect có chạy không (console.log).

### Cursor giật lag khi move nhanh
→ Spring config quá cứng. Giảm `stiffness` từ 300 xuống 200. Hoặc bỏ hẳn spring, dùng trực tiếp motion value.

### Mobile bị hiển thị cursor
→ `isTouchDevice` detection fail. Check `navigator.maxTouchPoints` — một số máy desktop có touchscreen cũng bị coi là touch. Thêm điều kiện `window.matchMedia("(hover: none)").matches` để chính xác hơn.

---

## 🎬 Animation Specs

| Variant | Animation | Duration | Ease |
|---|---|---|---|
| `pointer` | rotate 0→360° | 8s loop | linear |
| `text` | caret blink opacity 1↔0 | 1s loop | — |
| `grabbing` | scale 1↔0.95 | 0.3s loop | — |
| `bevibe` | y: 0↔-2px (bob) | 2s loop | easeInOut |
| `bevibe` | eye blink ry 1.5↔0.2 | 0.3s, repeat delay 3s | — |
| `zoom` | scale 1↔1.1 | 1.5s loop | easeInOut |
| `disabled` | rotate 0→-3→3→0 (shake) | 0.4s once | easeInOut |
| `loading` | rotate 0→360° | 1s loop | linear |

**Nguyên tắc:** Mọi animation < 8s loop. Không có animation > 2s cho cursor (gây phân tâm khi học).

---

## 🔧 Extending — Thêm cursor mới

Khi cần cursor mới (vd: "bookmark", "scissors"...):

1. **Tạo SVG file** trong `public/cursors/` — đặt tên kebab-case
2. **Thêm rule CSS** trong `cursors.css`:
   ```css
   .bookmark-mode {
     cursor: url("/cursors/bookmark.svg") 16 16, pointer;
   }
   ```
3. **Thêm variant** trong `AnimatedCursor.tsx`:
   - Update type `CursorVariant`
   - Thêm detect logic trong `handleMouseMove`
   - Thêm case trong `CursorShape` với SVG + animation
4. **Update catalog** ở section trên của file này

---

## 📚 References

- MDN: [CSS cursor property](https://developer.mozilla.org/en-US/docs/Web/CSS/cursor)
- Spec: [SVG cursor support](https://www.w3.org/TR/css-ui-3/#cursor)
- Framer Motion: [useSpring for smooth tracking](https://www.framer.com/motion/use-spring/)

---

*VibeSeek · Cursor Design System v1.0 · [CtrlC-CtrlV]*
