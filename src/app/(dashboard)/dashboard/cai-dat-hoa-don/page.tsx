'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Send, Eye, Info, Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ZaloPreviewModal } from '@/components/zalo-preview-modal';
import type { CaiDatHoaDon, HinhThucThanhToan, XuLyTienThua } from '@/types';

interface HoaDonOption { _id: string; maHoaDon: string }

export default function CaiDatHoaDonPage() {
  const [settings, setSettings] = useState<CaiDatHoaDon | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hoaDonList, setHoaDonList] = useState<HoaDonOption[]>([]);
  const [selectedHoaDon, setSelectedHoaDon] = useState<string>('');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    document.title = 'Cài đặt phiếu thu';
    (async () => {
      try {
        const [s, h] = await Promise.all([
          fetch('/api/cai-dat-hoa-don'),
          fetch('/api/hoa-don?limit=20'),
        ]);
        if (s.ok) {
          const r = await s.json();
          if (r.success) setSettings(r.data);
        }
        if (h.ok) {
          const r = await h.json();
          if (r.success) {
            setHoaDonList((r.data || []).map((hd: { _id: string; maHoaDon: string }) => ({ _id: hd._id, maHoaDon: hd.maHoaDon })));
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = <K extends keyof CaiDatHoaDon>(key: K, value: CaiDatHoaDon[K]) => {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/cai-dat-hoa-don', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenNhaTro: settings.tenNhaTro,
          ngayLapHoaDon: settings.ngayLapHoaDon,
          hanDongTien: settings.hanDongTien,
          autoSendZalo: settings.autoSendZalo,
          hienMaQR: settings.hienMaQR,
          phanLoaiThuChi: settings.phanLoaiThuChi,
          lamTronHoaDon: settings.lamTronHoaDon,
          hinhThucThanhToanMacDinh: settings.hinhThucThanhToanMacDinh,
          ghiChuMacDinh: settings.ghiChuMacDinh,
          xuLyTienThuaMacDinh: settings.xuLyTienThuaMacDinh,
        }),
      });
      const r = await res.json();
      if (res.ok && r.success) {
        toast.success(r.message || 'Đã lưu cấu hình');
      } else {
        toast.error(r.message || 'Có lỗi xảy ra');
      }
    } catch (e) {
      console.error(e);
      toast.error('Có lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return <div className="h-96 bg-gray-200 rounded animate-pulse" />;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Cài đặt phiếu thu (hóa đơn)</h1>
        <p className="text-sm text-gray-500">Thiết lập, tùy chỉnh cho hóa đơn của bạn</p>
      </div>

      {/* Tên nhà trọ */}
      <div className="space-y-2">
        <Label>Tên nhà trọ (hiển thị trên tin Zalo) <span className="text-red-500">*</span></Label>
        <Input
          value={settings.tenNhaTro}
          onChange={(e) => update('tenNhaTro', e.target.value)}
          placeholder="VD: Nhà trọ Minh Anh"
          maxLength={120}
        />
        <p className="text-xs text-gray-500">Tên này sẽ hiển thị trong tiêu đề và header tin Zalo gửi cho khách</p>
      </div>

      {/* Ngày lập + hạn đóng */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>Ngày lập hóa đơn và trong khoảng 1 đến 31 <span className="text-red-500">*</span></Label>
          <Input
            type="number" min={1} max={31}
            value={settings.ngayLapHoaDon ?? ''}
            placeholder="Để trống = cuối tháng"
            onChange={(e) => update('ngayLapHoaDon', e.target.value === '' ? null : parseInt(e.target.value, 10))}
          />
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-3 flex gap-2 text-sm">
              <Info className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p><strong className="text-green-800">Thông tin:</strong> Khi đến ngày lập hóa đơn hệ thống sẽ nhắc nhở qua thông báo</p>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-gray-500">- Là ngày lập hóa đơn tiền điện, nước...</p>
          <p className="text-xs text-gray-500">- Nhập một ngày trong tháng. Nếu không nhập mặc định là cuối tháng.</p>
        </div>

        <div className="space-y-2">
          <Label>Hạn đóng tiền <span className="text-red-500">*</span></Label>
          <Input
            type="number" min={1} max={31}
            value={settings.hanDongTien}
            onChange={(e) => update('hanDongTien', parseInt(e.target.value, 10) || 1)}
          />
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-3 flex gap-2 text-sm">
              <Info className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p><strong className="text-green-800">Thông tin:</strong> Khi khách đóng tiền không đúng thời hạn hệ thống sẽ nhắc nhở</p>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-gray-500">
            <strong>Ví dụ:</strong> Bạn lập phiếu ngày 01 và hạn đóng tiền thuê trọ ở đây là 5 ngày thì ngày 05 sẽ là ngày hết hạn
          </p>
        </div>
      </div>

      {/* Auto send Zalo */}
      <div className="border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Switch
              checked={settings.autoSendZalo}
              onCheckedChange={(v) => update('autoSendZalo', v)}
            />
            <div>
              <p className="font-semibold">Gửi hóa đơn tự động cho khách qua Zalo</p>
              <p className="text-sm text-gray-600">Tự động gửi hóa đơn qua zalo cho khách ngay khi tạo hóa đơn</p>
              <p className="text-sm text-orange-600 font-semibold mt-1">* Tính năng chỉ hoạt động khi bạn đang sử dụng gói có phí</p>
              <p className="text-sm text-orange-600 font-semibold">* Chỉ gửi từ 6h sáng đến 22h tối</p>
            </div>
          </div>
        </div>
        <div className="space-y-2 flex flex-col gap-2">
          <div className="space-y-2">
            <Label className="text-sm">Hóa đơn dùng để gửi thử</Label>
            <Select value={selectedHoaDon} onValueChange={setSelectedHoaDon}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn 1 hóa đơn có sẵn..." />
              </SelectTrigger>
              <SelectContent>
                {hoaDonList.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-gray-500">Chưa có hóa đơn nào</div>
                ) : hoaDonList.map(h => (
                  <SelectItem key={h._id} value={h._id}>{h.maHoaDon}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => setPreviewOpen(true)}
            disabled={!selectedHoaDon}
          >
            <Send className="h-4 w-4 mr-2" />
            Gửi xem trước
          </Button>
          <Button
            variant="outline"
            className="bg-amber-100 hover:bg-amber-200 border-amber-300"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-4 w-4 mr-2" />
            Xem hình mẫu gửi zalo
          </Button>
        </div>
      </div>

      {/* QR + phân loại */}
      <div className="border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex items-start gap-3">
          <Switch checked={settings.hienMaQR} onCheckedChange={(v) => update('hienMaQR', v)} />
          <div>
            <p className="font-semibold">Ẩn/Hiển mã QR trong hóa đơn</p>
            <p className="text-sm text-gray-600">
              Bạn muốn hiển thị thông tin tài khoản & số tiền hóa đơn bằng mã QR giúp khách hàng thanh toán chuyển khoản nhanh hơn?
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Switch checked={settings.phanLoaiThuChi} onCheckedChange={(v) => update('phanLoaiThuChi', v)} />
          <div>
            <p className="font-semibold">Phân loại thu/chi từ hóa đơn</p>
            <p className="text-sm text-gray-600">
              Khi thu tiền hóa đơn bạn muốn phân tách các phiếu thu chi rõ ràng như: Tiền phòng/giường, tiền dịch vụ, giảm trừ, cộng thêm
            </p>
          </div>
        </div>
      </div>

      {/* Làm tròn + thanh toán mặc định */}
      <div className="border-t pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex items-start gap-3">
          <Switch checked={settings.lamTronHoaDon} onCheckedChange={(v) => update('lamTronHoaDon', v)} />
          <div>
            <p className="font-semibold">Làm tròn hóa đơn</p>
            <p className="text-sm text-gray-600">
              Làm tròn đơn vị 1.000 đ Ví dụ: 4.300 đ → 4.000đ, 4.500 đ → 4.000 đ, 4.600 đ → 5.000đ, 4.800 đ → 5.000đ
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Hình thức thanh toán mặc định <span className="text-red-500">*</span></Label>
          <Select
            value={settings.hinhThucThanhToanMacDinh}
            onValueChange={(v) => update('hinhThucThanhToanMacDinh', v as HinhThucThanhToan)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tienMat">Tiền mặt</SelectItem>
              <SelectItem value="chuyenKhoan">Chuyển khoản</SelectItem>
              <SelectItem value="momo">MoMo</SelectItem>
              <SelectItem value="vnpay">VNPay</SelectItem>
              <SelectItem value="khac">Khác</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tiền khách đóng thừa */}
      <div className="border-t pt-6 space-y-2">
        <Label>Tiền khách đóng thừa</Label>
        <Select
          value={settings.xuLyTienThuaMacDinh ?? 'truKySau'}
          onValueChange={(v) => update('xuLyTienThuaMacDinh', v as XuLyTienThua)}
        >
          <SelectTrigger className="w-full md:w-96">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="truKySau">Trừ vào kỳ sau</SelectItem>
            <SelectItem value="khongTru">Không trừ (bỏ qua tiền thừa)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-gray-600">
          Lựa chọn mặc định khi khách đóng nhiều hơn số đang nợ. Mỗi lần thu tiền vẫn có thể chọn lại.
          Khi khách đóng trước (chưa có nợ), hệ thống luôn chọn sẵn &quot;Trừ vào kỳ sau&quot;.
        </p>
      </div>

      {/* Ghi chú */}
      <div className="border-t pt-6 space-y-2">
        <Label>Ghi chú thêm cho hóa đơn</Label>
        <Textarea
          rows={3}
          value={settings.ghiChuMacDinh}
          onChange={(e) => update('ghiChuMacDinh', e.target.value)}
          placeholder="Ví dụ: Các vi phạm khi đóng tiền trễ hạn..."
          maxLength={500}
        />
        <p className="text-xs text-gray-500 text-right">{settings.ghiChuMacDinh.length}/500</p>
      </div>

      <div className="border-t pt-6 flex justify-end gap-2">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
        </Button>
      </div>

      <ZaloPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        hoaDonId={selectedHoaDon}
      />
    </div>
  );
}
