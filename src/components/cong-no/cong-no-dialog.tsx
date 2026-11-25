'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Plus, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { GiaoDichCongNo, LoaiGiaoDichCongNo } from '@/types';
import { ThuTienForm } from './thu-tien-form';
import { SoDuBadge, formatVND } from './so-du';

const NHAN_LOAI: Record<LoaiGiaoDichCongNo, string> = {
  hoaDon: 'Hóa đơn',
  thanhToan: 'Thanh toán',
  giamTru: 'Giảm trừ',
  truCoc: 'Trừ cọc',
  tienCoc: 'Tiền cọc',
  hoanTien: 'Hoàn tiền',
  boQuaTienThua: 'Bỏ qua tiền thừa',
  dieuChinh: 'Điều chỉnh',
};

type CheDo = 'xem' | 'thuTien' | 'dieuChinh';

export function CongNoDialog({
  khachThueId,
  hoTen,
  open,
  onOpenChange,
  onChanged,
  cheDoBanDau = 'xem',
}: {
  khachThueId: string | null;
  hoTen?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: (soDu: number) => void;
  cheDoBanDau?: CheDo;
}) {
  const [cheDo, setCheDo] = useState<CheDo>(cheDoBanDau);
  const [loading, setLoading] = useState(false);
  const [hienDaHuy, setHienDaHuy] = useState(false);
  const [data, setData] = useState<{ soDu: number; noConLai?: number; tienThua?: number; butToan: GiaoDichCongNo[] } | null>(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const load = useCallback(async () => {
    if (!khachThueId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cong-no?khachThueId=${khachThueId}${hienDaHuy ? '&hienDaHuy=1' : ''}`);
      const r = await res.json();
      if (r.success) {
        setData(r.data);
        onChangedRef.current?.(r.data.soDu);
      } else {
        toast.error(r.message || 'Không tải được công nợ');
      }
    } finally {
      setLoading(false);
    }
  }, [khachThueId, hienDaHuy]);

  useEffect(() => {
    if (open) {
      setData(null);
      setCheDo(cheDoBanDau);
      load();
    }
  }, [open, cheDoBanDau, load]);

  const tieuDe = cheDo === 'thuTien' ? 'Thu tiền' : cheDo === 'dieuChinh' ? 'Điều chỉnh công nợ' : 'Công nợ';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] md:w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {cheDo !== 'xem' && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCheDo('xem')} aria-label="Quay lại">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {tieuDe}{hoTen ? ` — ${hoTen}` : ''}
          </DialogTitle>
          <DialogDescription>
            Số dư dương là khách đang nợ, âm là tiền thừa (chọn khấu trừ khi lập hóa đơn).
          </DialogDescription>
        </DialogHeader>

        {cheDo === 'thuTien' && khachThueId && (
          <ThuTienForm
            khachThueId={khachThueId}
            onCancel={() => setCheDo('xem')}
            onSuccess={() => { setCheDo('xem'); load(); }}
          />
        )}

        {cheDo === 'dieuChinh' && khachThueId && (
          <DieuChinhForm
            khachThueId={khachThueId}
            onCancel={() => setCheDo('xem')}
            onSuccess={() => { setCheDo('xem'); load(); }}
          />
        )}

        {cheDo === 'xem' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md border p-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Số dư hiện tại</span>
                {!data ? <Loader2 className="h-4 w-4 animate-spin" /> : (data.noConLai ?? 0) > 0 && (data.tienThua ?? 0) > 0 ? (
                  <>
                    <SoDuBadge soDu={data.noConLai} className="text-sm" />
                    <SoDuBadge soDu={-(data.tienThua ?? 0)} className="text-sm" />
                  </>
                ) : <SoDuBadge soDu={data.soDu} className="text-sm" />}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setCheDo('thuTien')}><Plus className="h-4 w-4 mr-1" />Thu tiền</Button>
                <Button size="sm" variant="outline" onClick={() => setCheDo('dieuChinh')}><SlidersHorizontal className="h-4 w-4 mr-1" />Điều chỉnh</Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="hienDaHuy" checked={hienDaHuy} onCheckedChange={(v) => setHienDaHuy(Boolean(v))} />
              <Label htmlFor="hienDaHuy" className="text-sm font-normal">Hiện cả bút toán đã hủy</Label>
            </div>

            {loading && !data ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : data && data.butToan.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Chưa có phát sinh công nợ.</p>
            ) : data && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ngày</TableHead>
                      <TableHead>Loại</TableHead>
                      <TableHead>Mô tả</TableHead>
                      <TableHead className="text-right">Số tiền</TableHead>
                      <TableHead className="text-right">Số dư</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.butToan.map((b) => (
                      <TableRow key={b._id} className={b.daHuy ? 'opacity-50 line-through' : undefined}>
                        <TableCell className="whitespace-nowrap text-xs">{new Date(b.ngayGhiNhan).toLocaleDateString('vi-VN')}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs whitespace-nowrap">{NHAN_LOAI[b.loai] ?? b.loai}</Badge></TableCell>
                        <TableCell className="text-xs max-w-[260px]">
                          {b.moTa}
                          {typeof b.phong === 'object' && b.phong?.maPhong ? <span className="text-muted-foreground"> · P.{b.phong.maPhong}</span> : null}
                          {b.daHuy && b.lyDoHuy ? <span className="block text-muted-foreground no-underline">Đã hủy: {b.lyDoHuy}</span> : null}
                        </TableCell>
                        <TableCell className={`text-right whitespace-nowrap font-medium ${b.soTien > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {b.soTien > 0 ? '+' : '−'}{formatVND(Math.abs(b.soTien))}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap text-xs">
                          {b.soDuLuyKe === null || b.soDuLuyKe === undefined ? '' : formatVND(b.soDuLuyKe)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DieuChinhForm({ khachThueId, onSuccess, onCancel }: { khachThueId: string; onSuccess: () => void; onCancel: () => void }) {
  const [huong, setHuong] = useState<'tang' | 'giam'>('tang');
  const [soTien, setSoTien] = useState(0);
  const [moTa, setMoTa] = useState('');
  const [ngay, setNgay] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!soTien || soTien <= 0) return toast.error('Số tiền phải lớn hơn 0');
    if (!moTa.trim()) return toast.error('Vui lòng nhập lý do điều chỉnh');
    setSaving(true);
    try {
      const res = await fetch('/api/cong-no/dieu-chinh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ khachThueId, soTien: huong === 'tang' ? soTien : -soTien, moTa, ngayGhiNhan: ngay }),
      });
      const r = await res.json();
      if (!res.ok || !r.success) return toast.error(r.message || 'Không thể điều chỉnh');
      toast.success('Đã ghi điều chỉnh công nợ');
      onSuccess();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" checked={huong === 'tang'} onChange={() => setHuong('tang')} />
          Tăng nợ (khách phải trả thêm)
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="radio" checked={huong === 'giam'} onChange={() => setHuong('giam')} />
          Giảm nợ (bớt cho khách / ghi có)
        </label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="dcSoTien">Số tiền (VNĐ)</Label>
          <Input id="dcSoTien" type="number" min={1} value={soTien || ''} onChange={(e) => setSoTien(parseInt(e.target.value) || 0)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dcNgay">Ngày ghi nhận</Label>
          <Input id="dcNgay" type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="dcMoTa">Lý do điều chỉnh</Label>
        <Input id="dcMoTa" value={moTa} onChange={(e) => setMoTa(e.target.value)} placeholder="Ví dụ: Đổi người đại diện, nhập sai trước đây…" maxLength={500} required />
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Hủy</Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ghi điều chỉnh
        </Button>
      </div>
    </form>
  );
}
