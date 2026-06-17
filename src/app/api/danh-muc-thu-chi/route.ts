import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import DanhMucThuChi from '@/models/DanhMucThuChi';
import { ensureDefaultThuChiCategories } from '@/lib/thu-chi-seed';
import { z } from 'zod';

const danhMucSchema = z.object({
  ten: z.string().min(1, 'Tên danh mục là bắt buộc').max(120),
  loai: z.enum(['thu', 'chi']),
  icon: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  await ensureDefaultThuChiCategories();

  const { searchParams } = new URL(request.url);
  const loai = searchParams.get('loai') || '';

  const query: Record<string, unknown> = {};
  if (loai === 'thu' || loai === 'chi') query.loai = loai;

  const data = await DanhMucThuChi.find(query)
    .sort({ loai: 1, heThong: -1, thuTu: 1, ngayTao: 1 })
    .lean();

  return NextResponse.json({ success: true, data });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const data = danhMucSchema.parse(body);

    await dbConnect();

    // Trùng tên trong cùng loại?
    const existed = await DanhMucThuChi.findOne({
      loai: data.loai,
      ten: { $regex: `^${data.ten.trim()}$`, $options: 'i' },
    });
    if (existed) {
      return NextResponse.json({ message: 'Danh mục đã tồn tại' }, { status: 400 });
    }

    const maxThuTu = await DanhMucThuChi.findOne({ loai: data.loai })
      .sort({ thuTu: -1 }).select('thuTu').lean();

    const created = await DanhMucThuChi.create({
      ten: data.ten.trim(),
      loai: data.loai,
      icon: data.icon || '',
      heThong: false,
      choPhepSua: true,
      thuTu: ((maxThuTu as { thuTu?: number } | null)?.thuTu ?? 0) + 1,
    });

    return NextResponse.json({
      success: true,
      data: created,
      message: 'Đã thêm danh mục',
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.issues[0].message }, { status: 400 });
    }
    console.error('Error creating danh muc thu chi:', err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
