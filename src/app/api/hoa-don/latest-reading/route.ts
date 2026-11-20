import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { tinhHoaDonHangThang, LapHoaDonError } from '@/lib/hoa-don/lap-hoa-don';

/**
 * GET /api/hoa-don/latest-reading?hopDong=&thang=&nam=[&chiSoDienCuoiKy=&chiSoNuocCuoiKy=]
 * Xem trước hóa đơn hàng tháng: kỳ thu, chỉ số đầu kỳ (và cuối kỳ nếu đã ghi), tiền phòng lẻ,
 * phí hợp đồng, làm tròn, nợ kỳ trước, hạn đóng. Không ghi DB.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const hopDongId = searchParams.get('hopDong');
    const now = new Date();
    const thang = parseInt(searchParams.get('thang') || String(now.getMonth() + 1));
    const nam = parseInt(searchParams.get('nam') || String(now.getFullYear()));
    const soHoacNull = (k: string) => {
      const v = searchParams.get(k);
      return v === null || v === '' ? null : Number(v);
    };

    if (!hopDongId) {
      return NextResponse.json({ message: 'Thiếu ID hợp đồng' }, { status: 400 });
    }

    const bt = await tinhHoaDonHangThang({
      hopDongId,
      thang,
      nam,
      chiSoDienCuoiKy: soHoacNull('chiSoDienCuoiKy'),
      chiSoNuocCuoiKy: soHoacNull('chiSoNuocCuoiKy'),
    });

    return NextResponse.json({
      success: true,
      data: bt,
      message: `Kỳ thu ${bt.kyBatDau.toISOString()}`,
    });
  } catch (error) {
    if (error instanceof LapHoaDonError) {
      return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    }
    console.error('Error previewing hoa don:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
