import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import DanhMucThuChi from '@/models/DanhMucThuChi';
import PhieuThuChi from '@/models/PhieuThuChi';
import { z } from 'zod';

const updateSchema = z.object({
  ten: z.string().min(1, 'Tên danh mục là bắt buộc').max(120),
  icon: z.string().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);

    await dbConnect();
    const { id } = await params;

    const danhMuc = await DanhMucThuChi.findById(id);
    if (!danhMuc) return NextResponse.json({ message: 'Danh mục không tồn tại' }, { status: 404 });
    if (!danhMuc.choPhepSua) {
      return NextResponse.json({ message: 'Danh mục hệ thống này không thể chỉnh sửa' }, { status: 400 });
    }

    // Trùng tên với danh mục khác cùng loại?
    const existed = await DanhMucThuChi.findOne({
      _id: { $ne: id },
      loai: danhMuc.loai,
      ten: { $regex: `^${data.ten.trim()}$`, $options: 'i' },
    });
    if (existed) {
      return NextResponse.json({ message: 'Danh mục đã tồn tại' }, { status: 400 });
    }

    danhMuc.ten = data.ten.trim();
    if (data.icon !== undefined) danhMuc.icon = data.icon;
    await danhMuc.save();

    return NextResponse.json({ success: true, data: danhMuc, message: 'Đã cập nhật danh mục' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.issues[0].message }, { status: 400 });
    }
    console.error('Error updating danh muc thu chi:', err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { id } = await params;

  const danhMuc = await DanhMucThuChi.findById(id);
  if (!danhMuc) return NextResponse.json({ message: 'Danh mục không tồn tại' }, { status: 404 });
  if (danhMuc.heThong || !danhMuc.choPhepSua) {
    return NextResponse.json({ message: 'Danh mục hệ thống không thể xóa' }, { status: 400 });
  }

  // Đang có phiếu dùng danh mục này?
  const inUse = await PhieuThuChi.countDocuments({ danhMuc: id });
  if (inUse > 0) {
    return NextResponse.json(
      { message: `Không thể xóa: đang có ${inUse} phiếu dùng danh mục này` },
      { status: 400 }
    );
  }

  await danhMuc.deleteOne();
  return NextResponse.json({ success: true, message: 'Đã xóa danh mục' });
}
