'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Send, Power, RefreshCw, ChevronLeft, ChevronRight,
  CheckCircle2, AlertCircle, Inbox, Clock, Filter, Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { ZaloPreviewModal } from '@/components/zalo-preview-modal';
import type { ZaloMessageLog, Phong, CaiDatHoaDon } from '@/types';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function statusBadge(status: string) {
  switch (status) {
    case 'sent': return <Badge className="bg-green-600 gap-1"><CheckCircle2 className="h-3 w-3" />Đã gửi</Badge>;
    case 'failed': return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Thất bại</Badge>;
    case 'failed_permanent': return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Thất bại vĩnh viễn</Badge>;
    case 'queued': return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Đang chờ</Badge>;
    case 'skipped': return <Badge variant="outline" className="gap-1">Bỏ qua</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function nameOf(field: unknown, key: string): string {
  if (field && typeof field === 'object' && key in (field as Record<string, unknown>)) {
    return String((field as Record<string, unknown>)[key]);
  }
  return 'N/A';
}

export default function ZaloHistoryPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [phongFilter, setPhongFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [phongList, setPhongList] = useState<Phong[]>([]);
  const [logs, setLogs] = useState<ZaloMessageLog[]>([]);
  const [counters, setCounters] = useState({ successCount: 0, failedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<CaiDatHoaDon | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [detailLog, setDetailLog] = useState<ZaloMessageLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month), limit: '10000' });
      if (phongFilter && phongFilter !== 'all') params.set('phongId', phongFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/zalo/logs?${params}`);
      if (res.ok) {
        const r = await res.json();
        if (r.success) {
          setLogs(r.data);
          setCounters(r.counters);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [year, month, phongFilter, statusFilter]);

  useEffect(() => {
    document.title = 'Lịch sử gửi hóa đơn qua Zalo';
    (async () => {
      const [p, s] = await Promise.all([
        fetch('/api/phong?limit=10000'),
        fetch('/api/cai-dat-hoa-don'),
      ]);
      if (p.ok) {
        const r = await p.json();
        if (r.success) setPhongList(r.data);
      }
      if (s.ok) {
        const r = await s.json();
        if (r.success) setSettings(r.data);
      }
    })();
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleToggleMaster = async () => {
    if (!settings) return;
    const next = !settings.autoSendZalo;
    if (!confirm(`Bạn có chắc muốn ${next ? 'BẬT' : 'TẮT'} tính năng gửi hóa đơn qua Zalo?`)) return;
    try {
      const res = await fetch('/api/cai-dat-hoa-don', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSendZalo: next }),
      });
      const r = await res.json();
      if (res.ok && r.success) {
        setSettings(r.data);
        toast.success(`Đã ${next ? 'bật' : 'tắt'} tính năng gửi tự động`);
      } else {
        toast.error(r.message || 'Có lỗi xảy ra');
      }
    } catch {
      toast.error('Có lỗi khi cập nhật');
    }
  };

  const handleResend = async (logId: string) => {
    try {
      const res = await fetch(`/api/zalo/logs/${logId}/resend`, { method: 'POST' });
      const r = await res.json();
      if (res.ok && r.success) {
        toast.success('Đã gửi lại — kiểm tra trạng thái mới');
        fetchLogs();
      } else {
        toast.error(r.message || 'Có lỗi xảy ra');
      }
    } catch {
      toast.error('Có lỗi khi gửi lại');
    }
  };

  return (
    <div className="space-y-4">
      {/* Year selector */}
      <Card>
        <CardContent className="p-3 flex items-center gap-2 overflow-x-auto">
          <Button variant="ghost" size="sm" onClick={() => setYear(y => y - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Năm trước
          </Button>
          {MONTHS.map(m => {
            const isActive = m === month && year === year;
            const isCurrent = m === month;
            return (
              <Button
                key={m}
                variant={isCurrent ? 'default' : 'outline'}
                size="sm"
                className={isCurrent ? 'bg-green-100 hover:bg-green-200 text-green-700 border-green-400' : ''}
                onClick={() => setMonth(m)}
              >
                <div className="text-center">
                  <div className="font-bold text-xs">T.{m}</div>
                  <div className="text-[10px] opacity-70">{year}</div>
                </div>
              </Button>
            );
          })}
          <Button variant="ghost" size="sm" onClick={() => setYear(y => y + 1)}>
            Năm tới
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Lịch sử gửi hóa đơn qua zalo cho khách thuê</h1>
          <p className="text-sm text-gray-500">Lịch sử gửi hóa đơn qua zalo cho khách thuê</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={phongFilter} onValueChange={setPhongFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Lọc theo phòng" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              {phongList.map(p => (
                <SelectItem key={p._id} value={p._id!}>{p.maPhong}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filter chips + actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-4 w-4 text-gray-400" />
          <Button
            variant={statusFilter === 'sent' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(statusFilter === 'sent' ? '' : 'sent')}
          >
            Đã gửi thành công
            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">{counters.successCount}</Badge>
          </Button>
          <Button
            variant={statusFilter === 'failed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(statusFilter === 'failed' ? '' : 'failed')}
          >
            Đã gửi thất bại
            <Badge variant="destructive" className="ml-2">{counters.failedCount}</Badge>
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            className="bg-amber-400 hover:bg-amber-500 text-white"
            onClick={() => setPreviewOpen(true)}
          >
            <Send className="h-4 w-4 mr-2" />
            Gửi thử hóa đơn qua ZALO
          </Button>
          <Button
            className={settings?.autoSendZalo ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-500 hover:bg-gray-600'}
            onClick={handleToggleMaster}
          >
            <Power className="h-4 w-4 mr-2" />
            {settings?.autoSendZalo ? 'Tắt' : 'Bật'} tính năng gửi hóa đơn qua ZALO
          </Button>
        </div>
      </div>

      {/* Logs table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Đang tải...</div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Inbox className="h-16 w-16 text-gray-300 mb-3" />
              <p className="text-gray-400">Bạn chưa gửi tin nhắn Zalo nào</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Khách thuê</TableHead>
                  <TableHead>Phòng</TableHead>
                  <TableHead>Mã hóa đơn</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Lỗi</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <TableRow key={log._id}>
                    <TableCell>{nameOf(log.khachThueId, 'hoTen')}</TableCell>
                    <TableCell>{nameOf(log.phongId, 'maPhong')}</TableCell>
                    <TableCell className="font-mono text-sm">{nameOf(log.hoaDonId, 'maHoaDon')}</TableCell>
                    <TableCell className="text-sm">
                      {log.sentAt
                        ? new Date(log.sentAt).toLocaleString('vi-VN')
                        : new Date(log.ngayTao!).toLocaleString('vi-VN')}
                    </TableCell>
                    <TableCell>{statusBadge(log.status)}</TableCell>
                    <TableCell className="text-xs text-red-600 max-w-xs truncate">
                      {log.errorMessage || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetailLog(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {(log.status === 'failed' || log.status === 'failed_permanent' || log.status === 'skipped') && log.hoaDonId && (
                          <Button variant="ghost" size="sm" onClick={() => handleResend(log._id!)}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ZaloPreviewModal open={previewOpen} onOpenChange={setPreviewOpen} />

      {/* Detail dialog */}
      <Dialog open={!!detailLog} onOpenChange={(o) => !o && setDetailLog(null)}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết tin Zalo</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><strong>Khách thuê:</strong> {nameOf(detailLog.khachThueId, 'hoTen')}</div>
                <div><strong>Phòng:</strong> {nameOf(detailLog.phongId, 'maPhong')}</div>
                <div><strong>Mã HD:</strong> {nameOf(detailLog.hoaDonId, 'maHoaDon')}</div>
                <div><strong>Trigger:</strong> {detailLog.trigger}</div>
                <div><strong>Trạng thái:</strong> {statusBadge(detailLog.status)}</div>
                <div><strong>Retry:</strong> {detailLog.retryCount}</div>
                <div><strong>Zalo Msg ID:</strong> {detailLog.zaloMessageId || '—'}</div>
                <div><strong>Sent At:</strong> {detailLog.sentAt ? new Date(detailLog.sentAt).toLocaleString('vi-VN') : '—'}</div>
              </div>
              {detailLog.errorMessage && (
                <div>
                  <strong className="text-red-600">Lỗi ({detailLog.errorCode}):</strong>
                  <pre className="bg-red-50 p-2 mt-1 text-xs overflow-x-auto rounded">{detailLog.errorMessage}</pre>
                </div>
              )}
              <details>
                <summary className="cursor-pointer font-semibold">Request payload</summary>
                <pre className="bg-gray-50 p-2 mt-1 text-xs overflow-x-auto rounded max-h-64">
                  {JSON.stringify(detailLog.requestPayload, null, 2)}
                </pre>
              </details>
              <details>
                <summary className="cursor-pointer font-semibold">Response payload</summary>
                <pre className="bg-gray-50 p-2 mt-1 text-xs overflow-x-auto rounded max-h-64">
                  {JSON.stringify(detailLog.responsePayload, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
