'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft,
  Save,
  FileText,
  Zap,
  Droplets,
  Wrench,
  Calculator,
  RefreshCw
} from 'lucide-react';
import { HopDong, Phong, KhachThue, PhiDichVu, KhoanGiamTru } from '@/types';
import { PhiDichVuEditor, GiamTruEditor, lamTron1000 } from '@/components/hoa-don/khoan-thu-editor';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { danhDauDuLieuThayDoi } from '@/hooks/use-cache';

// Helper functions
const getPhongName = (phongId: string | Phong, phongList: Phong[]) => {
  if (!phongId) return 'N/A';
  if (typeof phongId === 'object' && phongId.maPhong) {
    return phongId.maPhong;
  }
  if (typeof phongId === 'string') {
    const phong = phongList.find(p => p._id === phongId);
    return phong?.maPhong || 'N/A';
  }
  return 'N/A';
};

const getKhachThueName = (khachThueId: string | KhachThue, khachThueList: KhachThue[]) => {
  if (!khachThueId) return 'N/A';
  if (typeof khachThueId === 'object' && khachThueId.hoTen) {
    return khachThueId.hoTen;
  }
  if (typeof khachThueId === 'string') {
    const khachThue = khachThueList.find(k => k._id === khachThueId);
    return khachThue?.hoTen || 'N/A';
  }
  return 'N/A';
};

interface XemTruoc {
  thang: number;
  nam: number;
  kyBatDau: string;
  kyKetThuc: string;
  soNgayKy: number;
  tienPhong: number;
  chiSoDienBanDau: number;
  chiSoDienCuoiKy: number | null;
  chiSoNuocBanDau: number;
  chiSoNuocCuoiKy: number | null;
  chiSoCuoiTuGhiNhan: boolean;
  phiDichVu: PhiDichVu[];
  tienPhongLeGoiY: PhiDichVu | null;
  lamTron: boolean;
  noConLaiKyTruoc: number;
  tienThuaKyTruoc: number;
  hanThanhToan: string;
  ghiChuMacDinh: string;
  hopDong: { giaDien: number; giaNuoc: number; maPhong: string };
}

const fmtNgay = (d: string | Date) => new Date(d).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const toDateInput = (d: string | Date) => new Date(d).toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} VNĐ`;

/** Hợp đồng đang hoạt động của phòng (mới nhất nếu có nhiều). */
function hopDongCuaPhong(list: HopDong[], phongId: string): HopDong | undefined {
  return list
    .filter(h => h.trangThai === 'hoatDong' && (typeof h.phong === 'object' ? (h.phong as { _id?: string })._id : h.phong) === phongId)
    .sort((a, b) => new Date(b.ngayBatDau).getTime() - new Date(a.ngayBatDau).getTime())[0];
}

export default function ThemMoiHoaDonPage() {
  const router = useRouter();
  const [hopDongList, setHopDongList] = useState<HopDong[]>([]);
  const [phongList, setPhongList] = useState<Phong[]>([]);
  const [khachThueList, setKhachThueList] = useState<KhachThue[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [xemTruoc, setXemTruoc] = useState<XemTruoc | null>(null);
  const [loiXemTruoc, setLoiXemTruoc] = useState<string | null>(null);
  const [dangTai, setDangTai] = useState(false);

  const [formData, setFormData] = useState({
    maHoaDon: '',
    hopDong: '',
    phong: '',
    khachThue: '',
    thang: new Date().getMonth() + 1,
    nam: new Date().getFullYear(),
    tienPhong: 0,
    chiSoDienBanDau: 0,
    chiSoDienCuoiKy: 0,
    chiSoNuocBanDau: 0,
    chiSoNuocCuoiKy: 0,
    phiDichVu: [] as PhiDichVu[],
    khoanGiamTru: [] as KhoanGiamTru[],
    hanThanhToan: '',
    ghiChu: '',
  });
  // Khấu trừ tiền thừa kỳ trước — mặc định không trừ
  const [khauTru, setKhauTru] = useState(false);
  const [thayDongHo, setThayDongHo] = useState({ dien: false, soDien: 0, nuoc: false, soNuoc: 0 });

  // Tự động sinh mã hóa đơn
  const generateInvoiceCode = () => {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `HD${year}${month}${day}${randomNum}`;
  };

  useEffect(() => {
    fetchFormData();
    setFormData(prev => ({ ...prev, maHoaDon: generateInvoiceCode() }));
  }, []);

  const fetchFormData = async () => {
    try {
      const res = await fetch('/api/hoa-don/form-data');
      if (res.ok) {
        const r = await res.json();
        setHopDongList(r.data.hopDongList || []);
        setPhongList(r.data.phongList || []);
        setKhachThueList(r.data.khachThueList || []);
        // Mở từ trang Phòng / Hợp đồng: ?phong=<id> hoặc ?hopDong=<id>
        const sp = new URLSearchParams(window.location.search);
        const hds: HopDong[] = r.data.hopDongList || [];
        const hopDongTuUrl = sp.get('hopDong');
        const phongTuUrl = sp.get('phong');
        const chon = hopDongTuUrl
          ? hds.find(h => h._id === hopDongTuUrl)
          : phongTuUrl ? hopDongCuaPhong(hds, phongTuUrl) : undefined;
        if (chon) {
          setFormData(prev => ({ ...prev, hopDong: chon._id!, phong: chon.phong as string }));
        } else if (phongTuUrl || hopDongTuUrl) {
          toast.error('Phòng này không có hợp đồng đang hoạt động');
        }
      }
    } catch (error) {
      console.error('Error fetching form data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Xem trước hóa đơn mỗi khi đổi hợp đồng / tháng / năm
  useEffect(() => {
    if (!formData.hopDong) return;
    const selected = hopDongList.find(hd => hd._id === formData.hopDong);
    if (selected) {
      setFormData(prev => ({ ...prev, phong: selected.phong as string, khachThue: selected.nguoiDaiDien as string }));
    }
    let huy = false;
    setDangTai(true);
    fetch(`/api/hoa-don/latest-reading?hopDong=${formData.hopDong}&thang=${formData.thang}&nam=${formData.nam}`)
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (huy) return;
        if (!ok || !j.success) {
          setXemTruoc(null);
          setLoiXemTruoc(j.message || 'Không lập được hóa đơn cho kỳ này');
          return;
        }
        const bt: XemTruoc = j.data;
        setLoiXemTruoc(null);
        setXemTruoc(bt);
        setKhauTru(false);
        setThayDongHo({ dien: false, soDien: 0, nuoc: false, soNuoc: 0 });
        setFormData(prev => ({
          ...prev,
          tienPhong: bt.tienPhong,
          chiSoDienBanDau: bt.chiSoDienBanDau,
          chiSoDienCuoiKy: bt.chiSoDienCuoiKy ?? bt.chiSoDienBanDau,
          chiSoNuocBanDau: bt.chiSoNuocBanDau,
          chiSoNuocCuoiKy: bt.chiSoNuocCuoiKy ?? bt.chiSoNuocBanDau,
          phiDichVu: bt.phiDichVu,
          hanThanhToan: toDateInput(bt.hanThanhToan),
          ghiChu: prev.ghiChu || bt.ghiChuMacDinh || '',
        }));
      })
      .catch(() => { if (!huy) setLoiXemTruoc('Không tải được dữ liệu xem trước'); })
      .finally(() => { if (!huy) setDangTai(false); });
    return () => { huy = true; };
  }, [formData.hopDong, formData.thang, formData.nam, hopDongList]);

  // Tính tiền (giống server)
  const giaDien = xemTruoc?.hopDong.giaDien ?? 0;
  const giaNuoc = xemTruoc?.hopDong.giaNuoc ?? 0;
  const dienGiam = formData.chiSoDienCuoiKy < formData.chiSoDienBanDau;
  const nuocGiam = formData.chiSoNuocCuoiKy < formData.chiSoNuocBanDau;
  const soDien = dienGiam ? (thayDongHo.dien ? thayDongHo.soDien : 0) : formData.chiSoDienCuoiKy - formData.chiSoDienBanDau;
  const soNuoc = nuocGiam ? (thayDongHo.nuoc ? thayDongHo.soNuoc : 0) : formData.chiSoNuocCuoiKy - formData.chiSoNuocBanDau;
  const tienDien = soDien * giaDien;
  const tienNuoc = soNuoc * giaNuoc;
  const tongPhi = formData.phiDichVu.reduce((s, p) => s + (p.gia || 0), 0);
  const tongGiamTru = formData.khoanGiamTru.reduce((s, g) => s + (g.soTien || 0), 0);
  const tongTruocLamTron = formData.tienPhong + tienDien + tienNuoc + tongPhi - tongGiamTru;
  const tongTien = xemTruoc?.lamTron ? lamTron1000(tongTruocLamTron) : tongTruocLamTron;
  const noConLaiKyTruoc = xemTruoc?.noConLaiKyTruoc ?? 0;
  const tienThuaKyTruoc = xemTruoc?.tienThuaKyTruoc ?? 0;
  const noKyTruoc = noConLaiKyTruoc - (khauTru ? tienThuaKyTruoc : 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.hopDong) return toast.error('Vui lòng chọn hợp đồng');
    if (loiXemTruoc) return toast.error(loiXemTruoc);
    if ((dienGiam && !thayDongHo.dien) || (nuocGiam && !thayDongHo.nuoc)) {
      return toast.error('Chỉ số cuối kỳ nhỏ hơn đầu kỳ — kiểm tra lại hoặc chọn "Thay đồng hồ"');
    }
    if (tongTien < 0) return toast.error('Tổng hóa đơn không được âm — kiểm tra lại mục Giảm trừ');

    setSubmitting(true);
    try {
      const response = await fetch('/api/hoa-don', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maHoaDon: formData.maHoaDon.trim() || undefined,
          hopDong: formData.hopDong,
          thang: formData.thang,
          nam: formData.nam,
          tienPhong: formData.tienPhong,
          chiSoDienCuoiKy: formData.chiSoDienCuoiKy,
          chiSoNuocCuoiKy: formData.chiSoNuocCuoiKy,
          thayDongHo: {
            ...(dienGiam && thayDongHo.dien ? { soDien: thayDongHo.soDien } : {}),
            ...(nuocGiam && thayDongHo.nuoc ? { soNuoc: thayDongHo.soNuoc } : {}),
          },
          phiDichVu: formData.phiDichVu,
          khoanGiamTru: formData.khoanGiamTru,
          hanThanhToan: formData.hanThanhToan,
          ghiChu: formData.ghiChu,
          khauTruTienThua: khauTru,
        }),
      });
      const result = await response.json();
      if (response.ok) {
        danhDauDuLieuThayDoi();
        toast.success(result.message || 'Hóa đơn đã được tạo thành công');
        router.replace('/dashboard/hoa-don');
        router.refresh();
      } else {
        toast.error(result.message || 'Có lỗi xảy ra');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Có lỗi xảy ra khi gửi dữ liệu');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  const dongChiSo = (
    loai: 'dien' | 'nuoc',
    ten: string,
    icon: React.ReactNode,
    donVi: string,
    dau: number,
    cuoi: number,
    so: number,
    gia: number,
    tien: number,
    giam: boolean,
  ) => (
    <tr>
      <td className="border border-gray-200 px-3 py-2">
        <div className="flex items-center gap-2">{icon}<span className="font-medium">{ten}</span></div>
      </td>
      <td className="border border-gray-200 px-3 py-2">
        <span className="font-medium">{dau.toLocaleString('vi-VN')}</span> <span className="text-xs text-gray-500">{donVi}</span>
      </td>
      <td className="border border-gray-200 px-3 py-2">
        <Input
          type="number"
          min="0"
          value={cuoi}
          onChange={(e) => {
            const v = Math.max(0, parseInt(e.target.value) || 0);
            setFormData(prev => (loai === 'dien' ? { ...prev, chiSoDienCuoiKy: v } : { ...prev, chiSoNuocCuoiKy: v }));
          }}
          className={`h-8 w-24 text-center ${giam ? 'border-red-400' : ''}`}
        />
        {giam && (
          <div className="mt-1 space-y-1 text-xs">
            <div className="text-red-600">⚠️ Nhỏ hơn chỉ số đầu kỳ</div>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={loai === 'dien' ? thayDongHo.dien : thayDongHo.nuoc}
                onChange={(e) => setThayDongHo(t => (loai === 'dien' ? { ...t, dien: e.target.checked } : { ...t, nuoc: e.target.checked }))}
              />
              Thay đồng hồ — nhập số tiêu thụ:
            </label>
            {(loai === 'dien' ? thayDongHo.dien : thayDongHo.nuoc) && (
              <Input
                type="number"
                min="0"
                value={loai === 'dien' ? thayDongHo.soDien : thayDongHo.soNuoc}
                onChange={(e) => {
                  const v = Math.max(0, parseInt(e.target.value) || 0);
                  setThayDongHo(t => (loai === 'dien' ? { ...t, soDien: v } : { ...t, soNuoc: v }));
                }}
                className="h-7 w-24 text-center"
              />
            )}
          </div>
        )}
      </td>
      <td className="border border-gray-200 px-3 py-2 font-medium text-blue-600">{so.toLocaleString('vi-VN')} {donVi}</td>
      <td className="border border-gray-200 px-3 py-2">{gia.toLocaleString('vi-VN')}</td>
      <td className="border border-gray-200 px-3 py-2 font-medium text-green-600">{tien.toLocaleString('vi-VN')}</td>
    </tr>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 md:gap-4">
        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/hoa-don')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-900">Tạo hóa đơn mới</h1>
          <p className="text-xs md:text-sm text-gray-600">Hóa đơn hàng tháng theo kỳ thu của hợp đồng</p>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl">Thông tin hóa đơn</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Chọn hợp đồng và tháng — kỳ thu, tiền phòng lẻ, phí dịch vụ và hạn đóng được điền sẵn
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <form onSubmit={handleSubmit}>
            <Tabs defaultValue="thong-tin" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="thong-tin" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3">
                  <FileText className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Thông tin</span>
                  <span className="sm:hidden">Info</span>
                </TabsTrigger>
                <TabsTrigger value="dien-nuoc" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3">
                  <Zap className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Điện & Nước</span>
                  <span className="sm:hidden">Đ&N</span>
                </TabsTrigger>
                <TabsTrigger value="dich-vu" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3">
                  <Wrench className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Phí & khoản khác</span>
                  <span className="sm:hidden">Phí</span>
                </TabsTrigger>
                <TabsTrigger value="tong-ket" className="flex items-center gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3">
                  <Calculator className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Tổng kết</span>
                  <span className="sm:hidden">TK</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="thong-tin" className="space-y-3 md:space-y-4 mt-4 md:mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="maHoaDon" className="text-xs md:text-sm">Mã hóa đơn</Label>
                    <div className="flex gap-2">
                      <Input
                        id="maHoaDon"
                        value={formData.maHoaDon}
                        onChange={(e) => setFormData(prev => ({ ...prev, maHoaDon: e.target.value.toUpperCase() }))}
                        placeholder="Để trống để tự sinh"
                        className="h-10 flex-1 text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, maHoaDon: generateInvoiceCode() }))}
                        className="h-10 px-3"
                        title="Tự động sinh mã hóa đơn"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="hopDong" className="text-xs md:text-sm">Hợp đồng *</Label>
                    <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mb-1">
                      {hopDongList.filter(hd => hd.trangThai === 'hoatDong').length} hợp đồng hoạt động
                    </div>
                    <Select value={formData.hopDong} onValueChange={(value) => setFormData(prev => ({ ...prev, hopDong: value }))}>
                      <SelectTrigger className="h-10 text-sm">
                        <SelectValue placeholder="Chọn hợp đồng" />
                      </SelectTrigger>
                      <SelectContent className="max-w-[500px]">
                        {hopDongList.length === 0 ? (
                          <div className="p-2 text-sm text-gray-500">Đang tải hợp đồng...</div>
                        ) : (
                          hopDongList
                            .filter(hd => hd.trangThai === 'hoatDong')
                            .map((hopDong) => {
                              const phongObj = typeof hopDong.phong === 'object' ? (hopDong.phong as Phong) : null;
                              const phongName = phongObj?.maPhong || getPhongName(hopDong.phong as string, phongList);
                              const toaNhaName = phongObj?.toaNha && typeof phongObj.toaNha === 'object' 
                                ? (phongObj.toaNha as { tenToaNha?: string }).tenToaNha 
                                : 'N/A';
                              const nguoiDaiDienName = getKhachThueName(hopDong.nguoiDaiDien, khachThueList);
                              
                              // Xử lý ngày tháng an toàn
                              const formatDate = (date: unknown) => {
                                try {
                                  if (!date) return 'N/A';
                                  const dateObj = new Date(date as string);
                                  if (isNaN(dateObj.getTime())) return 'N/A';
                                  return dateObj.toLocaleDateString('vi-VN');
                                } catch {
                                  return 'N/A';
                                }
                              };
                              
                              const ngayBatDau = formatDate(hopDong.ngayBatDau);
                              const ngayKetThuc = formatDate(hopDong.ngayKetThuc);
                              
                              return (
                                <SelectItem 
                                  key={hopDong._id} 
                                  value={hopDong._id!}
                                  className="cursor-pointer"
                                >
                                  <div className="flex flex-col gap-1 py-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-blue-700">{hopDong.maHopDong}</span>
                                      <span className="text-gray-400">•</span>
                                      <span className="text-sm font-medium text-gray-700">Phòng {phongName}</span>
                                      {toaNhaName !== 'N/A' && (
                                        <>
                                          <span className="text-gray-400">•</span>
                                          <span className="text-sm text-gray-600">{toaNhaName}</span>
                                        </>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                      <span>👤 {nguoiDaiDienName}</span>
                                      <span className="text-gray-400">•</span>
                                      <span>📅 {ngayBatDau !== 'N/A' && ngayKetThuc !== 'N/A' ? `${ngayBatDau} → ${ngayKetThuc}` : 'Chưa có thông tin ngày'}</span>
                                    </div>
                                  </div>
                                </SelectItem>
                              );
                            })
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm">Phòng</Label>
                    <Select
                      value={formData.phong || undefined}
                      onValueChange={(phongId) => {
                        const hd = hopDongCuaPhong(hopDongList, phongId);
                        if (hd) setFormData(prev => ({ ...prev, phong: phongId, hopDong: hd._id! }));
                      }}
                    >
                      <SelectTrigger className="h-10"><SelectValue placeholder="Chọn phòng" /></SelectTrigger>
                      <SelectContent>
                        {phongList
                          .filter(p => hopDongCuaPhong(hopDongList, p._id!))
                          .map(p => {
                            const hd = hopDongCuaPhong(hopDongList, p._id!)!;
                            const toaNhaTen = typeof p.toaNha === 'object' && p.toaNha ? (p.toaNha as { tenToaNha?: string }).tenToaNha : '';
                            return (
                              <SelectItem key={p._id} value={p._id!}>
                                P.{p.maPhong}{toaNhaTen ? ` · ${toaNhaTen}` : ''} — {getKhachThueName(hd.nguoiDaiDien, khachThueList)}
                              </SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Chọn phòng sẽ tự chọn hợp đồng đang hoạt động của phòng.</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm">Người đại diện</Label>
                    <Input value={getKhachThueName(formData.khachThue, khachThueList)} disabled className="bg-gray-50 h-10" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="thang" className="text-sm">Tháng</Label>
                    <Input
                      id="thang"
                      type="number"
                      min="1"
                      max="12"
                      value={formData.thang}
                      onChange={(e) => setFormData(prev => ({ ...prev, thang: Math.min(12, Math.max(1, parseInt(e.target.value) || 1)) }))}
                      required
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="nam" className="text-sm">Năm</Label>
                    <Input
                      id="nam"
                      type="number"
                      min="2020"
                      value={formData.nam}
                      onChange={(e) => setFormData(prev => ({ ...prev, nam: parseInt(e.target.value) || new Date().getFullYear() }))}
                      required
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="hanThanhToan" className="text-sm">Hạn thanh toán</Label>
                    <Input
                      id="hanThanhToan"
                      type="date"
                      value={formData.hanThanhToan}
                      onChange={(e) => setFormData(prev => ({ ...prev, hanThanhToan: e.target.value }))}
                      required
                      className="h-10"
                    />
                  </div>
                </div>

                {loiXemTruoc && (
                  <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{loiXemTruoc}</div>
                )}
                {xemTruoc && !loiXemTruoc && (
                  <div className="rounded-md border bg-blue-50 p-3 text-sm space-y-1">
                    <div>
                      📅 Kỳ thu: <strong>{fmtNgay(xemTruoc.kyBatDau)}</strong> – <strong>{fmtNgay(new Date(new Date(xemTruoc.kyKetThuc).getTime() - 86400000))}</strong> ({xemTruoc.soNgayKy} ngày) — tiền phòng thu trước cho kỳ này
                    </div>
                    {xemTruoc.tienPhongLeGoiY && (
                      <div>➕ Có {xemTruoc.tienPhongLeGoiY.ten.replace('Tiền phòng lẻ ', 'tiền phòng lẻ ')}: {xemTruoc.tienPhongLeGoiY.gia.toLocaleString('vi-VN')}đ (xem tab Phí & khoản khác)</div>
                    )}
                    {noConLaiKyTruoc > 0 && (
                      <div>⚠️ Khách đang nợ {noConLaiKyTruoc.toLocaleString('vi-VN')}đ — sẽ hiện trên hóa đơn</div>
                    )}
                    {tienThuaKyTruoc > 0 && (
                      <label className="flex items-start gap-2 cursor-pointer pt-1">
                        <Checkbox checked={khauTru} onCheckedChange={(v) => setKhauTru(Boolean(v))} className="mt-0.5 bg-white" />
                        <span>
                          Khấu trừ tiền thừa kỳ trước <strong className="text-emerald-700">{tienThuaKyTruoc.toLocaleString('vi-VN')}đ</strong> vào hóa đơn này
                          <span className="block text-xs text-muted-foreground">Không chọn: khách trả đủ tiền hóa đơn, tiền thừa vẫn giữ lại cho khách.</span>
                        </span>
                      </label>
                    )}
                  </div>
                )}
                {dangTai && <div className="text-xs text-muted-foreground">Đang tính…</div>}

                <div className="space-y-1">
                  <Label htmlFor="tienPhong" className="text-sm">Tiền phòng kỳ này (VNĐ)</Label>
                  <Input
                    id="tienPhong"
                    type="number"
                    min="0"
                    value={formData.tienPhong}
                    onChange={(e) => setFormData(prev => ({ ...prev, tienPhong: Math.max(0, parseInt(e.target.value) || 0) }))}
                    required
                    className="h-10 md:w-1/2"
                  />
                </div>
              </TabsContent>

              <TabsContent value="dien-nuoc" className="space-y-4 mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">⚡💧 Chỉ số điện & nước</h3>
                  {xemTruoc?.chiSoCuoiTuGhiNhan && (
                    <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">📋 Chỉ số cuối lấy từ sổ ghi chỉ số tháng {xemTruoc.thang}/{xemTruoc.nam}</div>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-200 rounded-lg text-sm">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-700">Loại</th>
                        <th className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-700">Đầu kỳ</th>
                        <th className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-700">Cuối kỳ</th>
                        <th className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-700">Sử dụng</th>
                        <th className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-700">Đơn giá</th>
                        <th className="border border-gray-200 px-3 py-2 text-left font-medium text-gray-700">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dongChiSo('dien', 'Điện', <Zap className="h-4 w-4 text-yellow-500" />, 'kWh', formData.chiSoDienBanDau, formData.chiSoDienCuoiKy, soDien, giaDien, tienDien, dienGiam)}
                      {dongChiSo('nuoc', 'Nước', <Droplets className="h-4 w-4 text-blue-500" />, 'm³', formData.chiSoNuocBanDau, formData.chiSoNuocCuoiKy, soNuoc, giaNuoc, tienNuoc, nuocGiam)}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">Chỉ số đầu kỳ lấy từ hóa đơn trước (hoặc chỉ số ban đầu của hợp đồng).</p>
              </TabsContent>

              <TabsContent value="dich-vu" className="space-y-6 mt-6">
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">🔧 Phí dịch vụ & khoản thu khác</h3>
                  <PhiDichVuEditor
                    value={formData.phiDichVu}
                    onChange={(phiDichVu) => setFormData(prev => ({ ...prev, phiDichVu }))}
                    tienPhongLeGoiY={xemTruoc?.tienPhongLeGoiY}
                    giaThueGoiY={hopDongList.find(hd => hd._id === formData.hopDong)?.giaThue}
                    ngayThuGoiY={hopDongList.find(hd => hd._id === formData.hopDong)?.ngayThanhToan}
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold">➖ Giảm trừ</h3>
                  <GiamTruEditor
                    value={formData.khoanGiamTru}
                    onChange={(khoanGiamTru) => setFormData(prev => ({ ...prev, khoanGiamTru }))}
                  />
                </div>
              </TabsContent>

              <TabsContent value="tong-ket" className="space-y-4 mt-6">
                <h3 className="text-base font-semibold">💰 Tổng kết</h3>
                <div className="rounded-lg border p-4 text-sm space-y-1">
                  <div className="flex justify-between"><span>Tiền phòng</span><span>{vnd(formData.tienPhong)}</span></div>
                  <div className="flex justify-between"><span>Tiền điện ({soDien} kWh)</span><span>{vnd(tienDien)}</span></div>
                  <div className="flex justify-between"><span>Tiền nước ({soNuoc} m³)</span><span>{vnd(tienNuoc)}</span></div>
                  {formData.phiDichVu.map((p, i) => (
                    <div key={i} className="flex justify-between"><span>{p.ten}</span><span>{vnd(p.gia)}</span></div>
                  ))}
                  {formData.khoanGiamTru.map((g, i) => (
                    <div key={`g${i}`} className="flex justify-between text-emerald-700"><span>{g.ten}</span><span>−{vnd(g.soTien)}</span></div>
                  ))}
                  {tongTien !== tongTruocLamTron && (
                    <div className="flex justify-between text-muted-foreground"><span>Làm tròn</span><span>{tongTien - tongTruocLamTron > 0 ? '+' : ''}{(tongTien - tongTruocLamTron).toLocaleString('vi-VN')} VNĐ</span></div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Tổng tiền</span><span>{vnd(tongTien)}</span></div>
                  {noKyTruoc !== 0 && (
                    <>
                      <div className={`flex justify-between ${noKyTruoc > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        <span>{noKyTruoc > 0 ? 'Nợ kỳ trước' : 'Tiền thừa kỳ trước'}</span><span>{vnd(noKyTruoc)}</span>
                      </div>
                      <div className="flex justify-between font-bold"><span>Tổng cần thanh toán</span><span>{vnd(tongTien + noKyTruoc)}</span></div>
                    </>
                  )}
                </div>

                {tienThuaKyTruoc > 0 && (
                      <label className="flex items-start gap-2 cursor-pointer rounded-lg border p-3 text-sm">
                        <Checkbox checked={khauTru} onCheckedChange={(v) => setKhauTru(Boolean(v))} className="mt-0.5 bg-white" />
                        <span>
                          Khấu trừ tiền thừa kỳ trước <strong className="text-emerald-700">{tienThuaKyTruoc.toLocaleString('vi-VN')}đ</strong> vào hóa đơn này
                          <span className="block text-xs text-muted-foreground">Không chọn: khách trả đủ tiền hóa đơn, tiền thừa vẫn giữ lại cho khách.</span>
                        </span>
                      </label>
                    )}

                <div className="space-y-2">
                  <Label htmlFor="ghiChu" className="text-sm">Ghi chú</Label>
                  <Input
                    id="ghiChu"
                    value={formData.ghiChu}
                    onChange={(e) => setFormData(prev => ({ ...prev, ghiChu: e.target.value }))}
                    placeholder="Ghi chú về hóa đơn..."
                    className="h-10"
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-2 md:gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push('/dashboard/hoa-don')}
                    disabled={submitting}
                    className="w-full sm:w-auto sm:min-w-[80px]"
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submitting || Boolean(loiXemTruoc) || !xemTruoc}
                    className="w-full sm:w-auto sm:min-w-[120px]"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {submitting ? 'Đang tạo...' : 'Tạo hóa đơn'}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
