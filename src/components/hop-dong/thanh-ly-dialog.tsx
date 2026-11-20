'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GiamTruEditor, PhiDichVuEditor, lamTron1000 } from '@/components/hoa-don/khoan-thu-editor';
import { SoDuBadge, formatVND } from '@/components/cong-no/so-du';
import type { KhoanGiamTru, PhiDichVu } from '@/types';

export type LoaiThanhLy = 'chuyenPhong' | 'traPhong';

export interface HopDongThanhLy {
  _id: string;
  maHopDong: string;
  maPhong?: string;
  tenKhach?: string;
  nguoiDaiDienId?: string;
}

interface BanTinh {
  hopDong: { maPhong: string; giaThue: number; giaDien: number; giaNuoc: number; tienCoc: number };
  ngayChot: string;
  mocTienPhong: string;
  chiSoDienBanDau: number;
  chiSoDienChot: number;
  soDien: number;
  tienDien: number;
  chiSoNuocBanDau: number;
  chiSoNuocChot: number;
  soNuoc: number;
  tienNuoc: number;
  tienPhongDieuChinh: { soTien: number; soNgay: number };
  phiDichVu: PhiDichVu[];
  khoanGiamTru: KhoanGiamTru[];
  tongTien: number;
  soDuTruoc: number;
}

interface XemTruoc {
  hoanTienPhong: boolean;
  banTinh: BanTinh;
  coc: { tienCoc: number; truCoc?: number; cocConLai?: number };
  phongMoi: null | {
    phong: { _id: string; maPhong: string; giaThue: number; tienCoc: number };
    chiSoGoiY: null | { dien: number; nuoc: number; nguon: string };
  };
}

interface PhongTrong {
  _id: string;
  maPhong: string;
  giaThue: number;
  tienCoc: number;
}

const homNay = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const fmtNgay = (d: string) => new Date(d).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

export function ThanhLyDialog({
  hopDong,
  loai,
  open,
  onOpenChange,
  onDone,
}: {
  hopDong: HopDongThanhLy | null;
  loai: LoaiThanhLy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const laChuyen = loai === 'chuyenPhong';
  const maThaoTac = useRef('');
  const [ngay, setNgay] = useState(homNay());
  const [chiSoDien, setChiSoDien] = useState('');
  const [chiSoNuoc, setChiSoNuoc] = useState('');
  const [thayDien, setThayDien] = useState('');
  const [thayNuoc, setThayNuoc] = useState('');
  const [hoanTienPhong, setHoanTienPhong] = useState<boolean | null>(null);
  const [dungCocTruNo, setDungCocTruNo] = useState(true);
  // Chuyển phòng
  const [phongTrong, setPhongTrong] = useState<PhongTrong[]>([]);
  const [phongMoiId, setPhongMoiId] = useState('');
  const [chiSoDienMoi, setChiSoDienMoi] = useState('');
  const [chiSoNuocMoi, setChiSoNuocMoi] = useState('');
  const [giaThueMoi, setGiaThueMoi] = useState('');
  const [tienCocMoi, setTienCocMoi] = useState('');

  const [xemTruoc, setXemTruoc] = useState<XemTruoc | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangTai, setDangTai] = useState(false);
  const [phi, setPhi] = useState<PhiDichVu[]>([]);
  const [giamTru, setGiamTru] = useState<KhoanGiamTru[]>([]);
  const [lamTron, setLamTron] = useState(false);
  const [dangGui, setDangGui] = useState(false);
  const [ketQua, setKetQua] = useState<null | { cocConLai: number; soDuCuoi: number; hopDongMoi?: { maHopDong: string } }>(null);

  // Reset mỗi lần mở
  useEffect(() => {
    if (!open || !hopDong) return;
    maThaoTac.current = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setNgay(homNay());
    setChiSoDien(''); setChiSoNuoc(''); setThayDien(''); setThayNuoc('');
    setHoanTienPhong(null); setDungCocTruNo(true);
    setPhongMoiId(''); setChiSoDienMoi(''); setChiSoNuocMoi(''); setGiaThueMoi(''); setTienCocMoi('');
    setXemTruoc(null); setLoi(null); setKetQua(null);
    fetch('/api/cai-dat-hoa-don').then(r => r.json()).then(r => { if (r.success) setLamTron(Boolean(r.data.lamTronHoaDon)); }).catch(() => undefined);
    if (laChuyen) {
      fetch('/api/phong?trangThai=trong&limit=500').then(r => r.json()).then(r => setPhongTrong(r.data || [])).catch(() => setPhongTrong([]));
    }
  }, [open, hopDong, laChuyen]);

  // Xem trước (debounce)
  useEffect(() => {
    if (!open || !hopDong || ketQua) return;
    const t = setTimeout(async () => {
      const sp = new URLSearchParams({ loai, ngay });
      if (chiSoDien !== '') sp.set('chiSoDien', chiSoDien);
      if (chiSoNuoc !== '') sp.set('chiSoNuoc', chiSoNuoc);
      if (thayDien !== '') sp.set('soDienThayDongHo', thayDien);
      if (thayNuoc !== '') sp.set('soNuocThayDongHo', thayNuoc);
      if (hoanTienPhong !== null) sp.set('hoanTienPhong', hoanTienPhong ? '1' : '0');
      sp.set('dungCocTruNo', dungCocTruNo ? '1' : '0');
      if (laChuyen && phongMoiId) sp.set('phongMoiId', phongMoiId);
      setDangTai(true);
      try {
        const res = await fetch(`/api/hop-dong/${hopDong._id}/tinh-tien-chot?${sp}`);
        const r = await res.json();
        if (!res.ok || !r.success) {
          setLoi(r.message || 'Không tính được');
          setXemTruoc(null);
          return;
        }
        const d: XemTruoc = r.data;
        setLoi(null);
        setXemTruoc(d);
        setPhi(d.banTinh.phiDichVu);
        setGiamTru(d.banTinh.khoanGiamTru);
        if (hoanTienPhong === null) setHoanTienPhong(d.hoanTienPhong);
        if (chiSoDien === '') setChiSoDien(String(d.banTinh.chiSoDienChot));
        if (chiSoNuoc === '') setChiSoNuoc(String(d.banTinh.chiSoNuocChot));
        if (d.phongMoi) {
          if (chiSoDienMoi === '' && d.phongMoi.chiSoGoiY) setChiSoDienMoi(String(d.phongMoi.chiSoGoiY.dien));
          if (chiSoNuocMoi === '' && d.phongMoi.chiSoGoiY) setChiSoNuocMoi(String(d.phongMoi.chiSoGoiY.nuoc));
          if (giaThueMoi === '') setGiaThueMoi(String(d.phongMoi.phong.giaThue));
          if (tienCocMoi === '') setTienCocMoi(String(d.coc.tienCoc));
        }
      } catch {
        setLoi('Không tải được bảng tính');
      } finally {
        setDangTai(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hopDong, loai, ngay, chiSoDien, chiSoNuoc, thayDien, thayNuoc, hoanTienPhong, dungCocTruNo, phongMoiId, ketQua]);

  const bt = xemTruoc?.banTinh;
  const dienGiam = bt ? Number(chiSoDien) < bt.chiSoDienBanDau : false;
  const nuocGiam = bt ? Number(chiSoNuoc) < bt.chiSoNuocBanDau : false;

  const tong = useMemo(() => {
    if (!bt) return 0;
    const truoc = bt.tienDien + bt.tienNuoc + phi.reduce((s, p) => s + (p.gia || 0), 0) - giamTru.reduce((s, g) => s + (g.soTien || 0), 0);
    return lamTron ? lamTron1000(truoc) : truoc;
  }, [bt, phi, giamTru, lamTron]);
  const soDuSau = (bt?.soDuTruoc ?? 0) + tong;
  const tienCoc = xemTruoc?.coc.tienCoc ?? 0;
  const truCoc = !laChuyen && dungCocTruNo ? Math.min(tienCoc, Math.max(0, soDuSau)) : 0;
  const cocMoi = tienCocMoi === '' ? tienCoc : Number(tienCocMoi);

  const xacNhan = async () => {
    if (!hopDong || !bt) return;
    if (laChuyen && !phongMoiId) return toast.error('Vui lòng chọn phòng mới');
    if (laChuyen && (chiSoDienMoi === '' || chiSoNuocMoi === '')) return toast.error('Vui lòng nhập chỉ số bắt đầu của phòng mới');
    setDangGui(true);
    try {
      const chung = {
        chiSoDienChot: Number(chiSoDien),
        chiSoNuocChot: Number(chiSoNuoc),
        thayDongHo: {
          ...(dienGiam && thayDien !== '' ? { soDien: Number(thayDien) } : {}),
          ...(nuocGiam && thayNuoc !== '' ? { soNuoc: Number(thayNuoc) } : {}),
        },
        phiDichVu: phi,
        khoanGiamTru: giamTru,
        maThaoTac: maThaoTac.current,
      };
      const body = laChuyen
        ? {
          ...chung,
          ngayChuyen: ngay,
          phongMoiId,
          chiSoDienBatDauPhongMoi: Number(chiSoDienMoi),
          chiSoNuocBatDauPhongMoi: Number(chiSoNuocMoi),
          giaThueMoi: giaThueMoi === '' ? null : Number(giaThueMoi),
          tienCocMoi: tienCocMoi === '' ? null : Number(tienCocMoi),
        }
        : { ...chung, ngayTraPhong: ngay, hoanTienPhong: Boolean(hoanTienPhong), dungCocTruNo };
      const res = await fetch(`/api/hop-dong/${hopDong._id}/${laChuyen ? 'chuyen-phong' : 'tra-phong'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const r = await res.json();
      if (!res.ok || !r.success) return toast.error(r.message || 'Không thực hiện được');
      toast.success(r.message);
      onDone();
      if (laChuyen) {
        onOpenChange(false);
      } else {
        setKetQua({ cocConLai: r.data.cocConLai ?? 0, soDuCuoi: r.data.soDuCuoi ?? 0 });
      }
    } finally {
      setDangGui(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] md:w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{laChuyen ? 'Chuyển phòng' : 'Trả phòng'} — {hopDong?.maHopDong}{hopDong?.maPhong ? ` · P.${hopDong.maPhong}` : ''}</DialogTitle>
          <DialogDescription>
            {laChuyen
              ? 'Chốt điện nước phòng cũ, tính lại tiền phòng theo ngày và tạo hợp đồng mới ở phòng mới. Nợ / tiền thừa đi theo khách.'
              : 'Chốt điện nước, tính tiền phòng theo ngày và thanh lý hợp đồng.'}
          </DialogDescription>
        </DialogHeader>

        {ketQua && hopDong ? (
          <KetQuaTraPhong hopDong={hopDong} ketQua={ketQua} onXong={() => { onDone(); onOpenChange(false); }} />
        ) : (
          <div className="space-y-5">
            {/* Thông tin chốt */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">1. {laChuyen ? 'Ngày chuyển & chỉ số phòng cũ' : 'Ngày trả phòng & chỉ số chốt'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="tl-ngay">{laChuyen ? 'Ngày chuyển' : 'Ngày trả phòng'}</Label>
                  <Input id="tl-ngay" type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tl-dien">Chỉ số điện chốt</Label>
                  <Input id="tl-dien" type="number" min={0} value={chiSoDien} onChange={(e) => setChiSoDien(e.target.value)} className={dienGiam ? 'border-red-400' : ''} />
                  {bt && <p className="text-xs text-muted-foreground">Đầu kỳ: {bt.chiSoDienBanDau.toLocaleString('vi-VN')}</p>}
                  {dienGiam && <Input type="number" min={0} placeholder="Thay đồng hồ — số điện tiêu thụ" value={thayDien} onChange={(e) => setThayDien(e.target.value)} className="h-8 text-xs" />}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tl-nuoc">Chỉ số nước chốt</Label>
                  <Input id="tl-nuoc" type="number" min={0} value={chiSoNuoc} onChange={(e) => setChiSoNuoc(e.target.value)} className={nuocGiam ? 'border-red-400' : ''} />
                  {bt && <p className="text-xs text-muted-foreground">Đầu kỳ: {bt.chiSoNuocBanDau.toLocaleString('vi-VN')}</p>}
                  {nuocGiam && <Input type="number" min={0} placeholder="Thay đồng hồ — số nước tiêu thụ" value={thayNuoc} onChange={(e) => setThayNuoc(e.target.value)} className="h-8 text-xs" />}
                </div>
              </div>
            </section>

            {/* Phòng mới / tùy chọn trả phòng */}
            {laChuyen ? (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">2. Phòng mới</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Chọn phòng trống</Label>
                    <Select value={phongMoiId} onValueChange={(v) => { setPhongMoiId(v); setChiSoDienMoi(''); setChiSoNuocMoi(''); setGiaThueMoi(''); }}>
                      <SelectTrigger><SelectValue placeholder={phongTrong.length ? 'Chọn phòng' : 'Không có phòng trống'} /></SelectTrigger>
                      <SelectContent>
                        {phongTrong.map((p) => (
                          <SelectItem key={p._id} value={p._id}>P.{p.maPhong} — {formatVND(p.giaThue)}/tháng</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="tl-dien-moi">Chỉ số điện bắt đầu (phòng mới)</Label>
                    <Input id="tl-dien-moi" type="number" min={0} value={chiSoDienMoi} onChange={(e) => setChiSoDienMoi(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="tl-nuoc-moi">Chỉ số nước bắt đầu (phòng mới)</Label>
                    <Input id="tl-nuoc-moi" type="number" min={0} value={chiSoNuocMoi} onChange={(e) => setChiSoNuocMoi(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="tl-gia-moi">Giá thuê mới</Label>
                    <Input id="tl-gia-moi" type="number" min={0} value={giaThueMoi} onChange={(e) => setGiaThueMoi(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="tl-coc-moi">Tiền cọc hợp đồng mới</Label>
                    <Input id="tl-coc-moi" type="number" min={0} value={tienCocMoi} onChange={(e) => setTienCocMoi(e.target.value)} />
                    {xemTruoc && cocMoi !== tienCoc && (
                      <p className="text-xs text-amber-700">
                        {cocMoi > tienCoc ? `Khách nộp thêm ${formatVND(cocMoi - tienCoc)} cọc (ghi vào công nợ)` : `Cọc dư ${formatVND(tienCoc - cocMoi)} thành tiền thừa của khách`}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tiền phòng mới từ ngày chuyển tới ngày thu kế tiếp sẽ được cộng ở hóa đơn đầu tiên của hợp đồng mới (tiền phòng lẻ).
                </p>
              </section>
            ) : (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">2. Tùy chọn</h3>
                <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <Label htmlFor="tl-hoan" className="font-normal">Hoàn tiền phòng đã thu trước cho những ngày chưa ở</Label>
                  <Switch id="tl-hoan" checked={Boolean(hoanTienPhong)} onCheckedChange={(v) => setHoanTienPhong(v)} />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                  <Label htmlFor="tl-coc" className="font-normal">Dùng tiền cọc ({formatVND(tienCoc)}) trừ nợ</Label>
                  <Switch id="tl-coc" checked={dungCocTruNo} onCheckedChange={setDungCocTruNo} />
                </div>
              </section>
            )}

            {/* Bảng tính */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                3. Hóa đơn chốt phòng {dangTai && <Loader2 className="h-4 w-4 animate-spin" />}
              </h3>
              {loi && <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{loi}</div>}
              {bt && !loi && (
                <div className="space-y-4">
                  <div className="rounded-md border p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span>Tiền điện ({bt.soDien} kWh × {bt.hopDong.giaDien.toLocaleString('vi-VN')})</span><span>{formatVND(bt.tienDien)}</span></div>
                    <div className="flex justify-between"><span>Tiền nước ({bt.soNuoc} m³ × {bt.hopDong.giaNuoc.toLocaleString('vi-VN')})</span><span>{formatVND(bt.tienNuoc)}</span></div>
                    <p className="text-xs text-muted-foreground">
                      Tiền phòng đã lập hóa đơn đến {fmtNgay(bt.mocTienPhong)} —{' '}
                      {bt.tienPhongDieuChinh.soTien > 0
                        ? `khách còn thiếu ${bt.tienPhongDieuChinh.soNgay} ngày`
                        : bt.tienPhongDieuChinh.soTien < 0
                          ? `khách đã trả trước ${-bt.tienPhongDieuChinh.soNgay} ngày chưa ở (${formatVND(-bt.tienPhongDieuChinh.soTien)})`
                          : 'không phát sinh tiền phòng'}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tiền phòng & khoản thu khác</Label>
                    <PhiDichVuEditor value={phi} onChange={setPhi} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Giảm trừ / hoàn tiền</Label>
                    <GiamTruEditor value={giamTru} onChange={setGiamTru} />
                  </div>
                  <div className="rounded-md bg-muted/40 p-3 text-sm space-y-1">
                    <div className="flex justify-between font-semibold"><span>Tổng hóa đơn chốt</span><span className={tong < 0 ? 'text-emerald-700' : ''}>{formatVND(tong)}</span></div>
                    <div className="flex justify-between"><span>Số dư công nợ hiện tại</span><SoDuBadge soDu={bt.soDuTruoc} /></div>
                    {!laChuyen && truCoc > 0 && <div className="flex justify-between"><span>Dùng cọc trừ nợ</span><span>−{formatVND(truCoc)}</span></div>}
                    <div className="flex justify-between"><span>Số dư sau {laChuyen ? 'chuyển phòng' : 'trả phòng'}</span><SoDuBadge soDu={soDuSau - truCoc + (laChuyen ? cocMoi - tienCoc : 0)} /></div>
                    {!laChuyen && <div className="flex justify-between text-muted-foreground"><span>Cọc còn lại cần hoàn</span><span>{formatVND(tienCoc - truCoc)}</span></div>}
                  </div>
                </div>
              )}
            </section>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t pt-4">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Hủy</Button>
              <Button size="sm" onClick={xacNhan} disabled={dangGui || !bt || Boolean(loi) || dangTai || (dienGiam && thayDien === '') || (nuocGiam && thayNuoc === '')}>
                {dangGui && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {laChuyen ? 'Xác nhận chuyển phòng' : 'Xác nhận trả phòng'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KetQuaTraPhong({
  hopDong,
  ketQua,
  onXong,
}: {
  hopDong: HopDongThanhLy;
  ketQua: { cocConLai: number; soDuCuoi: number };
  onXong: () => void;
}) {
  const [cocConLai, setCocConLai] = useState(ketQua.cocConLai);
  const [tienThua, setTienThua] = useState(Math.max(0, -ketQua.soDuCuoi));
  const [dangGui, setDangGui] = useState<string | null>(null);

  const hoan = async (nguon: 'tienCoc' | 'tienThua', soTien: number) => {
    if (!hopDong.nguoiDaiDienId) return toast.error('Thiếu thông tin khách thuê');
    setDangGui(nguon);
    try {
      const res = await fetch('/api/cong-no/hoan-tien', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ khachThueId: hopDong.nguoiDaiDienId, hopDongId: hopDong._id, nguon, soTien, phuongThuc: 'tienMat' }),
      });
      const r = await res.json();
      if (!res.ok || !r.success) return toast.error(r.message || 'Không hoàn được');
      toast.success(`Đã hoàn ${formatVND(soTien)} và tạo phiếu chi`);
      if (nguon === 'tienCoc') setCocConLai(0); else setTienThua(0);
    } finally {
      setDangGui(null);
    }
  };

  return (
    <div className="space-y-4 text-sm">
      <p>Đã trả phòng {hopDong.maPhong ? `P.${hopDong.maPhong}` : ''}. Số dư công nợ hiện tại: <SoDuBadge soDu={ketQua.soDuCuoi} /></p>
      {cocConLai > 0 && (
        <div className="flex items-center justify-between rounded-md border p-3">
          <span>Cọc còn lại cần hoàn: <strong>{formatVND(cocConLai)}</strong></span>
          <Button size="sm" onClick={() => hoan('tienCoc', cocConLai)} disabled={dangGui !== null}>
            {dangGui === 'tienCoc' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Hoàn cọc (tiền mặt)
          </Button>
        </div>
      )}
      {tienThua > 0 && (
        <div className="flex items-center justify-between rounded-md border p-3">
          <span>Tiền thừa của khách: <strong>{formatVND(tienThua)}</strong></span>
          <Button size="sm" onClick={() => hoan('tienThua', tienThua)} disabled={dangGui !== null}>
            {dangGui === 'tienThua' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Hoàn tiền thừa (tiền mặt)
          </Button>
        </div>
      )}
      {ketQua.soDuCuoi > 0 && <p className="text-red-600">Khách còn nợ {formatVND(ketQua.soDuCuoi)} — thu ở trang Khách thuê / Thanh toán.</p>}
      <div className="flex justify-end"><Button size="sm" variant="outline" onClick={onXong}>Xong</Button></div>
    </div>
  );
}
