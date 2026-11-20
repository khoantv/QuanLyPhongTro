import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { LapHoaDonError } from '@/lib/hoa-don/lap-hoa-don';
import { luuChiSoHangLoat } from '@/lib/bang-thu-tien';
import { docThangNam } from '../_params';

// POST /api/bang-thu-tien/chi-so { thang, nam, items: [{ phongId, chiSoDienMoi, chiSoNuocMoi }] }
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const body = await request.json();
    const { thang, nam } = docThangNam(body ?? {});
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ message: 'Không có chỉ số nào để lưu' }, { status: 400 });
    }
    const kq = await luuChiSoHangLoat(thang, nam, body.items, session.user.id);
    return NextResponse.json({ success: true, data: kq, message: `Đã lưu chỉ số ${kq.daLuu} phòng` });
  } catch (error) {
    if (error instanceof LapHoaDonError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error luu chi so:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
