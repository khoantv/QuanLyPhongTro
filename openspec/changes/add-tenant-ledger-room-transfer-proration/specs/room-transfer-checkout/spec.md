## ADDED Requirements

### Requirement: Hóa đơn chốt phòng

Khi khách rời phòng, hệ thống SHALL lập hóa đơn `loaiHoaDon='chotPhong'` gồm điện nước từ chỉ số kỳ trước đến chỉ số chốt, và tiền phòng điều chỉnh `tienPhongTheoNgay(giaThue, daThuTienPhongDen, ngayChot)`: dương thành dòng phí `tienPhongLe`, âm thành giảm trừ "Hoàn tiền phòng chưa ở" (sửa được ở bước xem trước). Hóa đơn chốt SHALL NOT thu phí dịch vụ cố định.

#### Scenario: Chốt phòng đã thu trước tiền phòng

- **WHEN** khách phòng 5 (`giaThue=900.000`, `ngayThanhToan=21`, đã lập hóa đơn ngày 21/10/2026 nên `daThuTienPhongDen=21/11/2026`) rời phòng ngày 01/11/2026; điện từ 8.762 → 8.792 (30 số × 3.500đ), nước từ 495 → 497 (2 khối × 15.000đ)
- **THEN** hóa đơn chốt gồm điện 105.000đ + nước 30.000đ − hoàn tiền phòng chưa ở 580.645đ (01/11 – 20/11, 20/31 ngày) = −445.645đ; số dư khách giảm 445.645đ

#### Scenario: Chốt phòng trước kỳ thu đầu tiên (thu thêm tiền phòng)

- **WHEN** khách vào phòng ngày 05/10/2026 (`giaThue=900.000`, kỳ 21/09 – 20/10 dài 30 ngày), rời phòng ngày 12/10/2026 trước khi có hóa đơn nào
- **THEN** hóa đơn chốt thu tiền phòng 7 ngày = 210.000đ cộng điện nước tiêu thụ

#### Scenario: Chỉ số chốt nhỏ hơn chỉ số trước

- **WHEN** admin nhập chỉ số điện chốt nhỏ hơn chỉ số cuối của hóa đơn trước
- **THEN** API trả 400 "Chỉ số chốt không được nhỏ hơn chỉ số kỳ trước (X)"

### Requirement: Lưu chỉ số chốt

Chỉ số chốt SHALL lưu trên hóa đơn chốt (chỉ số cuối kỳ) và làm gợi ý chỉ số bắt đầu cho hợp đồng kế tiếp của phòng. Hệ thống SHALL NOT ghi đè `ChiSoDienNuoc` của tháng (mỗi phòng một bản ghi/tháng, dành cho kỳ thu hàng tháng).

#### Scenario: Gợi ý chỉ số cho người chuyển vào

- **WHEN** phòng vừa có hóa đơn chốt với chỉ số điện 8.792 và có khách khác chuyển vào phòng này
- **THEN** form chuyển phòng gợi ý chỉ số điện bắt đầu 8.792

### Requirement: Hóa đơn chốt có tổng âm

`tongTien` của hóa đơn chốt phòng SHALL được phép âm. Khi âm, bút toán `hoaDon` tương ứng SHALL mang số âm và trở thành tiền thừa của khách; hóa đơn hiển thị "Khách được hoàn / trừ kỳ sau".

#### Scenario: Hoàn nhiều hơn điện nước

- **WHEN** hóa đơn chốt có điện nước 135.000đ và hoàn tiền phòng 580.645đ
- **THEN** `tongTien=−445.645`, bút toán `hoaDon` −445.645đ, `conLai=0`

### Requirement: Xem trước tiền chốt phòng

Hệ thống SHALL cung cấp `GET /api/hop-dong/[id]/tinh-tien-chot?ngay=&chiSoDien=&chiSoNuoc=&hoanTienPhong=` trả về bảng tính hóa đơn chốt (các dòng, tổng, số dư khách trước/sau, tiền cọc) mà không ghi gì vào DB. Dialog chuyển phòng và trả phòng SHALL gọi endpoint này để hiển thị trước khi người dùng xác nhận.

#### Scenario: Xem trước không thay đổi dữ liệu

- **WHEN** gọi endpoint xem trước nhiều lần với tham số khác nhau
- **THEN** không có hóa đơn, bút toán hay chỉ số nào được tạo

### Requirement: Chuyển phòng

Hệ thống SHALL cung cấp `POST /api/hop-dong/[id]/chuyen-phong` (body gồm phòng mới, ngày chuyển, chỉ số chốt phòng cũ, chỉ số bắt đầu phòng mới, tùy chọn giá thuê / cọc / ngày thu / dịch vụ mới, và `maThaoTac`). Thao tác SHALL lập hóa đơn chốt phòng cũ (luôn hoàn tiền phòng đã thu trước), đặt hợp đồng cũ `trangThai='daThanhLy'`, `lyDoKetThuc='chuyenPhong'`, `ngayTraPhong=ngayChuyen`, cập nhật phòng cũ thành `trong`, phòng mới thành `dangThue`, rồi tính lại công nợ của khách.

#### Scenario: Phòng cũ được giải phóng

- **WHEN** chuyển phòng thành công
- **THEN** phòng cũ có `trangThai='trong'`, hợp đồng cũ `trangThai='daThanhLy'` với `hopDongSau` trỏ tới hợp đồng mới

### Requirement: Hợp đồng mới khi chuyển phòng

Khi chuyển phòng, hệ thống SHALL tạo hợp đồng mới cùng danh sách khách và người đại diện, `ngayBatDau=ngayChuyen`, chỉ số ban đầu bằng chỉ số bắt đầu phòng mới, `giaThue` mặc định theo phòng mới, `ngayThanhToan` và `ngayKetThuc` mặc định giữ của hợp đồng cũ, `daThuTienPhongDen=ngayChuyen`, `hopDongTruoc` trỏ về hợp đồng cũ. Tiền phòng mới từ `ngayChuyen` đến ngày thu kế tiếp SHALL được thu ở hóa đơn hàng tháng đầu tiên của hợp đồng mới như tiền phòng lẻ.

#### Scenario: Chuyển sang phòng rẻ hơn giữa kỳ

- **WHEN** khách phòng 5 (900.000đ, ngày thu 21, đã thu tiền phòng đến 21/11/2026) chuyển sang phòng 8 (450.000đ) ngày 01/11/2026
- **THEN** hóa đơn chốt phòng 5 hoàn 580.645đ tiền phòng chưa ở; hợp đồng mới phòng 8 có `daThuTienPhongDen=01/11/2026`; hóa đơn ngày 21/11/2026 của phòng 8 có tiền phòng lẻ 450.000 × 20/31 = 290.323đ cộng tiền phòng kỳ tới 450.000đ và điện nước tính từ chỉ số bắt đầu phòng 8

#### Scenario: Nợ cũ đi theo khách

- **WHEN** khách còn nợ 1.000đ trước khi chuyển phòng
- **THEN** sau khi chuyển, số dư khách vẫn bao gồm khoản nợ 1.000đ và hóa đơn đầu tiên ở phòng mới hiển thị "Nợ kỳ trước" tương ứng

#### Scenario: Phòng mới không trống

- **WHEN** phòng mới có trạng thái khác `trong`
- **THEN** API trả 400 "Phòng mới không còn trống"

#### Scenario: Ngày chuyển không hợp lệ

- **WHEN** `ngayChuyen` trước `ngayBatDau` của hợp đồng cũ hoặc trước ngày thu của hóa đơn hàng tháng mới nhất
- **THEN** API trả 400 kèm ngày sớm nhất được phép

#### Scenario: Gọi lại với cùng mã thao tác

- **WHEN** client gửi lại request với cùng `maThaoTac` do mạng chập chờn
- **THEN** hệ thống trả kết quả của lần đầu, không tạo hóa đơn chốt hay hợp đồng thứ hai

### Requirement: Tiền cọc khi chuyển phòng

Hệ thống SHALL mặc định chuyển nguyên `tienCoc` của hợp đồng cũ sang hợp đồng mới. Nếu admin nhập `tienCocMoi` khác, hệ thống SHALL ghi bút toán `loai='tienCoc'` với `soTien = tienCocMoi − tienCocCu` (dương: khách phải nộp thêm cọc; âm: phần cọc dư thành tiền thừa của khách).

#### Scenario: Phòng mới yêu cầu cọc cao hơn

- **WHEN** cọc cũ 900.000đ, `tienCocMoi=1.000.000`
- **THEN** sổ công nợ có bút toán `tienCoc` +100.000đ và hợp đồng mới `tienCoc=1.000.000`

#### Scenario: Giữ nguyên cọc

- **WHEN** không gửi `tienCocMoi`
- **THEN** hợp đồng mới có `tienCoc` bằng cọc cũ, không phát sinh bút toán cọc

### Requirement: Trả phòng

Hệ thống SHALL cung cấp `POST /api/hop-dong/[id]/tra-phong` với body `{ ngayTraPhong, chiSoDienChot, chiSoNuocChot, hoanTienPhong?, dungCocTruNo?, maThaoTac }`. Thao tác SHALL lập hóa đơn chốt phòng, đặt hợp đồng `trangThai='daThanhLy'`, `lyDoKetThuc='traPhong'`, cập nhật phòng thành `trong` và khách thành `daTraPhong` nếu khách không còn hợp đồng hoạt động nào.

#### Scenario: Khách trả phòng duy nhất

- **WHEN** khách chỉ có một hợp đồng và trả phòng
- **THEN** khách có `trangThai='daTraPhong'`, phòng có `trangThai='trong'`

### Requirement: Dùng cọc trừ nợ khi trả phòng

Khi trả phòng với `dungCocTruNo = true` (mặc định), hệ thống SHALL ghi bút toán `truCoc = −min(tienCoc, số dư dương sau chốt)` và hiển thị phần cọc còn lại cần hoàn.

#### Scenario: Trả phòng, dùng cọc trừ nợ

- **WHEN** sau hóa đơn chốt khách còn nợ 300.000đ, cọc 900.000đ, `dungCocTruNo=true`
- **THEN** sổ công nợ có bút toán `truCoc` −300.000đ, số dư khách về 0, màn hình hiển thị "Cọc còn lại cần hoàn: 600.000đ"

### Requirement: Hoàn tiền phòng đã thu trước khi trả phòng

Khi trả phòng, hệ thống SHALL hoàn tiền phòng đã thu trước cho những ngày chưa ở theo tham số `hoanTienPhong` nếu được gửi, ngược lại theo `CaiDatHoaDon.hoanTienPhongKhiTraPhong` (mặc định `false`).

#### Scenario: Ghi đè cài đặt

- **WHEN** `hoanTienPhongKhiTraPhong=false` nhưng admin gửi `hoanTienPhong=true`
- **THEN** hóa đơn chốt có dòng hoàn tiền phòng chưa ở

#### Scenario: Không hoàn tiền phòng khi trả phòng

- **WHEN** `hoanTienPhongKhiTraPhong=false`, khách đã trả trước tiền phòng đến 21/11 và trả phòng ngày 01/11
- **THEN** hóa đơn chốt không có dòng hoàn tiền phòng chưa ở

### Requirement: Hoàn tiền cho khách

Hệ thống SHALL cung cấp `POST /api/cong-no/hoan-tien` (chỉ `admin` / `chuNha`) để ghi nhận việc trả lại tiền cho khách và tạo phiếu chi trong module thu/chi. Hoàn tiền thừa SHALL ghi bút toán `hoanTien` dương, không vượt quá tiền thừa hiện có. Hoàn cọc SHALL chỉ áp dụng cho hợp đồng đã thanh lý, không vượt quá cọc còn lại (`tienCoc − tienCocDaTru − tienCocDaHoan`) và cập nhật `HopDong.tienCocDaHoan` (cọc không nằm trong sổ công nợ).

#### Scenario: Hoàn tiền thừa

- **WHEN** khách có số dư −445.645đ sau khi trả phòng và admin hoàn 445.645đ tiền mặt
- **THEN** số dư khách về 0 và có phiếu chi 445.645đ "Hoàn tiền thừa – <tên khách> – HĐ <mã>"

#### Scenario: Hoàn cọc còn lại

- **WHEN** hợp đồng đã trả phòng còn 690.000đ cọc và admin hoàn 690.000đ
- **THEN** `tienCocDaHoan=690.000`, có phiếu chi "Hoàn cọc", lần hoàn tiếp theo bị từ chối (400)

### Requirement: Liên kết lịch sử hợp đồng

Trang chi tiết hợp đồng SHALL hiển thị liên kết tới hợp đồng trước/sau (`hopDongTruoc`, `hopDongSau`) và lý do kết thúc. Trang chi tiết phòng SHALL liệt kê các hợp đồng đã thanh lý kèm ngày trả phòng và hóa đơn chốt.

#### Scenario: Xem hợp đồng sau khi chuyển phòng

- **WHEN** admin mở hợp đồng cũ đã chuyển phòng
- **THEN** thấy nhãn "Đã chuyển sang phòng 8 ngày 01/11/2026" và liên kết tới hợp đồng mới cùng hóa đơn chốt
