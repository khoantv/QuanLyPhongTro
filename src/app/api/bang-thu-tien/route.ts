import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { LapHoaDonError } from '@/lib/hoa-don/lap-hoa-don';
import { dungBangThuTien } from '@/lib/bang-thu-tien';
import { docThangNam } from './_params';

// GET /api/bang-thu-tien?toaNha=&thang=&nam=
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const sp = new URL(request.url).searchParams;
    const { thang, nam } = docThangNam(sp);
    const bang = await dungBangThuTien(sp.get('toaNha') || '', thang, nam);
    return NextResponse.json({ success: true, data: bang });
  } catch (error) {
    if (error instanceof LapHoaDonError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error bang thu tien:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
