## ADDED Requirements

### Requirement: Kỳ thu theo ngày thu của hợp đồng

Hệ thống SHALL xác định ngày thu của hợp đồng trong tháng m là `min(HopDong.ngayThanhToan, số ngày của tháng m)`, và kỳ thu là khoảng nửa mở `[ngày thu tháng m, ngày thu tháng m+1)`. Logic này SHALL nằm trong một module dùng chung `src/lib/ky-thu.ts` (`ngayThu(hopDong, thang, nam)`, `kyThuChua(hopDong, ngay)`, `soNgayCuaKy(ky)`).

#### Scenario: Ngày thu thông thường

- **WHEN** hợp đồng có `ngayThanhToan=21`, xét tháng 10/2026
- **THEN** kỳ thu là `[21/10/2026, 21/11/2026)` dài 31 ngày

#### Scenario: Ngày thu lớn hơn số ngày của tháng

- **WHEN** hợp đồng có `ngayThanhToan=31`, xét tháng 02/2027
- **THEN** ngày thu tháng 2 là 28/02/2027 và kỳ là `[28/02/2027, 31/03/2027)` dài 31 ngày

### Requirement: Mốc đã thu tiền phòng đến

Hệ thống SHALL lưu `HopDong.daThuTienPhongDen` là ngày mà tiền phòng đã được lập hóa đơn tới (không phụ thuộc khách đã trả hay chưa). Giá trị khởi tạo SHALL bằng `ngayBatDau`. Mỗi hóa đơn hàng tháng SHALL đặt mốc này bằng ngày kết thúc của kỳ tiền phòng nó thu (`kyKetThuc`). Hóa đơn chốt phòng SHALL đặt mốc này bằng ngày chốt. Xóa hóa đơn hàng tháng mới nhất SHALL trả mốc về giá trị trước đó.

#### Scenario: Hợp đồng mới

- **WHEN** tạo hợp đồng `ngayBatDau=05/10/2026`
- **THEN** `daThuTienPhongDen=05/10/2026`

#### Scenario: Sau khi lập hóa đơn hàng tháng

- **WHEN** lập hóa đơn ngày thu 21/10/2026 cho hợp đồng `ngayThanhToan=21`
- **THEN** `daThuTienPhongDen=21/11/2026`

### Requirement: Công thức tiền phòng theo ngày

Hệ thống SHALL tính `tienPhongTheoNgay(giaThue, tuNgay, denNgay)` bằng cách chia khoảng `[tuNgay, denNgay)` theo các kỳ thu của hợp đồng, mỗi phần giao nhau tính `giaThue × soNgayGiaoNhau / soNgayThucTeCuaKy`, cộng lại và làm tròn đến đồng. Ngày bắt đầu được tính là một ngày ở, ngày kết thúc không tính. Kết quả SHALL âm khi `denNgay < tuNgay` và bằng 0 khi hai ngày trùng nhau. Khoảng phủ trọn một kỳ SHALL cho kết quả đúng bằng `giaThue`.

#### Scenario: Một phần kỳ

- **WHEN** `giaThue=900.000`, kỳ `[21/09/2026, 21/10/2026)` dài 30 ngày, tính `[05/10/2026, 21/10/2026)`
- **THEN** kết quả = 900.000 × 16 / 30 = 480.000đ

#### Scenario: Trọn một kỳ

- **WHEN** `giaThue=900.000`, tính `[21/10/2026, 21/11/2026)`
- **THEN** kết quả = 900.000đ (dù kỳ dài 31 ngày)

#### Scenario: Khoảng ngược chiều

- **WHEN** `giaThue=900.000`, kỳ `[21/10/2026, 21/11/2026)` dài 31 ngày, tính `[21/11/2026, 01/11/2026)`
- **THEN** kết quả = −(900.000 × 20 / 31) = −580.645đ

### Requirement: Tiền phòng lẻ cho khách mới vào giữa kỳ

Khi lập hóa đơn hàng tháng mà `daThuTienPhongDen` nhỏ hơn ngày thu, hệ thống SHALL tự thêm vào danh sách "Phí dịch vụ & khoản thu khác" một dòng `loai='tienPhongLe'`, tên "Tiền phòng lẻ (DD/MM – DD/MM, N ngày)", `gia = tienPhongTheoNgay(giaThue, daThuTienPhongDen, ngàyThu)`, `chiTiet` lưu ngày bắt đầu/kết thúc, số ngày, số ngày của kỳ và giá thuê. Dòng này cộng ngoài tiền phòng kỳ tới.

#### Scenario: Khách vào trước ngày thu

- **WHEN** hợp đồng `giaThue=900.000`, `ngayThanhToan=21`, `ngayBatDau=05/10/2026`, dịch vụ rác 15.000đ; lập hóa đơn ngày 21/10/2026 với điện 154 số × 3.500đ, nước 5 khối × 15.000đ
- **THEN** danh sách phí của hóa đơn có hai dòng "Tiền rác" 15.000đ và "Tiền phòng lẻ (05/10 – 20/10, 16 ngày)" 480.000đ; tổng = tiền phòng kỳ 21/10 – 20/11 900.000đ + điện 539.000đ + nước 75.000đ + 15.000đ + 480.000đ = 2.009.000đ (trước làm tròn)

#### Scenario: Khách vào đúng ngày thu

- **WHEN** `ngayBatDau` trùng ngày thu đầu tiên
- **THEN** không có dòng tiền phòng lẻ, hóa đơn chỉ thu tiền phòng kỳ tới

#### Scenario: Hóa đơn các tháng sau

- **WHEN** lập hóa đơn tháng tiếp theo, `daThuTienPhongDen` đã bằng ngày thu
- **THEN** không có tiền phòng lẻ

### Requirement: Sửa hoặc bỏ dòng tiền phòng lẻ

Dòng tiền phòng lẻ tự điền SHALL sửa được tên và số tiền, hoặc xóa được, giống mọi dòng khác trong danh sách phí của form hóa đơn. Form SHALL hiển thị gợi ý cách tính (vd "900.000 × 16/30") cạnh dòng này và nút "Tính lại" để khôi phục giá trị tự tính. Dù dòng bị sửa hay xóa, `daThuTienPhongDen` vẫn SHALL được đẩy tới `kyKetThuc` của hóa đơn (coi như chủ trọ giảm hoặc miễn tiền lẻ).

#### Scenario: Chủ trọ làm tròn tiền lẻ

- **WHEN** admin sửa dòng tiền phòng lẻ từ 480.000đ thành 450.000đ
- **THEN** hóa đơn lưu dòng `loai='tienPhongLe'` với `gia=450.000`, `chiTiet` vẫn giữ số ngày gốc, tổng hóa đơn giảm 30.000đ

#### Scenario: Chủ trọ miễn tiền lẻ

- **WHEN** admin xóa dòng tiền phòng lẻ rồi lưu
- **THEN** hóa đơn không có dòng tiền phòng lẻ và hóa đơn tháng sau không tự thêm lại khoản này

#### Scenario: Khôi phục giá trị tự tính

- **WHEN** admin đã sửa dòng rồi bấm "Tính lại"
- **THEN** số tiền dòng trở về 480.000đ

### Requirement: Phí dịch vụ cố định không chia theo ngày

Hệ thống SHALL thu phí dịch vụ cố định của hợp đồng (vd rác) trọn một lần trên mỗi hóa đơn hàng tháng, không chia theo ngày cho tiền phòng lẻ và không hoàn khi chốt phòng.

#### Scenario: Hóa đơn đầu có tiền phòng lẻ

- **WHEN** hóa đơn đầu tiên có tiền phòng lẻ 16 ngày
- **THEN** tiền rác vẫn là 15.000đ, không phải 15.000 × (30+16)/30
