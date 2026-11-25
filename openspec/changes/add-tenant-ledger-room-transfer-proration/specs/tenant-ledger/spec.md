## ADDED Requirements

### Requirement: Sổ công nợ theo khách thuê

Hệ thống SHALL lưu mọi phát sinh tiền với khách thuê thành bút toán trong collection `GiaoDichCongNo`. Mỗi bút toán có `khachThue`, `loai` thuộc `hoaDon | thanhToan | giamTru | truCoc | tienCoc | hoanTien | boQuaTienThua | dieuChinh`, `soTien` có dấu khác 0 (dương = tăng nợ, âm = giảm nợ), `ngayGhiNhan`, `moTa`, `nguoiTao`, `daHuy`. Số dư của khách SHALL bằng tổng `soTien` các bút toán `daHuy = false`. Số dư dương nghĩa là khách còn nợ; số dư âm nghĩa là khách có tiền thừa.

#### Scenario: Lập hóa đơn tạo bút toán nợ

- **WHEN** hệ thống lập hóa đơn tổng 1.529.000đ cho khách "Phạm Hằng"
- **THEN** sổ công nợ có thêm bút toán `loai='hoaDon'`, `soTien=+1.529.000`, `hoaDon` trỏ tới hóa đơn đó

#### Scenario: Thu tiền tạo bút toán có

- **WHEN** admin ghi nhận khách đóng 1.529.000đ
- **THEN** sổ công nợ có thêm bút toán `loai='thanhToan'`, `soTien=−1.529.000` và số dư khách về 0

#### Scenario: Không xóa cứng bút toán

- **WHEN** admin xóa một thanh toán nhập nhầm
- **THEN** bút toán tương ứng được đánh dấu `daHuy=true` (ghi người hủy, thời điểm), không bị xóa khỏi DB, và số dư được tính lại

### Requirement: Thanh toán một phần, đóng thừa và đóng trước

Hệ thống SHALL cho phép ghi nhận thanh toán với bất kỳ số tiền dương nào cho một khách thuê, kể cả khi số tiền nhỏ hơn, bằng hoặc lớn hơn số còn nợ, và kể cả khi khách chưa có hóa đơn nào đang mở. `POST /api/thanh-toan` SHALL nhận `khachThueId` (hoặc `hoaDonId` — khi đó lấy khách từ hóa đơn); `hoaDonId` chỉ mang tính gợi ý.

#### Scenario: Đóng thiếu

- **WHEN** khách phòng 11 có hóa đơn 1.111.000đ và đóng 1.110.000đ
- **THEN** hóa đơn có `daThanhToan=1.110.000`, `conLai=1.000`, `trangThai='daThanhToanMotPhan'`, số dư khách = +1.000đ

#### Scenario: Đóng thừa

- **WHEN** khách phòng 22 có hóa đơn 1.409.500đ, đóng 1.410.000đ và chọn "Trừ vào kỳ sau"
- **THEN** API trả 200 (không từ chối), hóa đơn `trangThai='daThanhToan'`, `conLai=0`, số dư khách = −500đ (tiền thừa)

#### Scenario: Đóng trước khi có hóa đơn

- **WHEN** khách không có hóa đơn đang mở và đóng trước 500.000đ ngày 15/11
- **THEN** hệ thống ghi bút toán `thanhToan` −500.000đ, số dư khách = −500.000đ; không tạo hóa đơn

### Requirement: Lựa chọn xử lý tiền đóng thừa

Khi thanh toán có phần thừa (`soTien − max(số dư trước khi thu, 0)` > 0), hệ thống SHALL cho người dùng chọn `ThanhToan.xuLyTienThua`: `truKySau` giữ phần thừa làm tiền thừa của khách; `khongTru` ghi thêm bút toán `boQuaTienThua` dương bằng phần thừa (liên kết thanh toán) để số dư về 0. Mặc định SHALL theo `CaiDatHoaDon.xuLyTienThuaMacDinh`, riêng trường hợp khách không có nợ (đóng trước) SHALL chọn sẵn `truKySau`.

#### Scenario: Không trừ tiền thừa nhỏ

- **WHEN** phòng 20 có hóa đơn 1.084.000đ, khách đóng 1.100.000đ và người dùng chọn "Không trừ vào kỳ sau"
- **THEN** sổ công nợ có bút toán `thanhToan` −1.100.000đ và `boQuaTienThua` +16.000đ; số dư khách = 0; hóa đơn tháng sau không có dòng "Tiền thừa kỳ trước"

#### Scenario: Trừ tiền thừa vào kỳ sau

- **WHEN** cùng tình huống nhưng chọn "Trừ vào kỳ sau"
- **THEN** số dư khách = −16.000đ và hóa đơn tháng sau có "Tiền thừa kỳ trước: −16.000đ"

#### Scenario: Thanh toán không thừa

- **WHEN** số tiền thu nhỏ hơn hoặc bằng số dư nợ
- **THEN** form thu tiền không hiển thị lựa chọn xử lý tiền thừa và không ghi bút toán `boQuaTienThua`

#### Scenario: Hủy thanh toán có bỏ qua tiền thừa

- **WHEN** admin hủy thanh toán đã ghi kèm bút toán `boQuaTienThua`
- **THEN** cả hai bút toán đều được đánh dấu `daHuy=true` và số dư được tính lại

#### Scenario: Đổi lựa chọn sau khi đã thu

- **WHEN** admin sửa thanh toán từ `khongTru` sang `truKySau`
- **THEN** bút toán `boQuaTienThua` bị hủy, số dư khách trở thành âm bằng phần thừa

### Requirement: Cài đặt mặc định xử lý tiền thừa

Trang Cài đặt phiếu thu SHALL có lựa chọn "Tiền khách đóng thừa" với hai giá trị "Trừ vào kỳ sau" (`truKySau`, mặc định) và "Không trừ" (`khongTru`), lưu vào `CaiDatHoaDon.xuLyTienThuaMacDinh`. Chỉ `admin` / `chuNha` được thay đổi.

#### Scenario: Đổi mặc định

- **WHEN** admin chọn "Không trừ" và lưu
- **THEN** các lần thu tiền có phần thừa sau đó mặc định chọn "Không trừ vào kỳ sau" (người dùng vẫn đổi được từng lần)

#### Scenario: Số tiền không hợp lệ

- **WHEN** gửi `soTien <= 0`
- **THEN** API trả 400 "Số tiền phải lớn hơn 0"

### Requirement: Phân bổ FIFO và trạng thái hóa đơn suy ra

Hệ thống SHALL tính `daThanhToan`, `conLai`, `trangThai` của mọi hóa đơn bằng cách phân bổ tổng các bút toán âm của khách vào các bút toán dương theo thứ tự `ngayGhiNhan` tăng dần (cũ trước). Việc phân bổ SHALL được tính lại toàn bộ cho khách sau mỗi lần thêm, sửa hoặc hủy bút toán. `PUT /api/hoa-don` SHALL bỏ qua `daThanhToan`, `conLai`, `trangThai` do client gửi.

#### Scenario: Trả nợ cũ trước

- **WHEN** khách nợ hóa đơn tháng 10 còn 1.000đ, có hóa đơn tháng 11 1.400.000đ, rồi đóng 1.000.000đ
- **THEN** hóa đơn tháng 10 `daThanhToan` đủ, `trangThai='daThanhToan'`; hóa đơn tháng 11 `daThanhToan=999.000`, `conLai=401.000`

#### Scenario: Quá hạn

- **WHEN** hóa đơn có `conLai > 0` và `hanThanhToan` đã qua
- **THEN** `trangThai='quaHan'`

#### Scenario: Hủy thanh toán làm hóa đơn mở lại

- **WHEN** admin hủy thanh toán đã phân bổ hết vào hóa đơn tháng 11
- **THEN** hóa đơn tháng 11 trở về `chuaThanhToan` (hoặc `quaHan` nếu đã quá hạn)

### Requirement: Chọn khấu trừ tiền thừa kỳ trước khi lập hóa đơn

Khi lập hóa đơn cho khách đang có tiền thừa, người dùng SHALL chọn được có khấu trừ vào hóa đơn hay không (`HoaDon.khauTruTienThua`), mặc định KHÔNG khấu trừ. Không khấu trừ: hóa đơn chỉ nhận các khoản tiền ghi nhận sau khi lập, tiền thừa SHALL được giữ lại cho khách. Nợ kỳ trước luôn được tính. Hóa đơn cũ chưa có trường này SHALL được coi là có khấu trừ; lựa chọn đổi được ở form sửa.

#### Scenario: Mặc định không khấu trừ

- **WHEN** khách thừa 500đ và lập hóa đơn 1.369.500đ không chọn khấu trừ
- **THEN** `noKyTruoc=0`, cần thanh toán 1.369.500đ, `daThanhToan=0`, `trangThai='chuaThanhToan'`, khách vẫn thừa 500đ

#### Scenario: Chọn khấu trừ

- **WHEN** cùng tình huống nhưng chọn khấu trừ
- **THEN** `noKyTruoc=−500`, cần thanh toán 1.369.000đ, `tienThuaDaKhauTru=500`, `trangThai='chuaThanhToan'` (khấu trừ không tính là một lần thanh toán)

### Requirement: Nợ kỳ trước trên hóa đơn

Hệ thống SHALL lưu trên mỗi hóa đơn mới: `noKyTruoc` = số dư của khách ngay trước khi ghi bút toán của hóa đơn này (dương = nợ, âm = tiền thừa), và `tongCanThanhToan = tongTien + noKyTruoc`. Trang chi tiết, bản in, PDF và tin Zalo của hóa đơn SHALL hiển thị dòng "Nợ kỳ trước" (hoặc "Tiền thừa kỳ trước" khi âm) và "Tổng cần thanh toán"; ẩn dòng khi `noKyTruoc = 0`.

#### Scenario: Có nợ kỳ trước

- **WHEN** khách phòng 11 còn nợ 1.000đ và hệ thống lập hóa đơn tháng sau 1.200.000đ
- **THEN** hóa đơn có `noKyTruoc=1.000`, `tongCanThanhToan=1.201.000`, hiển thị "Nợ kỳ trước: 1.000đ"

#### Scenario: Có tiền thừa kỳ trước

- **WHEN** khách phòng 22 có số dư −500đ và hệ thống lập hóa đơn 1.300.000đ
- **THEN** hóa đơn có `noKyTruoc=−500`, `tongCanThanhToan=1.299.500`, hiển thị "Tiền thừa kỳ trước: −500đ"

### Requirement: Xem và điều chỉnh công nợ

Hệ thống SHALL cung cấp `GET /api/cong-no?khachThueId=...` trả về số dư hiện tại và danh sách bút toán (kèm số dư lũy kế từng dòng), và `POST /api/cong-no/dieu-chinh` để admin ghi bút toán `dieuChinh` với `soTien` có dấu và `moTa` bắt buộc. Trang chi tiết khách thuê SHALL có tab "Công nợ" hiển thị số dư, lịch sử bút toán và nút "Thu tiền", "Điều chỉnh". Danh sách khách thuê SHALL có cột "Công nợ" và bộ lọc "Đang nợ" / "Có tiền thừa". Chỉ role `admin` / `chuNha` được điều chỉnh.

#### Scenario: Xem lịch sử công nợ

- **WHEN** admin mở tab Công nợ của khách
- **THEN** thấy các dòng theo thời gian: ngày, loại, mô tả, số tiền (+/−), số dư lũy kế, và số dư hiện tại ở đầu trang

#### Scenario: Điều chỉnh thiếu mô tả

- **WHEN** admin gửi điều chỉnh không có `moTa`
- **THEN** API trả 400 "Vui lòng nhập lý do điều chỉnh"

#### Scenario: Nhân viên điều chỉnh

- **WHEN** user role `nhanVien` gọi `POST /api/cong-no/dieu-chinh`
- **THEN** API trả 403

### Requirement: Migration dữ liệu cũ sang sổ công nợ

Hệ thống SHALL có script `scripts/migrate-cong-no.ts` tạo bút toán `hoaDon` cho mọi hóa đơn và bút toán `thanhToan` cho mọi thanh toán hiện có, điền `ThanhToan.khachThue` từ hóa đơn, rồi tính lại phân bổ cho mọi khách. Script SHALL idempotent (chạy lại không tạo trùng) và có chế độ `--dry-run` liệt kê hóa đơn có `daThanhToan` cũ khác kết quả phân bổ mới.

#### Scenario: Chạy lại script

- **WHEN** chạy script lần thứ hai
- **THEN** không có bút toán nào được tạo thêm

#### Scenario: Dry run phát hiện chênh lệch

- **WHEN** hóa đơn cũ có `daThanhToan=500.000` nhưng tổng `ThanhToan` của nó là 0 (sửa tay qua PUT)
- **THEN** báo cáo dry-run liệt kê hóa đơn này với hai giá trị để admin quyết định
