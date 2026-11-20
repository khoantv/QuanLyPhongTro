'use client';

import { useState } from 'react';
import { Plus, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { KhoanGiamTru, LoaiPhiHoaDon, PhiDichVu } from '@/types';

const NHAN_LOAI: Record<LoaiPhiHoaDon, { nhan: string; className: string }> = {
  dichVu: { nhan: 'Hợp đồng', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  tienPhongLe: { nhan: 'Tiền phòng lẻ', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  khac: { nhan: 'Phát sinh', className: 'bg-sky-100 text-sky-800 border-sky-200' },
};

const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

/** Gợi ý cách tính tiền phòng lẻ, vd "900.000 × 16/30". */
export function goiYTienPhongLe(phi: PhiDichVu): string | null {
  const ct = phi.chiTiet;
  if (!ct) return null;
  return `${ct.giaThue.toLocaleString('vi-VN')} × ${ct.soNgay}/${ct.soNgayCuaKy} = ${vnd(ct.soTienTuTinh)}`;
}

/**
 * Danh sách "Phí dịch vụ & khoản thu khác" của hóa đơn: phí hợp đồng, tiền phòng lẻ và khoản phát sinh.
 * Mọi dòng sửa được tên/số tiền hoặc xóa; số tiền ≥ 0.
 */
export function PhiDichVuEditor({
  value,
  onChange,
  tienPhongLeGoiY,
}: {
  value: PhiDichVu[];
  onChange: (next: PhiDichVu[]) => void;
  /** Dòng tiền phòng lẻ hệ thống tự tính — dùng cho nút "Tính lại" / "Thêm lại". */
  tienPhongLeGoiY?: PhiDichVu | null;
}) {
  const [moi, setMoi] = useState({ ten: '', gia: 0 });

  const sua = (i: number, patch: Partial<PhiDichVu>) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const xoa = (i: number) => onChange(value.filter((_, j) => j !== i));
  const them = () => {
    if (!moi.ten.trim() || moi.gia < 0) return;
    onChange([...value, { ten: moi.ten.trim(), gia: moi.gia, loai: 'khac' }]);
    setMoi({ ten: '', gia: 0 });
  };
  const coTienPhongLe = value.some((p) => p.loai === 'tienPhongLe');
  const tong = value.reduce((s, p) => s + (p.gia || 0), 0);

  return (
    <div className="space-y-3">
      {value.length === 0 && <p className="text-sm text-muted-foreground">Chưa có khoản nào.</p>}
      {value.map((phi, i) => {
        const loai = phi.loai ?? 'dichVu';
        const goiY = loai === 'tienPhongLe' ? goiYTienPhongLe(phi) : null;
        const daSua = loai === 'tienPhongLe' && phi.chiTiet && phi.gia !== phi.chiTiet.soTienTuTinh;
        return (
          <div key={i} className="rounded-md border p-2 space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Badge variant="outline" className={`w-fit text-[11px] ${NHAN_LOAI[loai].className}`}>{NHAN_LOAI[loai].nhan}</Badge>
              <Input
                value={phi.ten}
                onChange={(e) => sua(i, { ten: e.target.value })}
                className="h-9 flex-1 text-sm"
                aria-label="Tên khoản"
              />
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={Number.isFinite(phi.gia) ? phi.gia : ''}
                  onChange={(e) => sua(i, { gia: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="h-9 w-32 text-right text-sm"
                  aria-label="Số tiền"
                />
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => xoa(i)} title="Xóa khoản này">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {goiY && (
              <div className="flex flex-wrap items-center gap-2 pl-1 text-xs text-muted-foreground">
                <span>Tự tính: {goiY}</span>
                {daSua && phi.chiTiet && (
                  <button type="button" className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => sua(i, { gia: phi.chiTiet!.soTienTuTinh })}>
                    <RotateCcw className="h-3 w-3" /> Tính lại
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {tienPhongLeGoiY && !coTienPhongLe && (
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => onChange([...value, { ...tienPhongLeGoiY }])}
        >
          + Thêm lại {tienPhongLeGoiY.ten}: {vnd(tienPhongLeGoiY.gia)}
        </button>
      )}

      <div className="space-y-1">
        <Label className="text-sm">Thêm khoản thu khác</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Ví dụ: Thay bóng đèn, gửi xe tháng này…"
            value={moi.ten}
            onChange={(e) => setMoi((m) => ({ ...m, ten: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); them(); } }}
            className="h-9 flex-1 text-sm"
          />
          <Input
            placeholder="Số tiền"
            type="number"
            min={0}
            value={moi.gia || ''}
            onChange={(e) => setMoi((m) => ({ ...m, gia: Math.max(0, parseInt(e.target.value) || 0) }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); them(); } }}
            className="h-9 w-32 text-right text-sm"
          />
          <Button type="button" onClick={them} disabled={!moi.ten.trim()} className="h-9 px-3" title="Thêm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex justify-between border-t pt-2 text-sm">
        <span className="text-muted-foreground">Cộng phí dịch vụ & khoản khác</span>
        <span className="font-semibold">{vnd(tong)}</span>
      </div>
    </div>
  );
}

/** Danh sách giảm trừ (khuyến mãi, bồi hoàn…) — số tiền dương, trừ vào tổng hóa đơn. */
export function GiamTruEditor({ value, onChange }: { value: KhoanGiamTru[]; onChange: (next: KhoanGiamTru[]) => void }) {
  const [moi, setMoi] = useState({ ten: '', soTien: 0 });
  const sua = (i: number, patch: Partial<KhoanGiamTru>) => onChange(value.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const them = () => {
    if (!moi.ten.trim() || moi.soTien <= 0) return;
    onChange([...value, { ten: moi.ten.trim(), soTien: moi.soTien }]);
    setMoi({ ten: '', soTien: 0 });
  };
  const tong = value.reduce((s, g) => s + (g.soTien || 0), 0);

  return (
    <div className="space-y-3">
      {value.map((g, i) => (
        <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border p-2">
          <Input value={g.ten} onChange={(e) => sua(i, { ten: e.target.value })} className="h-9 flex-1 text-sm" aria-label="Tên khoản giảm trừ" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-emerald-700">−</span>
            <Input
              type="number"
              min={0}
              value={g.soTien || ''}
              onChange={(e) => sua(i, { soTien: Math.max(0, parseInt(e.target.value) || 0) })}
              className="h-9 w-32 text-right text-sm"
              aria-label="Số tiền giảm trừ"
            />
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => onChange(value.filter((_, j) => j !== i))} title="Xóa">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          placeholder="Ví dụ: Khuyến mãi tháng đầu"
          value={moi.ten}
          onChange={(e) => setMoi((m) => ({ ...m, ten: e.target.value }))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); them(); } }}
          className="h-9 flex-1 text-sm"
        />
        <Input
          placeholder="Số tiền"
          type="number"
          min={0}
          value={moi.soTien || ''}
          onChange={(e) => setMoi((m) => ({ ...m, soTien: Math.max(0, parseInt(e.target.value) || 0) }))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); them(); } }}
          className="h-9 w-32 text-right text-sm"
        />
        <Button type="button" variant="outline" onClick={them} disabled={!moi.ten.trim() || moi.soTien <= 0} className="h-9 px-3" title="Thêm giảm trừ">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex justify-between border-t pt-2 text-sm">
          <span className="text-muted-foreground">Cộng giảm trừ</span>
          <span className="font-semibold text-emerald-700">−{vnd(tong)}</span>
        </div>
      )}
    </div>
  );
}

export { lamTron1000 } from '@/lib/ky-thu';
