import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const formatVND = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

/** Hiển thị số dư công nợ: dương = đang nợ (đỏ), âm = tiền thừa (xanh), 0 = đã đủ. */
export function SoDuBadge({ soDu, className }: { soDu: number | undefined | null; className?: string }) {
  if (soDu === undefined || soDu === null) return <span className={cn('text-muted-foreground text-xs', className)}>—</span>;
  if (soDu > 0) {
    return <Badge variant="destructive" className={cn('font-medium', className)}>Nợ {formatVND(soDu)}</Badge>;
  }
  if (soDu < 0) {
    return <Badge className={cn('bg-emerald-600 hover:bg-emerald-600 font-medium', className)}>Thừa {formatVND(-soDu)}</Badge>;
  }
  return <Badge variant="outline" className={cn('text-muted-foreground', className)}>Đã đủ</Badge>;
}

/** Dòng "Nợ kỳ trước" / "Tiền thừa kỳ trước" cho hóa đơn. Trả null khi bằng 0. */
export function nhanNoKyTruoc(noKyTruoc: number | undefined | null) {
  if (!noKyTruoc) return null;
  return noKyTruoc > 0
    ? { nhan: 'Nợ kỳ trước', giaTri: formatVND(noKyTruoc) }
    : { nhan: 'Tiền thừa kỳ trước', giaTri: `−${formatVND(-noKyTruoc)}` };
}
