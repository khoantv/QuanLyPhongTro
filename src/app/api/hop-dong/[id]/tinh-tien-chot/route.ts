import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import { LapHoaDonError, hoaDonGanNhat, taiHopDong } from '@/lib/hoa-don/lap-hoa-don';
import { hoanTienPhongMacDinh, thongTinPhongMoi, tinhTienChot } from '@/lib/thanh-ly';

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/hop-dong/[id]/tinh-tien-chot?loai=chuyenPhong|traPhong&ngay=YYYY-MM-DD
 *   [&chiSoDien=&chiSoNuoc=&soDienThayDongHo=&soNuocThayDongHo=&hoanTienPhong=0|1&dungCocTruNo=0|1&phongMoiId=]
 * Xem trước hóa đơn chốt phòng — không ghi DB. Bỏ trống chỉ số → dùng chỉ số đầu kỳ (tiêu thụ 0) để form điền sẵn.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    await dbConnect();

    const { id } = await params;
    const sp = new URL(request.url).searchParams;
    const loai = sp.get('loai') === 'chuyenPhong' ? 'chuyenPhong' : 'traPhong';
    const so = (k: string) => (sp.get(k) === null || sp.get(k) === '' ? null : Number(sp.get(k)));
    const co = (k: string) => (sp.get(k) === null ? null : sp.get(k) === '1' || sp.get(k) === 'true');

    const hd = await taiHopDong(id);
    const ganNhat = await hoaDonGanNhat(hd._id);
    const chiSoDienDau = ganNhat?.chiSoDienCuoiKy ?? hd.chiSoDienBanDau ?? 0;
    const chiSoNuocDau = ganNhat?.chiSoNuocCuoiKy ?? hd.chiSoNuocBanDau ?? 0;

    const hoanTienPhong = loai === 'chuyenPhong' ? true : await hoanTienPhongMacDinh(co('hoanTienPhong'));
    const thayDongHo = {
      ...(so('soDienThayDongHo') !== null ? { soDien: so('soDienThayDongHo')! } : {}),
      ...(so('soNuocThayDongHo') !== null ? { soNuoc: so('soNuocThayDongHo')! } : {}),
    };
    const bt = await tinhTienChot({
      hopDongId: id,
      ngayChot: sp.get('ngay') || new Date(),
      chiSoDienChot: so('chiSoDien') ?? chiSoDienDau,
      chiSoNuocChot: so('chiSoNuoc') ?? chiSoNuocDau,
      thayDongHo,
      hoanTienPhong,
    });

    const dungCocTruNo = co('dungCocTruNo') ?? true;
    const tienCoc = bt.hopDong.tienCoc;
    const truCoc = loai === 'traPhong' && dungCocTruNo ? Math.min(tienCoc, Math.max(0, bt.soDuSau)) : 0;

    const phongMoiId = sp.get('phongMoiId');
    const phongMoi = loai === 'chuyenPhong' && phongMoiId ? await thongTinPhongMoi(id, phongMoiId) : null;

    return NextResponse.json({
      success: true,
      data: {
        loai,
        hoanTienPhong,
        banTinh: bt,
        coc: loai === 'traPhong' ? { tienCoc, truCoc, cocConLai: tienCoc - truCoc, soDuSauTruCoc: bt.soDuSau - truCoc } : { tienCoc },
        phongMoi,
      },
    });
  } catch (error) {
    if (error instanceof LapHoaDonError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error previewing chot phong:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
