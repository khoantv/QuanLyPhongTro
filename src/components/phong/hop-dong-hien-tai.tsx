'use client';

import Link from 'next/link';
import { FilePlus2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SoDuBadge } from '@/components/cong-no/so-du';
import { cn } from '@/lib/utils';

export interface HopDongHienTaiPhong {
  _id: string;
  maHopDong: string;
  ngayBatDau: string;
  ngayKetThuc: string;
  giaThue: number;
  tienCoc: number;
  ngayThanhToan: number;
  daThuTienPhongDen?: string | null;
  khachThueId?: unknown[];
  nguoiDaiDien?: { _id: string; hoTen: string; soDienThoai?: string } | null;
  soDuCongNo?: number;
  hoaDonGanNhat?: {
    _id: string;
    maHoaDon: string;
    thang: number;
    nam: number;
    loaiHoaDon?: string;
    conLai: number;
    trangThai: 'chuaThanhToan' | 'daThanhToanMotPhan' | 'daThanhToan' | 'quaHan';
  } | null;
}

const ngay = (d?: string | null) => (d ? new Date(d).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : '—');
const tien = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

const TRANG_THAI_HD: Record<string, { nhan: string; cls: string }> = {
  chuaThanhToan: { nhan: 'Chưa thanh toán', cls: 'border-slate-300 text-slate-700' },
  daThanhToanMotPhan: { nhan: 'Trả một phần', cls: 'border-amber-300 bg-amber-50 text-amber-800' },
  daThanhToan: { nhan: 'Đã thanh toán', cls: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  quaHan: { nhan: 'Quá hạn', cls: 'border-red-300 bg-red-50 text-red-700' },
};

export const linkTaoHoaDon = (phongId: string) => `/dashboard/hoa-don/them-moi?phong=${phongId}`;

/** Thông tin hợp đồng đang gắn với phòng + nút tạo hóa đơn. */
export function HopDongHienTai({
  hopDong,
  phongId,
  compact = false,
}: {
  hopDong: HopDongHienTaiPhong | null | undefined;
  phongId: string;
  compact?: boolean;
}) {
  if (!hopDong) return <span className="text-sm text-muted-foreground">Chưa có hợp đồng</span>;

  const conNgay = Math.ceil((new Date(hopDong.ngayKetThuc).getTime() - Date.now()) / 86_400_000);
  const hd = hopDong.hoaDonGanNhat;
  const tt = hd ? TRANG_THAI_HD[hd.trangThai] : null;

  return (
    <div className={cn('space-y-1 text-xs', compact ? '' : 'min-w-56')}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href={`/dashboard/hop-dong/${hopDong._id}`} className="font-semibold text-primary hover:underline">
          {hopDong.maHopDong}
        </Link>
        {conNgay <= 30 && (
          <Badge variant="outline" className="border-orange-400 text-orange-700 text-[10px]">
            {conNgay < 0 ? 'Đã quá hạn HĐ' : `Còn ${conNgay} ngày`}
          </Badge>
        )}
      </div>
      <div className="text-muted-foreground">{ngay(hopDong.ngayBatDau)} → {ngay(hopDong.ngayKetThuc)}</div>
      <div>{tien(hopDong.giaThue)}/tháng · cọc {tien(hopDong.tienCoc)}</div>
      <div className="text-muted-foreground">
        Thu ngày {hopDong.ngayThanhToan}
        {hopDong.daThuTienPhongDen ? ` · đã lập tiền phòng đến ${ngay(hopDong.daThuTienPhongDen)}` : ''}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {hd ? (
          <>
            <Link href={`/hoa-don/${hd._id}`} target="_blank" className="hover:underline">
              {hd.loaiHoaDon === 'chotPhong' ? 'HĐ chốt' : `HĐ T${hd.thang}/${hd.nam}`}
            </Link>
            {tt && <Badge variant="outline" className={cn('text-[10px]', tt.cls)}>{tt.nhan}{hd.conLai > 0 ? ` · còn ${tien(hd.conLai)}` : ''}</Badge>}
          </>
        ) : (
          <span className="text-muted-foreground">Chưa có hóa đơn</span>
        )}
        {hopDong.soDuCongNo !== undefined && hopDong.soDuCongNo !== 0 && <SoDuBadge soDu={hopDong.soDuCongNo} className="text-[10px]" />}
      </div>
      <Button asChild size="sm" variant="outline" className="h-7 mt-1 text-xs">
        <Link href={linkTaoHoaDon(phongId)}>
          <FilePlus2 className="h-3.5 w-3.5 mr-1" /> Tạo hóa đơn
        </Link>
      </Button>
    </div>
  );
}
