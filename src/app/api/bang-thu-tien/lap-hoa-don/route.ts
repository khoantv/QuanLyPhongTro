import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { LapHoaDonError } from '@/lib/hoa-don/lap-hoa-don';
import { lapHoaDonHangLoat } from '@/lib/bang-thu-tien';
import { coQuanLy, docThangNam } from '../_params';

// POST /api/bang-thu-tien/lap-hoa-don { thang, nam, hopDongIds: string[] }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    if (!coQuanLy((session.user as { role?: string }).role)) {
      return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 403 });
    }
    await dbConnect();
    const body = await request.json();
    const { thang, nam } = docThangNam(body ?? {});
    const ids: string[] = Array.isArray(body.hopDongIds) ? body.hopDongIds.filter((x: unknown) => typeof x === 'string') : [];
    if (ids.length === 0) return NextResponse.json({ message: 'Chưa chọn hợp đồng nào' }, { status: 400 });
    const kq = await lapHoaDonHangLoat(thang, nam, ids, session.user.id);
    return NextResponse.json({ success: true, data: kq, message: `Đã lập ${kq.daLap} hóa đơn` });
  } catch (error) {
    if (error instanceof LapHoaDonError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error lap hoa don hang loat:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
