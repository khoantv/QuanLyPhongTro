## ADDED Requirements

### Requirement: Service Zalo OA tập trung

Hệ thống SHALL có 1 module duy nhất `src/lib/zalo/` đóng vai trò wrapper cho Zalo Official Account REST API. Mọi nơi trong codebase muốn gửi tin Zalo phải gọi qua module này — không gọi `fetch` trực tiếp đến `openapi.zalo.me`. Module export tối thiểu: `sendInvoiceMessage(hoaDon, khachThue, settings)`, `refreshAccessToken()`, `isWithinAllowedHours()`.

#### Scenario: Gọi trực tiếp API Zalo bị forbidden

- **WHEN** code review thấy `fetch('https://openapi.zalo.me/...')` ở file ngoài `src/lib/zalo/`
- **THEN** đây là violation — phải refactor để gọi qua service

#### Scenario: Service mock được trong test

- **WHEN** chạy unit test cho hook auto-send
- **THEN** test có thể mock `sendInvoiceMessage` mà không cần token thật

### Requirement: Cấu hình Zalo OA token qua env

Hệ thống SHALL đọc Zalo OA credentials từ env vars: `ZALO_OA_APP_ID`, `ZALO_OA_SECRET_KEY`, `ZALO_OA_ACCESS_TOKEN`, `ZALO_OA_REFRESH_TOKEN`. Không hardcode trong code, không lưu plaintext trong DB. Access token có thể được refresh và cache trong memory + lưu lại file/DB để các instance khác đọc.

#### Scenario: Thiếu token khi gửi

- **WHEN** `ZALO_OA_ACCESS_TOKEN` không có hoặc rỗng và service được gọi
- **THEN** service throw `ZaloConfigError("Chưa cấu hình Zalo OA access token")` và caller phải log/skip

#### Scenario: Access token hết hạn

- **WHEN** Zalo API trả lỗi `code=-216` (token expired)
- **THEN** service tự gọi `refreshAccessToken()` rồi retry 1 lần; nếu vẫn fail thì throw

### Requirement: Khung giờ gửi 6h-22h theo giờ VN

Hệ thống SHALL chỉ thực sự gọi Zalo API trong khung `[06:00, 22:00]` theo timezone `Asia/Ho_Chi_Minh`. Ngoài khung giờ, tin được lưu vào queue (collection `ZaloMessageLog` với status=`queued`) để cron retry chạy khi đến giờ hợp lệ.

#### Scenario: Trong khung giờ

- **WHEN** giờ VN là 10:30 và service được gọi
- **THEN** API Zalo được gọi ngay, log status=`sent` hoặc `failed`

#### Scenario: Ngoài khung giờ

- **WHEN** giờ VN là 23:30 hoặc 03:00 và service được gọi
- **THEN** không gọi Zalo, tạo log với status=`queued`, retryAt = ngày hiện tại hoặc hôm sau lúc 06:05

#### Scenario: Đến giờ chạy retry

- **WHEN** cron `/api/zalo/retry` chạy lúc 06:10 và có tin status=`queued` retryAt <= now
- **THEN** cron lấy tối đa 50 tin một lần, gọi service gửi từng tin, cập nhật log

### Requirement: Template message dạng card hóa đơn

Hệ thống SHALL gửi tin Zalo dạng `consultation_request` (hoặc template tương đương được Zalo duyệt) với layout:

- Logo + tên OA
- Lời chào: `Xin chào {hoTenKhach},`
- Tiêu đề: `Hóa đơn tiền thuê nhà tháng {MM/YYYY} từ nhà trọ {tenNhaTro}`
- Bảng chi tiết: Mã hóa đơn, Mã thanh toán, Tiền phòng - cọc, Tiền điện (chỉ số cũ - mới, giá), Tiền nước, Dịch vụ khác, Cộng/Giảm trừ, **Tổng tiền** (bold)
- Hạn thanh toán: `Hạn thanh toán hóa đơn trước ngày DD/MM/YYYY`
- Ghi chú: nội dung từ `caiDatHoaDon.ghiChuMacDinh` (nếu có)
- Button CTA: "XÁC NHẬN THANH TOÁN" → link tới `/hoa-don/{id}` trang public

#### Scenario: Render template với data thật

- **WHEN** gửi hóa đơn `#T000123` cho khách "Nguyễn Văn A" phòng P101 tháng 06/2026
- **THEN** tin Zalo có đầy đủ các trường trên, format tiền VND có dấu chấm phân cách, ngày DD/MM/YYYY

#### Scenario: Hóa đơn không có dịch vụ khác

- **WHEN** hóa đơn chỉ có tiền phòng + điện + nước, không có dịch vụ
- **THEN** dòng "Dịch vụ khác" hiển thị "0đ" hoặc ẩn hoàn toàn

### Requirement: API gửi hóa đơn thủ công

Hệ thống SHALL expose `POST /api/zalo/send-invoice` nhận body `{ hoaDonId: string, mode?: 'send' | 'preview' }`:

- `mode='send'` (default): gửi đến khách thuê chính của phòng (`zaloUserId` của khách)
- `mode='preview'`: gửi đến `zaloUserId` của user đang đăng nhập (chủ trọ) để xem thử

Trả về log entry vừa tạo.

#### Scenario: Gửi manual thành công

- **WHEN** admin POST với `hoaDonId` hợp lệ, khách có `zaloUserId`, trong khung giờ
- **THEN** API trả 200 với `{ success: true, log: { _id, status: 'sent', sentAt } }`

#### Scenario: Preview cho chủ trọ

- **WHEN** chủ trọ POST với `mode='preview'`
- **THEN** tin được gửi vào Zalo của chính chủ trọ, log có `recipientType='owner_preview'`

#### Scenario: Hóa đơn không tồn tại

- **WHEN** POST với `hoaDonId` không có trong DB
- **THEN** API trả 404 `{ message: 'Hóa đơn không tồn tại' }`

### Requirement: Hook tự động sau khi tạo hóa đơn

Hệ thống SHALL chèn hook trong `POST /api/hoa-don` (sau khi save thành công): nếu `caiDatHoaDon.autoSendZalo === true` và `khachThue.zaloUserId` tồn tại → gọi `zalo.sendInvoiceMessage(...)` async (không block response). Lỗi từ Zalo không làm fail việc tạo hóa đơn.

#### Scenario: Auto-send khi tạo hóa đơn

- **WHEN** `autoSendZalo=true` và tạo hóa đơn cho khách có `zaloUserId='abc123'`
- **THEN** hóa đơn được tạo (HTTP 201), đồng thời 1 entry trong `ZaloMessageLog` với `trigger='auto'`, `hoaDonId` mới

#### Scenario: Zalo fail không phá hủy hóa đơn

- **WHEN** Zalo API trả error 500
- **THEN** hóa đơn vẫn được tạo thành công (HTTP 201), log có status=`failed`, errorMessage được lưu để retry sau

### Requirement: Follow OA flow cho khách thuê

Hệ thống SHALL cung cấp:

- Field `zaloUserId?: string` và `daQuanTamOA: boolean` trong model `KhachThue`
- Endpoint `GET /api/zalo/oa-link?khachThueId=...` trả về link Zalo OA + QR để admin gửi cho khách quan tâm
- Webhook xử lý event `follow` từ Zalo → cập nhật `khachThueId` tương ứng với `zaloUserId` và set `daQuanTamOA=true`
- UI ở trang khách thuê: nếu `daQuanTamOA=false` → hiện badge "Chưa quan tâm OA" + nút "Sao chép link mời"

#### Scenario: Khách quan tâm OA

- **WHEN** khách click link OA và bấm "Quan tâm"
- **THEN** Zalo webhook event `follow` trigger, hệ thống cập nhật `KhachThue` với `zaloUserId` từ payload, set `daQuanTamOA=true`

#### Scenario: Gửi tin cho khách chưa follow

- **WHEN** Zalo API trả `code=-32` (user chưa follow OA)
- **THEN** log status=`failed`, errorCode=`user_not_follower`, **không retry** (vô ích)

### Requirement: Webhook nhận event từ Zalo

Hệ thống SHALL expose `POST /api/zalo/webhook` xử lý event từ Zalo, ít nhất: `follow`, `unfollow`, `user_send_text`. Webhook MUST verify signature bằng `ZALO_OA_SECRET_KEY` (HMAC SHA-256 của body) — request không hợp lệ trả HTTP 401.

#### Scenario: Event follow hợp lệ

- **WHEN** Zalo POST event `follow` với signature đúng
- **THEN** hệ thống cập nhật `daQuanTamOA=true` cho khách (lookup theo phone match) và trả HTTP 200

#### Scenario: Signature sai

- **WHEN** request đến webhook với header `X-ZEvent-Signature` không khớp
- **THEN** trả HTTP 401 `{ message: 'Invalid signature' }` và không xử lý payload

### Requirement: Retry tin failed

Hệ thống SHALL có endpoint `POST /api/zalo/retry` (chạy bằng Vercel Cron hoặc cron ngoài) lấy các log `status='failed'` hoặc `'queued'` với điều kiện:

- `retryCount < 3`
- `nextRetryAt <= now`
- `errorCode` không thuộc danh sách terminal: `['user_not_follower', 'invalid_template', 'access_denied']`

Mỗi lần retry tăng `retryCount`, set `nextRetryAt = now + [5min, 15min, 60min][retryCount-1]`.

#### Scenario: Retry tin tạm thời fail

- **WHEN** log có `status=failed`, `errorCode='rate_limit'`, `retryCount=0`
- **THEN** cron gọi lại service; nếu thành công → status=`sent`; nếu fail tiếp → retryCount=1, nextRetryAt = now + 5min

#### Scenario: Đã retry 3 lần

- **WHEN** `retryCount=3` và vẫn failed
- **THEN** cron không retry nữa, log giữ status=`failed_permanent`

#### Scenario: Terminal error không retry

- **WHEN** errorCode='user_not_follower'
- **THEN** cron skip ngay, log giữ status=`failed_permanent`
