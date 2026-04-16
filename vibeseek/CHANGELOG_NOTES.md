# VibeSeek — Changelog & Debug Notes

> File này ghi lại các lần kiểm tra / sửa lỗi để lần sau đọc lại nắm bối cảnh nhanh.

---

## 2026-04-15 — Kiểm tra toàn bộ project + lỗi `autoprefixer` + xử lý PDF

### 1. Lỗi báo cáo
```
Error: Cannot find module 'autoprefixer'
   at loadPlugin (.../next/dist/build/webpack/config/blocks/css/plugins.js:49:32)
```
Xuất hiện khi chạy `npm run dev` ngay sau `copy .env.local.example .env.local`.

### 2. Chẩn đoán
- `node_modules/autoprefixer@10.5.0` **đã có sẵn**, `lib/autoprefixer.js` đầy đủ.
- `node -e "require('autoprefixer')"` → load OK.
- Tất cả transitive deps (`browserslist`, `caniuse-lite`, `fraction.js`, `picocolors`, `postcss-value-parser`) đều resolve được.
- Sau khi xoá `.next/` và chạy lại `npm run dev` → **server lên bình thường, compile `/` 200 OK**.
- Không reproduce lại được lỗi.

### 3. Kết luận về lỗi autoprefixer
Lỗi mang tính **transient** — có thể do:
- Lần đó `npm install` chưa hoàn tất (race) → Next.js bắt đầu compile khi `autoprefixer` chưa kịp ghi xong.
- Hoặc cache `.next/` bị stale từ lần build trước (trước khi `node_modules` được cài).

**Cách xử lý nếu gặp lại:**
```powershell
# Trong d:\WangNhat\Study\VibeCode\vibeseek
Remove-Item -Recurse -Force .next
npm install            # đảm bảo install xong sạch
npm run dev
```
Nếu vẫn lỗi: `Remove-Item -Recurse -Force node_modules, package-lock.json; npm install`.

### 4. Xử lý PDF — Đã verify hoạt động
Đã test thực tế endpoint `POST /api/vibefy` với 1 file PDF thật (`2526-HK1-MMDS-CK.pdf`):
- `pdf-parse@1.1.4` extract text OK (không còn bug `./test/data/05-versions-space.pdf` của bản cũ — `index.js` hiện chỉ là `require('./lib/pdf-parse.js')`).
- Gemini (`gemini-2.0-flash`) trả về JSON đúng schema → 10 Vibe Cards được tạo.
- Insert vào Supabase `vibe_documents` + `vibe_cards` thành công.
- Response 200 với `success: true`.

**Pipeline xác nhận chạy đúng:**
1. `app/api/vibefy/route.ts` nhận multipart form (`pdf`, `title`, `maxCards`).
2. `lib/ai/processor.ts → extractTextFromBuffer()` dùng `pdf-parse` (dynamic import — quan trọng để tránh edge runtime).
3. `chunkText()` cắt 4000 chars/chunk, dùng `chunks[0]` (chỉ chunk đầu, đủ cho hầu hết tài liệu).
4. `vibefyText()` thử lần lượt `gemini-2.0-flash` → `gemini-2.0-flash-lite` → `gemini-2.5-flash`, mỗi model 2 lần (có wait 5s nếu 429/quota).
5. `validateAndTransformCards()` đảm bảo schema đúng trước khi trả về.
6. Optional save Supabase (try/catch — DB lỗi không fail request).

### 5. Lỗi giả "Failed to extract text from PDF"
Nếu test bằng PDF tự handcraft (vd hex thuần), `pdf-parse` sẽ throw `Invalid number: / (charCode 47)` → route trả 422 với message *"Make sure it is not scanned/image-only."* Đây là **hành vi đúng** — chỉ là message hơi gây hiểu nhầm với PDF malformed.

> **Gợi ý cải thiện sau này:** phân biệt error message:
> - PDF parse fail (corrupt format) → "PDF bị lỗi/không đúng định dạng"
> - Text < 50 chars → "PDF có thể là scan/ảnh, hãy dùng OCR trước"

### 6. Cấu hình env hiện tại
`.env.local` đã có:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ✅
- `GEMINI_API_KEY` ✅ (đã verify gọi được)
- `MAX_FILE_SIZE_MB=10`

### 7. Cấu trúc project ghi nhớ
```
vibeseek/
├── app/
│   ├── api/vibefy/route.ts      # Endpoint POST chính
│   ├── layout.tsx, page.tsx, globals.css
├── components/                   # UploadZone, VibeCard, GlowButton, ProgressBar
├── lib/ai/
│   ├── processor.ts             # extractTextFromBuffer + vibefyText + chunkText
│   └── prompts.ts               # VIBEFY_SYSTEM_PROMPT + VIBEFY_USER_PROMPT
├── utils/supabase.ts            # supabase + supabaseAdmin clients + types
├── next.config.js               # serverComponentsExternalPackages: ['pdf-parse'] ✅
├── postcss.config.js            # tailwind + autoprefixer
└── supabase-schema.sql          # 4 bảng: vibe_documents, vibe_cards, quiz_questions, user_progress
```

### 8. Hướng phát triển tiếp (gợi ý từ code hiện tại)
- **Multi-chunk processing**: hiện chỉ dùng `chunks[0]` → PDF dài bị cắt. Nên gộp tất cả chunks hoặc chia card cho từng chunk.
- **Quiz generation**: bảng `quiz_questions` đã có schema nhưng chưa thấy code generate → cần thêm prompt + endpoint.
- **User progress / Learn-to-Earn**: bảng `user_progress` có sẵn nhưng UI chưa wire (hiện tại nút "Smart Quiz Boss" chỉ toast Coming soon).
- **Auth**: Supabase RLS đang `USING (true)` — public demo. Production cần auth + tighten policy.
- **OCR fallback**: PDF scan/ảnh hiện fail luôn. Có thể thêm Tesseract.js hoặc Gemini Vision cho OCR.
- **Storage bucket `vibeseek-files`**: schema có note nhưng route chưa upload file lên storage (chỉ insert metadata). Nên upload + lưu `file_url`.

---
