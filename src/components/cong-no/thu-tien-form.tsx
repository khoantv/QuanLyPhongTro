'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { tinhTienThua, xemTruocPhanBo, type HoaDonMo } from '@/lib/cong-no/phan-bo';
import type { GiaoDichCongNo, HinhThucThanhToan, XuLyTienThua } from '@/types';
import { SoDuBadge, formatVND } from './so-du';

type PhuongThuc = 'tienMat' | 'chuyenKhoan' | 'viDienTu';

export interface ThanhToanDangSua {
  _id?: string;
  khachThue?: string | { _id?: string; hoTen?: string } | null;
  hoaDon?: string | { _id?: string } | null;
  soTien: number;
  phuongThuc: PhuongThuc;
  thongTinChuyenKhoan?: { nganHang: string; soGiaoDich: string };
  ngayThanhToan: Date | string;
  ghiChu?: string;
  anhBienLai?: string;
  xuLyTienThua?: XuLyTienThua | null;
}

interface KhachOption {
  _id: string;
  hoTen: string;
  soDienThoai: string;
  trangThai?: string;
}

interface CongNoData {
  soDu: number;
  butToan: GiaoDichCongNo[];
  hoaDonMo: Array<HoaDonMo & { thang?: number; nam?: number; phong?: { maPhong?: string } | string }>;
}

const idOf = (v: unknown): string => {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v && '_id' in v) return String((v as { _id?: string })._id ?? '');
  return '';
};

const toDateInput = (d: Date | string) => new Date(d).toISOString().split('T')[0];

const PHUONG_THUC_TU_CAI_DAT: Record<HinhThucThanhToan, PhuongThuc> = {
  tienMat: 'tienMat',
  chuyenKhoan: 'chuyenKhoan',
  momo: 'viDienTu',
  vnpay: 'viDienTu',
  khac: 'tienMat',
};

export function ThuTienForm({
  thanhToan,
  khachThueId: khachThueIdBanDau,
  soTienGoiY,
  onSuccess,
  onCancel,
}: {
  thanhToan?: ThanhToanDangSua | null;
  khachThueId?: string;
  soTienGoiY?: number;
  onSuccess: (result: { soDu?: number; tienThua?: number }) => void;
  onCancel: () => void;
}) {
  const dangSua = Boolean(thanhToan?._id);
  const [khachList, setKhachList] = useState<KhachOption[]>([]);
  const [khachOpen, setKhachOpen] = useState(false);
  const [khachThueId, setKhachThueId] = useState(idOf(thanhToan?.khachThue) || khachThueIdBanDau || '');
  const [congNo, setCongNo] = useState<CongNoData | null>(null);
  const [loadingCongNo, setLoadingCongNo] = useState(false);
  const [xuLyMacDinh, setXuLyMacDinh] = useState<XuLyTienThua>('truKySau');
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    soTien: thanhToan?.soTien ?? soTienGoiY ?? 0,
    phuongThuc: (thanhToan?.phuongThuc ?? 'tienMat') as PhuongThuc,
    nganHang: thanhToan?.thongTinChuyenKhoan?.nganHang ?? '',
    soGiaoDich: thanhToan?.thongTinChuyenKhoan?.soGiaoDich ?? '',
    ngayThanhToan: toDateInput(thanhToan?.ngayThanhToan ?? new Date()),
    ghiChu: thanhToan?.ghiChu ?? '',
    anhBienLai: thanhToan?.anhBienLai ?? '',
  });
  const [xuLyTienThua, setXuLyTienThua] = useState<XuLyTienThua | null>(thanhToan?.xuLyTienThua ?? null);
  const [daChonXuLy, setDaChonXuLy] = useState(Boolean(thanhToan?.xuLyTienThua));
  const [daNhapSoTien, setDaNhapSoTien] = useState(Boolean(thanhToan?._id) || soTienGoiY !== undefined);

  // Danh sách khách + cài đặt mặc định
  useEffect(() => {
    fetch('/api/khach-thue?limit=1000')
      .then((r) => r.json())
      .then((r) => {
        if (r.success) {
          const list: KhachOption[] = r.data;
          list.sort((a, b) => Number(b.trangThai === 'dangThue') - Number(a.trangThai === 'dangThue') || a.hoTen.localeCompare(b.hoTen, 'vi'));
          setKhachList(list);
        }
      })
      .catch(() => undefined);
    fetch('/api/cai-dat-hoa-don')
      .then((r) => r.json())
      .then((r) => {
        if (!r.success) return;
        setXuLyMacDinh(r.data.xuLyTienThuaMacDinh ?? 'truKySau');
        if (!thanhToan?._id && r.data.hinhThucThanhToanMacDinh) {
          setForm((f) => ({ ...f, phuongThuc: PHUONG_THUC_TU_CAI_DAT[r.data.hinhThucThanhToanMacDinh as HinhThucThanhToan] ?? 'tienMat' }));
        }
      })
      .catch(() => undefined);
  }, [thanhToan?._id]);

  // Công nợ của khách đang chọn
  useEffect(() => {
    if (!khachThueId) {
      setCongNo(null);
      return;
    }
    setLoadingCongNo(true);
    fetch(`/api/cong-no?khachThueId=${khachThueId}`)
      .then((r) => r.json())
      .then((r) => setCongNo(r.success ? r.data : null))
      .catch(() => setCongNo(null))
      .finally(() => setLoadingCongNo(false));
  }, [khachThueId]);

  // Số dư "nền" = số dư hiện tại trừ đi ảnh hưởng của chính thanh toán đang sửa
  const soDuNen = useMemo(() => {
    if (!congNo) return 0;
    if (!dangSua) return congNo.soDu;
    const anhHuong = congNo.butToan
      .filter((b) => !b.daHuy && idOf(b.thanhToan) === thanhToan?._id)
      .reduce((s, b) => s + b.soTien, 0);
    return congNo.soDu - anhHuong;
  }, [congNo, dangSua, thanhToan?._id]);

  // Gợi ý số tiền = số đang nợ khi tạo mới
  useEffect(() => {
    if (!daNhapSoTien && congNo && !dangSua) {
      setForm((f) => ({ ...f, soTien: Math.max(0, congNo.soDu) }));
    }
  }, [congNo, daNhapSoTien, dangSua]);

  const tienThua = tinhTienThua(form.soTien, soDuNen - form.soTien);
  const dongTruoc = soDuNen <= 0;

  // Lựa chọn xử lý tiền thừa mặc định
  useEffect(() => {
    if (tienThua > 0 && !daChonXuLy) setXuLyTienThua(dongTruoc ? 'truKySau' : xuLyMacDinh);
  }, [tienThua, daChonXuLy, dongTruoc, xuLyMacDinh]);

  const phanBo = useMemo(
    () => (congNo && !dangSua ? xemTruocPhanBo(congNo.hoaDonMo, form.soTien) : null),
    [congNo, dangSua, form.soTien],
  );

  const khachDangChon = khachList.find((k) => k._id === khachThueId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!khachThueId) {
      toast.error('Vui lòng chọn khách thuê');
      return;
    }
    if (!form.soTien || form.soTien <= 0) {
      toast.error('Số tiền phải lớn hơn 0');
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        khachThueId,
        soTien: form.soTien,
        phuongThuc: form.phuongThuc,
        thongTinChuyenKhoan: form.phuongThuc === 'chuyenKhoan' ? { nganHang: form.nganHang, soGiaoDich: form.soGiaoDich } : undefined,
        ngayThanhToan: form.ngayThanhToan,
        ghiChu: form.ghiChu,
        anhBienLai: form.anhBienLai,
        xuLyTienThua: tienThua > 0 ? xuLyTienThua : null,
      };
      const res = await fetch(dangSua ? `/api/thanh-toan/${thanhToan!._id}` : '/api/thanh-toan', {
        method: dangSua ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const r = await res.json();
      if (!res.ok || !r.success) {
        toast.error(r.message || 'Không thể lưu thanh toán');
        return;
      }
      const kq = r.data?.congNo ?? r.congNo ?? {};
      toast.success(dangSua ? 'Đã cập nhật thanh toán' : 'Đã ghi nhận thanh toán', {
        description: kq.soDu !== undefined ? `Số dư công nợ: ${moTaSoDu(kq.soDu)}` : undefined,
      });
      onSuccess(kq);
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi xảy ra khi gửi dữ liệu');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Khách thuê */}
      <div className="space-y-2">
        <Label>Khách thuê</Label>
        <Popover open={khachOpen} onOpenChange={setKhachOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={dangSua && Boolean(khachThueId)}>
              {khachDangChon ? `${khachDangChon.hoTen} — ${khachDangChon.soDienThoai}` : (khachThueId ? 'Đang tải…' : 'Chọn khách thuê')}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Tìm theo tên hoặc số điện thoại…" />
              <CommandList>
                <CommandEmpty>Không tìm thấy khách thuê</CommandEmpty>
                <CommandGroup>
                  {khachList.map((k) => (
                    <CommandItem
                      key={k._id}
                      value={`${k.hoTen} ${k.soDienThoai}`}
                      onSelect={() => {
                        setKhachThueId(k._id);
                        setDaNhapSoTien(false);
                        setDaChonXuLy(false);
                        setKhachOpen(false);
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', k._id === khachThueId ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex-1">{k.hoTen}</span>
                      <span className="text-xs text-muted-foreground">{k.soDienThoai}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Tình hình công nợ */}
      {khachThueId && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
          {loadingCongNo || !congNo ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải công nợ…</div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{dangSua ? 'Số dư (không tính thanh toán này)' : 'Số dư hiện tại'}</span>
                <SoDuBadge soDu={soDuNen} />
              </div>
              {!dangSua && congNo.hoaDonMo.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Hóa đơn còn nợ (trả cũ trước):</p>
                  {congNo.hoaDonMo.map((hd) => (
                    <div key={hd._id} className="flex justify-between text-xs">
                      <span>{hd.maHoaDon}{hd.thang ? ` — T${hd.thang}/${hd.nam}` : ''}</span>
                      <span className="font-medium">{formatVND(hd.conLai)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Số tiền */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="soTien">Số tiền (VNĐ)</Label>
          {congNo && soDuNen > 0 && (
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => { setForm((f) => ({ ...f, soTien: soDuNen })); setDaNhapSoTien(true); }}>
              Điền số đang nợ ({formatVND(soDuNen)})
            </button>
          )}
        </div>
        <Input
          id="soTien"
          type="number"
          min={1}
          value={form.soTien || ''}
          onChange={(e) => { setForm((f) => ({ ...f, soTien: parseInt(e.target.value) || 0 })); setDaNhapSoTien(true); }}
          required
        />
        {phanBo && form.soTien > 0 && (phanBo.dong.length > 0 || phanBo.tienThua > 0) && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {phanBo.dong.map((d) => (
              <div key={d.hoaDon._id}>→ Trả {formatVND(d.soTien)} cho {d.hoaDon.maHoaDon}{d.traDu ? ' (đủ)' : ''}</div>
            ))}
          </div>
        )}
      </div>

      {/* Xử lý tiền thừa */}
      {tienThua > 0 && congNo && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm space-y-2 dark:bg-amber-950/30">
          <p className="font-medium">
            {dongTruoc ? `Khách đóng trước ${formatVND(tienThua)}` : `Khách đóng thừa ${formatVND(tienThua)}`}
          </p>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="radio" name="xuLyTienThua" className="mt-1" checked={xuLyTienThua === 'truKySau'} onChange={() => { setXuLyTienThua('truKySau'); setDaChonXuLy(true); }} />
            <span>Trừ vào kỳ sau <span className="text-muted-foreground">— hóa đơn sau hiện &quot;Tiền thừa kỳ trước&quot;</span></span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input type="radio" name="xuLyTienThua" className="mt-1" checked={xuLyTienThua === 'khongTru'} onChange={() => { setXuLyTienThua('khongTru'); setDaChonXuLy(true); }} />
            <span>Không trừ <span className="text-muted-foreground">— bỏ qua phần thừa, số dư khách về 0</span></span>
          </label>
        </div>
      )}

      {/* Phương thức */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Phương thức thanh toán</Label>
          <Select value={form.phuongThuc} onValueChange={(v) => setForm((f) => ({ ...f, phuongThuc: v as PhuongThuc }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tienMat">Tiền mặt</SelectItem>
              <SelectItem value="chuyenKhoan">Chuyển khoản</SelectItem>
              <SelectItem value="viDienTu">Ví điện tử</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ngayThanhToan">Ngày thanh toán</Label>
          <Input id="ngayThanhToan" type="date" value={form.ngayThanhToan} onChange={(e) => setForm((f) => ({ ...f, ngayThanhToan: e.target.value }))} required />
        </div>
      </div>

      {form.phuongThuc === 'chuyenKhoan' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="nganHang">Ngân hàng</Label>
            <Input id="nganHang" value={form.nganHang} onChange={(e) => setForm((f) => ({ ...f, nganHang: e.target.value }))} placeholder="Tên ngân hàng" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="soGiaoDich">Số giao dịch</Label>
            <Input id="soGiaoDich" value={form.soGiaoDich} onChange={(e) => setForm((f) => ({ ...f, soGiaoDich: e.target.value }))} placeholder="Mã giao dịch" required />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="ghiChu">Ghi chú</Label>
        <Textarea id="ghiChu" rows={2} value={form.ghiChu} onChange={(e) => setForm((f) => ({ ...f, ghiChu: e.target.value }))} placeholder="Ghi chú về giao dịch…" />
      </div>

      <ImageUpload
        imageUrl={form.anhBienLai}
        onImageChange={(url) => setForm((f) => ({ ...f, anhBienLai: url }))}
        label="Ảnh biên lai"
        placeholder="Chọn ảnh biên lai thanh toán"
      />

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Hủy</Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {dangSua ? 'Cập nhật' : 'Ghi nhận thanh toán'}
        </Button>
      </div>
    </form>
  );
}

function moTaSoDu(soDu: number) {
  if (soDu > 0) return `còn nợ ${formatVND(soDu)}`;
  if (soDu < 0) return `tiền thừa ${formatVND(-soDu)}`;
  return 'đã đủ';
}
