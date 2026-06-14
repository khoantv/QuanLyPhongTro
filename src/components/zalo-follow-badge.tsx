'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Copy, MessageSquareWarning, CheckCircle2, QrCode } from 'lucide-react';
import { toast } from 'sonner';

interface ZaloFollowBadgeProps {
  /** Có zaloUserId + đã quan tâm OA */
  daQuanTamOA?: boolean;
  /** Show full version with invite button (table cell) hay chỉ icon (compact) */
  compact?: boolean;
}

export function ZaloFollowBadge({ daQuanTamOA, compact = false }: ZaloFollowBadgeProps) {
  const [oaLink, setOaLink] = useState<{ permalink: string; qrUrl: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const fetchLink = async () => {
    if (oaLink) return;
    setLoading(true);
    try {
      const res = await fetch('/api/zalo/oa-link');
      const r = await res.json();
      if (res.ok && r.success) {
        setOaLink(r.data);
      } else {
        toast.error(r.message || 'Chưa cấu hình Zalo OA');
      }
    } catch {
      toast.error('Không lấy được link OA');
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (oaLink?.permalink) {
      navigator.clipboard.writeText(oaLink.permalink);
      toast.success('Đã sao chép link mời');
    }
  };

  if (daQuanTamOA) {
    return (
      <Badge variant="default" className="gap-1 bg-blue-600 hover:bg-blue-700">
        <CheckCircle2 className="h-3 w-3" />
        {compact ? 'Zalo OA' : 'Đã quan tâm OA'}
      </Badge>
    );
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) fetchLink(); }}>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className="gap-1 border-amber-300 text-amber-700 bg-amber-50 cursor-pointer hover:bg-amber-100"
        >
          <MessageSquareWarning className="h-3 w-3" />
          {compact ? 'Chưa OA' : 'Chưa quan tâm OA'}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-sm">Mời khách quan tâm Zalo OA</p>
            <p className="text-xs text-gray-500">Sao chép link và gửi cho khách. Khi khách bấm "Quan tâm", hệ thống sẽ tự động gửi hóa đơn qua Zalo.</p>
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Đang tải...</p>
          ) : oaLink ? (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={oaLink.permalink}
                  className="flex-1 text-xs border rounded px-2 py-1 bg-gray-50 font-mono"
                />
                <Button size="sm" variant="outline" onClick={copyLink}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <details>
                <summary className="text-xs cursor-pointer text-gray-600 flex items-center gap-1">
                  <QrCode className="h-3 w-3" />
                  Hiện mã QR
                </summary>
                <div className="mt-2 flex justify-center">
                  <img src={oaLink.qrUrl} alt="QR OA" className="w-40 h-40 border rounded" />
                </div>
              </details>
            </>
          ) : (
            <p className="text-xs text-amber-600">Chưa cấu hình Zalo OA. Vào Cài đặt phiếu thu để cấu hình.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
