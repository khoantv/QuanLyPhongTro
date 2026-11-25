import { describe, expect, it } from 'vitest';
import { phanBoFIFO, tinhNoKyTruoc, tinhTienThua, tinhTrangThaiHoaDon, xemTruocPhanBo, ButToanPhanBo } from './phan-bo';

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
  it('phần thừa do chính thanh toán tạo ra, tối đa bằng số tiền thu', () => {
    expect(tinhTienThua(1_100_000, 16_000, 0)).toBe(16_000);
    expect(tinhTienThua(1_000_000, 0, 0)).toBe(0);
    expect(tinhTienThua(500_000, 800_000, 300_000)).toBe(500_000); // đã có tiền thừa từ trước
    expect(tinhTienThua(1_370_500, 1_500, 500)).toBe(1_000); // 500đ giữ lại không bị tính vào
  });
});

describe('không khấu trừ tiền thừa kỳ trước (phòng 22)', () => {
  const T10 = bt(1_409_500, '2026-10-21', 'T10');
  const thuT10 = bt(-1_410_000, '2026-10-22');
  const T11 = bt(1_369_500, '2026-11-21', 'T11');
  const T11Khong = { ...T11, khongKhauTru: true };

  it('không trừ: T11 chưa được trả đồng nào, 500đ vẫn là tiền thừa của khách', () => {
    const kq = phanBoFIFO([T10, thuT10, T11Khong]);
    expect(kq.daPhanBoTheoHoaDon.get('T11')).toBe(0);
    expect(kq.tienThua).toBe(500);
    expect(kq.noConLai).toBe(1_369_500);
    expect(kq.soDu).toBe(1_369_000);
    expect(tinhTrangThaiHoaDon(1_369_500, 0, '2099-01-01').trangThai).toBe('chuaThanhToan');
  });

  it('không trừ: tiền thu sau khi lập T11 vẫn trả cho T11, tiền thừa giữ nguyên', () => {
    const kq = phanBoFIFO([T10, thuT10, T11Khong, bt(-1_369_500, '2026-11-22')]);
    expect(kq.daPhanBoTheoHoaDon.get('T11')).toBe(1_369_500);
    expect(kq.tienThua).toBe(500);
    expect(kq.noConLai).toBe(0);
  });

  it('không trừ T11 rồi trừ T12: 500đ được dùng cho T12', () => {
    const kq = phanBoFIFO([T10, thuT10, T11Khong, bt(-1_369_500, '2026-11-22'), bt(1_000_000, '2026-12-21', 'T12')]);
    expect(kq.daPhanBoTheoHoaDon.get('T12')).toBe(500);
    expect(kq.daKhauTruTheoHoaDon.get('T12')).toBe(500);
    expect(kq.tienThua).toBe(0);
  });

  it('có trừ: 500đ là khấu trừ, không phải "thanh toán một phần"', () => {
    const kq = phanBoFIFO([T10, thuT10, T11]);
    expect(kq.daPhanBoTheoHoaDon.get('T11')).toBe(500);
    expect(kq.daKhauTruTheoHoaDon.get('T11')).toBe(500);
    expect(kq.daKhauTruTheoHoaDon.get('T10') ?? 0).toBe(0);
    expect(tinhTrangThaiHoaDon(1_369_500, 500, '2099-01-01', new Date(), 500)).toEqual({ conLai: 1_369_000, trangThai: 'chuaThanhToan' });
  });

  it('nợ kỳ trước luôn được tính dù không khấu trừ', () => {
    const truoc = phanBoFIFO([bt(1_111_000, '2026-10-21', 'A'), bt(-1_110_000, '2026-10-22')]);
    expect(tinhNoKyTruoc(truoc, false)).toBe(1_000);
    expect(tinhNoKyTruoc(phanBoFIFO([T10, thuT10]), false)).toBe(0);
    expect(tinhNoKyTruoc(phanBoFIFO([T10, thuT10]), true)).toBe(-500);
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
