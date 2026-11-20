import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { LapHoaDonError } from '@/lib/hoa-don/lap-hoa-don';
import { dungBangThuTien } from '@/lib/bang-thu-tien';
import { xuatExcelBangThuTien } from '@/lib/bang-thu-tien-excel';
import { docThangNam } from '../_params';

export const runtime = 'nodejs';

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

// GET /api/bang-thu-tien/export?toaNha=&thang=&nam= → .xlsx
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await dbConnect();
    const sp = new URL(request.url).searchParams;
    const { thang, nam } = docThangNam(sp);
    const bang = await dungBangThuTien(sp.get('toaNha') || '', thang, nam);
    const buf = await xuatExcelBangThuTien(bang);
    const ten = `bang-thu-tien-${slug(bang.toaNha?.tenToaNha ?? 'toa-nha')}-${String(thang).padStart(2, '0')}-${nam}.xlsx`;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${ten}"`,
      },
    });
  } catch (error) {
    if (error instanceof LapHoaDonError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error export bang thu tien:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
