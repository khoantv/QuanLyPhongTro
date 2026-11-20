import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { LapHoaDonError } from '@/lib/hoa-don/lap-hoa-don';
import { chuyenPhong } from '@/lib/thanh-ly';

type Params = { params: Promise<{ id: string }> };

// POST /api/hop-dong/[id]/chuyen-phong — chốt phòng cũ, thanh lý hợp đồng, tạo hợp đồng mới ở phòng mới
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await dbConnect();

    const { id } = await params;
    const b = await request.json();
    const kq = await chuyenPhong({
      hopDongId: id,
      phongMoiId: b.phongMoiId,
      ngayChuyen: b.ngayChuyen,
      chiSoDienChot: b.chiSoDienChot,
      chiSoNuocChot: b.chiSoNuocChot,
      chiSoDienBatDauPhongMoi: b.chiSoDienBatDauPhongMoi,
      chiSoNuocBatDauPhongMoi: b.chiSoNuocBatDauPhongMoi,
      thayDongHo: b.thayDongHo ?? null,
      giaThueMoi: b.giaThueMoi ?? null,
      tienCocMoi: b.tienCocMoi ?? null,
      ngayThanhToanMoi: b.ngayThanhToanMoi ?? null,
      phiDichVuMoi: Array.isArray(b.phiDichVuMoi) ? b.phiDichVuMoi : null,
      phiDichVu: Array.isArray(b.phiDichVu) ? b.phiDichVu : null,
      khoanGiamTru: Array.isArray(b.khoanGiamTru) ? b.khoanGiamTru : null,
      maThaoTac: b.maThaoTac,
    }, session.user.id);

    return NextResponse.json({ success: true, data: kq, message: 'Chuyển phòng thành công' });
  } catch (error) {
    if (error instanceof LapHoaDonError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error chuyen phong:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
