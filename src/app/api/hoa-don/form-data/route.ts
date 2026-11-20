import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import HopDong from '@/models/HopDong';
import Phong from '@/models/Phong';
import KhachThue from '@/models/KhachThue';
import '@/models/ToaNha';

// GET - Dữ liệu cho form tạo/sửa hóa đơn: phòng, khách thuê, hợp đồng đang hoạt động
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const [phongList, khachThueList, hopDongList] = await Promise.all([
      Phong.find()
        .select('maPhong toaNha tang dienTich giaThue trangThai')
        .populate('toaNha', 'tenToaNha')
        .sort({ maPhong: 1 })
        .collation({ locale: 'vi', numericOrdering: true }),
      KhachThue.find()
        .select('hoTen soDienThoai email trangThai')
        .sort({ hoTen: 1 }),
      HopDong.find({ trangThai: 'hoatDong' })
        .select('maHopDong phong nguoiDaiDien giaThue giaDien giaNuoc phiDichVu ngayThanhToan trangThai chiSoDienBanDau chiSoNuocBanDau ngayBatDau ngayKetThuc')
        .sort({ maHopDong: 1 }),
    ]);

    return NextResponse.json({
      success: true,
      data: { hopDongList, phongList, khachThueList },
    });
  } catch (error) {
    console.error('Error fetching form data:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
