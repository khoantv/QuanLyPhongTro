'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

interface ZaloPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected hóa đơn id. Nếu null/undefined → modal hiển thị dropdown chọn. */
  hoaDonId?: string;
  /** Số Zalo nhận thử mặc định (vd của chủ trọ). */
  defaultPhone?: string;
}

interface HoaDonOption {
  _id: string;
  maHoaDon: string;
  thang: number;
  nam: number;
  tienPhong: number;
  tienDien: number;
  tienNuoc: number;
  tongTien: number;
  hanThanhToan: string;
  phiDichVu?: Array<{ ten: string; gia: number }>;
  khachThue?: { hoTen?: string };
}

const fmtVND = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + 'đ';
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('vi-VN');

export function ZaloPreviewModal({ open, onOpenChange, hoaDonId, defaultPhone = '' }: ZaloPreviewModalProps) {
  const [phone, setPhone] = useState(defaultPhone);
  const [sending, setSending] = useState(false);
  const [hoaDonList, setHoaDonList] = useState<HoaDonOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>(hoaDonId || '');
  const [tenNhaTro, setTenNhaTro] = useState<string>('Nhà trọ');

  useEffect(() => {
    if (!open) return;
    // Fetch settings để lấy tenNhaTro
    fetch('/api/cai-dat-hoa-don')
      .then(r => r.json())
      .then(r => { if (r.success && r.data?.tenNhaTro) setTenNhaTro(r.data.tenNhaTro); })
      .catch(() => {});
    // Fetch hóa đơn list để chọn nếu chưa có hoaDonId
    if (!hoaDonId) {
      fetch('/api/hoa-don?limit=50')
        .then(r => r.json())
        .then(r => { if (r.success) setHoaDonList(r.data || []); })
        .catch(() => {});
    }
  }, [open, hoaDonId]);

  useEffect(() => {
    if (hoaDonId) setSelectedId(hoaDonId);
  }, [hoaDonId]);

  const effectiveId = hoaDonId || selectedId;
  const selectedHoaDon = hoaDonList.find(h => h._id === selectedId);

  const handleSendPreview = async () => {
    if (!effectiveId) {
      toast.error('Cần chọn hóa đơn để gửi thử');
      return;
    }
    if (!phone.trim()) {
      toast.error('Nhập số Zalo nhận thử');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/zalo/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hoaDonId: effectiveId, mode: 'preview', overrideZaloUserId: phone.trim() }),
      });
      const r = await res.json();
      if (res.ok && r.success) {
        const log = r.data;
        if (log.status === 'sent') {
          toast.success('Đã gửi tin thử, kiểm tra Zalo của bạn');
        } else if (log.status === 'queued') {
          toast.info('Ngoài khung giờ 6h-22h. Tin đã được xếp hàng đợi.');
        } else {
          toast.error(log.errorMessage || `Status: ${log.status}`);
        }
      } else {
        toast.error(r.message || 'Có lỗi xảy ra');
      }
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi khi gửi tin thử');
    } finally {
      setSending(false);
    }
  };

  // Dữ liệu hiển thị mockup: ưu tiên hóa đơn được chọn, fallback mock
  const display = selectedHoaDon
    ? {
        ten: selectedHoaDon.khachThue?.hoTen || 'Khách thuê',
        thang: String(selectedHoaDon.thang).padStart(2, '0'),
        nam: String(selectedHoaDon.nam),
        maHoaDon: selectedHoaDon.maHoaDon,
        tienPhong: fmtVND(selectedHoaDon.tienPhong),
        tienDien: fmtVND(selectedHoaDon.tienDien),
        tienNuoc: fmtVND(selectedHoaDon.tienNuoc),
        dichVu: fmtVND((selectedHoaDon.phiDichVu || []).reduce((s, p) => s + p.gia, 0)),
        tongTien: fmtVND(selectedHoaDon.tongTien),
        hanThanhToan: fmtDate(selectedHoaDon.hanThanhToan),
      }
    : {
        ten: 'khách thuê',
        thang: '11', nam: '2025',
        maHoaDon: 'T000001',
        tienPhong: '2.000.000đ',
        tienDien: '100.000đ',
        tienNuoc: '200.000đ',
        dichVu: '150.000đ',
        tongTien: '3.300.000đ',
        hanThanhToan: '17/11/2025',
      };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mẫu gửi hóa đơn qua ZALO</DialogTitle>
          <DialogDescription className="sr-only">Preview hóa đơn Zalo</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Phone mockup */}
          <div className="flex justify-center">
            <div className="w-full max-w-[320px] border-2 border-blue-200 rounded-3xl p-3 bg-gradient-to-b from-blue-50 to-white shadow-lg">
              <div className="bg-blue-500 text-white p-3 rounded-t-2xl flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs">←</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm flex items-center gap-1 truncate">
                    {tenNhaTro} <span className="text-xs">✓</span>
                  </div>
                  <div className="text-[10px] opacity-80">Tài khoản OA</div>
                </div>
              </div>
              <div className="bg-white p-3 space-y-3 text-xs">
                <div className="bg-gray-50 p-2 rounded-md">
                  <div className="font-semibold text-blue-600 truncate">{tenNhaTro}</div>
                  <div className="text-[10px] text-gray-500">Tìm TRỌ - CĂN HỘ</div>
                </div>
                <div>
                  <p className="font-semibold">Xin chào {display.ten},</p>
                  <p className="text-gray-700 mt-1">Hóa đơn tiền thuê nhà tháng {display.thang}/{display.nam} từ {tenNhaTro}</p>
                </div>
                <div className="space-y-1 text-[11px] border-t border-b py-2">
                  <div className="flex justify-between"><span className="text-gray-500">Mã hóa đơn</span><span className="font-mono">#{display.maHoaDon}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Mã thanh toán</span><span className="font-mono">RT{display.maHoaDon}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Tiền phòng</span><span>{display.tienPhong}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Tiền điện</span><span>{display.tienDien}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Tiền nước</span><span>{display.tienNuoc}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Dịch vụ khác</span><span>{display.dichVu}</span></div>
                  <div className="flex justify-between font-bold pt-1 border-t"><span>Tổng tiền</span><span>{display.tongTien}</span></div>
                </div>
                <p className="text-[10px]">Hạn thanh toán hóa đơn trước ngày {display.hanThanhToan}.</p>
                <button className="w-full bg-blue-600 text-white font-bold py-2 rounded-md text-xs">XÁC NHẬN THANH TOÁN</button>
              </div>
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-5">
            <h3 className="font-semibold text-lg">Chú ý:</h3>
            <div>
              <p className="font-semibold text-sm">Chỉ gửi từ 6h sáng đến 22h tối. Ngoài khung giờ sẽ không gửi được hóa đơn</p>
              <p className="text-sm text-gray-500 mt-1">Đây là quy định của ZALO</p>
            </div>
            <div className="border-t pt-4">
              <p className="font-semibold text-sm">Mỗi tin nhắn sẽ mất phí/tin nhắn từ Zalo</p>
              <p className="text-sm text-gray-500 mt-1">Đây là phí của ZALO. Bạn cũng có thể gửi hóa đơn tự động qua App nếu khách đã quan tâm OA</p>
            </div>
            <div className="border-t pt-4">
              <p className="font-semibold text-sm">Mẫu hóa đơn có thể thay đổi theo chính sách của ZALO</p>
              <p className="text-sm text-gray-500 mt-1">Chúng tôi sẽ cập nhật mẫu mới nhất từ ZALO khi có thay đổi</p>
            </div>

            <div className="border-t pt-4 space-y-3">
              {/* Hóa đơn dropdown — chỉ hiển thị khi không có hoaDonId fixed */}
              {!hoaDonId && (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Chọn hóa đơn để gửi thử</label>
                  <Select value={selectedId} onValueChange={setSelectedId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn 1 hóa đơn có sẵn..." />
                    </SelectTrigger>
                    <SelectContent>
                      {hoaDonList.length === 0 ? (
                        <div className="px-2 py-3 text-sm text-gray-500">Chưa có hóa đơn nào</div>
                      ) : hoaDonList.map(h => (
                        <SelectItem key={h._id} value={h._id}>
                          {h.maHoaDon} — T{h.thang}/{h.nam} — {fmtVND(h.tongTien)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-center text-sm">Sẽ gửi một hóa đơn mẫu về ZALO của bạn</p>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Số điện thoại Zalo nhận thử"
                className="text-center text-lg font-bold text-orange-600"
              />
              <Button
                onClick={handleSendPreview}
                disabled={sending || !effectiveId}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Đang gửi...' : 'Gửi xem trước'}
              </Button>
              {!effectiveId && (
                <p className="text-xs text-orange-600 text-center">
                  Chọn 1 hóa đơn có sẵn để gửi thử
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
