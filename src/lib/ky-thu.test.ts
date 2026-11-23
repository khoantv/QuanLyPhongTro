import { describe, expect, it } from 'vitest';
import {
  tinhTheoNgayChuyenVao,
  fmtNgay, kyThuChua, kyThuCuaThang, lamTron1000, ngayThu, soNgayGiua, taoNgayVN, tenTienPhongLe, tienPhongTheoNgay,
} from './ky-thu';

const d = (y: number, m: number, day: number) => taoNgayVN(y, m, day);

describe('kỳ thu', () => {
  it('ngày thu 21 tháng 10/2026 → kỳ 21/10 – 21/11, 31 ngày', () => {
    const ky = kyThuCuaThang(21, 10, 2026);
    expect(fmtNgay(ky.batDau)).toBe('21/10/2026');
    expect(fmtNgay(ky.ketThuc)).toBe('21/11/2026');
    expect(ky.soNgay).toBe(31);
  });

  it('ngày thu 31 ở tháng 2 → 28/02, kỳ dài 31 ngày', () => {
    expect(fmtNgay(ngayThu(31, 2, 2027))).toBe('28/02/2027');
    const ky = kyThuCuaThang(31, 2, 2027);
    expect(fmtNgay(ky.ketThuc)).toBe('31/03/2027');
    expect(ky.soNgay).toBe(31);
  });

  it('tháng 12 cuộn sang năm sau', () => {
    const ky = kyThuCuaThang(10, 12, 2026);
    expect(fmtNgay(ky.ketThuc)).toBe('10/01/2027');
  });

  it('kỳ chứa một ngày', () => {
    expect(fmtNgay(kyThuChua(21, d(2026, 10, 5)).batDau)).toBe('21/09/2026');
    expect(fmtNgay(kyThuChua(21, d(2026, 10, 21)).batDau)).toBe('21/10/2026');
  });

  it('không lệch múi giờ khi Date tạo ở UTC', () => {
    // 2026-10-04T17:00:00Z = 00:00 ngày 05/10 giờ VN
    expect(soNgayGiua(new Date('2026-10-04T17:00:00Z'), d(2026, 10, 21))).toBe(16);
  });
});

describe('tiền phòng theo ngày', () => {
  it('một phần kỳ: 900.000 × 16/30 = 480.000', () => {
    const kq = tienPhongTheoNgay(900_000, 21, d(2026, 10, 5), d(2026, 10, 21));
    expect(kq.soTien).toBe(480_000);
    expect(kq.soNgay).toBe(16);
    expect(kq.chiTiet).toHaveLength(1);
    expect(kq.chiTiet[0].soNgayCuaKy).toBe(30);
  });

  it('trọn một kỳ 31 ngày = đúng giá thuê', () => {
    expect(tienPhongTheoNgay(900_000, 21, d(2026, 10, 21), d(2026, 11, 21)).soTien).toBe(900_000);
  });

  it('khoảng ngược chiều cho số âm: −(900.000 × 20/31)', () => {
    expect(tienPhongTheoNgay(900_000, 21, d(2026, 11, 21), d(2026, 11, 1)).soTien).toBe(-580_645);
  });

  it('chuyển sang phòng 450.000 ngày 01/11 → 290.323', () => {
    expect(tienPhongTheoNgay(450_000, 21, d(2026, 11, 1), d(2026, 11, 21)).soTien).toBe(290_323);
  });

  it('chốt trước kỳ thu đầu: 7 ngày / 30 = 210.000', () => {
    expect(tienPhongTheoNgay(900_000, 21, d(2026, 10, 5), d(2026, 10, 12)).soTien).toBe(210_000);
  });

  it('khoảng trải qua nhiều kỳ', () => {
    // 05/10 → 21/11: 16/30 kỳ trước + trọn kỳ 21/10–21/11
    const kq = tienPhongTheoNgay(900_000, 21, d(2026, 10, 5), d(2026, 11, 21));
    expect(kq.soTien).toBe(1_380_000);
    expect(kq.chiTiet).toHaveLength(2);
  });

  it('trùng ngày → 0', () => {
    expect(tienPhongTheoNgay(900_000, 21, d(2026, 10, 21), d(2026, 10, 21)).soTien).toBe(0);
  });

  it('tên dòng tiền phòng lẻ', () => {
    expect(tenTienPhongLe(d(2026, 10, 5), d(2026, 10, 21), 16)).toBe('Tiền phòng lẻ (05/10 – 20/10, 16 ngày)');
  });
});

describe('làm tròn 1.000đ', () => {
  it.each([
    [4_300, 4_000], [4_500, 4_000], [4_600, 5_000], [4_800, 5_000], [4_000, 4_000],
    [1_199_500, 1_199_000], [2_009_600, 2_010_000], [-445_645, -446_000],
  ])('%i → %i', (vao, ra) => expect(lamTron1000(vao)).toBe(ra));
});

describe('tính theo ngày chuyển vào', () => {
  it('vào 05/11, thu ngày 21 → 05/11–20/11 là 16 ngày của kỳ 31 ngày', () => {
    const kq = tinhTheoNgayChuyenVao('2026-11-05', 21, 900000)!;
    expect(kq.soNgay).toBe(16);
    expect(kq.soNgayCuaKy).toBe(31); // kỳ 21/10 → 21/11 có 31 ngày
    expect(kq.soTien).toBe(Math.round((900000 * 16) / 31));
    expect(fmtNgay(kq.denNgay)).toBe('21/11/2026');
  });

  it('vào sau ngày thu → tính đến ngày thu tháng sau', () => {
    const kq = tinhTheoNgayChuyenVao('2026-11-25', 21, 900000)!;
    expect(fmtNgay(kq.denNgay)).toBe('21/12/2026');
    expect(kq.soNgay).toBe(26);
    expect(kq.soNgayCuaKy).toBe(30);
    expect(kq.soTien).toBe(780000);
  });

  it('vào đúng ngày thu → trọn một kỳ', () => {
    const kq = tinhTheoNgayChuyenVao('2026-11-21', 21, 900000)!;
    expect(kq.soNgay).toBe(kq.soNgayCuaKy);
    expect(kq.soTien).toBe(900000);
  });

  it('ngày thu chỉnh được (ngày 5)', () => {
    const kq = tinhTheoNgayChuyenVao('2026-11-20', 5, 600000)!;
    expect(fmtNgay(kq.denNgay)).toBe('05/12/2026');
    expect(kq.soNgay).toBe(15);
    expect(kq.soTien).toBe(300000);
  });

  it('dữ liệu không hợp lệ → null', () => {
    expect(tinhTheoNgayChuyenVao('', 21, 900000)).toBeNull();
    expect(tinhTheoNgayChuyenVao('2026-11-05', 0, 900000)).toBeNull();
  });
});
