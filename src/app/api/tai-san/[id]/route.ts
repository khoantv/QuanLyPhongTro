import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import TaiSan from '@/models/TaiSan';
import Phong from '@/models/Phong';
import ToaNha from '@/models/ToaNha';
import { z } from 'zod';

const taiSanSchema = z.object({
  ten: z.string().min(1).max(120),
  icon: z.string().optional(),
  giaTri: z.number().min(0),
  giaNhap: z.number().min(0).nullable().optional(),
  tongSoLuong: z.number().int().min(1),
  donVi: z.string().max(30).optional(),
  donViCungCap: z.string().max(200).optional(),
  loaiGanKet: z.enum(['phong', 'chung']),
  phong: z.string().nullable().optional(),
  toaNha: z.string().nullable().optional(),
  moTa: z.string().max(500).optional(),
  ngayMua: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { id } = await params;
  const data = await TaiSan.findById(id)
    .populate('phong', 'maPhong')
    .populate('toaNha', 'tenToaNha');
  if (!data) return NextResponse.json({ message: 'Tài sản không tồn tại' }, { status: 404 });
  return NextResponse.json({ success: true, data });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const data = taiSanSchema.parse(body);

    if (data.loaiGanKet === 'phong' && !data.phong) {
      return NextResponse.json({ message: 'Tài sản gắn với phòng phải chọn phòng' }, { status: 400 });
    }

    await dbConnect();
    const { id } = await params;

    if (data.phong) {
      const p = await Phong.findById(data.phong);
      if (!p) return NextResponse.json({ message: 'Phòng không tồn tại' }, { status: 400 });
    }
    if (data.toaNha) {
      const t = await ToaNha.findById(data.toaNha);
      if (!t) return NextResponse.json({ message: 'Tòa nhà không tồn tại' }, { status: 400 });
    }

    const updated = await TaiSan.findByIdAndUpdate(
      id,
      {
        ...data,
        // Khi chuyển từ 'phong' → 'chung', clear phong
        phong: data.loaiGanKet === 'phong' ? data.phong : null,
        ngayMua: data.ngayMua ? new Date(data.ngayMua) : null,
      },
      { new: true, runValidators: true }
    )
      .populate('phong', 'maPhong')
      .populate('toaNha', 'tenToaNha');

    if (!updated) return NextResponse.json({ message: 'Tài sản không tồn tại' }, { status: 404 });

    return NextResponse.json({ success: true, data: updated, message: 'Đã cập nhật tài sản' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.issues[0].message }, { status: 400 });
    }
    console.error('Error updating tai san:', err);
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
  const deleted = await TaiSan.findByIdAndDelete(id);
  if (!deleted) return NextResponse.json({ message: 'Tài sản không tồn tại' }, { status: 404 });
  return NextResponse.json({ success: true, message: 'Đã xóa tài sản' });
}
