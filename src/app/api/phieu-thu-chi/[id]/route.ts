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
  nguoiThanhToan: z.string().min(1).max(200),
  noiDung: z.string().min(1).max(500),
  danhMuc: z.string().min(1),
  ngayLapPhieu: z.string().min(1),
  tuDongTaoHangThang: z.boolean().optional(),
  toaNha: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  await dbConnect();
  const { id } = await params;
  const data = await PhieuThuChi.findById(id)
    .populate('danhMuc', 'ten loai key')
    .populate('toaNha', 'tenToaNha');
  if (!data) return NextResponse.json({ message: 'Phiếu không tồn tại' }, { status: 404 });
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
    const data = phieuSchema.parse(body);

    await dbConnect();
    const { id } = await params;

    const danhMuc = await DanhMucThuChi.findById(data.danhMuc);
    if (!danhMuc) return NextResponse.json({ message: 'Danh mục không tồn tại' }, { status: 400 });
    if (danhMuc.loai !== data.loai) {
      return NextResponse.json({ message: 'Danh mục không khớp với loại phiếu' }, { status: 400 });
    }
    if (data.toaNha) {
      const t = await ToaNha.findById(data.toaNha);
      if (!t) return NextResponse.json({ message: 'Tòa nhà không tồn tại' }, { status: 400 });
    }

    const updated = await PhieuThuChi.findByIdAndUpdate(
      id,
      {
        loai: data.loai,
        soTien: data.soTien,
        phuongThuc: data.phuongThuc,
        nguoiThanhToan: data.nguoiThanhToan.trim(),
        noiDung: data.noiDung.trim(),
        danhMuc: data.danhMuc,
        ngayLapPhieu: new Date(data.ngayLapPhieu),
        tuDongTaoHangThang: data.tuDongTaoHangThang || false,
        toaNha: data.toaNha || null,
      },
      { new: true, runValidators: true }
    )
      .populate('danhMuc', 'ten loai key')
      .populate('toaNha', 'tenToaNha');

    if (!updated) return NextResponse.json({ message: 'Phiếu không tồn tại' }, { status: 404 });

    return NextResponse.json({ success: true, data: updated, message: 'Đã cập nhật phiếu' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.issues[0].message }, { status: 400 });
    }
    console.error('Error updating phieu thu chi:', err);
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
  const deleted = await PhieuThuChi.findByIdAndDelete(id);
  if (!deleted) return NextResponse.json({ message: 'Phiếu không tồn tại' }, { status: 404 });
  return NextResponse.json({ success: true, message: 'Đã xóa phiếu' });
}
