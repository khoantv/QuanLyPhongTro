## 1. Chuẩn bị & cấu hình

- [ ] 1.1 Đăng ký Zalo Official Account (chủ trọ thực hiện ngoài codebase)
- [ ] 1.2 Lấy `APP_ID`, `SECRET_KEY`, `ACCESS_TOKEN`, `REFRESH_TOKEN` từ Zalo developer console
- [x] 1.3 Bổ sung biến vào `env.example`: `ZALO_OA_APP_ID`, `ZALO_OA_SECRET_KEY`, `ZALO_OA_ACCESS_TOKEN`, `ZALO_OA_REFRESH_TOKEN`
- [x] 1.4 Bổ sung biến tương ứng vào `.env.local` (giá trị thật) và document yêu cầu set cùng tên ở Vercel Production

## 2. M1 — Models & DB

- [x] 2.1 Tạo `src/models/CaiDatHoaDon.ts` (singleton schema với fields: `ngayLapHoaDon`, `hanDongTien`, `autoSendZalo`, `hienMaQR`, `phanLoaiThuChi`, `lamTronHoaDon`, `hinhThucThanhToanMacDinh`, `ghiChuMacDinh`, `singleton: { default:true, unique:true }`)
- [x] 2.2 Tạo `src/models/ZaloMessageLog.ts` (fields theo spec `zalo-message-history` requirement 1; thêm index `{phongId, sentAt:-1}`, `{status, nextRetryAt}`, `{sentAt:-1}`)
- [x] 2.3 Tạo `src/models/ZaloOAToken.ts` (singleton: `accessToken`, `refreshToken`, `expiresAt`, `lastRefreshAt`)
- [x] 2.4 Bổ sung type `CaiDatHoaDon`, `ZaloMessageLog` vào `src/types/index.ts`

## 3. M1 — API cấu hình phiếu thu

- [x] 3.1 Tạo `src/app/api/cai-dat-hoa-don/route.ts` (GET trả singleton, auto-create defaults nếu chưa có)
- [x] 3.2 Bổ sung PUT trong cùng file (zod validate; check role admin/chuNha → 403 nếu không)
- [x] 3.3 Thêm helper `getCaiDatHoaDon()` trong `src/lib/cai-dat.ts` để các nơi khác dùng (cached per-request)

## 4. M1 — Zalo service core

- [x] 4.1 Tạo skeleton `src/lib/zalo/index.ts` (export entry points)
- [x] 4.2 Tạo `src/lib/zalo/client.ts` (fetch wrapper với base URL `https://openapi.zalo.me/v3.0/oa`, header `access_token`, retry logic 1 lần khi 401/-216 → refresh token rồi gọi lại)
- [x] 4.3 Tạo `src/lib/zalo/token.ts` (lấy/refresh token từ DB singleton, mutex via `findOneAndUpdate` với `lastRefreshAt` guard, memory cache TTL 1h)
- [x] 4.4 Tạo `src/lib/zalo/time-gate.ts` (`isWithinAllowedHours()` check timezone `Asia/Ho_Chi_Minh` trong [6:00, 22:00]; `nextAllowedTime()` trả về Date hợp lệ kế tiếp)
- [x] 4.5 Tạo `src/lib/zalo/template.ts` (`renderInvoiceCard(hoaDon, khachThue, settings)` build payload Zalo OA message — card layout với logo, lời chào, bảng chi tiết, hạn thanh toán, ghi chú, CTA button trỏ tới `/hoa-don/{id}`)
- [x] 4.6 Tạo `src/lib/zalo/errors.ts` (định nghĩa `ZaloConfigError`, `ZaloApiError`, map errorCode terminal: `user_not_follower`, `invalid_template`, `access_denied`)
- [x] 4.7 Tạo `src/lib/zalo/send.ts` (`sendInvoiceMessage(...)` orchestrator: check time-gate → nếu out of hours create log `queued`; nếu trong giờ gọi client → tạo log `sent`/`failed`; mọi nhánh trả về log entry)
- [ ] 4.8 Viết unit test cho `time-gate.ts` và `template.ts` (`__tests__/zalo/*.test.ts`, optional)

## 5. M1 — API gửi hóa đơn thủ công

- [x] 5.1 Tạo `src/app/api/zalo/send-invoice/route.ts` (POST body `{hoaDonId, mode?}`; check session admin/chuNha; load hóa đơn + khách thuê + settings; gọi `sendInvoiceMessage`; trả log)
- [x] 5.2 Xử lý `mode='preview'`: gửi tới `zaloUserId` của session.user thay vì khách thuê (lookup `NguoiDung` → `zaloUserId`); set `recipientType='owner_preview'`
- [x] 5.3 Xử lý error: 404 nếu hóa đơn không tồn tại; 400 nếu khách không có `zaloUserId`; 500 với errorMessage Zalo nếu fail

## 6. M1 — Trang Cài đặt phiếu thu

- [x] 6.1 Tạo `src/app/(dashboard)/dashboard/cai-dat-hoa-don/page.tsx` layout theo ảnh
- [x] 6.2 Form các toggle/input: `ngayLapHoaDon` (number 1-31), `hanDongTien` (number 1-31), info box màu xanh giải thích
- [x] 6.3 Section "Gửi hóa đơn tự động qua Zalo": toggle + cảnh báo "Tính năng chỉ hoạt động khi bạn dùng gói có phí" + "Chỉ gửi 6h-22h"
- [x] 6.4 Button "Gửi xem trước" (mở dialog gửi thử, gọi `POST /api/zalo/send-invoice` với `mode='preview'`)
- [x] 6.5 Button "Xem hình mẫu gửi zalo" (modal preview UI điện thoại — component `ZaloPreviewModal`)
- [x] 6.6 Toggles `hienMaQR`, `phanLoaiThuChi`, `lamTronHoaDon` (với mô tả + ví dụ làm tròn)
- [x] 6.7 Select `hinhThucThanhToanMacDinh` (Tiền mặt / Chuyển khoản / MoMo / VNPay / Khác)
- [x] 6.8 Textarea `ghiChuMacDinh` (placeholder: "Ví dụ: Các vi phạm khi đóng tiền trễ hạn…")
- [x] 6.9 Nút "Lưu" → PUT `/api/cai-dat-hoa-don`, toast success
- [x] 6.10 Component `ZaloPreviewModal` (`src/components/zalo-preview-modal.tsx`) hiển thị mockup điện thoại như ảnh 3, side panel chú ý, input số nhận thử, button "Gửi xem trước"
- [x] 6.11 Thêm link "Cài đặt phiếu thu" vào sidebar (nhóm "Cài đặt")

## 7. M2 — API log

- [x] 7.1 Tạo `src/app/api/zalo/logs/route.ts` (GET query: `year`, `month`, `phongId`, `status`, `page`, `limit`; populate `khachThueId.hoTen`, `phongId.maPhong`, `hoaDonId.maHoaDon`)
- [x] 7.2 Trả thêm aggregate: `successCount`, `failedCount` trong tháng đang xem
- [x] 7.3 Endpoint `POST /api/zalo/logs/[id]/resend` → reset `retryCount=0`, `status='queued'`, gọi `sendInvoiceMessage`

## 8. M2 — Trang Lịch sử Zalo

- [x] 8.1 Tạo `src/app/(dashboard)/dashboard/zalo-history/page.tsx`
- [x] 8.2 Component thanh chọn năm/tháng (Năm trước ← T.1..T.12 → Năm tới, highlight tháng hiện tại, click chuyển tháng)
- [x] 8.3 Filter dropdown "Lọc theo phòng" + date picker
- [x] 8.4 2 chip filter "Đã gửi thành công (N)" + "Đã gửi thất bại (N)" với count động
- [x] 8.5 Nút "Gửi thử hóa đơn qua ZALO" (vàng, mở dialog dùng lại `ZaloPreviewModal`)
- [x] 8.6 Nút "Bật/tắt tính năng gửi hóa đơn qua ZALO" (xanh, toggle master switch — confirm dialog)
- [x] 8.7 Bảng list entries (Khách thuê, Phòng, Mã HD, Thời gian, Trạng thái badge, Lỗi, Hành động)
- [x] 8.8 Empty state với illustration "Bạn chưa gửi tin nhắn Zalo nào"
- [x] 8.9 Nút "Gửi lại" trên row failed → call resend API
- [x] 8.10 Modal chi tiết tin (template render, requestPayload, responsePayload, history retry)
- [x] 8.11 Thêm link "Lịch sử Zalo" vào sidebar (nhóm "Vận hành" hoặc "Tài chính")

## 9. M3 — Migration KhachThue & follow OA flow

- [x] 9.1 Bổ sung `zaloUserId?: string` và `daQuanTamOA: boolean (default false)` vào `src/models/KhachThue.ts`
- [x] 9.2 Bổ sung type tương ứng vào `src/types/index.ts`
- [x] 9.3 Tạo `src/app/api/zalo/oa-link/route.ts` (GET trả URL Zalo OA + URL QR ảnh để admin gửi cho khách)
- [x] 9.4 UI trang khách thuê: badge "Chưa quan tâm OA" nếu `daQuanTamOA=false`, nút "Sao chép link mời" / "Hiện QR mời"
- [x] 9.5 Helper `findKhachThueByPhone(phone)` để webhook map `zaloUserId` → khách thuê qua số điện thoại

## 10. M3 — Webhook & auto-send & cron

- [x] 10.1 Tạo `src/app/api/zalo/webhook/route.ts` (POST nhận event, verify HMAC SHA-256 signature header `X-ZEvent-Signature` với `ZALO_OA_SECRET_KEY`; sai → 401)
- [x] 10.2 Xử lý event `follow`: lookup khách bằng phone trong payload → update `zaloUserId`, `daQuanTamOA=true`
- [x] 10.3 Xử lý event `unfollow`: set `daQuanTamOA=false`
- [x] 10.4 Xử lý event `user_send_text`: log vào collection riêng (optional) hoặc no-op
- [x] 10.5 Trong `src/app/api/hoa-don/route.ts` POST: sau khi save, đọc `caiDatHoaDon`; nếu `autoSendZalo=true` và khách có `zaloUserId` → gọi `sendInvoiceMessage` với `waitUntil` từ `@vercel/functions` (fallback: tạo log `queued` để cron xử lý)
- [x] 10.6 Tạo `src/app/api/zalo/retry/route.ts` (POST — cron endpoint): lấy tối đa 50 entries với `status in ['queued','failed']` AND `nextRetryAt <= now` AND `retryCount < 3` AND `errorCode NOT IN terminal`; gọi `sendInvoiceMessage` cho từng entry; cập nhật retryCount, nextRetryAt (5/15/60 min); trả summary
- [x] 10.7 Bổ sung cron vào `vercel.json`: `{ "crons": [{ "path": "/api/zalo/retry", "schedule": "*/5 * * * *" }] }` (chỉ Pro plan; nếu Hobby giảm còn `0 */1 * * *`)
- [x] 10.8 Document fallback cron cho user Hobby plan (cron-job.org POST mỗi 5 phút) trong README

## 11. Verification & hardening

- [x] 11.1 `npm run build` xanh, không có lỗi TS
- [ ] 11.2 Manual test M1: cập nhật cấu hình, gửi xem trước → nhận tin trên Zalo OA
- [ ] 11.3 Manual test M2: tạo vài log fake, mở `/dashboard/zalo-history`, filter theo tháng/phòng, bấm Resend
- [ ] 11.4 Manual test M3: tạo hóa đơn mới với `autoSendZalo=true` → kiểm tra log có entry `trigger='auto'`
- [ ] 11.5 Manual test webhook: dùng curl/Postman gửi mock event `follow` với signature đúng/sai
- [x] 11.6 Backup DB trước khi deploy production (`npm run db:backup`)
- [x] 11.7 Cập nhật `README.md` mục "Cấu hình Zalo OA" hướng dẫn đăng ký + set env vars
- [x] 11.8 Cập nhật `.vercelignore` nếu cần (mock data, fixtures)
