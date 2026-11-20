import { describe, expect, it } from 'vitest';
import { phanBoFIFO, tinhTienThua, tinhTrangThaiHoaDon, xemTruocPhanBo, ButToanPhanBo } from './phan-bo';

const d = (s: string) => new Date(s);
let seq = 0;
const bt = (soTien: number, ngay: string, hoaDon?: string): ButToanPhanBo => ({
  id: String(++seq).padStart(4, '0'),
  soTien,
  ngayGhiNhan: d(ngay),
  ngayTao: d(ngay),
  hoaDon: hoaDon ?? null,
});

describe('phanBoFIFO', () => {
  it('đóng thiếu: hóa đơn còn nợ 1.000đ (phòng 11)', () => {
    const kq = phanBoFIFO([bt(1_111_000, '2026-10-21', 'T10'), bt(-1_110_000, '2026-10-22')]);
    expect(kq.soDu).toBe(1_000);
    expect(kq.daPhanBoTheoHoaDon.get('T10')).toBe(1_110_000);
    expect(kq.tienThua).toBe(0);
  });

  it('đóng thừa: số dư âm 500đ (phòng 22)', () => {
    const kq = phanBoFIFO([bt(1_409_500, '2026-10-21', 'T10'), bt(-1_410_000, '2026-10-22')]);
    expect(kq.soDu).toBe(-500);
    expect(kq.daPhanBoTheoHoaDon.get('T10')).toBe(1_409_500);
    expect(kq.tienThua).toBe(500);
  });

  it('trả nợ cũ trước (FIFO)', () => {
    const kq = phanBoFIFO([
      bt(1_111_000, '2026-10-21', 'T10'),
      bt(-1_110_000, '2026-10-22'),
      bt(1_400_000, '2026-11-21', 'T11'),
      bt(-1_000_000, '2026-11-22'),
    ]);
    expect(kq.daPhanBoTheoHoaDon.get('T10')).toBe(1_111_000);
    expect(kq.daPhanBoTheoHoaDon.get('T11')).toBe(999_000);
    expect(kq.soDu).toBe(401_000);
  });

  it('đóng trước khi chưa có hóa đơn: tiền thừa tự trừ vào hóa đơn sau', () => {
    const truoc = phanBoFIFO([bt(-500_000, '2026-11-15')]);
    expect(truoc.soDu).toBe(-500_000);
    expect(truoc.tienThua).toBe(500_000);

    const sau = phanBoFIFO([bt(-500_000, '2026-11-15'), bt(1_400_000, '2026-11-21', 'T11')]);
    expect(sau.daPhanBoTheoHoaDon.get('T11')).toBe(500_000);
    expect(sau.soDu).toBe(900_000);
  });

  it('bỏ qua tiền thừa: bút toán dương không gắn hóa đơn đưa số dư về 0', () => {
    const kq = phanBoFIFO([
      bt(1_084_000, '2026-10-21', 'T10'),
      bt(-1_100_000, '2026-10-22'),
      bt(16_000, '2026-10-22'), // boQuaTienThua
    ]);
    expect(kq.soDu).toBe(0);
    expect(kq.tienThua).toBe(0);
    expect(kq.daPhanBoTheoHoaDon.get('T10')).toBe(1_084_000);
  });

  it('hóa đơn chốt tổng âm hoạt động như một khoản có', () => {
    const kq = phanBoFIFO([bt(-445_645, '2026-11-01', 'CHOT'), bt(1_000_000, '2026-11-21', 'T11')]);
    expect(kq.daPhanBoTheoHoaDon.get('T11')).toBe(445_645);
    expect(kq.daPhanBoTheoHoaDon.has('CHOT')).toBe(false);
  });

  it('thứ tự đầu vào không ảnh hưởng kết quả', () => {
    const list = [bt(300, '2026-01-01', 'A'), bt(500, '2026-02-01', 'B'), bt(-400, '2026-03-01')];
    const a = phanBoFIFO(list);
    const b = phanBoFIFO([...list].reverse());
    expect([...a.daPhanBoTheoHoaDon]).toEqual([...b.daPhanBoTheoHoaDon]);
    expect(a.daPhanBoTheoHoaDon.get('A')).toBe(300);
    expect(a.daPhanBoTheoHoaDon.get('B')).toBe(100);
  });
});

describe('tinhTrangThaiHoaDon', () => {
  const now = d('2026-11-20');
  it('chưa thanh toán / một phần / đủ / quá hạn', () => {
    expect(tinhTrangThaiHoaDon(1000, 0, d('2026-11-25'), now).trangThai).toBe('chuaThanhToan');
    expect(tinhTrangThaiHoaDon(1000, 400, d('2026-11-25'), now)).toEqual({ conLai: 600, trangThai: 'daThanhToanMotPhan' });
    expect(tinhTrangThaiHoaDon(1000, 1000, d('2026-11-01'), now)).toEqual({ conLai: 0, trangThai: 'daThanhToan' });
    expect(tinhTrangThaiHoaDon(1000, 400, d('2026-11-01'), now).trangThai).toBe('quaHan');
  });
});

describe('tinhTienThua', () => {
  it('chỉ phần vượt quá số nợ, tối đa bằng số tiền thu', () => {
    expect(tinhTienThua(1_100_000, -16_000)).toBe(16_000);
    expect(tinhTienThua(1_000_000, 1_000)).toBe(0);
    expect(tinhTienThua(500_000, -800_000)).toBe(500_000); // đã có tiền thừa từ trước
  });
});

describe('xemTruocPhanBo', () => {
  it('trả hóa đơn cũ trước, báo tiền thừa', () => {
    const kq = xemTruocPhanBo(
      [{ _id: '1', maHoaDon: 'T10', conLai: 1_000 }, { _id: '2', maHoaDon: 'T11', conLai: 1_400_000 }],
      1_500_000,
    );
    expect(kq.dong.map((x) => [x.hoaDon.maHoaDon, x.soTien, x.traDu])).toEqual([
      ['T10', 1_000, true],
      ['T11', 1_400_000, true],
    ]);
    expect(kq.tienThua).toBe(99_000);
  });
});
