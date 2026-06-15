import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import TaiSan from '@/models/TaiSan';
import Phong from '@/models/Phong';
import { z } from 'zod';

const bodySchema = z.object({
  /** Phòng đích (override). Nếu không truyền — giữ nguyên phòng của bản gốc. */
  phong: z.string().nullable().optional(),
  /** Nhiều phòng — tạo N bản, mỗi phòng 1 bản */
  phongs: z.array(z.string()).optional(),
}).optional();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { id } = await params;

  const source = await TaiSan.findById(id).lean() as unknown as {
    _id: unknown;
    ten: string; icon: string;
    giaTri: number; giaNhap?: number | null;
    tongSoLuong: number; donVi: string; donViCungCap?: string;
    loaiGanKet: 'phong' | 'chung';
    phong?: unknown; toaNha?: unknown;
    moTa?: string; ngayMua?: Date | null;
  } | null;

  if (!source) {
    return NextResponse.json({ message: 'Tài sản không tồn tại' }, { status: 404 });
  }

  let parsed: z.infer<typeof bodySchema> = undefined;
  try {
    const raw = await request.text();
    if (raw) parsed = bodySchema.parse(JSON.parse(raw));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.issues[0].message }, { status: 400 });
    }
  }

  // Quyết định targets:
  // 1) Nếu body có phongs[] / phong → dùng list đó (set loaiGanKet='phong')
  // 2) Nếu source là 'phong' → clone về cùng phong (làm bản dự phòng)
  // 3) Nếu source là 'chung' → clone về 'chung' (không phong)
  let targets: Array<string | null>;
  let loaiGanKet: 'phong' | 'chung';

  if (parsed?.phongs && parsed.phongs.length > 0) {
    targets = parsed.phongs;
    loaiGanKet = 'phong';
  } else if (parsed?.phong) {
    targets = [parsed.phong];
    loaiGanKet = 'phong';
  } else if (source.loaiGanKet === 'phong') {
    targets = [String(source.phong)];
    loaiGanKet = 'phong';
  } else {
    targets = [null];
    loaiGanKet = 'chung';
  }

  // Verify phòng tồn tại
  const phongIds = targets.filter((t): t is string => !!t);
  if (phongIds.length > 0) {
    const found = await Phong.find({ _id: { $in: phongIds } }).select('_id').lean();
    if (found.length !== phongIds.length) {
      return NextResponse.json({ message: 'Một hoặc nhiều phòng không tồn tại' }, { status: 400 });
    }
  }

  const docs = targets.map(p => ({
    ten: source.ten,
    icon: source.icon,
    giaTri: source.giaTri,
    giaNhap: source.giaNhap ?? null,
    tongSoLuong: source.tongSoLuong,
    donVi: source.donVi,
    donViCungCap: source.donViCungCap,
    loaiGanKet,
    phong: p,
    toaNha: source.toaNha || null,
    moTa: source.moTa,
    ngayMua: source.ngayMua || null,
  }));
  const created = await TaiSan.insertMany(docs);
  const populated = await TaiSan.find({ _id: { $in: created.map(c => c._id) } })
    .populate('phong', 'maPhong')
    .populate('toaNha', 'tenToaNha');

  return NextResponse.json({
    success: true,
    data: populated,
    message: created.length === 1
      ? 'Đã nhân bản tài sản'
      : `Đã nhân bản tài sản cho ${created.length} phòng`,
  }, { status: 201 });
}
