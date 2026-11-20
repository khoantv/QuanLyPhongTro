## ADDED Requirements

### Requirement: Singleton cấu hình phiếu thu

Hệ thống SHALL lưu cấu hình phiếu thu/hóa đơn dưới dạng singleton (duy nhất 1 document) trong collection `CaiDatHoaDon`. Mọi API đọc/ghi đều thao tác trên cùng 1 record; nếu chưa tồn tại thì auto-create với giá trị mặc định.

#### Scenario: Lần đầu truy cập trang cài đặt

- **WHEN** người dùng admin mở `/dashboard/cai-dat-hoa-don` và chưa có record cấu hình
- **THEN** hệ thống tạo record mới với defaults (`ngayLapHoaDon=null → cuối tháng`, `hanDongTien=5`, `lamTronHoaDon=false`, `hienMaQR=true`, `autoSendZalo=false`, `hinhThucThanhToanMacDinh='tienMat'`, `ghiChuMacDinh=''`) và trả về cho client

#### Scenario: Cập nhật cấu hình

- **WHEN** admin gửi `PUT /api/cai-dat-hoa-don` với body chứa các field hợp lệ
- **THEN** hệ thống upsert lên singleton record và trả về cấu hình mới sau cập nhật

### Requirement: Field "Ngày lập hóa đơn"

Hệ thống SHALL cho phép cấu hình ngày lập hóa đơn trong khoảng `[1, 31]`. Nếu để trống/null, mặc định là **ngày cuối cùng của tháng**. Giá trị này được dùng để xác định ngày auto-generate hóa đơn hàng tháng và làm điểm bắt đầu cho `hanDongTien`.

#### Scenario: Nhập ngày hợp lệ

- **WHEN** admin nhập `ngayLapHoaDon = 10`
- **THEN** hệ thống chấp nhận và mỗi tháng đến ngày 10 sẽ phát thông báo nhắc lập hóa đơn

#### Scenario: Để trống

- **WHEN** admin không nhập (`ngayLapHoaDon = null`)
- **THEN** hệ thống dùng "ngày cuối tháng" — vd tháng 2 thường là ngày 28/29, tháng 4 là 30

#### Scenario: Nhập ngoài [1,31]

- **WHEN** admin nhập `ngayLapHoaDon = 32` hoặc `0`
- **THEN** API trả về HTTP 400 với message "Ngày lập hóa đơn phải từ 1 đến 31"

### Requirement: Field "Hạn đóng tiền"

Hệ thống SHALL cho phép cấu hình `hanDongTien` (số nguyên, đơn vị: ngày) là **số ngày sau ngày lập hóa đơn**. Hạn đóng tiền của một hóa đơn = `ngayLapHoaDon + hanDongTien`. Giá trị tối thiểu 1, tối đa 31.

#### Scenario: Ví dụ minh họa

- **WHEN** admin set `ngayLapHoaDon = 1`, `hanDongTien = 5`
- **THEN** hóa đơn lập ngày 01/MM có hạn đóng là ngày 06/MM

### Requirement: Toggle "Gửi hóa đơn tự động qua Zalo"

Hệ thống SHALL có flag boolean `autoSendZalo`. Khi `true`, mỗi hóa đơn mới được tạo (qua `POST /api/hoa-don`) tự động enqueue gửi tin Zalo đến khách thuê chính của phòng đó.

#### Scenario: Master switch ON, tạo hóa đơn mới

- **WHEN** `autoSendZalo=true` và admin tạo 1 hóa đơn cho khách có `zaloUserId`
- **THEN** hệ thống enqueue tin Zalo và ghi log với `trigger='auto'`

#### Scenario: Master switch OFF

- **WHEN** `autoSendZalo=false` và admin tạo hóa đơn
- **THEN** không có tin Zalo nào được gửi — chỉ tạo hóa đơn

#### Scenario: Khách chưa quan tâm OA

- **WHEN** `autoSendZalo=true` nhưng khách thuê chính không có `zaloUserId`
- **THEN** hệ thống ghi log status=`skipped` với reason=`khach_chua_quan_tam_oa`, không retry

### Requirement: Toggle "Ẩn/Hiện mã QR thanh toán"

Hệ thống SHALL có flag boolean `hienMaQR`. Khi `true`, template hóa đơn (cả PDF in và tin Zalo) hiển thị mã QR thanh toán chuyển khoản; khi `false`, ẩn QR.

#### Scenario: Hiện QR

- **WHEN** `hienMaQR=true`
- **THEN** template tin Zalo có vùng chứa QR code với số tiền + nội dung chuyển khoản

#### Scenario: Ẩn QR

- **WHEN** `hienMaQR=false`
- **THEN** template tin Zalo không có vùng QR

### Requirement: Toggle "Phân loại thu/chi từ hóa đơn"

Hệ thống SHALL có flag `phanLoaiThuChi`. Khi `true`, khi tạo hóa đơn hệ thống tách các khoản thành phiếu thu/chi riêng (tiền phòng, dịch vụ, giảm trừ, cộng thêm); khi `false`, gom thành 1 phiếu thu tổng.

#### Scenario: Phân loại ON

- **WHEN** `phanLoaiThuChi=true` và hóa đơn có nhiều khoản
- **THEN** hệ thống tạo n phiếu thu chi riêng biệt liên kết cùng `hoaDonId`

### Requirement: Toggle "Làm tròn hóa đơn"

Hệ thống SHALL có flag `lamTronHoaDon`. Khi `true`, tổng tiền hóa đơn được làm tròn về đơn vị 1.000đ theo quy tắc: phần dư trong khoảng `[1, 500]` → làm tròn xuống, `[501, 999]` → làm tròn lên.

#### Scenario: Làm tròn xuống

- **WHEN** `lamTronHoaDon=true`, tổng tiền = 4.300đ
- **THEN** tổng sau làm tròn = 4.000đ

#### Scenario: Mốc 500đ làm tròn xuống

- **WHEN** `lamTronHoaDon=true`, tổng tiền = 4.500đ
- **THEN** tổng sau làm tròn = 4.000đ

#### Scenario: Làm tròn lên

- **WHEN** `lamTronHoaDon=true`, tổng tiền = 4.600đ hoặc 4.800đ
- **THEN** tổng sau làm tròn = 5.000đ

#### Scenario: Tắt làm tròn

- **WHEN** `lamTronHoaDon=false`, tổng tiền = 4.357đ
- **THEN** tổng được giữ nguyên 4.357đ

### Requirement: Field "Hình thức thanh toán mặc định"

Hệ thống SHALL cho phép chọn 1 trong các giá trị enum: `tienMat | chuyenKhoan | momo | vnpay | khac`. Khi tạo hóa đơn mới, field hình thức thanh toán được pre-fill bằng giá trị này.

#### Scenario: Mặc định tiền mặt

- **WHEN** `hinhThucThanhToanMacDinh='tienMat'` và admin mở form tạo hóa đơn
- **THEN** dropdown hình thức thanh toán có giá trị "Tiền mặt" được chọn sẵn

### Requirement: Field "Ghi chú thêm mặc định"

Hệ thống SHALL cho phép admin nhập đoạn text tùy ý làm ghi chú mặc định (tối đa 500 ký tự). Ghi chú này tự động được append vào template Zalo và hóa đơn PDF.

#### Scenario: Có ghi chú mặc định

- **WHEN** admin set `ghiChuMacDinh = "Vui lòng đóng tiền đúng hạn, cảm ơn!"`
- **THEN** mỗi hóa đơn / tin Zalo có dòng "Ghi chú: Vui lòng đóng tiền đúng hạn, cảm ơn!"

### Requirement: Trang cài đặt yêu cầu quyền admin

Hệ thống SHALL chỉ cho phép user có `role='admin'` hoặc `role='chuNha'` đọc/ghi cấu hình. User khác bị từ chối HTTP 403.

#### Scenario: Nhân viên truy cập

- **WHEN** user role `nhanVien` gọi `PUT /api/cai-dat-hoa-don`
- **THEN** API trả về HTTP 403 với message "Không có quyền truy cập"
