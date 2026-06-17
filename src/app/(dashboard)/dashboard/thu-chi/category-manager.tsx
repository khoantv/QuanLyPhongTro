'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Edit, Lock, Check, X, TrendingUp, TrendingDown } from 'lucide-react';
import { DeleteConfirmPopover } from '@/components/ui/delete-confirm-popover';
import { toast } from 'sonner';
import type { DanhMucThuChi, LoaiThuChi } from '@/types';

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** 'thu' | 'chi' — loại danh mục hiển thị khi mở */
  loai: LoaiThuChi;
  danhMucList: DanhMucThuChi[];
  onChanged: () => void;
  /** Mở thẳng ô thêm mới khi dialog bật. */
  startInAddMode?: boolean;
};

export function CategoryManagerDialog({ open, onOpenChange, loai, danhMucList, onChanged, startInAddMode }: Props) {
  const [adding, setAdding] = useState(false);
  const [newTen, setNewTen] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTen, setEditTen] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setAdding(!!startInAddMode);
  }, [open, startInAddMode, loai]);

  const list = danhMucList.filter((d) => d.loai === loai);

  const reset = () => {
    setAdding(false);
    setNewTen('');
    setEditingId(null);
    setEditTen('');
  };

  const handleAdd = async () => {
    if (!newTen.trim()) return toast.error('Nhập tên danh mục');
    setSubmitting(true);
    try {
      const res = await fetch('/api/danh-muc-thu-chi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ten: newTen.trim(), loai }),
      });
      const r = await res.json();
      if (res.ok && r.success) {
        toast.success(r.message || 'Đã thêm danh mục');
        setNewTen('');
        setAdding(false);
        onChanged();
      } else {
        toast.error(r.message || 'Có lỗi xảy ra');
      }
    } catch {
      toast.error('Có lỗi khi thêm danh mục');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (id: string) => {
    if (!editTen.trim()) return toast.error('Nhập tên danh mục');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/danh-muc-thu-chi/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ten: editTen.trim() }),
      });
      const r = await res.json();
      if (res.ok && r.success) {
        toast.success(r.message || 'Đã cập nhật');
        setEditingId(null);
        onChanged();
      } else {
        toast.error(r.message || 'Có lỗi xảy ra');
      }
    } catch {
      toast.error('Có lỗi khi cập nhật');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/danh-muc-thu-chi/${id}`, { method: 'DELETE' });
    const r = await res.json();
    if (res.ok && r.success) {
      toast.success(r.message || 'Đã xóa');
      onChanged();
    } else {
      toast.error(r.message || 'Có lỗi khi xóa');
    }
  };

  const isThu = loai === 'thu';
  const accent = isThu ? 'text-green-600' : 'text-red-600';

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isThu
              ? <TrendingUp className={`h-5 w-5 ${accent}`} />
              : <TrendingDown className={`h-5 w-5 ${accent}`} />}
            Danh mục {isThu ? 'thu' : 'chi'}
          </DialogTitle>
          <DialogDescription>
            Quản lý danh mục {isThu ? 'khoản thu' : 'khoản chi'}. Danh mục hệ thống không thể xóa.
          </DialogDescription>
        </DialogHeader>

        {/* Add row */}
        {adding ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              placeholder={`Tên danh mục ${isThu ? 'thu' : 'chi'} mới`}
              value={newTen}
              onChange={(e) => setNewTen(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            />
            <Button size="sm" onClick={handleAdd} disabled={submitting} className={isThu ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewTen(''); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)} className="self-start">
            <Plus className="h-4 w-4 mr-2" />
            Thêm danh mục {isThu ? 'thu' : 'chi'}
          </Button>
        )}

        {/* List */}
        <div className="space-y-1.5">
          {list.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Chưa có danh mục</p>
          ) : list.map((d) => (
            <div key={d._id} className="flex items-center gap-2 border rounded-md px-3 py-2">
              {editingId === d._id ? (
                <>
                  <Input
                    autoFocus
                    value={editTen}
                    onChange={(e) => setEditTen(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleEdit(d._id!); }}
                    className="h-8"
                  />
                  <Button size="sm" onClick={() => handleEdit(d._id!)} disabled={submitting}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">{d.ten}</span>
                  {d.heThong && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <Lock className="h-3 w-3" /> Hệ thống
                    </Badge>
                  )}
                  {d.choPhepSua && (
                    <Button
                      variant="ghost" size="sm"
                      onClick={() => { setEditingId(d._id!); setEditTen(d.ten); }}
                      title="Sửa"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {!d.heThong && d.choPhepSua && (
                    <DeleteConfirmPopover
                      onConfirm={() => handleDelete(d._id!)}
                      title="Xóa danh mục"
                      description={`Xác nhận xóa danh mục "${d.ten}"?`}
                      buttonVariant="ghost"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    />
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
