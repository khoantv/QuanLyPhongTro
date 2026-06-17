import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import PhieuThuChi from '@/models/PhieuThuChi';
import DanhMucThuChi from '@/models/DanhMucThuChi';
import ToaNha from '@/models/ToaNha';
import { z } from 'zod';

const phieuSchema = z.object({
  loai: z.enum(['thu', 'chi']),
  soTien: z.number().min(1, 'Số tiền phải lớn hơn 0'),
  phuongThuc: z.enum(['tienMat', 'chuyenKhoan']),
  nguoiThanhToan: z.string().min(1, 'Người thanh toán là bắt buộc').max(200),
  noiDung: z.string().min(1, 'Nội dung thanh toán là bắt buộc').max(500),
  danhMuc: z.string().min(1, 'Danh mục là bắt buộc'),
  ngayLapPhieu: z.string().min(1, 'Ngày lập phiếu là bắt buộc'),
  tuDongTaoHangThang: z.boolean().optional(),
  toaNha: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { searchParams } = new URL(request.url);

  const thang = parseInt(searchParams.get('thang') || '', 10);
  const nam = parseInt(searchParams.get('nam') || '', 10);
  const loai = searchParams.get('loai') || '';
  const toaNha = searchParams.get('toaNha') || '';

  const query: Record<string, unknown> = {};

  if (Number.isFinite(thang) && Number.isFinite(nam) && thang >= 1 && thang <= 12) {
    const start = new Date(nam, thang - 1, 1, 0, 0, 0, 0);
    const end = new Date(nam, thang, 0, 23, 59, 59, 999);
    query.ngayLapPhieu = { $gte: start, $lte: end };
  } else if (Number.isFinite(nam)) {
    const start = new Date(nam, 0, 1, 0, 0, 0, 0);
    const end = new Date(nam, 11, 31, 23, 59, 59, 999);
    query.ngayLapPhieu = { $gte: start, $lte: end };
  }

  if (loai === 'thu' || loai === 'chi') query.loai = loai;
  if (toaNha) query.toaNha = toaNha;

  const data = await PhieuThuChi.find(query)
    .populate('danhMuc', 'ten loai key')
    .populate('toaNha', 'tenToaNha')
    .sort({ ngayLapPhieu: -1, ngayTao: -1 })
    .lean() as unknown as Array<{ loai: string; soTien: number }>;

  const tongThu = data
    .filter((p) => p.loai === 'thu')
    .reduce((s, p) => s + (p.soTien || 0), 0);
  const tongChi = data
    .filter((p) => p.loai === 'chi')
    .reduce((s, p) => s + (p.soTien || 0), 0);

  return NextResponse.json({
    success: true,
    data,
    summary: { tongThu, tongChi, loiNhuan: tongThu - tongChi },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const data = phieuSchema.parse(body);

    await dbConnect();

    const danhMuc = await DanhMucThuChi.findById(data.danhMuc);
    if (!danhMuc) return NextResponse.json({ message: 'Danh mục không tồn tại' }, { status: 400 });
    if (danhMuc.loai !== data.loai) {
      return NextResponse.json({ message: 'Danh mục không khớp với loại phiếu' }, { status: 400 });
    }

    if (data.toaNha) {
      const t = await ToaNha.findById(data.toaNha);
      if (!t) return NextResponse.json({ message: 'Tòa nhà không tồn tại' }, { status: 400 });
    }

    const created = await PhieuThuChi.create({
      loai: data.loai,
      soTien: data.soTien,
      phuongThuc: data.phuongThuc,
      nguoiThanhToan: data.nguoiThanhToan.trim(),
      noiDung: data.noiDung.trim(),
      danhMuc: data.danhMuc,
      ngayLapPhieu: new Date(data.ngayLapPhieu),
      tuDongTaoHangThang: data.tuDongTaoHangThang || false,
      toaNha: data.toaNha || null,
      nguoiTao: (session.user as { id?: string })?.id || null,
    });

    const populated = await PhieuThuChi.findById(created._id)
      .populate('danhMuc', 'ten loai key')
      .populate('toaNha', 'tenToaNha');

    return NextResponse.json({
      success: true,
      data: populated,
      message: data.loai === 'thu' ? 'Đã thêm phiếu thu' : 'Đã thêm phiếu chi',
    }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.issues[0].message }, { status: 400 });
    }
    console.error('Error creating phieu thu chi:', err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
