import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import HopDong from '@/models/HopDong';
import ChiSoDienNuoc from '@/models/ChiSoDienNuoc';
import '@/models/Phong';
import { dauNgayVN, kyThuCuaThang, ngayVN, soNgayGiua } from '@/lib/ky-thu';
import { lapHoaDonHangThang, LapHoaDonError } from '@/lib/hoa-don/lap-hoa-don';
import { guiZaloTuDong } from '@/lib/hoa-don/gui-zalo';

interface HopDongDenHan {
  _id: { toString(): string };
  maHopDong: string;
  phong: { _id: unknown; maPhong: string };
  ngayThanhToan: number;
  ngayBatDau: Date;
  daThuTienPhongDen?: Date | null;
}

/**
 * Hợp đồng đến hạn lập hóa đơn hôm nay: ngày thu của tháng hiện tại (giờ VN) ≤ hôm nay
 * và tiền phòng mới được lập hóa đơn tới trước hoặc đúng ngày thu đó.
 */
async function hopDongDenHan(now = new Date()) {
  const homNay = dauNgayVN(now);
  const { thang, nam } = ngayVN(now);
  const list = await HopDong.find({ trangThai: 'hoatDong', chuKyThanhToan: 'thang' })
    .populate('phong', 'maPhong')
    .select('maHopDong phong ngayThanhToan ngayBatDau daThuTienPhongDen')
    .lean<HopDongDenHan[]>();

  return list
    .map((hd) => ({ hd, ky: kyThuCuaThang(hd.ngayThanhToan, thang, nam) }))
    .filter(({ hd, ky }) => {
      if (soNgayGiua(ky.batDau, homNay) < 0) return false; // chưa tới ngày thu
      const moc = hd.daThuTienPhongDen ?? hd.ngayBatDau;
      return soNgayGiua(moc, ky.batDau) >= 0; // chưa lập kỳ này và hợp đồng đã bắt đầu trước ngày thu
    });
}

// POST - Lập hóa đơn cho mọi hợp đồng đã đến ngày thu của tháng hiện tại
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const denHan = await hopDongDenHan();

    let createdInvoices = 0;
    const errors: string[] = [];
    for (const { hd, ky } of denHan) {
      try {
        const hoaDon = await lapHoaDonHangThang({ hopDongId: hd._id.toString(), thang: ky.thang, nam: ky.nam }, session.user.id);
        createdInvoices++;
        if (hoaDon) guiZaloTuDong(hoaDon);
      } catch (error) {
        if (error instanceof LapHoaDonError) {
          errors.push(`Phòng ${hd.phong?.maPhong ?? hd.maHopDong}: ${error.message}`);
        } else {
          console.error(`Error creating invoice for contract ${hd.maHopDong}:`, error);
          errors.push(`Lỗi tạo hóa đơn cho hợp đồng ${hd.maHopDong}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { createdInvoices, totalContracts: denHan.length, errors },
      message: `Đã tạo ${createdInvoices} hóa đơn tự động`,
    });
  } catch (error) {
    console.error('Error in auto invoice generation:', error);
    return NextResponse.json({ message: 'Lỗi khi tạo hóa đơn tự động' }, { status: 500 });
  }
}

// GET - Số hợp đồng đến hạn và số hợp đồng còn thiếu chỉ số điện nước
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const now = new Date();
    const { thang, nam } = ngayVN(now);
    const denHan = await hopDongDenHan(now);

    const daGhi = await ChiSoDienNuoc.find({
      thang,
      nam,
      phong: { $in: denHan.map(({ hd }) => hd.phong?._id) },
    }).select('phong').lean<Array<{ phong: { toString(): string } }>>();
    const coChiSo = new Set(daGhi.map((c) => c.phong.toString()));
    const thieuChiSo = denHan.filter(({ hd }) => !coChiSo.has(String(hd.phong?._id)));

    return NextResponse.json({
      success: true,
      data: {
        currentMonth: thang,
        currentYear: nam,
        activeContractsCount: denHan.length,
        dueContractsCount: denHan.length,
        contractsWithoutReadingsCount: thieuChiSo.length,
        contractsWithoutReadings: thieuChiSo.map(({ hd }) => hd.phong?.maPhong ?? hd.maHopDong),
        canRun: denHan.length > thieuChiSo.length,
      },
    });
  } catch (error) {
    console.error('Error checking auto-invoice status:', error);
    return NextResponse.json({ message: 'Lỗi khi kiểm tra trạng thái tạo hóa đơn tự động' }, { status: 500 });
  }
}
