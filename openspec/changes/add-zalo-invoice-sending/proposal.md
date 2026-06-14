## Why

Chủ trọ hiện phải tự thông báo hóa đơn cho khách qua tin nhắn rời rạc, dễ quên và mất thời gian; khách thuê thường bỏ lỡ hạn đóng tiền vì không có kênh nhắc tự động. Zalo OA là kênh phổ biến nhất ở Việt Nam — tích hợp gửi hóa đơn tự động qua Zalo giảm thao tác thủ công, chuẩn hóa template phiếu thu, và là điểm khác biệt rõ với các đối thủ chỉ in giấy / gửi email.

## What Changes

- Thêm trang **Cài đặt phiếu thu (hóa đơn)** — cấu hình ngày lập, hạn đóng, làm tròn, mã QR, hình thức thanh toán mặc định, ghi chú, master switch gửi Zalo tự động
- Thêm trang **Lịch sử gửi hóa đơn qua Zalo** — bảng log lọc theo năm/tháng/phòng/trạng thái, đếm success/failed, nút resend, nút gửi thử
- Thêm **service Zalo OA** (`src/lib/zalo`) — wrapper cho API Zalo (send message, refresh token), template card hóa đơn, khung giờ check 6h-22h (giờ VN)
- Thêm API `POST /api/zalo/send-invoice` — gửi 1 hóa đơn cụ thể (manual hoặc preview)
- Thêm webhook `POST /api/zalo/webhook` — nhận event delivery/user reply từ Zalo
- Thêm hook trong flow tạo hóa đơn — nếu master switch ON và khách có `zaloUserId` → enqueue gửi tự động
- Thêm cron job retry các tin failed (sau 5/15/60 phút, tối đa 3 lần)
- Bổ sung `zaloUserId` vào model `KhachThue` (lưu user ID Zalo sau khi khách quan tâm OA)
- Cấu hình Zalo OA token qua env vars: `ZALO_OA_ACCESS_TOKEN`, `ZALO_OA_REFRESH_TOKEN`, `ZALO_OA_APP_ID`, `ZALO_OA_SECRET_KEY`
- Triển khai theo phase: M1 (settings + DB + send manual/preview), M2 (history page + log), M3 (auto-send + cron + webhook)

## Capabilities

### New Capabilities
- `invoice-settings`: Trang cấu hình chung cho phiếu thu/hóa đơn (ngày lập, hạn đóng, làm tròn, mã QR, hình thức thanh toán mặc định, ghi chú mặc định, master switch gửi Zalo). Lưu dưới dạng singleton trong collection `CaiDatHoaDon`.
- `zalo-invoice-sending`: Tích hợp Zalo OA để gửi hóa đơn tự động hoặc thủ công. Bao gồm service wrapper, template card hóa đơn, khung giờ check 6h-22h, hook auto-send khi tạo hóa đơn, cron retry, webhook nhận event, follow OA flow cho khách thuê.
- `zalo-message-history`: Trang lịch sử + log mỗi lần gửi tin Zalo (status, response, error). UI lọc theo năm/tháng/phòng/trạng thái, đếm thành công/thất bại, nút resend, nút gửi thử, nút bật/tắt tính năng.

### Modified Capabilities
<!-- Chưa có spec hiện hữu trong openspec/specs/ — toàn bộ capability đều mới. -->

## Impact

**Code mới:**
- `src/lib/zalo/` — service module (client, template, time-gate, queue)
- `src/models/CaiDatHoaDon.ts`, `src/models/ZaloMessageLog.ts`
- `src/app/api/cai-dat-hoa-don/route.ts` (GET, PUT)
- `src/app/api/zalo/send-invoice/route.ts` (POST)
- `src/app/api/zalo/webhook/route.ts` (POST)
- `src/app/api/zalo/retry/route.ts` (POST — cron endpoint)
- `src/app/(dashboard)/dashboard/cai-dat-hoa-don/page.tsx`
- `src/app/(dashboard)/dashboard/zalo-history/page.tsx`
- Components: modal preview "Mẫu gửi Zalo", form gửi xem trước

**Code modify:**
- `src/models/KhachThue.ts` — thêm `zaloUserId?: string`, `daQuanTamOA: boolean`
- `src/app/api/hoa-don/route.ts` (POST) — sau khi tạo, nếu autoSend bật → gọi service Zalo
- `src/components/app-sidebar.tsx` — thêm link "Cài đặt phiếu thu" + "Lịch sử Zalo"
- `env.example` + `.env.local` — bổ sung `ZALO_OA_*`
- `vercel.json` — thêm cron `/api/zalo/retry` chạy mỗi 5 phút

**Dependencies:**
- Không thêm npm package nặng — dùng `fetch` native cho Zalo REST API
- Có thể thêm `qrcode` (nhỏ) để generate QR thanh toán

**Hạ tầng / vận hành:**
- Cần đăng ký Zalo Official Account + duyệt template message dạng "consultation_request" (mất 1-3 ngày)
- Vercel cron (Hobby plan support 1 cron/ngày; Pro hỗ trợ mỗi phút) — nếu Hobby thì cần dịch vụ ngoài (cron-job.org) hoặc giảm tần suất

**Rủi ro:**
- Zalo OA bị giới hạn tin/ngày tùy hạng tài khoản — cần handle 429
- Khách phải quan tâm OA trước → cần flow gửi link mời (không gửi được tin chủ động cho user chưa follow OA)
- Tin gửi ngoài khung 6h-22h sẽ bị Zalo từ chối → cần queue chờ giờ hợp lệ
