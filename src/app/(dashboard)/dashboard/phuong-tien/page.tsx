'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Plus, Search, Edit, Car, Bike, Image as ImageIcon,
  RefreshCw, Trash2, CarFront,
} from 'lucide-react';
import {
  Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious,
} from '@/components/ui/carousel';
import { PhongImageUpload } from '@/components/ui/phong-image-upload';
import { DeleteConfirmPopover } from '@/components/ui/delete-confirm-popover';
import { toast } from 'sonner';
import type { KhachThue, PhuongTien, LoaiPhuongTien } from '@/types';

const LOAI_XE_OPTIONS: { value: LoaiPhuongTien; label: string }[] = [
  { value: 'xeMay', label: 'Xe máy' },
  { value: 'oTo', label: 'Ô tô' },
  { value: 'xeDap', label: 'Xe đạp' },
  { value: 'xeDien', label: 'Xe điện' },
  { value: 'khac', label: 'Khác' },
];

const loaiXeLabel = (loai: LoaiPhuongTien) =>
  LOAI_XE_OPTIONS.find(o => o.value === loai)?.label || loai;

const getKhachThueName = (khachThue: PhuongTien['khachThue']) => {
  if (typeof khachThue === 'object' && khachThue?.hoTen) return khachThue.hoTen;
  return 'N/A';
};

const getKhachThuePhone = (khachThue: PhuongTien['khachThue']) => {
  if (typeof khachThue === 'object' && khachThue?.soDienThoai) return khachThue.soDienThoai;
  return '';
};

const getKhachThueId = (khachThue: PhuongTien['khachThue']) => {
  if (typeof khachThue === 'string') return khachThue;
  if (typeof khachThue === 'object' && khachThue?._id) return khachThue._id;
  return '';
};

export default function PhuongTienPage() {
  const [data, setData] = useState<PhuongTien[]>([]);
  const [khachThueList, setKhachThueList] = useState<KhachThue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLoaiXe, setFilterLoaiXe] = useState<string>('all');
  const [filterKhachThue, setFilterKhachThue] = useState<string>('all');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PhuongTien | null>(null);

  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [viewingImages, setViewingImages] = useState<string[]>([]);
  const [viewingName, setViewingName] = useState('');

  useEffect(() => {
    document.title = 'Quản lý phương tiện';
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [ptRes, ktRes] = await Promise.all([
        fetch('/api/phuong-tien?limit=200'),
        fetch('/api/khach-thue?limit=500'),
      ]);
      if (ptRes.ok) {
        const r = await ptRes.json();
        if (r.success) setData(r.data);
      }
      if (ktRes.ok) {
        const r = await ktRes.json();
        if (r.success) setKhachThueList(r.data);
      }
    } catch (e) {
      console.error(e);
      toast.error('Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
    toast.success('Đã tải dữ liệu mới nhất');
  };

  const filtered = data.filter(pt => {
    const matchSearch = !searchTerm
      || pt.tenXe.toLowerCase().includes(searchTerm.toLowerCase())
      || pt.bienSo.toLowerCase().includes(searchTerm.toLowerCase())
      || getKhachThueName(pt.khachThue).toLowerCase().includes(searchTerm.toLowerCase());
    const matchLoai = filterLoaiXe === 'all' || pt.loaiXe === filterLoaiXe;
    const matchKt = filterKhachThue === 'all' || getKhachThueId(pt.khachThue) === filterKhachThue;
    return matchSearch && matchLoai && matchKt;
  });

  const handleEdit = (pt: PhuongTien) => {
    setEditing(pt);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/phuong-tien/${id}`, { method: 'DELETE' });
      const r = await res.json();
      if (res.ok && r.success) {
        setData(prev => prev.filter(x => x._id !== id));
        toast.success(r.message || 'Đã xóa phương tiện');
      } else {
        toast.error(r.message || 'Có lỗi khi xóa');
      }
    } catch (e) {
      console.error(e);
      toast.error('Có lỗi khi xóa');
    }
  };

  const handleViewImages = (pt: PhuongTien) => {
    if (pt.hinhAnh && pt.hinhAnh.length > 0) {
      setViewingImages(pt.hinhAnh);
      setViewingName(`${pt.tenXe} (${pt.bienSo})`);
      setIsImageViewerOpen(true);
    } else {
      toast.info('Phương tiện này chưa có ảnh');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-64 animate-pulse"></div>
        <div className="h-96 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">Quản lý phương tiện</h1>
          <p className="text-xs md:text-sm text-gray-600">Danh sách phương tiện của khách thuê</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Đang tải...' : 'Tải mới'}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(o) => { setIsDialogOpen(o); if (!o) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditing(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Thêm phương tiện
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[95vw] md:w-full">
              <DialogHeader>
                <DialogTitle>{editing ? 'Chỉnh sửa phương tiện' : 'Thêm phương tiện mới'}</DialogTitle>
                <DialogDescription>Nhập thông tin xe của khách thuê</DialogDescription>
              </DialogHeader>
              <PhuongTienForm
                phuongTien={editing}
                khachThueList={khachThueList}
                onClose={() => setIsDialogOpen(false)}
                onSuccess={() => {
                  setIsDialogOpen(false);
                  fetchAll();
                  toast.success(editing ? 'Cập nhật phương tiện thành công!' : 'Thêm phương tiện thành công!');
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Tổng phương tiện</p>
              <p className="text-xl font-bold">{data.length}</p>
            </div>
            <Car className="h-5 w-5 text-blue-500" />
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Xe máy</p>
              <p className="text-xl font-bold text-green-600">
                {data.filter(d => d.loaiXe === 'xeMay').length}
              </p>
            </div>
            <Bike className="h-5 w-5 text-green-500" />
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Ô tô</p>
              <p className="text-xl font-bold text-blue-600">
                {data.filter(d => d.loaiXe === 'oTo').length}
              </p>
            </div>
            <Car className="h-5 w-5 text-blue-500" />
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Xe điện</p>
              <p className="text-xl font-bold text-yellow-600">
                {data.filter(d => d.loaiXe === 'xeDien').length}
              </p>
            </div>
            <Bike className="h-5 w-5 text-yellow-500" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Tìm theo tên xe, biển số, khách thuê..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterLoaiXe} onValueChange={setFilterLoaiXe}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Loại xe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả loại xe</SelectItem>
            {LOAI_XE_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterKhachThue} onValueChange={setFilterKhachThue}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Khách thuê" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả khách thuê</SelectItem>
            {khachThueList.map(kt => (
              <SelectItem key={kt._id} value={kt._id!}>{kt.hoTen}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Danh sách phương tiện</CardTitle>
          <CardDescription>{filtered.length} phương tiện được tìm thấy</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên khách thuê</TableHead>
                  <TableHead>Tên xe</TableHead>
                  <TableHead>Biển số xe</TableHead>
                  <TableHead>Hình xe</TableHead>
                  <TableHead>Loại xe</TableHead>
                  <TableHead>Mô tả</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-gray-500">
                      Không có dữ liệu
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(pt => (
                    <TableRow key={pt._id}>
                      <TableCell>
                        <div className="font-medium">{getKhachThueName(pt.khachThue)}</div>
                        {getKhachThuePhone(pt.khachThue) && (
                          <div className="text-xs text-gray-500">{getKhachThuePhone(pt.khachThue)}</div>
                        )}
                      </TableCell>
                      <TableCell>{pt.tenXe}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">{pt.bienSo}</Badge>
                      </TableCell>
                      <TableCell>
                        {pt.hinhAnh && pt.hinhAnh.length > 0 ? (
                          <Button variant="outline" size="sm" onClick={() => handleViewImages(pt)}>
                            <ImageIcon className="h-4 w-4 mr-1" />
                            {pt.hinhAnh.length}
                          </Button>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{loaiXeLabel(pt.loaiXe)}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-gray-600">
                        {pt.moTa || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(pt)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <DeleteConfirmPopover
                            onConfirm={() => handleDelete(pt._id!)}
                            title="Xóa phương tiện"
                            description={`Xác nhận xóa xe "${pt.tenXe}" (${pt.bienSo})?`}
                            buttonVariant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <Card className="p-6 text-center">
            <Car className="h-10 w-10 mx-auto text-gray-400 mb-3" />
            <p className="text-sm text-gray-600">Không có dữ liệu</p>
          </Card>
        ) : (
          filtered.map(pt => (
            <Card key={pt._id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{pt.tenXe}</h3>
                    <p className="text-xs text-gray-600">{getKhachThueName(pt.khachThue)}</p>
                  </div>
                  <Badge variant="secondary">{loaiXeLabel(pt.loaiXe)}</Badge>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Biển số: </span>
                  <span className="font-mono font-medium">{pt.bienSo}</span>
                </div>
                {pt.moTa && <div className="text-xs text-gray-600">{pt.moTa}</div>}
                <div className="flex gap-2 pt-1">
                  {pt.hinhAnh && pt.hinhAnh.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => handleViewImages(pt)}>
                      <ImageIcon className="h-3.5 w-3.5 mr-1" />
                      {pt.hinhAnh.length} ảnh
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleEdit(pt)} className="flex-1">
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    Sửa
                  </Button>
                  <DeleteConfirmPopover
                    onConfirm={() => handleDelete(pt._id!)}
                    title="Xóa phương tiện"
                    description={`Xác nhận xóa xe "${pt.tenXe}"?`}
                    buttonVariant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Image viewer */}
      <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
        <DialogContent className="max-w-4xl w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Ảnh xe {viewingName}
            </DialogTitle>
          </DialogHeader>
          {viewingImages.length > 0 && (
            <Carousel className="w-full">
              <CarouselContent>
                {viewingImages.map((img, i) => (
                  <CarouselItem key={i}>
                    <div className="flex items-center justify-center p-2">
                      <img
                        src={img}
                        alt={`Ảnh ${i + 1}`}
                        className="max-h-[60vh] w-auto object-contain rounded-lg"
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              {viewingImages.length > 1 && (
                <>
                  <CarouselPrevious />
                  <CarouselNext />
                </>
              )}
            </Carousel>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Form ----------

type FormProps = {
  phuongTien: PhuongTien | null;
  khachThueList: KhachThue[];
  onClose: () => void;
  onSuccess: () => void;
};

function PhuongTienForm({ phuongTien, khachThueList, onClose, onSuccess }: FormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [khachThue, setKhachThue] = useState<string>(
    phuongTien ? getKhachThueId(phuongTien.khachThue) : ''
  );
  const [tenXe, setTenXe] = useState(phuongTien?.tenXe || '');
  const [bienSo, setBienSo] = useState(phuongTien?.bienSo || '');
  const [loaiXe, setLoaiXe] = useState<LoaiPhuongTien>(phuongTien?.loaiXe || 'xeMay');
  const [moTa, setMoTa] = useState(phuongTien?.moTa || '');
  const [hinhAnh, setHinhAnh] = useState<string[]>(phuongTien?.hinhAnh || []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!khachThue) {
      toast.error('Vui lòng chọn khách thuê');
      return;
    }
    if (!tenXe.trim()) {
      toast.error('Vui lòng nhập tên xe');
      return;
    }
    if (!bienSo.trim()) {
      toast.error('Vui lòng nhập biển số xe');
      return;
    }

    setSubmitting(true);
    try {
      const url = phuongTien
        ? `/api/phuong-tien/${phuongTien._id}`
        : '/api/phuong-tien';
      const method = phuongTien ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          khachThue,
          tenXe: tenXe.trim(),
          bienSo: bienSo.trim().toUpperCase(),
          loaiXe,
          moTa: moTa.trim() || undefined,
          hinhAnh,
        }),
      });
      const r = await res.json();
      if (res.ok && r.success) {
        onSuccess();
      } else {
        toast.error(r.message || 'Có lỗi xảy ra');
      }
    } catch (err) {
      console.error(err);
      toast.error('Có lỗi khi gửi form');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 min-w-0">
          <Label>Khách thuê *</Label>
          <Select value={khachThue} onValueChange={setKhachThue}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Chọn khách thuê" />
            </SelectTrigger>
            <SelectContent>
              {khachThueList.map(kt => (
                <SelectItem key={kt._id} value={kt._id!}>
                  {kt.hoTen}{kt.soDienThoai ? ` — ${kt.soDienThoai}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 min-w-0">
          <Label>Loại xe *</Label>
          <Select value={loaiXe} onValueChange={(v) => setLoaiXe(v as LoaiPhuongTien)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOAI_XE_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Tên xe *</Label>
          <Input
            placeholder="VD: Honda Wave Alpha"
            value={tenXe}
            onChange={(e) => setTenXe(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Biển số xe *</Label>
          <Input
            placeholder="VD: 59X1-12345"
            value={bienSo}
            onChange={(e) => setBienSo(e.target.value)}
            className="uppercase font-mono"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Mô tả</Label>
        <Textarea
          placeholder="Ghi chú thêm (màu xe, đặc điểm nhận dạng...)"
          value={moTa}
          onChange={(e) => setMoTa(e.target.value)}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>Hình xe</Label>
        <PhongImageUpload
          images={hinhAnh}
          onImagesChange={setHinhAnh}
          maxImages={5}
          title="Ảnh xe"
          icon={CarFront}
          emptyText="Chưa có ảnh xe nào"
          emptyHelpText='Click "Thêm ảnh" để upload ảnh xe'
          altPrefix="Xe"
          unitLabel="ảnh xe"
        />
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          Hủy
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Đang lưu...' : (phuongTien ? 'Cập nhật' : 'Thêm mới')}
        </Button>
      </DialogFooter>
    </form>
  );
}
