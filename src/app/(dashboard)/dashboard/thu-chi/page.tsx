'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Plus, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet,
  FolderCog, Printer, FileSpreadsheet, Edit, RefreshCw, Filter, X, Check,
} from 'lucide-react';
import { DeleteConfirmPopover } from '@/components/ui/delete-confirm-popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CategoryManagerDialog } from './category-manager';
import type {
  DanhMucThuChi, PhieuThuChi, ToaNha, LoaiThuChi, PhuongThucThuChi,
} from '@/types';

const fmtVND = (n: number) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + ' đ';
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function danhMucObj(dm: PhieuThuChi['danhMuc']) {
  return typeof dm === 'object' && dm ? dm : null;
}
function danhMucId(dm: PhieuThuChi['danhMuc']): string {
  if (typeof dm === 'string') return dm;
  if (typeof dm === 'object' && dm?._id) return dm._id;
  return '';
}
function fmtDate(d: Date | string): string {
  const date = new Date(d);
  return date.toLocaleDateString('vi-VN');
}

export default function ThuChiPage() {
  const now = new Date();
  const [nam, setNam] = useState(now.getFullYear());
  const [thang, setThang] = useState(now.getMonth() + 1);

  const [toaNhaList, setToaNhaList] = useState<ToaNha[]>([]);
  const [selectedToaNha, setSelectedToaNha] = useState<string>('all');

  const [phieuList, setPhieuList] = useState<PhieuThuChi[]>([]);
  const [danhMucList, setDanhMucList] = useState<DanhMucThuChi[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [fThu, setFThu] = useState(false);
  const [fChi, setFChi] = useState(false);
  const [fTienMat, setFTienMat] = useState(false);
  const [fChuyenKhoan, setFChuyenKhoan] = useState(false);
  const [excludeDM, setExcludeDM] = useState<string[]>([]);
  const [includeDM, setIncludeDM] = useState<string[]>([]);

  // Dialogs
  const [phieuDialog, setPhieuDialog] = useState<{ loai: LoaiThuChi } | null>(null);
  const [editingPhieu, setEditingPhieu] = useState<PhieuThuChi | null>(null);
  const [catManager, setCatManager] = useState<{ loai: LoaiThuChi; add: boolean } | null>(null);

  const fetchPhieu = useCallback(async () => {
    const params = new URLSearchParams({ thang: String(thang), nam: String(nam) });
    if (selectedToaNha !== 'all') params.append('toaNha', selectedToaNha);
    const res = await fetch(`/api/phieu-thu-chi?${params.toString()}`);
    if (res.ok) {
      const j = await res.json();
      if (j.success) setPhieuList(j.data);
    }
  }, [thang, nam, selectedToaNha]);

  const fetchStatic = useCallback(async () => {
    const [rDm, rTn] = await Promise.all([
      fetch('/api/danh-muc-thu-chi'),
      fetch('/api/toa-nha?limit=10000'),
    ]);
    if (rDm.ok) { const j = await rDm.json(); if (j.success) setDanhMucList(j.data); }
    if (rTn.ok) { const j = await rTn.json(); if (j.success) setToaNhaList(j.data); }
  }, []);

  useEffect(() => {
    document.title = 'Quản lý thu / chi';
    (async () => {
      setLoading(true);
      await Promise.all([fetchStatic(), fetchPhieu()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchPhieu();
  }, [fetchPhieu]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStatic(), fetchPhieu()]);
    setRefreshing(false);
    toast.success('Đã tải dữ liệu mới nhất');
  };

  const reloadCategories = async () => {
    const r = await fetch('/api/danh-muc-thu-chi');
    if (r.ok) { const j = await r.json(); if (j.success) setDanhMucList(j.data); }
  };

  // ----- Client-side filtering -----
  const filtered = useMemo(() => {
    const loais: LoaiThuChi[] = fThu && !fChi ? ['thu'] : fChi && !fThu ? ['chi'] : ['thu', 'chi'];
    const pts: PhuongThucThuChi[] =
      fTienMat && !fChuyenKhoan ? ['tienMat']
      : fChuyenKhoan && !fTienMat ? ['chuyenKhoan']
      : ['tienMat', 'chuyenKhoan'];
    const inc = new Set(includeDM);
    const exc = new Set(excludeDM);

    return phieuList.filter((p) => {
      if (!loais.includes(p.loai)) return false;
      if (!pts.includes(p.phuongThuc)) return false;
      const dmId = danhMucId(p.danhMuc);
      if (inc.size > 0 && !inc.has(dmId)) return false;
      if (exc.size > 0 && exc.has(dmId)) return false;
      return true;
    });
  }, [phieuList, fThu, fChi, fTienMat, fChuyenKhoan, includeDM, excludeDM]);

  const stats = useMemo(() => {
    const tongThu = filtered.filter((p) => p.loai === 'thu').reduce((s, p) => s + p.soTien, 0);
    const tongChi = filtered.filter((p) => p.loai === 'chi').reduce((s, p) => s + p.soTien, 0);
    return { tongThu, tongChi, loiNhuan: tongThu - tongChi };
  }, [filtered]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/phieu-thu-chi/${id}`, { method: 'DELETE' });
    const r = await res.json();
    if (res.ok && r.success) {
      setPhieuList((prev) => prev.filter((x) => x._id !== id));
      toast.success(r.message || 'Đã xóa');
    } else {
      toast.error(r.message || 'Có lỗi khi xóa');
    }
  };

  const exportExcel = () => {
    if (filtered.length === 0) return toast.error('Không có dữ liệu để xuất');
    const rows = [
      ['Ngày', 'Loại', 'Danh mục', 'Nội dung', 'Người thanh toán', 'Phương thức', 'Số tiền'],
      ...filtered.map((p) => [
        fmtDate(p.ngayLapPhieu),
        p.loai === 'thu' ? 'Thu' : 'Chi',
        danhMucObj(p.danhMuc)?.ten || '',
        p.noiDung,
        p.nguoiThanhToan,
        p.phuongThuc === 'tienMat' ? 'Tiền mặt' : 'Chuyển khoản',
        String(p.soTien),
      ]),
    ];
    const csv = '﻿' + rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thu-chi-${thang}-${nam}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildingLabel = selectedToaNha === 'all'
    ? 'Tất cả nhà trọ'
    : toaNhaList.find((t) => t._id === selectedToaNha)?.tenToaNha || '';

  const anyFilter = fThu || fChi || fTienMat || fChuyenKhoan || excludeDM.length > 0 || includeDM.length > 0;
  const activeFilterCount =
    (fThu ? 1 : 0) + (fChi ? 1 : 0) + (fTienMat ? 1 : 0) + (fChuyenKhoan ? 1 : 0)
    + excludeDM.length + includeDM.length;

  if (loading) {
    return <div className="h-96 bg-gray-200 rounded animate-pulse" />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Month bar */}
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-1 px-2 py-2 overflow-x-auto">
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setNam((y) => y - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Năm trước
          </Button>
          <div className="flex gap-1">
            {MONTHS.map((m) => (
              <button
                key={m}
                onClick={() => setThang(m)}
                className={cn(
                  'shrink-0 px-3 py-1.5 rounded-md text-center transition-colors min-w-[58px]',
                  m === thang
                    ? 'bg-green-50 border-2 border-green-500 text-green-700'
                    : 'border-2 border-transparent hover:bg-gray-50 text-gray-600',
                )}
              >
                <div className="text-sm font-semibold leading-tight">T.{m}</div>
                <div className="text-[11px] leading-tight">{nam}</div>
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setNam((y) => y + 1)}>
            Năm tới <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </Card>

      {/* Title + building selector */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
        <div className="border-l-4 border-green-500 pl-3">
          <h1 className="text-xl md:text-2xl font-bold">
            Khoản thu / chi - tổng kết {buildingLabel}
          </h1>
          <p className="text-xs md:text-sm text-gray-600">
            Thống kê các khoản thu / chi tháng {thang}/{nam}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <Select value={selectedToaNha} onValueChange={setSelectedToaNha}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Chọn nhà trọ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả nhà trọ</SelectItem>
              {toaNhaList.map((t) => (
                <SelectItem key={t._id} value={t._id!}>{t.tenToaNha}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Tải mới
          </Button>
        </div>
      </div>

      {/* Filter row */}
      <Card className="p-3">
        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500 shrink-0">
            <Filter className="h-4 w-4" />
            <span>Bộ lọc</span>
            {activeFilterCount > 0 && (
              <Badge className="bg-green-600">{activeFilterCount}</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={fThu} onCheckedChange={(v) => setFThu(!!v)} />
              Tất cả khoản thu
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={fChi} onCheckedChange={(v) => setFChi(!!v)} />
              Tất cả khoản chi
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={fTienMat} onCheckedChange={(v) => setFTienMat(!!v)} />
              Tiền mặt
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={fChuyenKhoan} onCheckedChange={(v) => setFChuyenKhoan(!!v)} />
              Chuyển khoản
            </label>
          </div>
          <div className="flex flex-wrap gap-2 xl:ml-auto">
            <DanhMucMultiSelect
              danhMucList={danhMucList}
              value={excludeDM}
              onChange={setExcludeDM}
              placeholder="Loại trừ danh mục"
            />
            <DanhMucMultiSelect
              danhMucList={danhMucList}
              value={includeDM}
              onChange={setIncludeDM}
              placeholder="Lọc theo danh mục"
            />
            {anyFilter && (
              <Button
                variant="ghost" size="sm"
                onClick={() => {
                  setFThu(false); setFChi(false); setFTienMat(false); setFChuyenKhoan(false);
                  setExcludeDM([]); setIncludeDM([]);
                }}
                className="text-gray-500"
              >
                <X className="h-4 w-4 mr-1" /> Xóa lọc
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Stats + actions */}
      <div className="flex flex-col lg:flex-row justify-between gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3 flex-1">
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Tổng khoản thu (tiền vào)</p>
                <p className="text-xl font-bold text-green-600">{fmtVND(stats.tongThu)}</p>
              </div>
              <TrendingUp className="h-6 w-6 text-green-500" />
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Tổng khoản chi (tiền ra)</p>
                <p className="text-xl font-bold text-red-600">{fmtVND(stats.tongChi)}</p>
              </div>
              <TrendingDown className="h-6 w-6 text-red-500" />
            </div>
          </Card>
          <Card className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600">Lợi nhuận</p>
                <p className={cn('text-xl font-bold', stats.loiNhuan >= 0 ? 'text-blue-600' : 'text-orange-600')}>
                  {fmtVND(stats.loiNhuan)}
                </p>
              </div>
              <Wallet className="h-6 w-6 text-blue-500" />
            </div>
          </Card>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="bg-slate-800 text-white hover:bg-slate-700 hover:text-white">
              <FolderCog className="h-4 w-4 mr-2" /> Q.lý danh mục
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setCatManager({ loai: 'thu', add: true })}>
              <Plus className="h-4 w-4 mr-2 text-green-600" /> Thêm danh mục thu
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCatManager({ loai: 'thu', add: false })}>
              <FolderCog className="h-4 w-4 mr-2" /> Danh mục thu
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCatManager({ loai: 'chi', add: true })}>
              <Plus className="h-4 w-4 mr-2 text-red-600" /> Thêm danh mục chi
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCatManager({ loai: 'chi', add: false })}>
              <FolderCog className="h-4 w-4 mr-2" /> Danh mục chi
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => setPhieuDialog({ loai: 'chi' })}>
          <TrendingDown className="h-4 w-4 mr-2" /> Thêm phiếu chi
        </Button>
        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setPhieuDialog({ loai: 'thu' })}>
          <TrendingUp className="h-4 w-4 mr-2" /> Thêm phiếu thu
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" /> In thu/chi
        </Button>
        <Button variant="outline" size="sm" onClick={exportExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Xuất excel
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Chi tiết thu / chi tháng {thang}/{nam}</CardTitle>
          <CardDescription>{filtered.length} phiếu</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Danh mục</TableHead>
                  <TableHead>Nội dung</TableHead>
                  <TableHead>Người TT</TableHead>
                  <TableHead>Phương thức</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-gray-400">
                      Không tìm thấy dữ liệu!
                    </TableCell>
                  </TableRow>
                ) : filtered.map((p) => (
                  <TableRow key={p._id}>
                    <TableCell className="whitespace-nowrap">{fmtDate(p.ngayLapPhieu)}</TableCell>
                    <TableCell>
                      {p.loai === 'thu'
                        ? <Badge className="bg-green-600 gap-1"><TrendingUp className="h-3 w-3" />Thu</Badge>
                        : <Badge className="bg-red-600 gap-1"><TrendingDown className="h-3 w-3" />Chi</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">{danhMucObj(p.danhMuc)?.ten || '—'}</TableCell>
                    <TableCell className="text-sm max-w-[240px] truncate" title={p.noiDung}>{p.noiDung}</TableCell>
                    <TableCell className="text-sm">{p.nguoiThanhToan}</TableCell>
                    <TableCell className="text-sm">
                      {p.phuongThuc === 'tienMat' ? 'Tiền mặt' : 'Chuyển khoản'}
                    </TableCell>
                    <TableCell className={cn('text-right font-semibold whitespace-nowrap', p.loai === 'thu' ? 'text-green-600' : 'text-red-600')}>
                      {p.loai === 'thu' ? '+' : '-'}{fmtVND(p.soTien)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditingPhieu(p)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <DeleteConfirmPopover
                          onConfirm={() => handleDelete(p._id!)}
                          title="Xóa phiếu"
                          description={`Xác nhận xóa phiếu "${p.noiDung}"?`}
                          buttonVariant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add / edit dialog */}
      {(phieuDialog || editingPhieu) && (
        <PhieuFormDialog
          loai={editingPhieu ? editingPhieu.loai : phieuDialog!.loai}
          phieu={editingPhieu}
          danhMucList={danhMucList}
          toaNhaList={toaNhaList}
          defaultToaNha={selectedToaNha === 'all' ? '' : selectedToaNha}
          defaultThang={thang}
          defaultNam={nam}
          onClose={() => { setPhieuDialog(null); setEditingPhieu(null); }}
          onSuccess={() => {
            setPhieuDialog(null);
            setEditingPhieu(null);
            fetchPhieu();
          }}
        />
      )}

      {/* Category manager */}
      {catManager && (
        <CategoryManagerDialog
          open
          loai={catManager.loai}
          startInAddMode={catManager.add}
          danhMucList={danhMucList}
          onOpenChange={(o) => { if (!o) setCatManager(null); }}
          onChanged={reloadCategories}
        />
      )}
    </div>
  );
}

// ---------- Phiếu form ----------

type PhieuFormProps = {
  loai: LoaiThuChi;
  phieu: PhieuThuChi | null;
  danhMucList: DanhMucThuChi[];
  toaNhaList: ToaNha[];
  defaultToaNha: string;
  defaultThang: number;
  defaultNam: number;
  onClose: () => void;
  onSuccess: () => void;
};

function toDateInput(d: Date | string): string {
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function PhieuFormDialog({
  loai, phieu, danhMucList, toaNhaList, defaultToaNha, defaultThang, defaultNam, onClose, onSuccess,
}: PhieuFormProps) {
  const isEdit = !!phieu;
  const isThu = loai === 'thu';
  const dmOfLoai = danhMucList.filter((d) => d.loai === loai);

  const [submitting, setSubmitting] = useState(false);
  const [soTien, setSoTien] = useState<string>(phieu ? String(phieu.soTien) : '');
  const [phuongThuc, setPhuongThuc] = useState<PhuongThucThuChi>(phieu?.phuongThuc || 'tienMat');
  const [nguoiThanhToan, setNguoiThanhToan] = useState(phieu?.nguoiThanhToan || '');
  const [noiDung, setNoiDung] = useState(phieu?.noiDung || '');
  const [danhMuc, setDanhMuc] = useState<string>(
    phieu ? danhMucId(phieu.danhMuc) : (dmOfLoai[0]?._id || '')
  );
  const [ngayLapPhieu, setNgayLapPhieu] = useState<string>(
    phieu ? toDateInput(phieu.ngayLapPhieu) : toDateInput(new Date(defaultNam, defaultThang - 1, new Date().getDate()))
  );
  const [tuDong, setTuDong] = useState(phieu?.tuDongTaoHangThang || false);
  const [toaNha, setToaNha] = useState<string>(
    phieu
      ? (typeof phieu.toaNha === 'object' && phieu.toaNha ? phieu.toaNha._id : (typeof phieu.toaNha === 'string' ? phieu.toaNha : ''))
      : defaultToaNha
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const soTienNum = parseFloat(soTien);
    if (!Number.isFinite(soTienNum) || soTienNum <= 0) return toast.error('Nhập số tiền hợp lệ');
    if (!nguoiThanhToan.trim()) return toast.error('Nhập người thanh toán');
    if (!noiDung.trim()) return toast.error('Nhập nội dung thanh toán');
    if (!danhMuc) return toast.error('Chọn danh mục');
    if (!ngayLapPhieu) return toast.error('Chọn ngày lập phiếu');

    setSubmitting(true);
    try {
      const url = isEdit ? `/api/phieu-thu-chi/${phieu!._id}` : '/api/phieu-thu-chi';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loai,
          soTien: soTienNum,
          phuongThuc,
          nguoiThanhToan: nguoiThanhToan.trim(),
          noiDung: noiDung.trim(),
          danhMuc,
          ngayLapPhieu,
          tuDongTaoHangThang: tuDong,
          toaNha: toaNha || null,
        }),
      });
      const r = await res.json();
      if (res.ok && r.success) {
        toast.success(r.message || (isEdit ? 'Đã cập nhật' : 'Đã thêm phiếu'));
        onSuccess();
      } else {
        toast.error(r.message || 'Có lỗi xảy ra');
      }
    } catch {
      toast.error('Có lỗi khi gửi form');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isThu
              ? <TrendingUp className="h-5 w-5 text-green-600" />
              : <TrendingDown className="h-5 w-5 text-red-600" />}
            {isEdit ? 'Chỉnh sửa' : 'Thêm'} phiếu {isThu ? 'thu' : 'chi'}
          </DialogTitle>
          <DialogDescription>
            {isThu ? 'Ghi nhận một khoản tiền vào' : 'Ghi nhận một khoản tiền ra'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nhập số tiền {isThu ? 'thu' : 'chi'} <span className="text-red-500">*</span></Label>
            <Input
              type="number" min={0} step={1000}
              value={soTien}
              onChange={(e) => setSoTien(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Phương thức thanh toán <span className="text-red-500">*</span></Label>
            <Select value={phuongThuc} onValueChange={(v) => setPhuongThuc(v as PhuongThucThuChi)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tienMat">Trả tiền mặt</SelectItem>
                <SelectItem value="chuyenKhoan">Chuyển khoản</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Người thanh toán <span className="text-red-500">*</span></Label>
            <Input
              value={nguoiThanhToan}
              onChange={(e) => setNguoiThanhToan(e.target.value)}
              placeholder="Tên người thanh toán"
            />
          </div>

          <div className="space-y-2">
            <Label>Nội dung thanh toán <span className="text-red-500">*</span></Label>
            <Textarea
              rows={2}
              value={noiDung}
              onChange={(e) => setNoiDung(e.target.value)}
              placeholder="Nội dung..."
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label>Danh mục {isThu ? 'thu' : 'chi'} <span className="text-red-500">*</span></Label>
            <Select value={danhMuc} onValueChange={setDanhMuc}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Chọn danh mục" /></SelectTrigger>
              <SelectContent>
                {dmOfLoai.map((d) => (
                  <SelectItem key={d._id} value={d._id!}>{d.ten}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ngày lập phiếu <span className="text-red-500">*</span></Label>
              <Input type="date" value={ngayLapPhieu} onChange={(e) => setNgayLapPhieu(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nhà trọ</Label>
              <Select value={toaNha || 'none'} onValueChange={(v) => setToaNha(v === 'none' ? '' : v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Không gắn" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không gắn nhà trọ</SelectItem>
                  {toaNhaList.map((t) => (
                    <SelectItem key={t._id} value={t._id!}>{t.tenToaNha}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <Switch checked={tuDong} onCheckedChange={setTuDong} />
            <span>
              <span className="font-medium text-sm">Tự động tạo hàng tháng</span>
              <span className="block text-xs text-gray-500">Tự động tạo lại phiếu thu/chi này hàng tháng</span>
            </span>
          </label>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Đóng</Button>
            <Button
              type="submit"
              disabled={submitting}
              className={isThu ? 'bg-green-600 hover:bg-green-700' : 'bg-yellow-500 hover:bg-yellow-600 text-white'}
            >
              <Plus className="h-4 w-4 mr-1" />
              {submitting ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : `Thêm phiếu ${isThu ? 'thu' : 'chi'}`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Category multi-select (filters) ----------

function DanhMucMultiSelect({
  danhMucList, value, onChange, placeholder,
}: {
  danhMucList: DanhMucThuChi[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const thu = danhMucList.filter((d) => d.loai === 'thu');
  const chi = danhMucList.filter((d) => d.loai === 'chi');

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="min-w-[180px] h-9 border rounded-md px-3 py-2 text-sm text-left bg-transparent flex items-center justify-between gap-2"
        >
          <span className={value.length === 0 ? 'text-gray-500' : 'font-medium'}>
            {value.length === 0 ? placeholder : `${placeholder} (${value.length})`}
          </span>
          {value.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onChange([]); }}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <div className="max-h-72 overflow-y-auto">
          {[{ label: 'Khoản thu', items: thu }, { label: 'Khoản chi', items: chi }].map((group) => (
            group.items.length > 0 && (
              <div key={group.label}>
                <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 sticky top-0">
                  {group.label}
                </div>
                {group.items.map((d) => {
                  const checked = value.includes(d._id!);
                  return (
                    <button
                      key={d._id}
                      type="button"
                      onClick={() => toggle(d._id!)}
                      className="w-full px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-sm text-left"
                    >
                      <Checkbox checked={checked} />
                      <span className="flex-1">{d.ten}</span>
                      {checked && <Check className="h-4 w-4 text-green-600" />}
                    </button>
                  );
                })}
              </div>
            )
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
