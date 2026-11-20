import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { LapHoaDonError } from '@/lib/hoa-don/lap-hoa-don';
import { traPhong } from '@/lib/thanh-ly';

type Params = { params: Promise<{ id: string }> };

// POST /api/hop-dong/[id]/tra-phong — chốt phòng, thanh lý hợp đồng, dùng cọc trừ nợ (tùy chọn)
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await dbConnect();

    const { id } = await params;
    const b = await request.json();
    const kq = await traPhong({
      hopDongId: id,
      ngayTraPhong: b.ngayTraPhong,
      chiSoDienChot: b.chiSoDienChot,
      chiSoNuocChot: b.chiSoNuocChot,
      thayDongHo: b.thayDongHo ?? null,
      hoanTienPhong: typeof b.hoanTienPhong === 'boolean' ? b.hoanTienPhong : null,
      dungCocTruNo: typeof b.dungCocTruNo === 'boolean' ? b.dungCocTruNo : null,
      phiDichVu: Array.isArray(b.phiDichVu) ? b.phiDichVu : null,
      khoanGiamTru: Array.isArray(b.khoanGiamTru) ? b.khoanGiamTru : null,
      maThaoTac: b.maThaoTac,
    }, session.user.id);

    return NextResponse.json({ success: true, data: kq, message: 'Trả phòng thành công' });
  } catch (error) {
    if (error instanceof LapHoaDonError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error tra phong:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
