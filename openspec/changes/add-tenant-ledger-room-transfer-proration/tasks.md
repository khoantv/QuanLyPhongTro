## 1. Chuẩn bị

- [x] 1.1 Chốt các Open Questions trong `design.md` với chủ trọ (thu trước/sau, chia ngày thực tế/30, phí dịch vụ khi tính lẻ, giữ ngày thu khi chuyển phòng)
- [ ] 1.2 Backup DB (`npm run db:backup`)
- [ ] 1.3 Thêm dependency `exceljs`

## 2. M1 — Sổ công nợ (tenant-ledger)

- [x] 2.1 Tạo `src/models/GiaoDichCongNo.ts` (fields theo design Decision 1; index `{khachThue, daHuy, ngayGhiNhan}`, `{hoaDon}`, `{thanhToan}`)
- [x] 2.2 Sửa `src/models/ThanhToan.ts`: thêm `khachThue` (bắt buộc), `hopDong`; `hoaDon` optional
- [x] 2.3 Sửa `src/models/HoaDon.ts`: thêm `noKyTruoc`, `tongCanThanhToan`; bỏ `min: 0` của `tongTien` (chỉ cho âm khi `loaiHoaDon='chotPhong'`); bỏ logic tính `trangThai` trong pre-save (chuyển sang recompute)
- [x] 2.4 Tạo `src/lib/cong-no/index.ts`: `ghiButToan()`, `huyButToan()`, `soDu(khachThueId)`, `recomputeCongNo(khachThueId)` (phân bổ FIFO, ghi `daThanhToan/conLai/trangThai` vào hóa đơn)
- [x] 2.5 Unit test `recomputeCongNo`: đóng thiếu, đóng thừa, đóng trước, hủy thanh toán, hóa đơn âm, quá hạn
- [x] 2.6 Sửa `POST /api/thanh-toan`: nhận `khachThueId` hoặc `hoaDonId`, bỏ chặn `soTien > conLai`, ghi bút toán, recompute
- [x] 2.7 Sửa `PUT/DELETE /api/thanh-toan/[id]`: cập nhật / hủy mềm bút toán, recompute
- [x] 2.8 Tạo `GET /api/cong-no` và `POST /api/cong-no/dieu-chinh` (check role admin/chuNha)
- [x] 2.9 Script `scripts/migrate-cong-no.ts` (idempotent, `--dry-run`, báo cáo chênh lệch) + npm script `db:migrate-cong-no`
- [x] 2.10 UI: hộp thoại "Công nợ" (app chưa có trang chi tiết khách thuê — mở từ danh sách); cột + bộ lọc công nợ ở danh sách khách thuê
- [x] 2.11 UI: form thanh toán chọn khách thuê (hóa đơn là tùy chọn), cho nhập số tiền bất kỳ, hiển thị phân bổ dự kiến
- [x] 2.11a Tiền đóng thừa: thêm `ThanhToan.xuLyTienThua`, `CaiDatHoaDon.xuLyTienThuaMacDinh`; ghi/hủy bút toán `boQuaTienThua` kèm thanh toán; form thu tiền hiện lựa chọn "Trừ vào kỳ sau / Không trừ" khi có phần thừa; select mặc định ở trang Cài đặt phiếu thu; unit test các scenario
- [x] 2.12 UI hóa đơn (chi tiết, in, PDF) + template Zalo: dòng "Nợ kỳ trước / Tiền thừa kỳ trước" và "Tổng cần thanh toán"

## 3. M2 — Kỳ thu & tiền phòng theo ngày (rent-proration, invoice-generation)

- [x] 3.1 Tạo `src/lib/ky-thu.ts`: `ngayThu`, `kyThuChua`, `soNgayCuaKy`, `tienPhongTheoNgay` (timezone `Asia/Ho_Chi_Minh`, khoảng nửa mở)
- [x] 3.2 Unit test `ky-thu.ts`: các ví dụ trong spec (16/30 ngày, trọn kỳ 31 ngày, khoảng âm, ngày 31 tháng 2)
- [x] 3.3 Sửa `src/models/HopDong.ts`: thêm `daThuTienPhongDen`, `hopDongTruoc`, `hopDongSau`, `lyDoKetThuc`, `ngayTraPhong`; enum `trangThai` thêm `daThanhLy`; khi tạo hợp đồng mặc định `daThuTienPhongDen=ngayBatDau`, `ngayThanhToan` mặc định từ `CaiDatHoaDon.ngayLapHoaDon`
- [x] 3.4 Sửa `src/models/HoaDon.ts`: mở rộng dòng `phiDichVu` thành `{ten, gia, loai, chiTiet?}` (dữ liệu cũ coi là `dichVu`); thêm `loaiHoaDon`, `kyBatDau`, `kyKetThuc`, `khoanGiamTru[]`, `tienLamTron`, `hinhThucThanhToan`; unique `{hopDong, kyBatDau}` (partial: `loaiHoaDon='hangThang'`)
- [x] 3.5 Tạo `src/lib/hoa-don/lap-hoa-don.ts`: hàm dùng chung tính chỉ số đầu/cuối, tiền phòng + tiền phòng lẻ, dịch vụ, giảm trừ, làm tròn, hạn đóng, `noKyTruoc`; ghi bút toán; đẩy `daThuTienPhongDen`; recompute; trigger Zalo
- [x] 3.6 Viết lại `POST /api/hoa-don` dùng `lap-hoa-don.ts`; validate chỉ số giảm (trừ `thayDongHo`)
- [x] 3.7 Viết lại `PUT /api/hoa-don`: tính lại server-side, cập nhật bút toán, bỏ qua `daThanhToan/conLai/trangThai` từ client
- [x] 3.8 Sửa `DELETE /api/hoa-don`: chỉ xóa hóa đơn mới nhất, hủy mềm bút toán, khôi phục `daThuTienPhongDen`
- [x] 3.9 Viết lại `POST/GET /api/auto-invoice` theo ngày thu từng hợp đồng, dùng `lap-hoa-don.ts`
- [x] 3.10 Sửa `GET /api/hoa-don/latest-reading`: trả thêm tiền phòng lẻ dự kiến, kỳ thu, nợ kỳ trước
- [x] 3.11 UI form tạo/sửa hóa đơn: đổi mục "Thêm phí dịch vụ" thành "Phí dịch vụ & khoản thu khác" — tự điền phí hợp đồng + dòng tiền phòng lẻ (gợi ý cách tính, nút "Tính lại"), cho thêm dòng `khac`, chặn số âm; thêm mục "Giảm trừ"; hiển thị kỳ thu, làm tròn, nợ kỳ trước; điền sẵn ghi chú / hình thức thanh toán từ cài đặt
- [x] 3.11a Bản in, PDF, template Zalo, bảng thu tiền: hiển thị các dòng `phiDichVu` theo `loai` và các dòng giảm trừ
- [x] 3.12 Thêm field `hoanTienPhongKhiTraPhong` vào `CaiDatHoaDon` + toggle ở trang cài đặt phiếu thu

## 4. M3 — Chuyển phòng & trả phòng (room-transfer-checkout)

- [ ] 4.1 Tạo `src/lib/thanh-ly.ts`: `tinhTienChot()` (thuần, không ghi DB) và `thucHienChot()` (ghi chỉ số chốt, hóa đơn `chotPhong`, cập nhật hợp đồng), hỗ trợ transaction khi có replica set, idempotency theo `maThaoTac`
- [ ] 4.2 `GET /api/hop-dong/[id]/tinh-tien-chot` (xem trước)
- [ ] 4.3 `POST /api/hop-dong/[id]/chuyen-phong`: validate phòng mới trống, ngày chuyển hợp lệ; chốt phòng cũ; tạo hợp đồng mới; xử lý cọc; cập nhật trạng thái phòng/khách; recompute
- [ ] 4.4 `POST /api/hop-dong/[id]/tra-phong`: chốt phòng, hoàn tiền phòng theo cài đặt, trừ cọc, cập nhật trạng thái phòng/khách
- [ ] 4.5 API ghi nhận hoàn tiền (`loai='hoanTien'`) + tạo phiếu chi trong module thu/chi
- [ ] 4.6 Unit/integration test các ví dụ trong spec: chuyển giữa kỳ (−445.645đ / 290.323đ), chuyển trước kỳ thu đầu (210.000đ), trả phòng trừ cọc, gọi lại cùng `maThaoTac`
- [ ] 4.7 UI trang hợp đồng: nút "Chuyển phòng" và "Trả phòng" mở dialog nhiều bước (chọn phòng/ngày → nhập chỉ số chốt + chỉ số phòng mới → xem trước bảng tính → xác nhận)
- [ ] 4.8 UI chi tiết hợp đồng/phòng: liên kết hợp đồng trước/sau, lý do kết thúc, hóa đơn chốt
- [ ] 4.9 Cập nhật bộ lọc trạng thái hợp đồng / dashboard cho `daThanhLy`

## 5. M4 — Bảng thu tiền tháng (monthly-collection-sheet)

- [ ] 5.1 `GET /api/bang-thu-tien` (gộp phòng, hợp đồng, chỉ số, hóa đơn, thanh toán trong kỳ; tính Đã đóng / Còn thiếu)
- [ ] 5.2 `POST /api/bang-thu-tien/chi-so` (upsert hàng loạt, trả danh sách lỗi)
- [ ] 5.3 `POST /api/bang-thu-tien/lap-hoa-don` (lập hàng loạt qua `lap-hoa-don.ts`)
- [ ] 5.4 `GET /api/bang-thu-tien/export` (xlsx bằng `exceljs`, màu nền theo trạng thái, dòng tổng)
- [ ] 5.5 Trang `/dashboard/bang-thu-tien`: bộ lọc tòa nhà/tháng/tìm kiếm, bảng cột cố định, ô nhập chỉ số inline, dòng tổng, màu trạng thái, dialog Thu tiền
- [ ] 5.6 Thêm link "Bảng thu tiền" vào sidebar
- [ ] 5.7 Đối chiếu: nhập dữ liệu bảng Excel mẫu tháng 10 vào DB thử, so sánh từng dòng Cần đóng / Còn thiếu

## 6. Verification

- [ ] 6.1 `npm run build` và `npm run lint` xanh
- [ ] 6.2 Chạy `scripts/migrate-cong-no.ts --dry-run` trên bản sao dữ liệu thật, rà báo cáo chênh lệch
- [ ] 6.3 Manual test: đóng thiếu → tháng sau hiện nợ kỳ trước; đóng thừa → tháng sau trừ; đóng trước khi chưa có hóa đơn
- [x] 6.4 Manual test: khách mới vào giữa kỳ → hóa đơn đầu có tiền phòng lẻ đúng
- [ ] 6.5 Manual test: chuyển phòng giữa kỳ và trước kỳ thu đầu; trả phòng có/không hoàn tiền phòng, có trừ cọc
- [x] 6.6 Manual test: auto-invoice với hai nhóm ngày thu 10 và 21
- [ ] 6.7 Cập nhật `README.md`: quy trình thu tiền, chuyển phòng, trả phòng, migration công nợ
