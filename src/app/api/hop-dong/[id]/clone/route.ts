import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import HopDong from '@/models/HopDong';

async function generateUniqueMaHopDong(originalMaHopDong: string): Promise<string> {
  const base = `${originalMaHopDong}COPY`;
  let candidate = base;
  let suffix = 1;

  while (await HopDong.exists({ maHopDong: candidate })) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }

  return candidate;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();
    const { id } = await params;

    const source = await HopDong.findById(id);
    if (!source) {
      return NextResponse.json(
        { message: 'Hợp đồng không tồn tại' },
        { status: 404 }
      );
    }

    const newMaHopDong = await generateUniqueMaHopDong(source.maHopDong);

    const cloned = await HopDong.create({
      maHopDong: newMaHopDong,
      phong: source.phong,
      khachThueId: [...source.khachThueId],
      nguoiDaiDien: source.nguoiDaiDien,
      ngayBatDau: source.ngayBatDau,
      ngayKetThuc: source.ngayKetThuc,
      giaThue: source.giaThue,
      tienCoc: source.tienCoc,
      chuKyThanhToan: source.chuKyThanhToan,
      ngayThanhToan: source.ngayThanhToan,
      dieuKhoan: source.dieuKhoan,
      giaDien: source.giaDien,
      giaNuoc: source.giaNuoc,
      chiSoDienBanDau: source.chiSoDienBanDau,
      chiSoNuocBanDau: source.chiSoNuocBanDau,
      phiDichVu: (source.phiDichVu || []).map(p => ({ ten: p.ten, gia: p.gia })),
      trangThai: 'daHuy',
    });

    const populated = await HopDong.findById(cloned._id)
      .populate('phong', 'maPhong toaNha')
      .populate('khachThueId', 'hoTen soDienThoai')
      .populate('nguoiDaiDien', 'hoTen soDienThoai');

    return NextResponse.json({
      success: true,
      data: populated,
      message: `Đã nhân bản hợp đồng thành "${newMaHopDong}" (trạng thái: đã hủy — vào sửa và kích hoạt khi cần)`,
    }, { status: 201 });

  } catch (error) {
    console.error('Error cloning hop dong:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
