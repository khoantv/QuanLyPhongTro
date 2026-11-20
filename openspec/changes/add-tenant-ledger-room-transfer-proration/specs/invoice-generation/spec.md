## ADDED Requirements

### Requirement: Lập hóa đơn hàng tháng theo kỳ thu

Hệ thống SHALL lập hóa đơn hàng tháng (`loaiHoaDon='hangThang'`) cho một hợp đồng tại ngày thu của tháng (theo `rent-proration`), lưu `kyBatDau` và `kyKetThuc` của kỳ tiền phòng được thu. Mỗi hợp đồng SHALL có tối đa một hóa đơn hàng tháng cho mỗi `kyBatDau` (unique index). Tổng phát sinh SHALL bằng `tienPhong + tienDien + tienNuoc + Σ phiDichVu.gia − Σ khoanGiamTru.soTien` (tiền phòng lẻ nằm trong `phiDichVu`), sau đó áp dụng làm tròn. Chỉ áp dụng cho hợp đồng `chuKyThanhToan='thang'`.

#### Scenario: Khớp bảng Excel mẫu

- **WHEN** hợp đồng phòng 2: `giaThue=900.000`, `giaDien=3.500`, `giaNuoc=15.000`, rác 15.000đ; chỉ số điện 6.837 → 6.991, nước 320 → 325
- **THEN** hóa đơn có điện 154 số = 539.000đ, nước 5 khối = 75.000đ, tổng 1.529.000đ

#### Scenario: Trùng kỳ

- **WHEN** đã có hóa đơn hàng tháng cho kỳ bắt đầu 21/10/2026 của hợp đồng và tạo thêm
- **THEN** API trả 400 "Hóa đơn kỳ 21/10/2026 – 20/11/2026 đã tồn tại"

#### Scenario: Hợp đồng đã thanh lý

- **WHEN** tạo hóa đơn hàng tháng cho hợp đồng `trangThai='daThanhLy'`
- **THEN** API trả 400 "Hợp đồng đã thanh lý"

### Requirement: Phí dịch vụ và khoản thu khác trên hóa đơn

Form tạo/sửa hóa đơn SHALL giữ mục "Phí dịch vụ & khoản thu khác" hiện có, mỗi dòng `phiDichVu` là `{ ten, gia, loai: dichVu | tienPhongLe | khac, chiTiet? }`. Form SHALL điền sẵn phí hợp đồng (`dichVu`) và tiền phòng lẻ nếu có, cho thêm dòng tùy ý (`khac`), cho sửa/xóa mọi dòng; `gia` SHALL ≥ 0. Dòng cũ không có `loai` SHALL được coi là `dichVu`.

#### Scenario: Thêm khoản thu phát sinh

- **WHEN** admin thêm dòng "Thay bóng đèn" 50.000đ vào hóa đơn phòng 2
- **THEN** hóa đơn lưu dòng `loai='khac'`, tổng tăng thành 1.579.000đ, bản in và tin Zalo hiển thị dòng này

#### Scenario: Phí hợp đồng được điền sẵn

- **WHEN** chọn hợp đồng có phí "Tiền rác" 15.000đ
- **THEN** danh sách phí có sẵn dòng "Tiền rác" 15.000đ `loai='dichVu'`, admin có thể sửa hoặc xóa riêng cho hóa đơn này

#### Scenario: Số tiền âm

- **WHEN** admin nhập số tiền −20.000đ cho một dòng phí
- **THEN** form báo lỗi "Số tiền phải ≥ 0 — dùng mục Giảm trừ cho khoản bớt"

### Requirement: Giảm trừ trên hóa đơn

Form hóa đơn SHALL có mục "Giảm trừ" riêng (thêm/xóa nhiều dòng tên + số tiền dương) lưu vào `khoanGiamTru`, dùng cho các khoản bớt như khuyến mãi, bồi hoàn, hoàn tiền phòng chưa ở. Bản in và tin Zalo SHALL hiển thị giảm trừ với dấu trừ.

#### Scenario: Giảm giá tháng đầu

- **WHEN** admin thêm giảm trừ "Khuyến mãi tháng đầu" 100.000đ
- **THEN** tổng hóa đơn giảm 100.000đ và bản in có dòng "Khuyến mãi tháng đầu: −100.000đ"

### Requirement: Snapshot chỉ số điện nước trên hóa đơn

Mọi hóa đơn (thủ công, tự động, chốt phòng) SHALL lưu đủ `chiSoDienBanDau`, `chiSoDienCuoiKy`, `chiSoNuocBanDau`, `chiSoNuocCuoiKy`. Chỉ số đầu kỳ SHALL lấy từ chỉ số cuối của hóa đơn gần nhất cùng hợp đồng (theo `kyBatDau`), nếu chưa có thì từ chỉ số ban đầu hợp đồng. Chỉ số cuối kỳ SHALL lấy từ `ChiSoDienNuoc` của phòng trong tháng/năm của ngày thu nếu client không gửi. Chỉ số cuối nhỏ hơn chỉ số đầu SHALL bị từ chối (400), trừ khi admin đánh dấu `thayDongHo=true` kèm chỉ số đồng hồ mới.

#### Scenario: Tự động lấy chỉ số đã ghi

- **WHEN** đã ghi `ChiSoDienNuoc` phòng 1 tháng 10/2026: điện 10.733, nước 547; hóa đơn trước có chỉ số cuối 10.555 / 540
- **THEN** hóa đơn mới có điện 10.555 → 10.733 (178 số), nước 540 → 547 (7 khối)

#### Scenario: Chỉ số giảm

- **WHEN** chỉ số điện cuối kỳ 6.000 nhỏ hơn đầu kỳ 6.122
- **THEN** API trả 400 "Chỉ số điện cuối kỳ (6.000) nhỏ hơn đầu kỳ (6.122)"

### Requirement: Tạo hóa đơn tự động theo ngày thu

`POST /api/auto-invoice` SHALL chọn các hợp đồng `trangThai='hoatDong'`, `chuKyThanhToan='thang'` có ngày thu của tháng hiện tại ≤ hôm nay và chưa có hóa đơn cho kỳ đó, rồi lập hóa đơn qua cùng hàm dịch vụ với tạo thủ công (`src/lib/hoa-don/lap-hoa-don.ts`). Hợp đồng chưa có chỉ số điện nước của tháng SHALL bị bỏ qua và liệt kê trong `errors`. `GET /api/auto-invoice` SHALL trả về số hợp đồng đến hạn lập hóa đơn và số hợp đồng thiếu chỉ số.

#### Scenario: Hai nhóm ngày thu

- **WHEN** hôm nay là 15/11/2026, có phòng thu ngày 10 và phòng thu ngày 21, tất cả đã có chỉ số tháng 11
- **THEN** chỉ lập hóa đơn cho các phòng thu ngày 10; phòng thu ngày 21 chưa đến hạn

#### Scenario: Thiếu chỉ số

- **WHEN** hợp đồng đến hạn nhưng chưa có `ChiSoDienNuoc` tháng 11/2026
- **THEN** không lập hóa đơn cho hợp đồng đó, `errors` có "Chưa có chỉ số điện nước phòng X tháng 11/2026"

#### Scenario: Hóa đơn tự động hợp lệ

- **WHEN** lập hóa đơn tự động cho hợp đồng đủ dữ liệu
- **THEN** hóa đơn lưu thành công với đủ 4 trường chỉ số, có bút toán công nợ và kích hoạt gửi Zalo nếu `autoSendZalo=true`

### Requirement: Làm tròn hóa đơn theo cài đặt

Khi `CaiDatHoaDon.lamTronHoaDon = true`, hệ thống SHALL làm tròn tổng phát sinh của hóa đơn về 1.000đ (phần dư ≤ 500 làm tròn xuống, > 500 làm tròn lên) và lưu chênh lệch vào `tienLamTron`. Hệ thống SHALL NOT làm tròn `noKyTruoc`.

#### Scenario: Làm tròn lên

- **WHEN** `lamTronHoaDon=true`, tổng phát sinh 2.009.000đ + 600đ = 2.009.600đ
- **THEN** `tongTien=2.010.000`, `tienLamTron=+400`

#### Scenario: Mốc 500đ

- **WHEN** `lamTronHoaDon=true`, tổng phát sinh 1.199.500đ
- **THEN** `tongTien=1.199.000`, `tienLamTron=−500`

### Requirement: Hạn đóng tiền theo cài đặt

Hệ thống SHALL đặt `hanThanhToan` của hóa đơn hàng tháng bằng ngày thu cộng `CaiDatHoaDon.hanDongTien` ngày. `CaiDatHoaDon.ngayLapHoaDon` SHALL chỉ dùng làm giá trị mặc định `ngayThanhToan` khi tạo hợp đồng mới; ngày thu thực tế luôn theo hợp đồng.

#### Scenario: Hạn đóng

- **WHEN** ngày thu 21/10/2026, `hanDongTien=5`
- **THEN** `hanThanhToan=26/10/2026`

#### Scenario: Ngày lập toàn cục không ghi đè hợp đồng

- **WHEN** `ngayLapHoaDon=1` nhưng hợp đồng có `ngayThanhToan=21`
- **THEN** hóa đơn của hợp đồng vẫn lập theo ngày 21

### Requirement: Giá trị mặc định từ cài đặt

Khi lập hóa đơn, hệ thống SHALL điền `hinhThucThanhToan` từ `hinhThucThanhToanMacDinh` và `ghiChu` từ `ghiChuMacDinh` nếu client không gửi. Form thu tiền SHALL chọn sẵn phương thức theo `hinhThucThanhToanMacDinh`.

#### Scenario: Không gửi ghi chú

- **WHEN** `ghiChuMacDinh="Vui lòng đóng tiền đúng hạn"` và tạo hóa đơn không có `ghiChu`
- **THEN** hóa đơn có `ghiChu="Vui lòng đóng tiền đúng hạn"`

### Requirement: Sửa và xóa hóa đơn giữ nhất quán công nợ

`PUT /api/hoa-don` SHALL tính lại các khoản và tổng phía server, cập nhật `soTien` của bút toán `hoaDon` tương ứng, rồi tính lại công nợ của khách; SHALL bỏ qua `daThanhToan`, `conLai`, `trangThai` từ client. `DELETE /api/hoa-don` SHALL hủy mềm bút toán `hoaDon`, trả `daThuTienPhongDen` về giá trị trước hóa đơn đó, và SHALL từ chối xóa hóa đơn không phải mới nhất của hợp đồng (400) để tránh lệch chỉ số điện nước.

#### Scenario: Sửa chỉ số làm tăng tổng

- **WHEN** admin sửa chỉ số điện cuối kỳ làm tổng tăng 35.000đ trên hóa đơn đã thanh toán đủ
- **THEN** bút toán hóa đơn tăng 35.000đ, hóa đơn chuyển `daThanhToanMotPhan` với `conLai=35.000`

#### Scenario: Xóa hóa đơn không phải mới nhất

- **WHEN** xóa hóa đơn tháng 9 khi đã có hóa đơn tháng 10 cùng hợp đồng
- **THEN** API trả 400 "Chỉ được xóa hóa đơn mới nhất của hợp đồng"
