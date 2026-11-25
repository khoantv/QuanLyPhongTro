'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Download, FileText, Loader2, Pencil, RefreshCw, Save, Search, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThuTienForm } from '@/components/cong-no/thu-tien-form';
import { cn } from '@/lib/utils';
import type { BangThuTien, DongBangThuTien } from '@/lib/bang-thu-tien';

const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} đ`;
const so = (n: number | null | undefined) => (n === null || n === undefined ? '' : n.toLocaleString('vi-VN'));

const MAU_O: Partial<Record<DongBangThuTien['trangThai'], string>> = {
  daDu: 'bg-green-500/80 text-white dark:bg-green-600/70',
  motPhan: 'bg-yellow-300 text-yellow-950 dark:bg-yellow-500/70',
  quaHan: 'bg-red-500/80 text-white dark:bg-red-600/70',
};

function thangHienTai() {
  const s = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  return { nam: Number(s.slice(0, 4)), thang: Number(s.slice(5, 7)) };
}

export default function BangThuTienPage() {
  const now = thangHienTai();
  const [toaNhaList, setToaNhaList] = useState<Array<{ _id: string; tenToaNha: string }>>([]);
  const [toaNha, setToaNha] = useState('');
  const [thang, setThang] = useState(now.thang);
  const [nam, setNam] = useState(now.nam);
  const [tim, setTim] = useState('');
  const [bang, setBang] = useState<BangThuTien | null>(null);
  const [loading, setLoading] = useState(false);
  const [chiSoNhap, setChiSoNhap] = useState<Record<string, { dien: string; nuoc: string }>>({});
  const [chon, setChon] = useState<Record<string, boolean>>({});
  const [dangLuu, setDangLuu] = useState(false);
  const [dangLap, setDangLap] = useState(false);
  // Khấu trừ tiền thừa kỳ trước khi lập hóa đơn hàng loạt — mặc định không trừ
  const [khauTru, setKhauTru] = useState(false);
  const [thuTien, setThuTien] = useState<DongBangThuTien | null>(null);

  useEffect(() => {
    document.title = 'Bảng thu tiền tháng';
    // Quay lại từ form sửa hóa đơn: giữ đúng tháng đang xem
    const sp = new URLSearchParams(window.location.search);
    const t = Number(sp.get('thang'));
    const n = Number(sp.get('nam'));
    if (Number.isInteger(t) && t >= 1 && t <= 12 && Number.isInteger(n) && n >= 2020) {
      setThang(t);
      setNam(n);
    }
    fetch('/api/toa-nha?limit=10000')
      .then((r) => r.json())
      .then((r) => {
        const list = r.data || [];
        setToaNhaList(list);
        let luu = '';
        try { luu = localStorage.getItem('bang-thu-tien:toaNha') || ''; } catch { /* bỏ qua */ }
        setToaNha(list.some((t: { _id: string }) => t._id === luu) ? luu : list[0]?._id || '');
      })
      .catch(() => toast.error('Không tải được danh sách tòa nhà'));
  }, []);

  const taiBang = useCallback(async () => {
    if (!toaNha) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bang-thu-tien?toaNha=${toaNha}&thang=${thang}&nam=${nam}`);
      const r = await res.json();
      if (!res.ok || !r.success) {
        toast.error(r.message || 'Không tải được bảng thu tiền');
        setBang(null);
        return;
      }
      const data: BangThuTien = r.data;
      setBang(data);
      setChiSoNhap({});
      // Mặc định chọn các dòng đã có chỉ số và chưa lập hóa đơn
      setChon(Object.fromEntries(
        data.dong.filter((d) => d.loai === 'chuaLap' && d.trangThai === 'chuaLap' && d.daGhiChiSo && d.hopDongId).map((d) => [d.hopDongId!, true]),
      ));
    } finally {
      setLoading(false);
    }
  }, [toaNha, thang, nam]);

  useEffect(() => {
    taiBang();
    if (toaNha) { try { localStorage.setItem('bang-thu-tien:toaNha', toaNha); } catch { /* bỏ qua */ } }
  }, [taiBang, toaNha]);

  const dongHienThi = useMemo(() => {
    const q = tim.trim().toLowerCase();
    if (!bang) return [];
    if (!q) return bang.dong;
    return bang.dong.filter((d) => d.maPhong.toLowerCase().includes(q) || d.hoTen.toLowerCase().includes(q) || d.soDienThoai.includes(q));
  }, [bang, tim]);

  const choNhapChiSo = (d: DongBangThuTien) => d.loai === 'chuaLap' && d.trangThai === 'chuaLap';
  const giaTriNhap = (d: DongBangThuTien, loai: 'dien' | 'nuoc') =>
    chiSoNhap[d.phongId]?.[loai] ?? String((loai === 'dien' ? d.chiSoDienMoi : d.chiSoNuocMoi) ?? '');
  const loiChiSo = (d: DongBangThuTien, loai: 'dien' | 'nuoc') => {
    const v = giaTriNhap(d, loai);
    const cu = loai === 'dien' ? d.chiSoDienCu : d.chiSoNuocCu;
    return v !== '' && cu !== null && Number(v) < cu;
  };
  const daSuaChiSo = Object.keys(chiSoNhap).length > 0;

  const luuChiSo = async () => {
    if (!bang) return;
    const items = [];
    const boQua: string[] = [];
    for (const d of bang.dong.filter(choNhapChiSo)) {
      const nhap = chiSoNhap[d.phongId];
      if (!nhap) continue;
      const dien = giaTriNhap(d, 'dien');
      const nuoc = giaTriNhap(d, 'nuoc');
      if (dien === '' || nuoc === '') { boQua.push(`${d.maPhong} (thiếu chỉ số)`); continue; }
      if (loiChiSo(d, 'dien') || loiChiSo(d, 'nuoc')) { boQua.push(`${d.maPhong} (nhỏ hơn chỉ số cũ)`); continue; }
      items.push({ phongId: d.phongId, chiSoDienMoi: Number(dien), chiSoNuocMoi: Number(nuoc) });
    }
    if (items.length === 0) {
      toast.error(boQua.length ? `Không lưu được: ${boQua.join(', ')}` : 'Chưa nhập chỉ số nào');
      return;
    }
    setDangLuu(true);
    try {
      const res = await fetch('/api/bang-thu-tien/chi-so', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thang, nam, items }),
      });
      const r = await res.json();
      if (!res.ok || !r.success) return toast.error(r.message || 'Không lưu được chỉ số');
      const loi = [...boQua, ...r.data.loi.map((l: { message: string }) => l.message)];
      toast.success(r.message, { description: loi.length ? `Bỏ qua: ${loi.join('; ')}` : undefined });
      await taiBang();
    } finally {
      setDangLuu(false);
    }
  };

  const hopDongChon = Object.entries(chon).filter(([, v]) => v).map(([k]) => k);
  const lapHoaDon = async () => {
    if (hopDongChon.length === 0) return toast.error('Chưa chọn phòng nào để lập hóa đơn');
    if (daSuaChiSo) return toast.error('Hãy bấm "Lưu chỉ số" trước khi lập hóa đơn');
    setDangLap(true);
    try {
      const res = await fetch('/api/bang-thu-tien/lap-hoa-don', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thang, nam, hopDongIds: hopDongChon, khauTruTienThua: khauTru }),
      });
      const r = await res.json();
      if (!res.ok || !r.success) return toast.error(r.message || 'Không lập được hóa đơn');
      const loi = r.data.loi.map((l: { message: string }) => l.message);
      toast.success(r.message, { description: loi.length ? `Lỗi: ${loi.join('; ')}` : undefined });
      await taiBang();
    } finally {
      setDangLap(false);
    }
  };

  const xuatExcel = () => {
    if (!toaNha) return;
    window.location.href = `/api/bang-thu-tien/export?toaNha=${toaNha}&thang=${thang}&nam=${nam}`;
  };

  const oChiSo = (d: DongBangThuTien, loai: 'dien' | 'nuoc') => {
    if (!choNhapChiSo(d)) return so(loai === 'dien' ? d.chiSoDienMoi : d.chiSoNuocMoi);
    const loi = loiChiSo(d, loai);
    return (
      <Input
        type="number"
        min={0}
        value={giaTriNhap(d, loai)}
        onChange={(e) => setChiSoNhap((m) => ({
          ...m,
          [d.phongId]: { dien: giaTriNhap(d, 'dien'), nuoc: giaTriNhap(d, 'nuoc'), [loai]: e.target.value },
        }))}
        className={cn('h-7 w-20 px-1 text-right text-xs', loi && 'border-red-500 bg-red-50 dark:bg-red-950/40')}
        title={loi ? 'Nhỏ hơn chỉ số cũ' : undefined}
        aria-label={`Chỉ số ${loai === 'dien' ? 'điện' : 'nước'} mới phòng ${d.maPhong}`}
      />
    );
  };

  const tieuThu = (d: DongBangThuTien, loai: 'dien' | 'nuoc') => {
    if (!choNhapChiSo(d) || !chiSoNhap[d.phongId]) return so(loai === 'dien' ? d.soDien : d.soNuoc);
    const v = giaTriNhap(d, loai);
    const cu = loai === 'dien' ? d.chiSoDienCu : d.chiSoNuocCu;
    return v === '' || cu === null ? '' : so(Number(v) - cu);
  };

  const th = 'border px-2 py-2 text-[11px] font-semibold whitespace-nowrap bg-muted';
  const td = 'border px-2 py-1 text-xs whitespace-nowrap';
  const dinh1 = 'sticky left-0 z-10 bg-background';
  const dinh2 = 'sticky left-[64px] z-10 bg-background';

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold">Bảng thu tiền tháng</h1>
          <p className="text-xs md:text-sm text-muted-foreground">Nhập chỉ số, lập hóa đơn và thu tiền cả tòa nhà trên một bảng</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={taiBang} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 sm:mr-2', loading && 'animate-spin')} /><span className="hidden sm:inline">Tải lại</span>
          </Button>
          <Button variant="outline" size="sm" onClick={xuatExcel} disabled={!bang}>
            <Download className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Xuất Excel</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 md:p-4 grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
          <div className="col-span-2">
            <Select value={toaNha} onValueChange={setToaNha}>
              <SelectTrigger><SelectValue placeholder="Chọn tòa nhà" /></SelectTrigger>
              <SelectContent>
                {toaNhaList.map((t) => <SelectItem key={t._id} value={t._id}>{t.tenToaNha}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Select value={String(thang)} onValueChange={(v) => setThang(Number(v))}>
            <SelectTrigger aria-label="Tháng"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>Tháng {i + 1}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" min={2020} value={nam} onChange={(e) => setNam(parseInt(e.target.value) || now.nam)} aria-label="Năm" />
          <div className="relative col-span-2 md:col-span-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Phòng, tên, SĐT…" value={tim} onChange={(e) => setTim(e.target.value)} className="pl-8" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-3 md:p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base md:text-lg">{bang?.toaNha?.tenToaNha ?? '—'} · Tháng {thang}/{nam}</CardTitle>
            <CardDescription className="text-xs">
              Xanh: đã đủ · Vàng: đóng một phần · Đỏ: quá hạn chưa đóng. Còn thiếu âm = khách đóng thừa.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer" title="Không chọn: tiền thừa được giữ lại cho khách, không trừ vào hóa đơn mới">
              <Checkbox checked={khauTru} onCheckedChange={(v) => setKhauTru(Boolean(v))} />
              Khấu trừ tiền thừa kỳ trước
            </label>
            <Button size="sm" variant="outline" onClick={luuChiSo} disabled={!daSuaChiSo || dangLuu}>
              {dangLuu ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Lưu chỉ số
            </Button>
            <Button size="sm" onClick={lapHoaDon} disabled={hopDongChon.length === 0 || dangLap}>
              {dangLap ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}Lập hóa đơn ({hopDongChon.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!toaNha ? (
            <p className="p-6 text-sm text-muted-foreground">Chưa có tòa nhà nào.</p>
          ) : loading && !bang ? (
            <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto max-h-[70vh]">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th className={cn(th, dinh1, 'z-30 w-16 bg-muted')}>Phòng</th>
                    <th className={cn(th, dinh2, 'z-30 min-w-[160px] text-left bg-muted')}>Họ tên người thuê</th>
                    <th className={th}>Số điện thoại</th>
                    <th className={th}>Số người</th>
                    <th className={th}>Ngày thu</th>
                    <th className={th}>Số điện</th>
                    <th className={th}>Số nước</th>
                    <th className={th}>Điện cũ</th>
                    <th className={th}>Nước cũ</th>
                    <th className={th}>Điện mới</th>
                    <th className={th}>Nước mới</th>
                    <th className={th}>Tiền phòng</th>
                    <th className={th}>Phí dịch vụ</th>
                    <th className={th}>Nợ kỳ trước</th>
                    <th className={th}>Cần đóng</th>
                    <th className={th}>Đã đóng</th>
                    <th className={th}>Còn thiếu</th>
                    <th className={th}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {dongHienThi.map((d) => {
                    const coTien = d.loai === 'hangThang' || d.loai === 'chotPhong';
                    const mau = coTien ? MAU_O[d.trangThai] : undefined;
                    return (
                      <tr key={d.key} className={cn('hover:bg-muted/40', d.loai === 'trong' && 'text-muted-foreground')}>
                        <td className={cn(td, dinh1, 'text-center font-medium')}>{d.maPhong}</td>
                        <td className={cn(td, dinh2)}>
                          <div className="flex items-center gap-1">
                            {d.loai === 'chuaLap' && d.trangThai === 'chuaLap' && d.hopDongId && (
                              <Checkbox
                                checked={Boolean(chon[d.hopDongId])}
                                onCheckedChange={(v) => setChon((m) => ({ ...m, [d.hopDongId!]: Boolean(v) }))}
                                aria-label={`Chọn lập hóa đơn phòng ${d.maPhong}`}
                              />
                            )}
                            <span className="truncate max-w-[180px]">{d.hoTen || d.ghiChu}</span>
                          </div>
                          {d.hoTen && d.ghiChu && <div className="text-[10px] text-muted-foreground">{d.ghiChu}</div>}
                        </td>
                        <td className={td}>{d.soDienThoai}</td>
                        <td className={cn(td, 'text-center')}>{d.soNguoi || ''}</td>
                        <td className={cn(td, 'text-center')}>{d.ngayThu ?? ''}</td>
                        <td className={cn(td, 'text-right font-semibold text-red-600')}>{tieuThu(d, 'dien')}</td>
                        <td className={cn(td, 'text-right font-semibold text-red-600')}>{tieuThu(d, 'nuoc')}</td>
                        <td className={cn(td, 'text-right')}>{so(d.chiSoDienCu)}</td>
                        <td className={cn(td, 'text-right')}>{so(d.chiSoNuocCu)}</td>
                        <td className={cn(td, 'text-right')}>{oChiSo(d, 'dien')}</td>
                        <td className={cn(td, 'text-right')}>{oChiSo(d, 'nuoc')}</td>
                        <td className={cn(td, 'text-right')} title={d.tienPhongLe ? `Gồm tiền phòng lẻ ${vnd(d.tienPhongLe)}` : undefined}>
                          {d.loai === 'trong' ? '' : vnd(d.tienPhong)}{d.tienPhongLe ? <span className="text-amber-600">*</span> : null}
                        </td>
                        <td className={cn(td, 'text-right')}>{d.loai === 'trong' ? '' : vnd(d.phiDichVu)}</td>
                        <td className={cn(td, 'text-right', d.noKyTruoc > 0 && 'text-red-600', d.noKyTruoc < 0 && 'text-emerald-700')}>{d.noKyTruoc ? vnd(d.noKyTruoc) : ''}{d.tienThuaKyTruoc > 0 && <div className="text-[10px] text-emerald-700">Thừa {vnd(d.tienThuaKyTruoc)} ({khauTru ? 'sẽ trừ' : 'không trừ'})</div>}</td>
                        <td className={cn(td, 'text-right font-semibold', d.loai === 'chuaLap' && 'italic text-muted-foreground')} title={d.loai === 'chuaLap' ? 'Dự kiến — chưa lập hóa đơn' : undefined}>
                          {d.loai === 'trong' || d.trangThai === 'chuaDenKy' ? '' : vnd(d.canDong - (khauTru ? d.tienThuaKyTruoc : 0))}
                        </td>
                        <td className={cn(td, 'text-right font-semibold', mau)}>{coTien ? vnd(d.daDong) : ''}</td>
                        <td className={cn(td, 'text-right font-semibold', mau)}>
                          {coTien ? vnd(d.conThieu) : ''}
                          {coTien && d.boQuaTienThua > 0 && (
                            <div className="text-[10px] font-normal">Thừa {vnd(d.boQuaTienThua)} (không trừ)</div>
                          )}
                        </td>
                        <td className={cn(td, 'text-center')}>
                          <div className="flex justify-center gap-1">
                            {d.khachThueId && d.loai !== 'trong' && (
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setThuTien(d)} title="Thu tiền">
                                <Wallet className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {d.hoaDonId && (
                              <Button asChild size="sm" variant="ghost" className="h-7 px-2" title="Chỉnh sửa hóa đơn">
                                <Link href={`/dashboard/hoa-don/${d.hoaDonId}?ve=bang-thu-tien`} aria-label={`Chỉnh sửa hóa đơn ${d.maHoaDon}`}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                            )}
                            {d.hoaDonId && (
                              <Button asChild size="sm" variant="ghost" className="h-7 px-2" title={`Hóa đơn ${d.maHoaDon}`}>
                                <Link href={`/hoa-don/${d.hoaDonId}`} target="_blank"><FileText className="h-3.5 w-3.5" /></Link>
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {bang && (
                    <tr className="font-semibold bg-muted/60">
                      <td className={cn(td, dinh1, 'bg-muted')}>Tổng</td>
                      <td className={cn(td, dinh2, 'bg-muted')}>
                        <Badge variant="outline" className="text-[10px]">{bang.dong.filter((d) => d.loai === 'hangThang' || d.loai === 'chotPhong').length} hóa đơn</Badge>
                      </td>
                      <td className={td} colSpan={3} />
                      <td className={cn(td, 'text-right')}>{so(bang.tong.soDien)}</td>
                      <td className={cn(td, 'text-right')}>{so(bang.tong.soNuoc)}</td>
                      <td className={td} colSpan={4} />
                      <td className={cn(td, 'text-right')}>{vnd(bang.tong.tienPhong)}</td>
                      <td className={cn(td, 'text-right')}>{vnd(bang.tong.phiDichVu)}</td>
                      <td className={td} />
                      <td className={cn(td, 'text-right')}>{vnd(bang.tong.canDong)}</td>
                      <td className={cn(td, 'text-right')}>{vnd(bang.tong.daDong)}</td>
                      <td className={cn(td, 'text-right')}>{vnd(bang.tong.conThieu)}</td>
                      <td className={td} />
                    </tr>
                  )}
                </tbody>
              </table>
              {bang && dongHienThi.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Không có phòng nào khớp.</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(thuTien)} onOpenChange={(o) => { if (!o) setThuTien(null); }}>
        <DialogContent className="w-[95vw] md:w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Thu tiền — P.{thuTien?.maPhong} · {thuTien?.hoTen}</DialogTitle>
            <DialogDescription>Tiền được trừ vào hóa đơn cũ nhất trước; phần thừa xử lý theo lựa chọn bên dưới.</DialogDescription>
          </DialogHeader>
          {thuTien?.khachThueId && (
            <ThuTienForm
              key={thuTien.key}
              khachThueId={thuTien.khachThueId}
              soTienGoiY={Math.max(0, thuTien.conThieu)}
              onCancel={() => setThuTien(null)}
              onSuccess={() => { setThuTien(null); taiBang(); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
