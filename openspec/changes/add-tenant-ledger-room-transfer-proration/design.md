## Context

Hiện trạng code (nhánh `feat/zalo-invoice-sending`):

- `HoaDon` lưu `tongTien`, `daThanhToan`, `conLai`, `trangThai` trên từng hóa đơn; `conLai` có `min: 0`.
- `ThanhToan` bắt buộc gắn 1 `hoaDon`, API chặn `soTien > conLai` (`src/app/api/thanh-toan/route.ts`).
- `POST /api/hoa-don` lấy chỉ số đầu kỳ từ hóa đơn trước cùng hợp đồng hoặc từ hợp đồng; `tienPhong` do client gửi (form điền sẵn `giaThue`).
- `POST /api/auto-invoice` tạo hóa đơn cho tháng dương lịch hiện tại, không set `chiSoDienBanDau/CuoiKy`, `chiSoNuocBanDau/CuoiKy` (bắt buộc trong schema) → lỗi validate.
- Hợp đồng chỉ có `trangThai: hoatDong | hetHan | daHuy`; không có nghiệp vụ trả phòng / chuyển phòng.
- `CaiDatHoaDon` (change `add-zalo-invoice-sending`) có `lamTronHoaDon`, `hinhThucThanhToanMacDinh`, `hanDongTien`, `ngayLapHoaDon` nhưng chưa nơi nào đọc.

Quy trình thực tế của chủ trọ (theo bảng Excel mẫu):

- Mỗi phòng có **ngày thu tiền riêng** (vd 21 hoặc 10) — thường là ngày khách vào ở.
- Tiền phòng **thu trước** cho kỳ tới; điện nước **thu sau** theo chỉ số kỳ vừa qua.
- Giá điện 3.500đ/số, nước 15.000đ/khối, rác 15.000đ/phòng (cấu hình theo hợp đồng).
- Cột "Còn thiếu" có thể âm (khách đóng thừa).

Ràng buộc:

- MongoDB local (Docker single node) **không hỗ trợ transaction**; Atlas (production) thì có.
- Quy mô nhỏ: vài chục – vài trăm phòng/chủ trọ, vài chục giao dịch/khách/năm.

## Goals / Non-Goals

**Goals:**

- Thay thế được bảng Excel thu tiền hằng tháng.
- Nợ và tiền thừa tự chuyển sang kỳ sau; luôn xem được số dư từng khách.
- Chuyển phòng / trả phòng tính đúng điện nước và tiền phòng theo ngày, không cần tính tay.
- Hóa đơn đầu tiên của khách mới tự cộng tiền phòng lẻ.
- Truy vết được mọi thay đổi số dư (ai, khi nào, vì sao).

**Non-Goals:**

- Không làm kế toán kép đầy đủ (sổ cái, tài khoản đối ứng) — chỉ sổ công nợ phải thu theo khách.
- Không tính lãi phạt trễ hạn tự động (có thể thêm sau bằng bút toán `dieuChinh`).
- Không hỗ trợ chu kỳ thanh toán quý/năm trong change này — chỉ `chuKyThanhToan = 'thang'`; hợp đồng quý/năm giữ hành vi cũ.
- Không chia tiền điện nước theo ngày khi chuyển phòng giữa kỳ — điện nước luôn tính theo chỉ số thực tế đã chốt.
- Không tự động hoàn tiền ra ngân hàng — chỉ ghi nhận việc hoàn tiền.

## Decisions

### 1. Sổ công nợ theo khách thuê (ledger), không theo hợp đồng

**Chọn**: Collection `GiaoDichCongNo`, mỗi document là 1 bút toán có dấu, khóa chính theo `khachThue` (người đại diện hợp đồng):

```ts
{
  khachThue: ObjectId,          // bắt buộc
  hopDong?: ObjectId,
  phong?: ObjectId,
  loai: 'hoaDon' | 'thanhToan' | 'giamTru' | 'truCoc' | 'tienCoc' | 'hoanTien' | 'dieuChinh',
  soTien: number,               // + tăng nợ, − giảm nợ; != 0
  ngayGhiNhan: Date,            // dùng để sắp FIFO
  hoaDon?: ObjectId,
  thanhToan?: ObjectId,
  moTa: string,
  nguoiTao: ObjectId,
  daHuy: boolean,               // hủy mềm, không xóa cứng
  ngayTao, ngayCapNhat
}
```

Số dư khách = Σ `soTien` của các bút toán `daHuy = false`.

**Lý do**:
- Khi chuyển phòng, nợ và tiền thừa **đi theo người**, không cần bút toán "chuyển số dư" giữa hai hợp đồng.
- Mỗi thay đổi số dư là 1 dòng có người tạo và mô tả → truy vết được, khớp yêu cầu "xem khách đang nợ bao nhiêu".
- Tính số dư bằng 1 aggregate `$sum` — rẻ ở quy mô này.

**Alternatives**:
- Lưu số dư trên `HopDong` / `KhachThue`: nhanh nhưng mất lịch sử, dễ lệch khi sửa/xóa thanh toán.
- Ledger theo hợp đồng + bút toán chuyển số dư khi chuyển phòng: chính xác hơn khi 1 người thuê 2 phòng, nhưng phức tạp hơn cho trường hợp hiếm. Có thể mở rộng sau bằng cách lọc theo `hopDong`.

### 2. Trạng thái hóa đơn suy ra bằng phân bổ FIFO

**Chọn**: Các bút toán dương (nợ) và âm (có) của 1 khách được sắp theo `ngayGhiNhan` rồi `ngayTao`. Tổng các bút toán âm được phân bổ lần lượt vào các bút toán dương cũ nhất. Kết quả phân bổ cho bút toán `loai='hoaDon'` được ghi ngược vào `HoaDon.daThanhToan`, `conLai`, `trangThai`. Hàm `recomputeCongNo(khachThueId)` chạy lại **toàn bộ** phân bổ của khách sau mỗi thay đổi (thêm/sửa/hủy bút toán).

**Lý do**:
- Idempotent: chạy lại bao nhiêu lần cũng ra cùng kết quả → không cần transaction để giữ đúng (chỉ cần chạy lại khi nghi lệch).
- Đóng trước / đóng thừa tự nhiên: bút toán âm chưa phân bổ hết = tiền thừa, tự trừ vào hóa đơn kế tiếp.
- Hóa đơn chốt phòng có tổng âm (hoàn tiền phòng nhiều hơn điện nước) chỉ là thêm 1 bút toán âm.

**Alternatives**:
- Phân bổ cố định lúc thu tiền (lưu `phanBo[]` trên `ThanhToan`): khó xử lý khi sửa/xóa thanh toán cũ; phải phân bổ lại thủ công.
- Cho người dùng chọn hóa đơn để trả: giữ như "gợi ý" (`ThanhToan.hoaDon` tùy chọn) nhưng không ảnh hưởng thứ tự FIFO — tránh trường hợp nợ cũ bị bỏ quên.

### 3. Kỳ thu theo ngày thu của hợp đồng; tiền phòng thu trước

**Chọn**: Với hợp đồng có `ngayThanhToan = D`, **ngày thu tháng m** = `min(D, số ngày của tháng m)`. **Kỳ thu** là khoảng nửa mở `[ngày thu tháng m, ngày thu tháng m+1)`. Hóa đơn hàng tháng lập vào ngày thu tháng m gồm:

- Tiền phòng **kỳ tới** `[ngày thu tháng m, ngày thu tháng m+1)` — thu trước;
- Tiền phòng **còn thiếu** từ `daThuTienPhongDen` đến ngày thu tháng m (chính là tiền phòng lẻ của khách mới vào) — được tự thêm thành một dòng `loai='tienPhongLe'` trong danh sách "Phí dịch vụ & khoản thu khác" đã có sẵn trên form hóa đơn, nên người dùng sửa/xóa được như mọi khoản khác;
- Điện nước theo chỉ số từ lần chốt trước đến chỉ số ghi ở ngày thu tháng m — thu sau;
- Phí dịch vụ cố định của hợp đồng (rác, wifi…) — 1 lần/hóa đơn.

`thang/nam` của hóa đơn = tháng/năm của ngày thu (giữ tương thích với UI và chỉ số `ChiSoDienNuoc` hiện có).

**Lý do**: Khớp mô tả nghiệp vụ "khi đến ngày thu tiền, cộng thêm tiền phòng tương ứng số ngày người đó ở tính từ ngày vào đến ngày thu" — tức tiền phòng của kỳ đầy đủ vẫn thu trước, phần lẻ là phần cộng thêm.

**Alternatives**: Tiền phòng thu sau (hóa đơn tháng m trả cho kỳ đã ở): không khớp mô tả. Xem Open Questions nếu một số chủ trọ cần chế độ này.

### 4. Mốc "đã thu tiền phòng đến" (`HopDong.daThuTienPhongDen`)

**Chọn**: Mỗi hợp đồng lưu ngày mà tiền phòng đã được **lập hóa đơn** tới (không phải đã trả — việc trả do sổ công nợ lo). Khởi tạo = `ngayBatDau`. Mỗi hóa đơn hàng tháng đẩy mốc lên ngày thu tháng m+1. Khi chốt phòng, tiền phòng điều chỉnh = `tienPhongTheoNgay(daThuTienPhongDen → ngayChot)`, **có dấu**:

- `ngayChot > daThuTienPhongDen` → khách còn thiếu tiền phòng những ngày đã ở → cộng vào hóa đơn chốt;
- `ngayChot < daThuTienPhongDen` → khách đã trả trước những ngày chưa ở → giảm trừ (hoàn) vào hóa đơn chốt.

**Lý do**: Một công thức duy nhất xử lý cả khách mới vào, chuyển phòng trước kỳ thu đầu, chuyển phòng giữa kỳ đã thu trước, và trả phòng.

### 5. Công thức tiền phòng theo ngày

**Chọn**: `tienPhongTheoNgay(giaThue, tuNgay, denNgay)` chia khoảng `[tuNgay, denNgay)` theo các kỳ thu của hợp đồng; với mỗi kỳ giao nhau:

```
soTien_ky = giaThue × soNgayGiaoNhau / soNgayThucTeCuaKy
```

Tổng các kỳ, làm tròn đến đồng (`Math.round`). Ngày vào được tính là 1 ngày ở; ngày thu/ngày chốt không tính (khoảng nửa mở). Giá trị âm khi `denNgay < tuNgay`.

**Lý do**: Chia theo số ngày thực tế của kỳ (28–31) cho kết quả đúng khi khoảng tính trùng cả 1 kỳ đầy đủ (ra đúng `giaThue`), không bị lệch như chia cố định 30.

**Alternatives**: Chia cố định 30 ngày — đơn giản để giải thích cho khách nhưng 1 kỳ 31 ngày sẽ ra 103% giá thuê. Để thành cài đặt nếu cần (Open Questions).

### 6. Chuyển phòng = chốt phòng cũ + hợp đồng mới liên kết

**Chọn**: `POST /api/hop-dong/[id]/chuyen-phong` thực hiện tuần tự qua `src/lib/thanh-ly.ts`:

1. Ghi `ChiSoDienNuoc` chốt cho phòng cũ tại `ngayChuyen`.
2. Lập `HoaDon` `loaiHoaDon='chotPhong'`: điện nước từ chỉ số trước đến chỉ số chốt + tiền phòng điều chỉnh theo Decision 4 (luôn hoàn nếu đã thu trước — vì khách vẫn ở với chủ trọ).
3. Hợp đồng cũ: `trangThai='daThanhLy'`, `lyDoKetThuc='chuyenPhong'`, `ngayTraPhong=ngayChuyen`, `hopDongSau`.
4. Tạo hợp đồng mới: cùng khách thuê, `phong` mới, `ngayBatDau=ngayChuyen`, chỉ số ban đầu = chỉ số hiện tại của phòng mới, `giaThue` theo phòng mới (sửa được), `ngayThanhToan` mặc định giữ của hợp đồng cũ, `daThuTienPhongDen=ngayChuyen`, `hopDongTruoc`.
5. Cọc: mặc định chuyển nguyên cọc sang hợp đồng mới; nếu admin nhập `tienCocMoi` khác thì ghi chênh lệch bằng bút toán `tienCoc` (+ khách nộp thêm / − hoàn chênh).
6. Cập nhật trạng thái phòng cũ → `trong`, phòng mới → `dangThue`; cập nhật danh sách khách trong phòng.
7. `recomputeCongNo(khachThue)`.

Tiền phòng mới cho những ngày từ `ngayChuyen` đến ngày thu kế tiếp sẽ được tính tự động ở hóa đơn hàng tháng đầu tiên của hợp đồng mới (Decision 3 + 4) — không cần xử lý riêng.

Endpoint `GET /api/hop-dong/[id]/tinh-tien-chot?ngay&chiSoDien&chiSoNuoc` trả kết quả tính trước (không ghi DB) để UI hiển thị xác nhận.

**Lý do**: Giữ hợp đồng cũ nguyên vẹn để in lại / đối chiếu; dùng chung logic chốt cho chuyển phòng và trả phòng.

**Alternatives**: Sửa trực tiếp `phong` trên hợp đồng hiện có — mất lịch sử, chỉ số điện nước hai phòng lẫn vào nhau.

### 7. Trả phòng và tiền cọc

**Chọn**: `POST /api/hop-dong/[id]/tra-phong` dùng cùng bước 1–3, 6, 7 của Decision 6, khác ở:

- Hoàn tiền phòng đã thu trước chỉ khi `CaiDatHoaDon.hoanTienPhongKhiTraPhong = true` (mặc định `false` — đa số chủ trọ không hoàn khi khách tự trả phòng); admin có thể ghi đè từng lần.
- Sau khi lập hóa đơn chốt, nếu `dungCocTruNo = true` (mặc định): ghi bút toán `truCoc = −min(tienCoc, soDuDuong)`. Phần cọc còn lại và tiền thừa (nếu có) được hoàn khi admin xác nhận → bút toán `hoanTien` (+) và tạo phiếu chi trong module thu/chi.

### 8. `ngayThanhToan` của hợp đồng là nguồn sự thật cho ngày thu

**Chọn**: `CaiDatHoaDon.ngayLapHoaDon` (toàn cục) chỉ là **giá trị mặc định** khi tạo hợp đồng mới. Ngày thu thực tế luôn theo `HopDong.ngayThanhToan`. Hạn đóng = ngày thu + `CaiDatHoaDon.hanDongTien` ngày.

**Lý do**: Bảng Excel có các phòng thu ngày 21 và ngày 10 trong cùng tòa — một ngày lập toàn cục không mô tả được.

### 9a. Tiền phòng lẻ là một dòng trong danh sách phí, không phải trường riêng

**Chọn**: Form hóa đơn hiện đã có mục "Thêm phí dịch vụ" (tên + giá, thêm/xóa nhiều dòng). Mở rộng mỗi dòng `phiDichVu` thành `{ ten, gia, loai: 'dichVu' | 'tienPhongLe' | 'khac', chiTiet? }`. Tiền phòng lẻ, phí hợp đồng (rác…) và mọi khoản phát sinh khác đều nằm trong danh sách này. Các khoản bớt dùng mục "Giảm trừ" riêng (`khoanGiamTru`) để `gia` luôn ≥ 0.

**Lý do**: Người dùng đã quen chỗ nhập này; một nơi duy nhất để xem/sửa mọi khoản ngoài tiền phòng và điện nước; `loai` + `chiTiet` vẫn đủ để bảng thu tiền, bản in và Zalo tách riêng tiền phòng lẻ khi cần.

**Alternatives**: Trường `tienPhongLe` riêng trên `HoaDon` — thêm một ô nhập riêng, người dùng phải tìm ở hai chỗ.

### 9b. Tiền đóng thừa: trừ kỳ sau hoặc bỏ qua

**Chọn**: Khi thu tiền làm số dư âm, người dùng chọn `truKySau` (giữ làm tiền thừa) hoặc `khongTru`. Với `khongTru`, ghi thêm bút toán `boQuaTienThua` dương bằng phần thừa để số dư về 0; lựa chọn lưu trên `ThanhToan.xuLyTienThua`, mặc định theo `CaiDatHoaDon.xuLyTienThuaMacDinh`.

**Lý do**: Thực tế chủ trọ thường bỏ qua tiền lẻ (vd phòng 20 trong bảng Excel đóng thừa 16.000đ nhưng "Còn thiếu" ghi 0đ). Dùng bút toán thay vì ghi số tiền thu nhỏ hơn thực tế → tổng tiền mặt thu được vẫn khớp sổ, và đổi ý được (hủy bút toán).

**Alternatives**: Sửa số tiền thanh toán bằng đúng số nợ — sai lệch với tiền thực nhận, khó đối soát quỹ.

### 9. Ghi nhất quán khi không có transaction

**Chọn**: Dùng `session.withTransaction` khi MongoDB hỗ trợ (phát hiện qua `hello.setName`); nếu không (Docker local), ghi tuần tự theo thứ tự an toàn (tạo tài liệu mới trước, cập nhật trạng thái cuối) và luôn kết thúc bằng `recomputeCongNo`. Nghiệp vụ chuyển/trả phòng lưu `maThaoTac` (idempotency key do client sinh) để gọi lại không tạo trùng.

## Risks / Trade-offs

- **[Dữ liệu cũ không khớp sổ công nợ]** → Script migration tạo bút toán từ `HoaDon.tongTien` và `ThanhToan.soTien`, báo cáo hóa đơn có `daThanhToan` khác tổng thanh toán thực tế; chạy chế độ `--dry-run` trước.
- **[FIFO trả nhầm hóa đơn khách muốn trả]** → Hiển thị rõ phân bổ trong chi tiết thanh toán; tổng số dư luôn đúng nên không mất tiền, chỉ khác hóa đơn nào được đánh dấu đã trả.
- **[Recompute toàn bộ khi khách có nhiều năm dữ liệu]** → Vài trăm bút toán/khách vẫn < 50ms; thêm index `{ khachThue: 1, daHuy: 1, ngayGhiNhan: 1 }`.
- **[1 người đại diện 2 hợp đồng]** → Số dư gộp; UI công nợ cho lọc theo `hopDong`. Chấp nhận ở giai đoạn này.
- **[Đổi người đại diện hợp đồng]** → Không tự chuyển số dư; cần bút toán `dieuChinh` thủ công (ghi rõ trong UI).
- **[Breaking change API thanh toán]** → Giữ tương thích: nếu chỉ gửi `hoaDonId`, server tự lấy `khachThue` từ hóa đơn.
- **[Sửa hóa đơn đã có thanh toán]** → Cho phép sửa số liệu phát sinh; bút toán `hoaDon` được cập nhật theo `tongTien` mới rồi recompute; ghi lịch sử sửa vào `moTa`.

## Migration Plan

1. Backup DB (`npm run db:backup`).
2. Deploy model mới (trường mới đều optional/default) — code cũ vẫn chạy.
3. Chạy `scripts/migrate-cong-no.ts --dry-run` → xem báo cáo chênh lệch; rồi chạy thật:
   - Mỗi `HoaDon` → bút toán `hoaDon` (+tongTien, `ngayGhiNhan = ngayTao`), set `loaiHoaDon='hangThang'`, `kyBatDau = ngày thu của tháng/năm hóa đơn`.
   - Mỗi `ThanhToan` → set `khachThue` từ hóa đơn, bút toán `thanhToan` (−soTien, `ngayGhiNhan = ngayThanhToan`).
   - Mỗi hợp đồng `hoatDong` → `daThuTienPhongDen` = ngày thu kỳ sau của hóa đơn mới nhất, hoặc `ngayBatDau` nếu chưa có hóa đơn.
   - `recomputeCongNo` cho mọi khách.
4. Bật API/UI mới.

**Rollback**: Code cũ bỏ qua các trường mới; `daThanhToan/conLai` vẫn được ghi trên `HoaDon` nên UI cũ hiển thị được. Collection `GiaoDichCongNo` giữ nguyên.

## Open Questions

- **Tiền phòng thu trước hay thu sau?** Đề xuất: thu trước (theo mô tả nghiệp vụ). Nếu cần cả hai, thêm `HopDong.cachThuTienPhong: 'truoc' | 'sau'` ở change sau.
- **Chia theo số ngày thực tế của kỳ hay cố định 30 ngày?** Đề xuất: số ngày thực tế; có thể thêm cài đặt `cachTinhNgayLe`.
- **Phí dịch vụ cố định (rác) có tính theo ngày khi khách mới vào / chuyển phòng không?** Đề xuất: không — thu trọn 1 lần/hóa đơn, không hoàn khi chuyển phòng.
- **Làm tròn áp dụng cho hóa đơn chốt phòng?** Đề xuất: có, cùng quy tắc `lamTronHoaDon`.
- **Hợp đồng mới khi chuyển phòng giữ ngày thu cũ hay đổi sang ngày chuyển?** Đề xuất: giữ ngày thu cũ (khách quen lịch), cho admin đổi trong form.
