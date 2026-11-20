import { LapHoaDonError } from '@/lib/hoa-don/lap-hoa-don';

export function docThangNam(sp: URLSearchParams | { thang?: unknown; nam?: unknown }) {
  const lay = (k: 'thang' | 'nam') => (sp instanceof URLSearchParams ? sp.get(k) : sp[k]);
  const thang = Number(lay('thang'));
  const nam = Number(lay('nam'));
  if (!Number.isInteger(thang) || thang < 1 || thang > 12 || !Number.isInteger(nam) || nam < 2020) {
    throw new LapHoaDonError('Tháng/năm không hợp lệ');
  }
  return { thang, nam };
}

export const coQuanLy = (role?: string | null) => role === 'admin' || role === 'chuNha';
