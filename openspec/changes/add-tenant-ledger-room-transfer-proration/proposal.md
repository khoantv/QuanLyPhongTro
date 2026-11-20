## Why

Chủ trọ đang quản lý tiền nhà bằng bảng Excel (mỗi dòng một phòng: số người, ngày thu tiền, chỉ số điện nước, tiền phòng, tiền rác, cần đóng / đã đóng / còn thiếu). Ứng dụng hiện tại tính được hóa đơn cơ bản nhưng **không thay thế được bảng Excel** vì thiếu các nghiệp vụ hằng ngày:

- Khách **nợ** một phần → khoản nợ nằm chết trên hóa đơn cũ, không tự cộng sang tháng sau, không có chỗ xem "khách đang nợ bao nhiêu".
- Khách **đóng thừa / đóng trước** (vd phòng 22 còn thiếu −500đ) → API từ chối vì số tiền vượt `conLai`; không thể thu tiền khi chưa có hóa đơn.
- Khách **chuyển phòng** → không có nghiệp vụ; phải hủy hợp đồng thủ công, không chốt chỉ số điện nước phòng cũ, không tính lại tiền phòng đã thu trước, không chuyển cọc.
- Khách **mới vào giữa kỳ** → hóa đơn đầu tiên luôn lấy nguyên giá thuê, không cộng tiền phòng lẻ cho số ngày từ ngày vào đến ngày thu.
- Một số lỗi khiến luồng tự động không dùng được: `/api/auto-invoice` thiếu trường bắt buộc, gom hóa đơn theo tháng dương lịch thay vì ngày thu từng hợp đồng; các cài đặt `lamTronHoaDon`, `hinhThucThanhToanMacDinh` lưu nhưng không được áp dụng.

## What Changes

- Thêm **sổ công nợ theo khách thuê** (collection `GiaoDichCongNo`): mọi phát sinh (hóa đơn, thanh toán, giảm trừ, trừ cọc, hoàn tiền, điều chỉnh) là một bút toán có dấu. Số dư > 0 = khách nợ, < 0 = tiền thừa.
- **BREAKING (API)**: `POST /api/thanh-toan` nhận thanh toán theo khách thuê (`khachThueId`), `hoaDonId` trở thành tùy chọn; cho phép số tiền lớn hơn số còn lại và thu khi chưa có hóa đơn. Tiền được phân bổ FIFO vào các hóa đơn cũ nhất; phần thừa tự trừ vào hóa đơn sau.
- **BREAKING (dữ liệu)**: `HoaDon.daThanhToan`, `conLai`, `trangThai` trở thành giá trị **suy ra** từ sổ công nợ, không còn sửa trực tiếp qua `PUT /api/hoa-don`.
- Hóa đơn hiển thị **Nợ kỳ trước / Tiền thừa kỳ trước** và **Tổng cần thanh toán**.
- Thêm khái niệm **kỳ thu** theo `ngayThanhToan` của từng hợp đồng và mốc **"đã thu tiền phòng đến"** (`HopDong.daThuTienPhongDen`), làm nền cho tính tiền phòng theo ngày.
- **Tùy chọn xử lý tiền đóng thừa**: mỗi lần thu tiền thừa, người dùng chọn "Trừ vào kỳ sau" hoặc "Không trừ"; mặc định cấu hình ở Cài đặt phiếu thu.
- **Tiền phòng lẻ theo ngày**: hóa đơn đầu tiên của hợp đồng tự thêm dòng "Tiền phòng lẻ" (từ ngày vào đến ngày thu) vào mục **Phí dịch vụ & khoản thu khác** đã có trên form hóa đơn — sửa/xóa được, và người dùng thêm được các khoản phát sinh khác cùng chỗ; thêm mục **Giảm trừ** cho các khoản bớt.
- Thêm nghiệp vụ **chuyển phòng** (`POST /api/hop-dong/[id]/chuyen-phong`) và **trả phòng** (`POST /api/hop-dong/[id]/tra-phong`): chốt chỉ số điện nước, lập hóa đơn chốt phòng, hoàn/thu tiền phòng theo ngày, xử lý cọc, tạo hợp đồng mới ở phòng mới với chỉ số bắt đầu riêng.
- Sửa luồng lập hóa đơn: tạo theo kỳ thu từng hợp đồng, lưu đủ chỉ số, áp dụng làm tròn / hình thức thanh toán mặc định / hạn đóng tiền từ cài đặt, `PUT` tự tính lại trạng thái.
- Thêm trang **Bảng thu tiền tháng** (`/dashboard/bang-thu-tien`) tái hiện bảng Excel: nhập chỉ số hàng loạt, lập hóa đơn hàng loạt, thu tiền nhanh, xuất Excel.
- Script migration chuyển hóa đơn/thanh toán hiện có sang sổ công nợ.

## Capabilities

### New Capabilities
- `tenant-ledger`: Sổ công nợ theo khách thuê — bút toán, số dư, thanh toán một phần / thừa / trước, phân bổ FIFO, nợ kỳ trước trên hóa đơn.
- `rent-proration`: Kỳ thu theo ngày thu của hợp đồng, mốc đã thu tiền phòng đến, công thức tiền phòng theo ngày, tiền phòng lẻ cho khách mới vào.
- `room-transfer-checkout`: Chuyển phòng và trả phòng — chốt chỉ số, hóa đơn chốt phòng, hoàn/thu tiền phòng theo ngày, xử lý tiền cọc, liên kết hợp đồng cũ/mới.
- `invoice-generation`: Quy tắc lập hóa đơn hàng tháng (thủ công + tự động) theo kỳ thu, áp dụng cài đặt phiếu thu, sửa các lỗi hiện có.
- `monthly-collection-sheet`: Trang bảng thu tiền tháng giống bảng Excel, nhập chỉ số và thu tiền hàng loạt, xuất Excel.

### Modified Capabilities
<!-- Chưa có spec nào được archive trong openspec/specs/. Change này phụ thuộc vào change `add-zalo-invoice-sending` (model CaiDatHoaDon, template Zalo) — nếu change đó được archive trước, các thay đổi về CaiDatHoaDon và template Zalo dưới đây sẽ là MODIFIED của `invoice-settings` / `zalo-invoice-sending`. -->

## Impact

**Model mới:**
- `src/models/GiaoDichCongNo.ts`

**Model sửa:**
- `HoaDon`: dòng `phiDichVu` thêm `loai` (`dichVu | tienPhongLe | khac`) và `chiTiet`; thêm `loaiHoaDon`, `kyBatDau`, `kyKetThuc`, `khoanGiamTru[]`, `noKyTruoc`, `tongCanThanhToan`, `tienLamTron`, `hinhThucThanhToan`; `daThanhToan/conLai/trangThai` thành giá trị suy ra; unique `(hopDong, kyBatDau)` cho hóa đơn hàng tháng.
- `HopDong`: thêm `daThuTienPhongDen`, `hopDongTruoc`, `hopDongSau`, `lyDoKetThuc`, `ngayTraPhong`; enum `trangThai` thêm `daThanhLy`.
- `ThanhToan`: thêm `khachThue` (bắt buộc), `hopDong`; `hoaDon` thành tùy chọn; bỏ giới hạn `soTien <= conLai`.
- `ThanhToan`: thêm `xuLyTienThua` (`truKySau | khongTru`).
- `CaiDatHoaDon`: thêm `hoanTienPhongKhiTraPhong`, `xuLyTienThuaMacDinh`.

**API mới / sửa:**
- Mới: `GET /api/cong-no?khachThueId`, `POST /api/cong-no/dieu-chinh`, `POST /api/hop-dong/[id]/chuyen-phong`, `POST /api/hop-dong/[id]/tra-phong`, `GET /api/hop-dong/[id]/tinh-tien-chot` (xem trước), `GET /api/bang-thu-tien`, `POST /api/bang-thu-tien/chi-so`, `POST /api/bang-thu-tien/lap-hoa-don`, `GET /api/bang-thu-tien/export`.
- Sửa: `POST/PUT /api/hoa-don`, `POST /api/thanh-toan`, `PUT/DELETE /api/thanh-toan/[id]`, `POST /api/auto-invoice`, `GET /api/hoa-don/latest-reading`.

**Code mới:** `src/lib/cong-no/` (ghi bút toán, tính số dư, phân bổ FIFO), `src/lib/ky-thu.ts` (kỳ thu, tiền phòng theo ngày), `src/lib/thanh-ly.ts` (chốt phòng dùng chung cho chuyển/trả phòng).

**UI:** trang chi tiết khách thuê (tab Công nợ), form thanh toán, trang hợp đồng (nút Chuyển phòng / Trả phòng), form + trang in hóa đơn (dòng nợ kỳ trước, tiền phòng lẻ, giảm trừ), template Zalo (dòng nợ kỳ trước), trang mới `/dashboard/bang-thu-tien`, sidebar.

**Dependencies:** thêm `exceljs` để xuất `.xlsx`.

**Dữ liệu:** cần chạy script migration `scripts/migrate-cong-no.ts` một lần; backup DB trước (`npm run db:backup`).
