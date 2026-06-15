import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import TaiSan from '@/models/TaiSan';
import Phong from '@/models/Phong';
import ToaNha from '@/models/ToaNha';
import { z } from 'zod';

const taiSanSchema = z.object({
  ten: z.string().min(1, 'Tên tài sản là bắt buộc').max(120),
  icon: z.string().optional(),
  giaTri: z.number().min(0, 'Giá trị phải lớn hơn hoặc bằng 0'),
  giaNhap: z.number().min(0).nullable().optional(),
  tongSoLuong: z.number().int().min(1, 'Số lượng phải lớn hơn 0'),
  donVi: z.string().max(30).optional(),
  donViCungCap: z.string().max(200).optional(),
  loaiGanKet: z.enum(['phong', 'chung']),
  // Khi loaiGanKet='phong' — accept 1 phong (single) HOẶC nhiều phongs (bulk)
  phong: z.string().nullable().optional(),
  phongs: z.array(z.string()).optional(),
  toaNha: z.string().nullable().optional(),
  moTa: z.string().max(500).optional(),
  ngayMua: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const search = searchParams.get('search') || '';
  const loaiGanKet = searchParams.get('loaiGanKet') || '';
  const phong = searchParams.get('phong') || '';
  const toaNha = searchParams.get('toaNha') || '';

  const query: Record<string, unknown> = {};
  if (search) query.ten = { $regex: search, $options: 'i' };
  if (loaiGanKet) query.loaiGanKet = loaiGanKet;
  if (phong) query.phong = phong;
  if (toaNha) query.toaNha = toaNha;

  const [data, total] = await Promise.all([
    TaiSan.find(query)
      .populate('phong', 'maPhong')
      .populate('toaNha', 'tenToaNha')
      .sort({ ngayTao: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    TaiSan.countDocuments(query),
  ]);

  return NextResponse.json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const data = taiSanSchema.parse(body);

    // Normalize phong list: ưu tiên phongs[], fallback phong (1 id)
    const phongIds = data.phongs && data.phongs.length > 0
      ? data.phongs
      : (data.phong ? [data.phong] : []);

    if (data.loaiGanKet === 'phong' && phongIds.length === 0) {
      return NextResponse.json({ message: 'Tài sản gắn với phòng phải chọn ít nhất 1 phòng' }, { status: 400 });
    }

    await dbConnect();

    // Verify refs
    if (data.toaNha) {
      const t = await ToaNha.findById(data.toaNha);
      if (!t) return NextResponse.json({ message: 'Tòa nhà không tồn tại' }, { status: 400 });
    }

    if (data.loaiGanKet === 'phong') {
      // Verify tất cả phòng tồn tại
      const found = await Phong.find({ _id: { $in: phongIds } }).select('_id').lean();
      if (found.length !== phongIds.length) {
        return NextResponse.json({ message: 'Một hoặc nhiều phòng không tồn tại' }, { status: 400 });
      }

      // Bulk insert: 1 entry / phòng
      const docs = phongIds.map(p => ({
        ten: data.ten,
        icon: data.icon || 'package',
        giaTri: data.giaTri,
        giaNhap: data.giaNhap,
        tongSoLuong: data.tongSoLuong,
        donVi: data.donVi || 'Cái',
        donViCungCap: data.donViCungCap,
        loaiGanKet: 'phong' as const,
        phong: p,
        toaNha: data.toaNha || null,
        moTa: data.moTa,
        ngayMua: data.ngayMua ? new Date(data.ngayMua) : null,
      }));
      const created = await TaiSan.insertMany(docs);
      const populated = await TaiSan.find({ _id: { $in: created.map(c => c._id) } })
        .populate('phong', 'maPhong')
        .populate('toaNha', 'tenToaNha');
      return NextResponse.json({
        success: true,
        data: populated,
        message: `Đã thêm tài sản cho ${created.length} phòng`,
      }, { status: 201 });
    }

    // loaiGanKet='chung' — 1 entry
    const created = await TaiSan.create({
      ten: data.ten,
      icon: data.icon || 'package',
      giaTri: data.giaTri,
      giaNhap: data.giaNhap,
      tongSoLuong: data.tongSoLuong,
      donVi: data.donVi || 'Cái',
      donViCungCap: data.donViCungCap,
      loaiGanKet: 'chung',
      phong: null,
      toaNha: data.toaNha || null,
      moTa: data.moTa,
      ngayMua: data.ngayMua ? new Date(data.ngayMua) : null,
    });

    const populated = await TaiSan.findById(created._id)
      .populate('phong', 'maPhong')
      .populate('toaNha', 'tenToaNha');

    return NextResponse.json({
      success: true,
      data: populated,
      message: 'Đã thêm tài sản',
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.issues[0].message }, { status: 400 });
    }
    console.error('Error creating tai san:', err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
