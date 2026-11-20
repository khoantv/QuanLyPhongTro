## ADDED Requirements

### Requirement: Trang bảng thu tiền tháng

Hệ thống SHALL có trang `/dashboard/bang-thu-tien` hiển thị một dòng cho mỗi phòng của tòa nhà đang chọn trong tháng/năm đang chọn, dữ liệu lấy từ `GET /api/bang-thu-tien?toaNha&thang&nam`. Trang SHALL có bộ chọn tòa nhà, tháng/năm, và ô tìm theo phòng/tên.

#### Scenario: Mở trang tháng có hóa đơn

- **WHEN** admin mở bảng thu tiền tháng 10/2026 của tòa nhà có 33 phòng
- **THEN** bảng có 33 dòng sắp theo mã phòng, các phòng đã lập hóa đơn hiển thị đủ số liệu

#### Scenario: Phòng trống

- **WHEN** một phòng không có hợp đồng hoạt động trong tháng (vd phòng 30)
- **THEN** dòng hiển thị tên trống, các khoản tiền 0đ và nhãn "Phòng trống"

#### Scenario: Phòng có hai hợp đồng trong tháng

- **WHEN** phòng có khách cũ chuyển đi và khách mới vào trong cùng tháng
- **THEN** bảng hiển thị hai dòng con cho phòng đó (hóa đơn chốt của khách cũ và hóa đơn của khách mới)

### Requirement: Các cột của bảng thu tiền

Bảng SHALL có các cột: Phòng, Họ tên người đại diện, Số điện thoại, Số người ở, Ngày thu, Số điện tiêu thụ, Số nước tiêu thụ, Chỉ số điện cũ/mới, Chỉ số nước cũ/mới, Tiền phòng (gồm tiền phòng lẻ), Phí dịch vụ, Nợ kỳ trước, Số tiền cần đóng (`tongCanThanhToan`), Số tiền đã đóng, Còn thiếu. Cột Phòng và Họ tên SHALL cố định khi cuộn ngang.

#### Scenario: Dòng có tiền phòng lẻ

- **WHEN** khách mới vào giữa kỳ, hóa đơn có tiền phòng lẻ 480.000đ và tiền phòng kỳ 900.000đ
- **THEN** cột Tiền phòng hiển thị 1.380.000đ kèm tooltip tách hai khoản

### Requirement: Cột "Đã đóng" và "Còn thiếu"

"Số tiền đã đóng" SHALL bằng tổng thanh toán của khách từ ngày lập hóa đơn tháng này đến trước ngày lập hóa đơn kỳ sau; "Còn thiếu" SHALL bằng "Cần đóng" − "Đã đóng" + tổng bút toán `boQuaTienThua` cùng khoảng (âm khi đóng thừa và trừ kỳ sau; 0đ kèm nhãn "Thừa X (không trừ)" khi không trừ). Nền SHALL xanh khi còn thiếu ≤ 0, vàng khi đóng một phần, đỏ khi chưa đóng và quá hạn.

#### Scenario: Đóng thừa, trừ vào kỳ sau

- **WHEN** phòng 20 cần đóng 1.084.000đ, đã đóng 1.100.000đ, thanh toán chọn `truKySau`
- **THEN** cột Còn thiếu hiển thị −16.000đ, nền xanh

#### Scenario: Đóng thừa, không trừ

- **WHEN** phòng 20 cần đóng 1.084.000đ, đã đóng 1.100.000đ, thanh toán chọn `khongTru`
- **THEN** cột Còn thiếu hiển thị 0đ với nhãn "Thừa 16.000đ (không trừ)", nền xanh

#### Scenario: Chưa đóng

- **WHEN** phòng 7 cần đóng 1.176.000đ, chưa đóng, đã quá hạn
- **THEN** cột Đã đóng 0đ, Còn thiếu 1.176.000đ, nền đỏ

### Requirement: Nhập chỉ số điện nước hàng loạt

Trang bảng thu tiền SHALL cho phép nhập trực tiếp chỉ số điện mới và nước mới trên từng dòng cho các phòng chưa lập hóa đơn tháng đó; số tiêu thụ và số tiền cần đóng (dự kiến) SHALL cập nhật ngay trên giao diện. Nút "Lưu chỉ số" SHALL gọi `POST /api/bang-thu-tien/chi-so` để upsert `ChiSoDienNuoc` cho tất cả dòng đã nhập. Chỉ số mới nhỏ hơn chỉ số cũ SHALL được tô đỏ và không được lưu.

#### Scenario: Nhập chỉ số cả tòa

- **WHEN** admin nhập chỉ số mới cho 32 phòng và bấm "Lưu chỉ số"
- **THEN** 32 bản ghi `ChiSoDienNuoc` tháng đó được tạo/cập nhật, toast "Đã lưu chỉ số 32 phòng"

#### Scenario: Chỉ số sai

- **WHEN** nhập chỉ số điện mới 6.000 cho phòng có chỉ số cũ 6.122
- **THEN** ô được tô đỏ với tooltip "Nhỏ hơn chỉ số cũ", dòng đó bị bỏ qua khi lưu và được liệt kê trong thông báo

### Requirement: Lập hóa đơn hàng loạt từ bảng

Trang SHALL có nút "Lập hóa đơn" gọi `POST /api/bang-thu-tien/lap-hoa-don` với danh sách hợp đồng được chọn (mặc định: các dòng đã có chỉ số và chưa có hóa đơn), dùng chung hàm lập hóa đơn với `invoice-generation`. Kết quả SHALL báo số hóa đơn đã lập và danh sách lỗi theo phòng.

#### Scenario: Lập hóa đơn cho các phòng đủ chỉ số

- **WHEN** admin bấm "Lập hóa đơn" khi 30 phòng có chỉ số, 2 phòng chưa
- **THEN** lập 30 hóa đơn; thông báo liệt kê 2 phòng thiếu chỉ số

### Requirement: Thu tiền nhanh trên bảng

Mỗi dòng SHALL có nút "Thu tiền" mở dialog nhập số tiền (mặc định bằng "Còn thiếu" nếu dương), phương thức (mặc định theo `hinhThucThanhToanMacDinh`), ngày thu, ghi chú; gửi `POST /api/thanh-toan` theo `khachThueId`. Sau khi lưu, dòng SHALL cập nhật Đã đóng / Còn thiếu mà không tải lại cả trang.

#### Scenario: Thu đủ

- **WHEN** admin bấm Thu tiền trên phòng 7 và xác nhận số mặc định 1.176.000đ
- **THEN** dòng phòng 7 chuyển Đã đóng 1.176.000đ, Còn thiếu 0đ, nền xanh

### Requirement: Dòng tổng và xuất Excel

Bảng SHALL có dòng tổng cuối: tổng số điện, số nước, tiền phòng, phí dịch vụ, cần đóng, đã đóng, còn thiếu. Nút "Xuất Excel" SHALL tải file `.xlsx` (`GET /api/bang-thu-tien/export`) có cùng cột, định dạng tiền VND và màu nền như trên màn hình. Chỉ role `admin` / `chuNha` / `nhanVien` được xem; chỉ `admin` / `chuNha` được thu tiền và lập hóa đơn từ trang này.

#### Scenario: Xuất file

- **WHEN** admin bấm "Xuất Excel" tháng 10/2026
- **THEN** trình duyệt tải `bang-thu-tien-<toa-nha>-10-2026.xlsx` với một dòng mỗi phòng và dòng tổng
