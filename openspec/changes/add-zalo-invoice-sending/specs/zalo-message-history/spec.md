## ADDED Requirements

### Requirement: Collection log tin Zalo

Hệ thống SHALL có collection `ZaloMessageLog` ghi nhận mọi lần thử gửi tin Zalo. Mỗi document chứa tối thiểu:

- `hoaDonId: ObjectId` (ref HoaDon, optional nếu là preview)
- `khachThueId: ObjectId` (ref KhachThue, optional nếu là owner preview)
- `phongId: ObjectId` (ref Phong, optional)
- `recipientType: 'tenant' | 'owner_preview'`
- `recipientZaloUserId: string`
- `trigger: 'auto' | 'manual' | 'preview' | 'retry'`
- `status: 'queued' | 'sent' | 'failed' | 'failed_permanent' | 'skipped'`
- `sentAt: Date | null`
- `errorCode: string | null`
- `errorMessage: string | null`
- `zaloMessageId: string | null` (ID Zalo trả về sau khi gửi thành công)
- `retryCount: number` (default 0)
- `nextRetryAt: Date | null`
- `requestPayload: object` (template + variables thực tế đã render)
- `responsePayload: object | null` (response từ Zalo)
- `ngayTao: Date`, `ngayCapNhat: Date`

#### Scenario: Mỗi attempt là 1 entry mới

- **WHEN** retry lần 1 cho 1 hóa đơn đã có entry status=failed
- **THEN** **CẬP NHẬT** entry hiện hữu (retryCount++, status mới), KHÔNG tạo entry mới — để dễ xem lịch sử attempt theo hóa đơn

#### Scenario: Index để query theo tháng/phòng

- **WHEN** schema được khởi tạo
- **THEN** có index `{ phongId: 1, sentAt: -1 }` và `{ status: 1, nextRetryAt: 1 }` (cho cron) và `{ sentAt: -1 }`

### Requirement: Trang Lịch sử Zalo

Hệ thống SHALL có trang `/dashboard/zalo-history` hiển thị:

- Tiêu đề "Lịch sử gửi hóa đơn qua Zalo cho khách thuê"
- Thanh chọn tháng: "Năm trước ←" / T.1 / T.2 / ... / T.12 / "Năm tới →"; default highlight tháng hiện tại
- Dropdown "Lọc theo phòng" (kèm "Tất cả")
- Date picker (chọn ngày trong tháng)
- 2 chip filter: "Đã gửi thành công (N)", "Đã gửi thất bại (N)" — bấm để filter theo status
- 2 button góc phải: "Gửi thử hóa đơn qua ZALO" (vàng), "Bật/tắt tính năng gửi hóa đơn qua ZALO" (xanh)
- Bảng/danh sách entries: cột Khách thuê, Phòng, Mã hóa đơn, Thời gian gửi, Trạng thái (badge màu), Lỗi (nếu có), Hành động (nút Resend / Xem chi tiết)
- Empty state khi không có data: ảnh + text "Bạn chưa gửi tin nhắn Zalo nào"

#### Scenario: Mở trang lần đầu

- **WHEN** admin truy cập `/dashboard/zalo-history` tháng 06/2026
- **THEN** trang hiện T.6 được highlight, list tin có `sentAt` trong tháng 6/2026, đếm chip success/failed đúng

#### Scenario: Chuyển sang năm trước

- **WHEN** admin bấm "← Năm trước"
- **THEN** thanh tháng chuyển sang 2025, mặc định chọn tháng tương ứng hoặc T.12 (latest)

#### Scenario: Filter theo phòng

- **WHEN** admin chọn phòng P101
- **THEN** list chỉ còn entries có `phongId === P101._id`

### Requirement: Nút "Gửi thử hóa đơn qua ZALO"

Hệ thống SHALL có nút (cả ở trang Lịch sử Zalo và trang Cài đặt phiếu thu) mở dialog:

- Cho phép chọn 1 hóa đơn có sẵn từ dropdown (hoặc dùng hóa đơn mẫu nếu chưa có)
- Cho phép sửa số Zalo nhận thử (default: số của chủ trọ đang đăng nhập)
- Hiển thị preview UI điện thoại (modal "Mẫu gửi Zalo" như ảnh)
- Bấm "Gửi xem trước" → gọi `POST /api/zalo/send-invoice` với `mode='preview'`

#### Scenario: Bấm gửi thử thành công

- **WHEN** chủ trọ nhập số Zalo đã follow OA và bấm Gửi
- **THEN** API trả 200, toast "Đã gửi tin thử, kiểm tra Zalo của bạn"

#### Scenario: Số Zalo chưa follow OA

- **WHEN** số Zalo nhập chưa quan tâm OA
- **THEN** API trả lỗi, modal hiển thị "Số này chưa quan tâm Zalo OA — vui lòng quan tâm trước"

### Requirement: Nút "Bật/tắt tính năng gửi qua Zalo"

Hệ thống SHALL có toggle master ở trang Lịch sử Zalo. Toggle này ánh xạ 1-1 với field `autoSendZalo` trong `CaiDatHoaDon`. Khi đổi state → confirm dialog "Bạn có chắc muốn bật/tắt?" → PUT cấu hình.

#### Scenario: Tắt feature

- **WHEN** admin bấm toggle đang ON, confirm "Có"
- **THEN** `caiDatHoaDon.autoSendZalo = false`, hóa đơn mới sẽ không tự động gửi Zalo

### Requirement: Nút Resend cho tin failed

Hệ thống SHALL có nút "Gửi lại" trên mỗi entry có `status` thuộc `['failed', 'failed_permanent', 'skipped']`. Bấm → gọi `POST /api/zalo/send-invoice` với `hoaDonId` của entry, reset `retryCount=0` và `status='queued'` trước khi gửi.

#### Scenario: Resend thành công

- **WHEN** admin bấm Gửi lại cho entry status=failed_permanent (sau khi đã fix vấn đề ngoài hệ thống)
- **THEN** entry được retry, nếu Zalo OK → status=`sent` và toast hiện thông báo

### Requirement: Xem chi tiết tin

Hệ thống SHALL cho phép click vào 1 entry để mở modal chi tiết hiển thị: template message đã render (text/JSON), `requestPayload`, `responsePayload`, errorCode + errorMessage, lịch sử retry.

#### Scenario: Click vào entry failed

- **WHEN** admin click 1 dòng có lỗi
- **THEN** modal hiện template đầy đủ + error log + nút "Sao chép errorMessage để báo dev"

### Requirement: Phân quyền xem lịch sử

Hệ thống SHALL chỉ cho user role `admin` / `chuNha` truy cập `/dashboard/zalo-history` và endpoint `GET /api/zalo/logs`. User khác bị từ chối HTTP 403 / redirect về dashboard.

#### Scenario: Nhân viên truy cập

- **WHEN** user role `nhanVien` mở `/dashboard/zalo-history`
- **THEN** redirect về `/dashboard` hoặc hiện "Không có quyền truy cập"
