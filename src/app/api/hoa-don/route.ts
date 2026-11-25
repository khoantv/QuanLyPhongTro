import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import HoaDon from '@/models/HoaDon';
import '@/models/Phong';
import '@/models/KhachThue';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { lapHoaDonHangThang, capNhatHoaDon, xoaHoaDon, LapHoaDonError } from '@/lib/hoa-don/lap-hoa-don';
import { tinhCongNo, tinhCongNoTruocHoaDon } from '@/lib/cong-no';
import { guiZaloTuDong } from '@/lib/hoa-don/gui-zalo';


// GET - Lấy danh sách hóa đơn
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const hopDongId = searchParams.get('hopDongId');
    const trangThai = searchParams.get('trangThai');

    // Nếu có ID, lấy hóa đơn cụ thể
    if (id) {
      const hoaDon = await HoaDon.findById(id)
        .populate('hopDong', 'maHopDong')
        .populate('phong', 'maPhong')
        .populate('khachThue', 'hoTen soDienThoai');
      
      if (!hoaDon) {
        return NextResponse.json(
          { message: 'Hóa đơn không tồn tại' },
          { status: 404 }
        );
      }

      const hoaDonObj = hoaDon.toObject();
      
      // Xử lý dữ liệu cũ không có chỉ số điện nước
      if (hoaDonObj.chiSoDienBanDau === undefined) {
        hoaDonObj.chiSoDienBanDau = 0;
      }
      if (hoaDonObj.chiSoDienCuoiKy === undefined) {
        hoaDonObj.chiSoDienCuoiKy = hoaDonObj.chiSoDienBanDau;
      }
      if (hoaDonObj.chiSoNuocBanDau === undefined) {
        hoaDonObj.chiSoNuocBanDau = 0;
      }
      if (hoaDonObj.chiSoNuocCuoiKy === undefined) {
        hoaDonObj.chiSoNuocCuoiKy = hoaDonObj.chiSoNuocBanDau;
      }

      // Tiền thừa khách có ngay trước hóa đơn này — để form sửa cho chọn có khấu trừ hay không
      const truoc = await tinhCongNoTruocHoaDon(hoaDon);
      const hoaDonId = String(hoaDon._id);
      const khachId = String(hoaDon.khachThue?._id ?? hoaDon.khachThue);
      // Đã nhận / phần khấu trừ của hóa đơn theo từng lựa chọn, để form xem trước
      const phuongAn = async (khauTru: boolean) => {
        const kq = await tinhCongNo(khachId, {}, { hoaDonId, khauTru });
        return {
          daThanhToan: Math.min(Math.max(0, hoaDon.tongTien), kq.daPhanBoTheoHoaDon.get(hoaDonId) ?? 0),
          daKhauTru: kq.daKhauTruTheoHoaDon.get(hoaDonId) ?? 0,
        };
      };
      const [coTru, khongTru] = await Promise.all([phuongAn(true), phuongAn(false)]);
      return NextResponse.json({
        success: true,
        data: {
          ...hoaDonObj,
          tienThuaKyTruoc: truoc?.tienThua ?? 0,
          noConLaiKyTruoc: truoc?.noConLai ?? 0,
          phuongAnKhauTru: { coTru, khongTru },
        }
      });
    }

    const query: Record<string, unknown> = {};
    if (hopDongId) {
      query.hopDong = hopDongId;
    }
    if (trangThai) {
      query.trangThai = trangThai;
    }

    const skip = (page - 1) * limit;

    const hoaDons = await HoaDon.find(query)
      .populate('hopDong', 'maHopDong')
      .populate('phong', 'maPhong')
      .populate('khachThue', 'hoTen soDienThoai')
      .sort({ nam: -1, thang: -1 })
      .skip(skip)
      .limit(limit);

    // Xử lý dữ liệu cũ không có chỉ số điện nước
    const processedHoaDons = hoaDons.map(hoaDon => {
      const hoaDonObj = hoaDon.toObject();
      
      // Nếu không có chỉ số điện nước, tạo giá trị mặc định
      if (hoaDonObj.chiSoDienBanDau === undefined) {
        hoaDonObj.chiSoDienBanDau = 0;
      }
      if (hoaDonObj.chiSoDienCuoiKy === undefined) {
        hoaDonObj.chiSoDienCuoiKy = hoaDonObj.chiSoDienBanDau;
      }
      if (hoaDonObj.chiSoNuocBanDau === undefined) {
        hoaDonObj.chiSoNuocBanDau = 0;
      }
      if (hoaDonObj.chiSoNuocCuoiKy === undefined) {
        hoaDonObj.chiSoNuocCuoiKy = hoaDonObj.chiSoNuocBanDau;
      }
      
      return hoaDonObj;
    });

    const total = await HoaDon.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: processedHoaDons,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching hoa don:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Tạo hóa đơn hàng tháng (theo kỳ thu của hợp đồng)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();
    if (!body?.hopDong || !body?.thang || !body?.nam) {
      return NextResponse.json({ message: 'Thiếu hợp đồng hoặc tháng/năm' }, { status: 400 });
    }

    const hoaDon = await lapHoaDonHangThang({
      hopDongId: String(body.hopDong),
      thang: Number(body.thang),
      nam: Number(body.nam),
      chiSoDienCuoiKy: body.chiSoDienCuoiKy ?? null,
      chiSoNuocCuoiKy: body.chiSoNuocCuoiKy ?? null,
      tienPhong: body.tienPhong ?? null,
      phiDichVu: Array.isArray(body.phiDichVu) ? body.phiDichVu : null,
      khoanGiamTru: Array.isArray(body.khoanGiamTru) ? body.khoanGiamTru : null,
      thayDongHo: body.thayDongHo ?? null,
      hanThanhToan: body.hanThanhToan || null,
      ghiChu: body.ghiChu ?? null,
      maHoaDon: body.maHoaDon ?? null,
      hinhThucThanhToan: body.hinhThucThanhToan ?? null,
      khauTruTienThua: body.khauTruTienThua === true,
    }, session.user.id);

    if (hoaDon) guiZaloTuDong(hoaDon);

    return NextResponse.json({
      success: true,
      data: hoaDon,
      message: 'Tạo hóa đơn thành công'
    });
  } catch (error) {
    if (error instanceof LapHoaDonError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error('Error creating hoa don:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Cập nhật hóa đơn. Không đổi hợp đồng/kỳ; daThanhToan/conLai/trangThai do sổ công nợ tính.
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();
    if (!body?.id) {
      return NextResponse.json({ message: 'Thiếu ID hóa đơn' }, { status: 400 });
    }

    const hoaDon = await capNhatHoaDon(String(body.id), {
      maHoaDon: body.maHoaDon,
      tienPhong: body.tienPhong,
      chiSoDienBanDau: body.chiSoDienBanDau,
      chiSoDienCuoiKy: body.chiSoDienCuoiKy,
      chiSoNuocBanDau: body.chiSoNuocBanDau,
      chiSoNuocCuoiKy: body.chiSoNuocCuoiKy,
      phiDichVu: Array.isArray(body.phiDichVu) ? body.phiDichVu : undefined,
      khoanGiamTru: Array.isArray(body.khoanGiamTru) ? body.khoanGiamTru : undefined,
      thayDongHo: body.thayDongHo ?? null,
      hanThanhToan: body.hanThanhToan || undefined,
      ghiChu: body.ghiChu,
      hinhThucThanhToan: body.hinhThucThanhToan,
      khauTruTienThua: typeof body.khauTruTienThua === 'boolean' ? body.khauTruTienThua : undefined,
    }, session.user.id);

    return NextResponse.json({
      success: true,
      data: hoaDon,
      message: 'Cập nhật hóa đơn thành công'
    });
  } catch (error) {
    if (error instanceof LapHoaDonError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error('Error updating hoa don:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Xóa hóa đơn (chỉ hóa đơn mới nhất của hợp đồng)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ message: 'Thiếu ID hóa đơn' }, { status: 400 });
    }

    await xoaHoaDon(id, session.user.id);

    return NextResponse.json({ success: true, message: 'Xóa hóa đơn thành công' });
  } catch (error) {
    if (error instanceof LapHoaDonError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error('Error deleting hoa don:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
