import ExcelJS from 'exceljs';
import type { BangThuTien, DongBangThuTien } from './bang-thu-tien';

const MAU: Partial<Record<DongBangThuTien['trangThai'], string>> = {
  daDu: 'FF00CC44',
  motPhan: 'FFFFFF00',
  quaHan: 'FFFF6666',
};

/** Xuất bảng thu tiền ra .xlsx — cùng cột và màu như trên màn hình. */
export async function xuatExcelBangThuTien(bang: BangThuTien): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Quản lý phòng trọ';
  const ws = wb.addWorksheet(`T${bang.thang}-${bang.nam}`, { views: [{ state: 'frozen', xSplit: 2, ySplit: 2 }] });

  ws.mergeCells('A1:R1');
  ws.getCell('A1').value = `Bảng thu tiền tháng ${bang.thang}/${bang.nam} — ${bang.toaNha?.tenToaNha ?? ''}`;
  ws.getCell('A1').font = { bold: true, size: 14 };

  const cot: Array<{ header: string; key: string; width: number; tien?: boolean }> = [
    { header: 'Phòng', key: 'maPhong', width: 8 },
    { header: 'Họ tên người thuê', key: 'hoTen', width: 24 },
    { header: 'Số điện thoại', key: 'soDienThoai', width: 14 },
    { header: 'Số người ở', key: 'soNguoi', width: 9 },
    { header: 'Thu tiền ngày', key: 'ngayThu', width: 9 },
    { header: 'Số điện', key: 'soDien', width: 9 },
    { header: 'Số nước', key: 'soNuoc', width: 9 },
    { header: 'Điện cũ', key: 'chiSoDienCu', width: 10 },
    { header: 'Nước cũ', key: 'chiSoNuocCu', width: 9 },
    { header: 'Điện mới', key: 'chiSoDienMoi', width: 10 },
    { header: 'Nước mới', key: 'chiSoNuocMoi', width: 9 },
    { header: 'Tiền phòng', key: 'tienPhong', width: 13, tien: true },
    { header: 'Phí dịch vụ', key: 'phiDichVu', width: 12, tien: true },
    { header: 'Nợ kỳ trước', key: 'noKyTruoc', width: 13, tien: true },
    { header: 'Số tiền cần đóng', key: 'canDong', width: 15, tien: true },
    { header: 'Số tiền đã đóng', key: 'daDong', width: 15, tien: true },
    { header: 'Còn thiếu', key: 'conThieu', width: 13, tien: true },
    { header: 'Ghi chú', key: 'ghiChu', width: 30 },
  ];
  ws.columns = cot.map((c) => ({ key: c.key, width: c.width }));
  const header = ws.getRow(2);
  cot.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
  });
  header.height = 32;

  const fmtTien = '#,##0" đ";-#,##0" đ"';
  for (const d of bang.dong) {
    const coTien = d.loai === 'hangThang' || d.loai === 'chotPhong';
    const row = ws.addRow({
      maPhong: d.maPhong,
      hoTen: d.hoTen,
      soDienThoai: d.soDienThoai,
      soNguoi: d.soNguoi || null,
      ngayThu: d.ngayThu,
      soDien: coTien ? d.soDien : null,
      soNuoc: coTien ? d.soNuoc : null,
      chiSoDienCu: d.chiSoDienCu,
      chiSoNuocCu: d.chiSoNuocCu,
      chiSoDienMoi: d.chiSoDienMoi,
      chiSoNuocMoi: d.chiSoNuocMoi,
      tienPhong: coTien ? d.tienPhong : null,
      phiDichVu: coTien ? d.phiDichVu : null,
      noKyTruoc: coTien ? d.noKyTruoc : null,
      canDong: coTien ? d.canDong : null,
      daDong: coTien ? d.daDong : null,
      conThieu: coTien ? (d.boQuaTienThua > 0 && d.conThieu === 0 ? 0 : d.conThieu) : null,
      ghiChu: [d.ghiChu, d.boQuaTienThua > 0 ? `Thừa ${d.boQuaTienThua.toLocaleString('vi-VN')}đ (không trừ)` : ''].filter(Boolean).join(' · '),
    });
    cot.forEach((c, i) => { if (c.tien) row.getCell(i + 1).numFmt = fmtTien; });
    const mau = MAU[d.trangThai];
    if (mau) {
      for (const key of ['daDong', 'conThieu']) {
        const idx = cot.findIndex((c) => c.key === key) + 1;
        row.getCell(idx).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: mau } };
      }
    }
  }

  const tong = ws.addRow({
    maPhong: 'Tổng',
    soDien: bang.tong.soDien,
    soNuoc: bang.tong.soNuoc,
    tienPhong: bang.tong.tienPhong,
    phiDichVu: bang.tong.phiDichVu,
    canDong: bang.tong.canDong,
    daDong: bang.tong.daDong,
    conThieu: bang.tong.conThieu,
  });
  tong.font = { bold: true };
  cot.forEach((c, i) => { if (c.tien) tong.getCell(i + 1).numFmt = fmtTien; });

  ws.eachRow((row, n) => {
    if (n < 2) return;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
