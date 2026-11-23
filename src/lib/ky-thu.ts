/**
 * Kỳ thu và tiền phòng theo ngày — logic thuần, không truy cập DB.
 *
 * Mọi "ngày" được hiểu theo lịch Việt Nam (Asia/Ho_Chi_Minh, UTC+7, không có giờ mùa hè)
 * và được lưu dưới dạng Date tại 00:00 giờ VN.
 *
 * - Ngày thu tháng m  = min(ngayThanhToan, số ngày của tháng m)
 * - Kỳ thu            = [ngày thu tháng m, ngày thu tháng m+1)   (nửa mở)
 * - Tiền phòng theo ngày: chia khoảng theo các kỳ, mỗi phần = giaThue × số ngày / số ngày thực tế của kỳ
 */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface NgayVN {
  nam: number;
  thang: number; // 1-12
  ngay: number;  // 1-31
}

export type NgayInput = Date | string | number;

/** Tách ngày theo lịch VN. */
export function ngayVN(d: NgayInput): NgayVN {
  const t = new Date(d).getTime() + VN_OFFSET_MS;
  const u = new Date(t);
  return { nam: u.getUTCFullYear(), thang: u.getUTCMonth() + 1, ngay: u.getUTCDate() };
}

/** Date tại 00:00 giờ VN của ngày (nam, thang, ngay). Tháng ngoài 1-12 được tự cuộn năm. */
export function taoNgayVN(nam: number, thang: number, ngay: number): Date {
  return new Date(Date.UTC(nam, thang - 1, ngay) - VN_OFFSET_MS);
}

/** Cắt về 00:00 giờ VN. */
export function dauNgayVN(d: NgayInput): Date {
  const { nam, thang, ngay } = ngayVN(d);
  return taoNgayVN(nam, thang, ngay);
}

export function soNgayCuaThang(nam: number, thang: number): number {
  return new Date(Date.UTC(nam, thang, 0)).getUTCDate();
}

/** Số ngày từ a đến b (b − a), theo lịch VN. Âm nếu b trước a. */
export function soNgayGiua(a: NgayInput, b: NgayInput): number {
  return Math.round((dauNgayVN(b).getTime() - dauNgayVN(a).getTime()) / DAY_MS);
}

export function congNgay(d: NgayInput, soNgay: number): Date {
  return new Date(dauNgayVN(d).getTime() + soNgay * DAY_MS);
}

/** Chuẩn hóa (nam, thang) khi thang vượt 1-12. */
function chuanThang(nam: number, thang: number): { nam: number; thang: number } {
  const idx = nam * 12 + (thang - 1);
  return { nam: Math.floor(idx / 12), thang: (idx % 12) + 1 };
}

/** Ngày thu của hợp đồng trong tháng (nam, thang). */
export function ngayThu(ngayThanhToan: number, thang: number, nam: number): Date {
  const t = chuanThang(nam, thang);
  return taoNgayVN(t.nam, t.thang, Math.min(ngayThanhToan, soNgayCuaThang(t.nam, t.thang)));
}

export interface KyThu {
  batDau: Date;   // ngày thu tháng m (tính)
  ketThuc: Date;  // ngày thu tháng m+1 (không tính)
  thang: number;  // tháng/năm của ngày bắt đầu
  nam: number;
  soNgay: number;
}

/** Kỳ thu bắt đầu ở ngày thu của tháng (nam, thang). */
export function kyThuCuaThang(ngayThanhToan: number, thang: number, nam: number): KyThu {
  const t = chuanThang(nam, thang);
  const sau = chuanThang(t.nam, t.thang + 1);
  const batDau = ngayThu(ngayThanhToan, t.thang, t.nam);
  const ketThuc = ngayThu(ngayThanhToan, sau.thang, sau.nam);
  return { batDau, ketThuc, thang: t.thang, nam: t.nam, soNgay: soNgayGiua(batDau, ketThuc) };
}

/** Kỳ thu chứa một ngày bất kỳ. */
export function kyThuChua(ngayThanhToan: number, ngay: NgayInput): KyThu {
  const { nam, thang } = ngayVN(ngay);
  const ky = kyThuCuaThang(ngayThanhToan, thang, nam);
  if (soNgayGiua(ky.batDau, ngay) >= 0) return ky;
  const truoc = chuanThang(nam, thang - 1);
  return kyThuCuaThang(ngayThanhToan, truoc.thang, truoc.nam);
}

export interface PhanKyTienPhong {
  tuNgay: Date;
  denNgay: Date;
  soNgay: number;
  soNgayCuaKy: number;
  soTien: number; // chưa làm tròn
}

export interface KetQuaTienPhongTheoNgay {
  soTien: number;       // đã làm tròn đến đồng, có dấu
  soNgay: number;       // có dấu
  chiTiet: PhanKyTienPhong[];
}

/**
 * Tiền phòng cho khoảng [tuNgay, denNgay). Âm nếu denNgay < tuNgay.
 * Khoảng phủ trọn một kỳ cho đúng bằng giaThue.
 */
export function tienPhongTheoNgay(
  giaThue: number,
  ngayThanhToan: number,
  tuNgay: NgayInput,
  denNgay: NgayInput,
): KetQuaTienPhongTheoNgay {
  const soNgayTong = soNgayGiua(tuNgay, denNgay);
  if (soNgayTong === 0) return { soTien: 0, soNgay: 0, chiTiet: [] };
  if (soNgayTong < 0) {
    const kq = tienPhongTheoNgay(giaThue, ngayThanhToan, denNgay, tuNgay);
    return { soTien: -kq.soTien, soNgay: -kq.soNgay, chiTiet: kq.chiTiet };
  }

  const chiTiet: PhanKyTienPhong[] = [];
  let con = dauNgayVN(tuNgay);
  const het = dauNgayVN(denNgay);
  let tong = 0;
  while (soNgayGiua(con, het) > 0) {
    const ky = kyThuChua(ngayThanhToan, con);
    const den = soNgayGiua(ky.ketThuc, het) < 0 ? het : ky.ketThuc;
    const soNgay = soNgayGiua(con, den);
    const soTien = (giaThue * soNgay) / ky.soNgay;
    chiTiet.push({ tuNgay: con, denNgay: den, soNgay, soNgayCuaKy: ky.soNgay, soTien });
    tong += soTien;
    con = den;
  }
  return { soTien: Math.round(tong), soNgay: soNgayTong, chiTiet };
}

/**
 * Làm tròn về 1.000đ: phần dư ≤ 500 làm tròn xuống, > 500 làm tròn lên.
 * Số âm làm tròn đối xứng.
 */
export function lamTron1000(soTien: number): number {
  if (soTien < 0) return -lamTron1000(-soTien);
  const du = soTien % 1000;
  return du <= 500 ? soTien - du : soTien - du + 1000;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "DD/MM" theo lịch VN. */
export function fmtNgayThang(d: NgayInput): string {
  const { ngay, thang } = ngayVN(d);
  return `${pad(ngay)}/${pad(thang)}`;
}

/** "DD/MM/YYYY" theo lịch VN. */
export function fmtNgay(d: NgayInput): string {
  const { ngay, thang, nam } = ngayVN(d);
  return `${pad(ngay)}/${pad(thang)}/${nam}`;
}

/** Tên dòng tiền phòng lẻ: "Tiền phòng lẻ (05/10 – 20/10, 16 ngày)" — ngày cuối là ngày trước ngày kết thúc. */
export function tenTienPhongLe(tuNgay: NgayInput, denNgay: NgayInput, soNgay: number): string {
  return `Tiền phòng lẻ (${fmtNgayThang(tuNgay)} – ${fmtNgayThang(congNgay(denNgay, -1))}, ${soNgay} ngày)`;
}

/** "YYYY-MM-DD" (giá trị của input type=date) → Date 00:00 giờ VN; rỗng / sai định dạng → null */
export function docNgayInput(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? taoNgayVN(Number(m[1]), Number(m[2]), Number(m[3])) : null;
}

/**
 * Khoản thu theo số ngày ở: từ ngày chuyển vào đến ngày thu kế tiếp (không tính ngày thu).
 * Số tiền = tiền 1 tháng × số ngày / số ngày của kỳ thu — cùng công thức tiền phòng lẻ.
 * Chuyển vào đúng ngày thu → trọn một kỳ.
 */
export function tinhTheoNgayChuyenVao(ngayChuyenVao: string, ngayThuHangThang: number, tienMotThang: number) {
  const tuNgay = docNgayInput(ngayChuyenVao);
  if (!tuNgay || ngayThuHangThang < 1 || ngayThuHangThang > 31 || tienMotThang < 0) return null;
  const ky = kyThuChua(ngayThuHangThang, tuNgay);
  const soNgay = soNgayGiua(tuNgay, ky.ketThuc);
  const soTien = Math.round((tienMotThang * soNgay) / ky.soNgay);
  return { tuNgay, denNgay: ky.ketThuc, soNgay, soNgayCuaKy: ky.soNgay, soTien };
}
