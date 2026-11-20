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
}

export interface KetQuaPhanBo {
  /** Số dư = Σ soTien. Dương = khách nợ, âm = tiền thừa. */
  soDu: number;
  /** Số tiền đã phân bổ cho từng hóa đơn (key = hoaDonId). */
  daPhanBoTheoHoaDon: Map<string, number>;
  /** Tổng tiền có (âm) chưa phân bổ hết = tiền thừa của khách. */
  tienThua: number;
}

function toTime(d: Date | string | undefined): number {
  if (!d) return 0;
  return new Date(d).getTime();
}

/** Sắp xếp bút toán theo ngày ghi nhận, rồi ngày tạo, rồi id — cố định để kết quả lặp lại được. */
export function sapXepButToan<T extends ButToanPhanBo>(butToans: T[]): T[] {
  return [...butToans].sort((a, b) =>
    toTime(a.ngayGhiNhan) - toTime(b.ngayGhiNhan)
    || toTime(a.ngayTao) - toTime(b.ngayTao)
    || a.id.localeCompare(b.id)
  );
}

/**
 * Phân bổ FIFO: tổng các bút toán âm (thanh toán, giảm trừ…) được trả lần lượt
 * vào các bút toán dương cũ nhất (hóa đơn, điều chỉnh tăng…).
 */
export function phanBoFIFO(butToans: ButToanPhanBo[]): KetQuaPhanBo {
  let soDu = 0;
  let pool = 0;
  for (const bt of butToans) {
    soDu += bt.soTien;
    if (bt.soTien < 0) pool += -bt.soTien;
  }

  const daPhanBoTheoHoaDon = new Map<string, number>();
  for (const bt of sapXepButToan(butToans.filter((b) => b.soTien > 0))) {
    const phanBo = Math.min(pool, bt.soTien);
    pool -= phanBo;
    if (bt.hoaDon) {
      daPhanBoTheoHoaDon.set(bt.hoaDon, (daPhanBoTheoHoaDon.get(bt.hoaDon) || 0) + phanBo);
    }
  }

  return { soDu, daPhanBoTheoHoaDon, tienThua: pool };
}

export function tinhTrangThaiHoaDon(
  tongTien: number,
  daThanhToan: number,
  hanThanhToan: Date | string | null | undefined,
  now: Date = new Date(),
): { conLai: number; trangThai: TrangThaiHoaDon } {
  const conLai = Math.max(0, tongTien - daThanhToan);
  let trangThai: TrangThaiHoaDon;
  if (conLai <= 0) trangThai = 'daThanhToan';
  else if (hanThanhToan && new Date(hanThanhToan).getTime() < now.getTime()) trangThai = 'quaHan';
  else if (daThanhToan > 0) trangThai = 'daThanhToanMotPhan';
  else trangThai = 'chuaThanhToan';
  return { conLai, trangThai };
}

/**
 * Phần thừa của một thanh toán.
 * @param soDuSauKhiThu số dư khách sau khi đã ghi thanh toán (chưa tính bút toán bỏ qua tiền thừa của chính nó)
 */
export function tinhTienThua(soTien: number, soDuSauKhiThu: number): number {
  return Math.max(0, Math.min(soTien, -soDuSauKhiThu));
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
