'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tabs, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Plus, Search, Edit, Gift, RefreshCw, Home, Building2, Package, Copy, X, Check,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { DeleteConfirmPopover } from '@/components/ui/delete-confirm-popover';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { TAI_SAN_ICONS, getTaiSanIcon } from '@/lib/tai-san-icons';
import type { TaiSan, Phong, ToaNha, LoaiGanKetTaiSan } from '@/types';

const fmtVND = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + 'đ';

function phongName(phong: TaiSan['phong']): string {
  if (typeof phong === 'object' && phong?.maPhong) return phong.maPhong;
  return '—';
}
function toaNhaName(toaNha: TaiSan['toaNha']): string {
  if (typeof toaNha === 'object' && toaNha?.tenToaNha) return toaNha.tenToaNha;
  return '—';
}
function refId(field: TaiSan['phong'] | TaiSan['toaNha']): string {
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field?._id) return field._id;
  return '';
}

export default function TaiSanPage() {
  const [data, setData] = useState<TaiSan[]>([]);
  const [phongList, setPhongList] = useState<Phong[]>([]);
  const [toaNhaList, setToaNhaList] = useState<ToaNha[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLoai, setFilterLoai] = useState<'all' | LoaiGanKetTaiSan>('all');
  const [filterPhong, setFilterPhong] = useState<string>('all');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TaiSan | null>(null);

  useEffect(() => {
    document.title = 'Quản lý tài sản';
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch('/api/tai-san?limit=200'),
        fetch('/api/phong?limit=200'),
        fetch('/api/toa-nha?limit=50'),
      ]);
      if (r1.ok) { const j = await r1.json(); if (j.success) setData(j.data); }
      if (r2.ok) { const j = await r2.json(); if (j.success) setPhongList(j.data); }
      if (r3.ok) { const j = await r3.json(); if (j.success) setToaNhaList(j.data); }
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

  const filtered = data.filter(t => {
    const matchSearch = !searchTerm
      || t.ten.toLowerCase().includes(searchTerm.toLowerCase());
    const matchLoai = filterLoai === 'all' || t.loaiGanKet === filterLoai;
    const matchPhong = filterPhong === 'all' || refId(t.phong) === filterPhong;
    return matchSearch && matchLoai && matchPhong;
  });

  const handleEdit = (ts: TaiSan) => {
    setEditing(ts);
    setIsDialogOpen(true);
  };

  const handleClone = async (ts: TaiSan, phongs?: string[]) => {
    try {
      const res = await fetch(`/api/tai-san/${ts._id}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: phongs && phongs.length > 0 ? JSON.stringify({ phongs }) : '',
      });
      const r = await res.json();
      if (res.ok && r.success) {
        await fetchAll();
        toast.success(r.message || 'Đã nhân bản');
      } else {
        toast.error(r.message || 'Có lỗi khi nhân bản');
      }
    } catch {
      toast.error('Có lỗi khi nhân bản');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/tai-san/${id}`, { method: 'DELETE' });
      const r = await res.json();
      if (res.ok && r.success) {
        setData(prev => prev.filter(x => x._id !== id));
        toast.success(r.message || 'Đã xóa');
      } else {
        toast.error(r.message || 'Có lỗi khi xóa');
      }
    } catch {
      toast.error('Có lỗi khi xóa');
    }
  };

  // Stats
  const totalCount = data.length;
  const chungCount = data.filter(t => t.loaiGanKet === 'chung').length;
  const phongCount = data.filter(t => t.loaiGanKet === 'phong').length;
  const totalValue = data.reduce((s, t) => s + (t.giaTri || 0) * (t.tongSoLuong || 1), 0);

  if (loading) {
    return <div className="h-96 bg-gray-200 rounded animate-pulse" />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Quản lý tài sản</h1>
          <p className="text-xs md:text-sm text-gray-600">Tài sản chung và tài sản gắn với từng phòng</p>
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
                Thêm tài sản
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[95vw]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5 text-green-600" />
                  {editing ? 'Chỉnh sửa tài sản' : 'Thêm mới tài sản'}
                </DialogTitle>
                <DialogDescription>Khai báo tài sản cho nhà trọ hoặc từng phòng</DialogDescription>
              </DialogHeader>
              <TaiSanForm
                taiSan={editing}
                phongList={phongList}
                toaNhaList={toaNhaList}
                onClose={() => setIsDialogOpen(false)}
                onSuccess={() => {
                  setIsDialogOpen(false);
                  fetchAll();
                  toast.success(editing ? 'Cập nhật thành công!' : 'Thêm tài sản thành công!');
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
              <p className="text-xs text-gray-600">Tổng tài sản</p>
              <p className="text-xl font-bold">{totalCount}</p>
            </div>
            <Package className="h-5 w-5 text-blue-500" />
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Tài sản chung</p>
              <p className="text-xl font-bold text-green-600">{chungCount}</p>
            </div>
            <Building2 className="h-5 w-5 text-green-500" />
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Tài sản trong phòng</p>
              <p className="text-xl font-bold text-purple-600">{phongCount}</p>
            </div>
            <Home className="h-5 w-5 text-purple-500" />
          </div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600">Tổng giá trị</p>
              <p className="text-base font-bold text-amber-600">{fmtVND(totalValue)}</p>
            </div>
            <Gift className="h-5 w-5 text-amber-500" />
          </div>
        </Card>
      </div>

      {/* Tabs + filter */}
      <div className="flex flex-col md:flex-row gap-3">
        <Tabs value={filterLoai} onValueChange={(v) => setFilterLoai(v as 'all' | LoaiGanKetTaiSan)}>
          <TabsList>
            <TabsTrigger value="all">Tất cả ({totalCount})</TabsTrigger>
            <TabsTrigger value="chung">Chung ({chungCount})</TabsTrigger>
            <TabsTrigger value="phong">Theo phòng ({phongCount})</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Tìm theo tên tài sản..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterPhong} onValueChange={setFilterPhong}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Phòng" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả phòng</SelectItem>
            {phongList.map(p => (
              <SelectItem key={p._id} value={p._id!}>{p.maPhong}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Danh sách tài sản</CardTitle>
          <CardDescription>{filtered.length} tài sản</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên tài sản</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Phòng / Tòa</TableHead>
                  <TableHead className="text-right">Số lượng</TableHead>
                  <TableHead className="text-right">Giá trị / cái</TableHead>
                  <TableHead className="text-right">Tổng giá trị</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-gray-500">Không có dữ liệu</TableCell>
                  </TableRow>
                ) : filtered.map(ts => {
                  const Icon = getTaiSanIcon(ts.icon);
                  return (
                    <TableRow key={ts._id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-9 h-9 bg-green-50 rounded-md flex items-center justify-center text-green-700">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-medium">{ts.ten}</div>
                            {ts.donViCungCap && <div className="text-xs text-gray-500">{ts.donViCungCap}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {ts.loaiGanKet === 'chung' ? (
                          <Badge className="bg-green-600 gap-1"><Building2 className="h-3 w-3" />Chung</Badge>
                        ) : (
                          <Badge className="bg-purple-600 gap-1"><Home className="h-3 w-3" />Theo phòng</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {ts.loaiGanKet === 'phong'
                          ? <span className="font-medium">{phongName(ts.phong)}</span>
                          : (toaNhaName(ts.toaNha) !== '—' ? <span>{toaNhaName(ts.toaNha)}</span> : <span className="text-gray-400">Toàn bộ</span>)}
                      </TableCell>
                      <TableCell className="text-right">{ts.tongSoLuong} {ts.donVi}</TableCell>
                      <TableCell className="text-right">{fmtVND(ts.giaTri)}</TableCell>
                      <TableCell className="text-right font-semibold">{fmtVND(ts.giaTri * ts.tongSoLuong)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(ts)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <CloneButton taiSan={ts} phongList={phongList} onClone={handleClone} />
                          <DeleteConfirmPopover
                            onConfirm={() => handleDelete(ts._id!)}
                            title="Xóa tài sản"
                            description={`Xác nhận xóa "${ts.ten}"?`}
                            buttonVariant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.length === 0 ? (
          <Card className="p-6 text-center text-gray-500">Không có dữ liệu</Card>
        ) : filtered.map(ts => {
          const Icon = getTaiSanIcon(ts.icon);
          return (
            <Card key={ts._id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-green-50 rounded-md flex items-center justify-center text-green-700">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold truncate">{ts.ten}</h3>
                      {ts.loaiGanKet === 'chung'
                        ? <Badge className="bg-green-600 text-xs">Chung</Badge>
                        : <Badge className="bg-purple-600 text-xs">Phòng {phongName(ts.phong)}</Badge>}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {ts.tongSoLuong} {ts.donVi} × {fmtVND(ts.giaTri)} = <strong>{fmtVND(ts.giaTri * ts.tongSoLuong)}</strong>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(ts)} className="flex-1">
                    <Edit className="h-3.5 w-3.5 mr-1" /> Sửa
                  </Button>
                  <CloneButton taiSan={ts} phongList={phongList} onClone={handleClone} />
                  <DeleteConfirmPopover
                    onConfirm={() => handleDelete(ts._id!)}
                    title="Xóa tài sản"
                    description={`Xác nhận xóa "${ts.ten}"?`}
                    buttonVariant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Form ----------

type FormProps = {
  taiSan: TaiSan | null;
  phongList: Phong[];
  toaNhaList: ToaNha[];
  onClose: () => void;
  onSuccess: () => void;
};

function TaiSanForm({ taiSan, phongList, toaNhaList, onClose, onSuccess }: FormProps) {
  const isEdit = !!taiSan;
  const [submitting, setSubmitting] = useState(false);
  const [ten, setTen] = useState(taiSan?.ten || '');
  const [icon, setIcon] = useState(taiSan?.icon || 'package');
  const [giaTri, setGiaTri] = useState<string>(taiSan ? String(taiSan.giaTri) : '');
  const [giaNhap, setGiaNhap] = useState<string>(taiSan?.giaNhap ? String(taiSan.giaNhap) : '');
  const [tongSoLuong, setTongSoLuong] = useState<string>(taiSan ? String(taiSan.tongSoLuong) : '1');
  const [donVi, setDonVi] = useState(taiSan?.donVi || 'Cái');
  const [donViCungCap, setDonViCungCap] = useState(taiSan?.donViCungCap || '');
  const [loaiGanKet, setLoaiGanKet] = useState<LoaiGanKetTaiSan>(taiSan?.loaiGanKet || 'chung');
  // edit: single phong; create: multi phongs[]
  const [phong, setPhong] = useState<string>(refId(taiSan?.phong));
  const [phongs, setPhongs] = useState<string[]>(refId(taiSan?.phong) ? [refId(taiSan?.phong)] : []);
  const [toaNha, setToaNha] = useState<string>(refId(taiSan?.toaNha));
  const [moTa, setMoTa] = useState(taiSan?.moTa || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ten.trim()) return toast.error('Nhập tên tài sản');
    const giaTriNum = parseFloat(giaTri);
    if (!Number.isFinite(giaTriNum) || giaTriNum < 0) return toast.error('Giá trị không hợp lệ');
    const slNum = parseInt(tongSoLuong, 10);
    if (!Number.isFinite(slNum) || slNum < 1) return toast.error('Số lượng phải ≥ 1');
    if (loaiGanKet === 'phong') {
      if (isEdit && !phong) return toast.error('Chọn phòng cho tài sản');
      if (!isEdit && phongs.length === 0) return toast.error('Chọn ít nhất 1 phòng cho tài sản');
    }

    setSubmitting(true);
    try {
      const url = isEdit ? `/api/tai-san/${taiSan!._id}` : '/api/tai-san';
      const method = isEdit ? 'PUT' : 'POST';
      const body: Record<string, unknown> = {
        ten: ten.trim(),
        icon,
        giaTri: giaTriNum,
        giaNhap: giaNhap.trim() === '' ? null : parseFloat(giaNhap),
        tongSoLuong: slNum,
        donVi: donVi.trim() || 'Cái',
        donViCungCap: donViCungCap.trim() || undefined,
        loaiGanKet,
        toaNha: toaNha || null,
        moTa: moTa.trim() || undefined,
      };
      if (loaiGanKet === 'phong') {
        if (isEdit) body.phong = phong;
        else body.phongs = phongs;
      } else {
        body.phong = null;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      {/* Tên */}
      <div className="space-y-2">
        <Label>Tên tài sản <span className="text-red-500">*</span></Label>
        <Input value={ten} onChange={(e) => setTen(e.target.value)} placeholder="VD: Tủ lạnh Toshiba 150L" />
      </div>

      {/* Icon picker */}
      <div className="space-y-2">
        <Label className="border-l-4 border-green-500 pl-2">Chọn icon đại diện cho tài sản</Label>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 grid grid-cols-5 sm:grid-cols-6 gap-2">
          {TAI_SAN_ICONS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              title={label}
              onClick={() => setIcon(key)}
              className={cn(
                'aspect-square flex items-center justify-center rounded-md border-2 transition-colors',
                icon === key
                  ? 'border-green-600 bg-white text-green-700'
                  : 'border-transparent bg-white/60 hover:bg-white text-gray-600',
              )}
            >
              <Icon className="h-6 w-6" />
            </button>
          ))}
        </div>
      </div>

      {/* Loại gắn kết */}
      <div className="space-y-2">
        <Label>Loại tài sản <span className="text-red-500">*</span></Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLoaiGanKet('chung')}
            className={cn(
              'p-3 rounded-md border-2 text-left transition-colors',
              loaiGanKet === 'chung'
                ? 'border-green-600 bg-green-50'
                : 'border-gray-200 hover:border-gray-300',
            )}
          >
            <div className="flex items-center gap-2 font-medium">
              <Building2 className="h-4 w-4" />
              Tài sản chung
            </div>
            <p className="text-xs text-gray-500 mt-1">Dùng chung cho cả nhà trọ hoặc tòa nhà</p>
          </button>
          <button
            type="button"
            onClick={() => setLoaiGanKet('phong')}
            className={cn(
              'p-3 rounded-md border-2 text-left transition-colors',
              loaiGanKet === 'phong'
                ? 'border-purple-600 bg-purple-50'
                : 'border-gray-200 hover:border-gray-300',
            )}
          >
            <div className="flex items-center gap-2 font-medium">
              <Home className="h-4 w-4" />
              Gắn với phòng
            </div>
            <p className="text-xs text-gray-500 mt-1">Tài sản thuộc 1 phòng cụ thể</p>
          </button>
        </div>
      </div>

      {/* Phòng / Tòa nhà chọn */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loaiGanKet === 'phong' && (
          <div className="space-y-2 min-w-0">
            <Label>
              Phòng <span className="text-red-500">*</span>
              {!isEdit && <span className="text-xs text-gray-500 font-normal ml-1">(chọn nhiều để tạo cho từng phòng)</span>}
            </Label>
            {isEdit ? (
              <Select value={phong} onValueChange={setPhong}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Chọn phòng" /></SelectTrigger>
                <SelectContent>
                  {phongList.map(p => (
                    <SelectItem key={p._id} value={p._id!}>{p.maPhong}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <PhongMultiSelect
                phongList={phongList}
                value={phongs}
                onChange={setPhongs}
              />
            )}
          </div>
        )}
        <div className="space-y-2 min-w-0">
          <Label>Tòa nhà {loaiGanKet === 'chung' && <span className="text-xs text-gray-400">(tùy chọn)</span>}</Label>
          <Select value={toaNha || 'none'} onValueChange={(v) => setToaNha(v === 'none' ? '' : v)}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Toàn hệ thống" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Toàn hệ thống</SelectItem>
              {toaNhaList.map(t => (
                <SelectItem key={t._id} value={t._id!}>{t.tenToaNha}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Giá trị + giá nhập */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Giá trị tài sản (đ) <span className="text-red-500">*</span></Label>
          <Input
            type="number" min={0} step={1000}
            value={giaTri}
            onChange={(e) => setGiaTri(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label>Giá trị nhập vào (đ)</Label>
          <Input
            type="number" min={0} step={1000}
            value={giaNhap}
            onChange={(e) => setGiaNhap(e.target.value)}
            placeholder="0 (tùy chọn)"
          />
        </div>
      </div>

      {/* Số lượng + đơn vị */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tổng số lượng <span className="text-red-500">*</span></Label>
          <Input
            type="number" min={1} step={1}
            value={tongSoLuong}
            onChange={(e) => setTongSoLuong(e.target.value)}
          />
        </div>
        <div className="space-y-2 min-w-0">
          <Label>Đơn vị (chiếc/cái)</Label>
          <Input value={donVi} onChange={(e) => setDonVi(e.target.value)} placeholder="Cái" />
        </div>
      </div>

      {/* Đơn vị cung cấp */}
      <div className="space-y-2">
        <Label>Đơn vị cung cấp</Label>
        <Input
          value={donViCungCap}
          onChange={(e) => setDonViCungCap(e.target.value)}
          placeholder="Tên nhà cung cấp (tùy chọn)"
        />
      </div>

      {/* Mô tả */}
      <div className="space-y-2">
        <Label>Ghi chú</Label>
        <Textarea
          rows={2}
          value={moTa}
          onChange={(e) => setMoTa(e.target.value)}
          placeholder="Ghi chú thêm (tùy chọn)"
          maxLength={500}
        />
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Đóng</Button>
        <Button type="submit" disabled={submitting} className="bg-green-600 hover:bg-green-700">
          {submitting
            ? 'Đang lưu...'
            : (isEdit
                ? 'Cập nhật'
                : (loaiGanKet === 'phong' && phongs.length > 1
                    ? `Thêm cho ${phongs.length} phòng`
                    : 'Thêm tài sản'))}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ---------- Multi-select phòng (checkbox dropdown) ----------

function PhongMultiSelect({
  phongList, value, onChange,
}: {
  phongList: Phong[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = phongList.filter(p =>
    !search || p.maPhong.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  };

  const selectedNames = phongList.filter(p => value.includes(p._id!)).map(p => p.maPhong);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full min-h-9 border rounded-md px-3 py-2 text-sm text-left bg-transparent flex items-center justify-between gap-2"
        >
          <div className="flex-1 flex flex-wrap gap-1 min-w-0">
            {selectedNames.length === 0 ? (
              <span className="text-gray-400">Chọn 1 hoặc nhiều phòng...</span>
            ) : (
              selectedNames.slice(0, 4).map(name => (
                <span key={name} className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs">
                  {name}
                </span>
              ))
            )}
            {selectedNames.length > 4 && (
              <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs">
                +{selectedNames.length - 4}
              </span>
            )}
          </div>
          {value.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
              title="Bỏ chọn tất cả"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            placeholder="Tìm phòng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex justify-between items-center px-3 py-2 border-b text-xs text-gray-500">
          <span>{value.length} đã chọn</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange(filtered.map(p => p._id!))}
              className="hover:text-blue-600"
            >Tất cả</button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="hover:text-red-600"
            >Xóa</button>
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-4 text-sm text-gray-400 text-center">Không có phòng</div>
          ) : filtered.map(p => {
            const checked = value.includes(p._id!);
            return (
              <button
                key={p._id}
                type="button"
                onClick={() => toggle(p._id!)}
                className="w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-left"
              >
                <Checkbox checked={checked} />
                <span className="flex-1">{p.maPhong}</span>
                {checked && <Check className="h-4 w-4 text-purple-600" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------- Clone button (popover chọn phòng đích) ----------

function CloneButton({
  taiSan, phongList, onClone,
}: {
  taiSan: TaiSan;
  phongList: Phong[];
  onClone: (ts: TaiSan, phongs?: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [phongs, setPhongs] = useState<string[]>([]);

  const handleQuickClone = async () => {
    setOpen(false);
    await onClone(taiSan);
  };
  const handleCloneToPhongs = async () => {
    if (phongs.length === 0) {
      toast.error('Chọn ít nhất 1 phòng');
      return;
    }
    setOpen(false);
    const targets = [...phongs];
    setPhongs([]);
    await onClone(taiSan, targets);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setPhongs([]); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" title="Nhân bản tài sản" className="text-purple-600 hover:bg-purple-50">
          <Copy className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px]" align="end">
        <div className="space-y-3">
          <div>
            <p className="font-semibold text-sm">Nhân bản tài sản</p>
            <p className="text-xs text-gray-500">&quot;{taiSan.ten}&quot;</p>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleQuickClone}>
            Nhân bản nguyên trạng
          </Button>
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-medium">Hoặc nhân bản cho phòng khác:</p>
            <PhongMultiSelect phongList={phongList} value={phongs} onChange={setPhongs} />
            <Button
              size="sm"
              className="w-full bg-purple-600 hover:bg-purple-700"
              onClick={handleCloneToPhongs}
              disabled={phongs.length === 0}
            >
              {phongs.length > 1 ? `Tạo bản cho ${phongs.length} phòng` : 'Tạo bản cho phòng đã chọn'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
