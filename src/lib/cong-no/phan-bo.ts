/**
 * Logic thuần (không truy cập DB) cho sổ công nợ — dùng được cả ở server và client.
 */

export type TrangThaiHoaDon = 'chuaThanhToan' | 'daThanhToanMotPhan' | 'daThanhToan' | 'quaHan';

export interface ButToanPhanBo {
  id: string;
  soTien: number;
  ngayGhiNhan: Date | string;
  ngayTao?: Date | string;
  hoaDon?: string | null;
  /** Hóa đơn không khấu trừ tiền thừa có từ trước khi lập */
  khongKhauTru?: boolean;
}

export interface KetQuaPhanBo {
  /** Số dư = Σ soTien. Dương = khách nợ, âm = tiền thừa. */
  soDu: number;
  /** Số tiền đã phân bổ cho từng hóa đơn (key = hoaDonId). */
  daPhanBoTheoHoaDon: Map<string, number>;
  /** Trong đó: phần lấy từ tiền có trước khi lập hóa đơn (khấu trừ tiền thừa kỳ trước). */
  daKhauTruTheoHoaDon: Map<string, number>;
  /** Tổng tiền có (âm) chưa phân bổ hết = tiền thừa của khách. */
  tienThua: number;
  /** Tổng các khoản nợ chưa được trả. soDu = noConLai − tienThua. */
  noConLai: number;
}

function toTime(d: Date | string | undefined): number {
  if (!d) return 0;
  return new Date(d).getTime();
}

const thoiDiemTao = (b: ButToanPhanBo) => toTime(b.ngayTao ?? b.ngayGhiNhan);

/** Sắp xếp bút toán theo ngày ghi nhận, rồi ngày tạo, rồi id — cố định để kết quả lặp lại được. */
export function sapXepButToan<T extends ButToanPhanBo>(butToans: T[]): T[] {
  return [...butToans].sort((a, b) =>
    toTime(a.ngayGhiNhan) - toTime(b.ngayGhiNhan)
    || toTime(a.ngayTao) - toTime(b.ngayTao)
    || a.id.localeCompare(b.id)
  );
}

/**
 * Phân bổ FIFO: từng bút toán âm (thanh toán, giảm trừ…) được trả lần lượt vào các bút toán dương
 * cũ nhất (hóa đơn, điều chỉnh tăng…).
 * Hóa đơn `khongKhauTru` chỉ nhận khoản tiền được ghi nhận SAU khi lập hóa đơn — tiền thừa có từ trước
 * vẫn giữ nguyên là tiền thừa của khách.
 */
export function phanBoFIFO(butToans: ButToanPhanBo[]): KetQuaPhanBo {
  const soDu = butToans.reduce((s, bt) => s + bt.soTien, 0);
  const no = sapXepButToan(butToans.filter((b) => b.soTien > 0)).map((bt) => ({ bt, conLai: bt.soTien }));
  const co = butToans
    .filter((b) => b.soTien < 0)
    .sort((a, b) => thoiDiemTao(a) - thoiDiemTao(b) || a.id.localeCompare(b.id));

  const daPhanBoTheoHoaDon = new Map<string, number>();
  const daKhauTruTheoHoaDon = new Map<string, number>();
  const cong = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) || 0) + v);
  let tienThua = 0;

  for (const c of co) {
    let pool = -c.soTien;
    for (const n of no) {
      if (pool <= 0) break;
      const coTuTruoc = thoiDiemTao(c) < thoiDiemTao(n.bt);
      if (n.conLai <= 0 || (n.bt.khongKhauTru && coTuTruoc)) continue;
      const phanBo = Math.min(pool, n.conLai);
      pool -= phanBo;
      n.conLai -= phanBo;
      if (n.bt.hoaDon) {
        cong(daPhanBoTheoHoaDon, n.bt.hoaDon, phanBo);
        if (coTuTruoc) cong(daKhauTruTheoHoaDon, n.bt.hoaDon, phanBo);
      }
    }
    tienThua += pool;
  }
  for (const n of no) {
    if (n.bt.hoaDon && !daPhanBoTheoHoaDon.has(n.bt.hoaDon)) daPhanBoTheoHoaDon.set(n.bt.hoaDon, 0);
  }

  return { soDu, daPhanBoTheoHoaDon, daKhauTruTheoHoaDon, tienThua, noConLai: no.reduce((s, n) => s + n.conLai, 0) };
}

/** Nợ kỳ trước ghi lên hóa đơn mới: có khấu trừ → số dư (âm nếu thừa); không khấu trừ → chỉ phần còn nợ. */
export function tinhNoKyTruoc(kq: Pick<KetQuaPhanBo, 'soDu' | 'noConLai'>, khauTru: boolean): number {
  return khauTru ? kq.soDu : kq.noConLai;
}

/** @param daKhauTru phần tiền thừa kỳ trước đã trừ vào hóa đơn — không tính là một lần thanh toán */
export function tinhTrangThaiHoaDon(
  tongTien: number,
  daThanhToan: number,
  hanThanhToan: Date | string | null | undefined,
  now: Date = new Date(),
  daKhauTru = 0,
): { conLai: number; trangThai: TrangThaiHoaDon } {
  const conLai = Math.max(0, tongTien - daThanhToan);
  let trangThai: TrangThaiHoaDon;
  if (conLai <= 0) trangThai = 'daThanhToan';
  else if (hanThanhToan && new Date(hanThanhToan).getTime() < now.getTime()) trangThai = 'quaHan';
  else if (daThanhToan - daKhauTru > 0) trangThai = 'daThanhToanMotPhan';
  else trangThai = 'chuaThanhToan';
  return { conLai, trangThai };
}

/** Phần thừa do chính một thanh toán tạo ra = tiền thừa khi có thanh toán − tiền thừa khi chưa có. */
export function tinhTienThua(soTien: number, tienThuaKhiCo: number, tienThuaKhiChua: number): number {
  return Math.max(0, Math.min(soTien, tienThuaKhiCo - tienThuaKhiChua));
}

export interface HoaDonMo {
  _id: string;
  maHoaDon: string;
  conLai: number;
}

/** Xem trước một khoản thu sẽ trả cho những hóa đơn nào (hóa đơn đã sắp cũ → mới). */
export function xemTruocPhanBo(hoaDonMo: HoaDonMo[], soTien: number) {
  let conLaiTien = Math.max(0, soTien);
  const dong: Array<{ hoaDon: HoaDonMo; soTien: number; traDu: boolean }> = [];
  for (const hd of hoaDonMo) {
    if (conLaiTien <= 0) break;
    const tra = Math.min(conLaiTien, hd.conLai);
    if (tra <= 0) continue;
    dong.push({ hoaDon: hd, soTien: tra, traDu: tra >= hd.conLai });
    conLaiTien -= tra;
  }
  return { dong, tienThua: conLaiTien };
}
