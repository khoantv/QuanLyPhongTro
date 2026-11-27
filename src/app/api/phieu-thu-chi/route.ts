import { NextRequest, NextResponse } from 'next/server';
import { taoNgayVN } from '@/lib/ky-thu';
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
  // Nhiều tháng: thangs=2026-09,2026-10 · Khoảng ngày: tuNgay=2026-09-01&denNgay=2026-11-30 (cả hai ngày, giờ VN)
  const thangs = (searchParams.get('thangs') || '').split(',').map((x) => x.trim()).filter(Boolean);
  const tuNgay = searchParams.get('tuNgay') || '';
  const denNgay = searchParams.get('denNgay') || '';

  const query: Record<string, unknown> = {};
  const khoangThang = (n: number, t: number) => ({ ngayLapPhieu: { $gte: taoNgayVN(n, t, 1), $lt: taoNgayVN(n, t + 1, 1) } });
  const NGAY = /^(\d{4})-(\d{2})-(\d{2})$/;

  if (thangs.length) {
    const ds = thangs.map((x) => /^(\d{4})-(\d{1,2})$/.exec(x)).filter((m): m is RegExpExecArray => Boolean(m))
      .map((m) => ({ n: Number(m[1]), t: Number(m[2]) })).filter(({ n, t }) => n >= 2000 && t >= 1 && t <= 12);
    if (!ds.length || ds.length > 120) return NextResponse.json({ message: 'Danh sách tháng không hợp lệ' }, { status: 400 });
    query.$or = ds.map(({ n, t }) => khoangThang(n, t));
  } else if (tuNgay || denNgay) {
    const a = NGAY.exec(tuNgay); const b = NGAY.exec(denNgay);
    if (!a || !b) return NextResponse.json({ message: 'Khoảng ngày không hợp lệ (YYYY-MM-DD)' }, { status: 400 });
    const tu = taoNgayVN(Number(a[1]), Number(a[2]), Number(a[3]));
    const den = taoNgayVN(Number(b[1]), Number(b[2]), Number(b[3]) + 1);
    if (den <= tu) return NextResponse.json({ message: 'Ngày bắt đầu phải trước ngày kết thúc' }, { status: 400 });
    query.ngayLapPhieu = { $gte: tu, $lt: den };
  } else if (Number.isFinite(thang) && Number.isFinite(nam) && thang >= 1 && thang <= 12) {
    Object.assign(query, khoangThang(nam, thang));
  } else if (Number.isFinite(nam)) {
    query.ngayLapPhieu = { $gte: taoNgayVN(nam, 1, 1), $lt: taoNgayVN(nam + 1, 1, 1) };
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
