import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { LapHoaDonError } from '@/lib/hoa-don/lap-hoa-don';
import { hoanTienChoKhach } from '@/lib/thanh-ly';

// POST /api/cong-no/hoan-tien { khachThueId, nguon: 'tienThua'|'tienCoc', hopDongId?, soTien, phuongThuc?, ngay?, ghiChu? }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    const role = (session.user as { role?: string }).role;
    if (role !== 'admin' && role !== 'chuNha') {
      return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 403 });
    }
    await dbConnect();

    const b = await request.json();
    if (b?.nguon !== 'tienThua' && b?.nguon !== 'tienCoc') {
      return NextResponse.json({ message: 'Nguồn hoàn tiền không hợp lệ' }, { status: 400 });
    }
    const kq = await hoanTienChoKhach({
      khachThueId: b.khachThueId,
      nguon: b.nguon,
      hopDongId: b.hopDongId ?? null,
      soTien: b.soTien,
      phuongThuc: b.phuongThuc,
      ngay: b.ngay ?? null,
      ghiChu: b.ghiChu ?? null,
    }, session.user.id);

    return NextResponse.json({ success: true, data: kq, message: 'Đã ghi nhận hoàn tiền' });
  } catch (error) {
    if (error instanceof LapHoaDonError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error hoan tien:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
