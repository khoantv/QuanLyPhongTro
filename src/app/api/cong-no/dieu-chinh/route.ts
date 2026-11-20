import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import KhachThue from '@/models/KhachThue';
import { ghiButToan, recomputeCongNo, timHopDongCuaKhach } from '@/lib/cong-no';

function isPrivileged(role?: string | null) {
  return role === 'admin' || role === 'chuNha';
}

// POST /api/cong-no/dieu-chinh  { khachThueId, soTien (có dấu), moTa, ngayGhiNhan? }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    if (!isPrivileged((session.user as { role?: string }).role)) {
      return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 403 });
    }

    const body = await request.json();
    const { khachThueId, moTa, ngayGhiNhan } = body ?? {};
    const soTien = Math.round(Number(body?.soTien));

    if (!khachThueId || !mongoose.Types.ObjectId.isValid(khachThueId)) {
      return NextResponse.json({ message: 'Khách thuê không hợp lệ' }, { status: 400 });
    }
    if (!Number.isFinite(soTien) || soTien === 0) {
      return NextResponse.json({ message: 'Số tiền điều chỉnh phải khác 0' }, { status: 400 });
    }
    if (typeof moTa !== 'string' || !moTa.trim()) {
      return NextResponse.json({ message: 'Vui lòng nhập lý do điều chỉnh' }, { status: 400 });
    }

    await connectToDatabase();
    if (!(await KhachThue.exists({ _id: khachThueId }))) {
      return NextResponse.json({ message: 'Khách thuê không tồn tại' }, { status: 404 });
    }

    const ngay = ngayGhiNhan ? new Date(ngayGhiNhan) : new Date();
    if (Number.isNaN(ngay.getTime())) {
      return NextResponse.json({ message: 'Ngày ghi nhận không hợp lệ' }, { status: 400 });
    }

    const hopDong = await timHopDongCuaKhach(khachThueId);
    const butToan = await ghiButToan({
      khachThue: khachThueId,
      loai: 'dieuChinh',
      soTien,
      ngayGhiNhan: ngay,
      hopDong: hopDong?._id,
      phong: hopDong?.phong,
      moTa: moTa.trim(),
      nguoiTao: session.user.id,
    });
    const kq = await recomputeCongNo(khachThueId);

    return NextResponse.json({ success: true, data: { butToan, soDu: kq.soDu } });
  } catch (error) {
    console.error('Error creating dieu chinh cong no:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
