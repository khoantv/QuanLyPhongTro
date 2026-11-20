import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import GiaoDichCongNo from '@/models/GiaoDichCongNo';
import KhachThue from '@/models/KhachThue';
import { hoaDonMoCuaKhach, sapXepButToan } from '@/lib/cong-no';

// GET /api/cong-no?khachThueId=...&hienDaHuy=1
// Trả số dư hiện tại, lịch sử bút toán (kèm số dư lũy kế) và các hóa đơn còn nợ (cũ → mới).
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const khachThueId = searchParams.get('khachThueId');
    const hienDaHuy = searchParams.get('hienDaHuy') === '1';
    if (!khachThueId || !mongoose.Types.ObjectId.isValid(khachThueId)) {
      return NextResponse.json({ message: 'Thiếu hoặc sai khachThueId' }, { status: 400 });
    }

    await connectToDatabase();

    const khachThue = await KhachThue.findById(khachThueId).select('hoTen soDienThoai trangThai').lean();
    if (!khachThue) {
      return NextResponse.json({ message: 'Khách thuê không tồn tại' }, { status: 404 });
    }

    const filter: Record<string, unknown> = { khachThue: khachThueId };
    if (!hienDaHuy) filter.daHuy = false;

    const raw = await GiaoDichCongNo.find(filter)
      .populate('hoaDon', 'maHoaDon thang nam')
      .populate('phong', 'maPhong')
      .populate('thanhToan', 'phuongThuc xuLyTienThua')
      .populate('nguoiTao', 'ten email')
      .lean<Array<Record<string, unknown> & { _id: mongoose.Types.ObjectId; soTien: number; daHuy: boolean; ngayGhiNhan: Date; ngayTao: Date }>>();

    let luyKe = 0;
    const butToan = sapXepButToan(raw.map((b) => ({ ...b, id: String(b._id) }))).map((b) => {
      if (!b.daHuy) luyKe += b.soTien;
      return { ...b, soDuLuyKe: b.daHuy ? null : luyKe };
    });

    const hoaDonMo = await hoaDonMoCuaKhach(khachThueId);

    return NextResponse.json({
      success: true,
      data: {
        khachThue,
        soDu: luyKe,
        butToan: butToan.reverse(), // mới nhất trước
        hoaDonMo,
      },
    });
  } catch (error) {
    console.error('Error fetching cong no:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
