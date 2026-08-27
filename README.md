# LilyBeta — Phase 1: Backend Foundation + Auth + Assignment Security

LilyBeta là hệ thống dành riêng cho Beta Reader của LilyHub (`beta.lilyhub.top`). Hệ thống được thiết kế để Ban quản trị cấp phát bản thảo, phân công quyền đọc duyệt bảo mật, và đảm bảo **tuyệt đối không bị rò rỉ dữ liệu (chống IDOR)** giữa các Beta Reader.

---

## 🎯 Mục tiêu Phase 1

- **Auth thật**: Phân chia hai vai trò `ADMIN` và `BETA_READER`. Không mở đăng ký tự do, tài khoản do Admin cấp.
- **Upload & Phân tích bản thảo**: Tái sử dụng engine của LilyVIP (`BookImporter`, `ChapterDetector`, `TextCleaner`) để phân tích file `TXT`, `EPUB`, `DOCX` thành cấu trúc chương chuẩn hóa.
- **Zero Raw File Exposure**: Tuyệt đối không lưu và không cung cấp endpoint tải file gốc (`.txt`, `.docx`, `.epub`).
- **Phân công & Kiểm soát truy cập**: Admin assign truyện cho Beta Reader. Beta Reader chỉ thấy và chỉ đọc được truyện được phân công.
- **IDOR Protection ở Backend**: Backend kiểm tra quyền truy cập ở database level cho mọi request tới `/api/books/:id` và `/api/books/:id/chapters/:index`. Người dùng khác hoặc unassigned reader bị từ chối bằng **HTTP 403 Forbidden**.
- **BetaCloudBookSource**: Cung cấp implementation cloud kế thừa abstraction `BookSource` của hệ sinh thái Lily.

---

## 🚀 Cài đặt & Khởi chạy

### Yêu cầu môi trường
- Node.js: >= 20 (khuyên dùng Node.js 24)
- npm: >= 10

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Cấu hình môi trường
Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```
Nội dung mặc định:
```env
PORT=3001
JWT_SECRET=lilybeta-super-secret-key-change-in-production
DB_PATH=./data/lilybeta.db
NODE_ENV=development
```

### 3. Khởi tạo Database & Seed Admin
```bash
npm run db:migrate
```
Tài khoản Admin mặc định được khởi tạo:
- **Tên đăng nhập**: `admin`
- **Mật khẩu**: `admin123456`

### 4. Chạy chế độ Phát triển (Dev Mode)
Chạy đồng thời Backend API (port 3001) và Vite Frontend (port 3000):
```bash
npm run dev
```
Truy cập ứng dụng tại: `http://localhost:3000`

---

## 🛡️ Kiểm thử Bảo mật & IDOR (Automated Test Suite)

Chạy bộ test 34 kịch bản bảo mật và phân quyền nghiêm ngặt:
```bash
npm run test:security
```
Bộ test tự động xác thực:
1. Admin đăng nhập và cấp tài khoản cho Beta A và Beta B.
2. Admin upload Book A và Book B.
3. Admin assign Book A → Beta A, Book B → Beta B.
4. Beta A đăng nhập: chỉ thấy Book A, đọc được Chapter 1 của Book A.
5. **IDOR Test**: Beta A cố truy cập Book B (`/api/books/:idB`, `/chapters`, `/chapters/1`, `/progress`) → **403 Forbidden**.
6. **IDOR Test**: Beta B cố truy cập Book A (`/api/books/:idA`, `/chapters/1`) → **403 Forbidden**.
7. Beta Reader cố gọi endpoint admin → **403 Forbidden**.
8. Khóa tài khoản Beta Reader → Token bị từ chối ngay lập tức (**401 Unauthorized**).
9. Lưu và khôi phục tiến độ đọc chương.
10. Ghi nhận nhật ký audit (`LOGIN`, `BOOK_CREATED`, `BOOK_ASSIGNED`, `CHAPTER_OPENED`).

---

## 🗄️ Database Schema & Migrations

### Tables trong Phase 1:
1. `profiles`: Tài khoản người dùng, vai trò (`ADMIN`, `BETA_READER`), trạng thái kích hoạt (`is_active`).
2. `beta_books`: Thông tin tác phẩm, số chương, tổng số chữ, định dạng, trạng thái workflow.
3. `beta_chapters`: Danh sách chương và nội dung các đoạn văn (`paragraphs: string[]` lưu dưới dạng JSON).
4. `beta_assignments`: Bảng phân công quyền đọc tác phẩm cho từng Beta Reader.
5. `beta_chapter_progress`: Bảng theo dõi tiến độ đọc (chương hiện tại, % hoàn thành, % cuộn trang).
6. `beta_activity_logs`: Bảng nhật ký kiểm toán hệ thống.

### Chuẩn bị cho Phase 2 & 3 (Schema đã định nghĩa sẵn):
- `beta_edits`: Lưu các đề xuất sửa đổi văn bản trực tiếp.
- `beta_revisions`: Phản hồi và duyệt đề xuất sửa đổi.
- `beta_notes`: Ghi chú riêng của Beta Reader trên từng đoạn văn.

### File Migrations trong repo:
- `server/migrations/001_initial_schema.sql`: Migration chạy trên SQLite cho môi trường local/self-contained.
- `server/migrations/supabase_schema.sql`: File script PostgreSQL chuẩn bị cho deploy Supabase production kèm đầy đủ Row-Level Security (RLS) policies.

---

## 🏗️ Kiến trúc BookSource Abstraction

LilyBeta duy trì sự tương thích tuyệt đối với kiến trúc của LilyVIP:

```text
UI (BetaReaderView / BetaBookDetail)
           ↓
   BookSource (Interface)
           ↓
   BetaCloudBookSource
           ↓
   LilyBeta Authenticated API Client
           ↓
   LilyBeta Express Backend (Server-Side Authorization)
           ↓
   Database (SQLite / PostgreSQL)
```

---

## 📋 Danh sách tính năng cố tình KHÔNG đưa vào Phase 1 (Out of Scope)
Theo đúng yêu cầu đặc tả:
- Không có inline text editing, before/after diff.
- Không có Audio / TTS engine (`@diffusionstudio/vits-web`, NghiTTS).
- Không có hệ thống thanh toán, VIP pass, tiers, nâng cấp gói.
- Không có public registration (chỉ có Admin provisioning).
- Không có web scraper/crawler.
