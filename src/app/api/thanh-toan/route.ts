import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ThanhToan from '@/models/ThanhToan';
import HoaDon from '@/models/HoaDon';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ghiNhanThanhToan } from '@/lib/cong-no';
import { dongBoPhieuThuAnToan } from '@/lib/phieu-thu-tu-dong';
import { resolveThanhToanInput, ThanhToanInputError } from '@/lib/cong-no/thanh-toan-input';

// GET - Lấy danh sách thanh toán
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const hopDongId = searchParams.get('hopDongId');
    const hoaDonId = searchParams.get('hoaDonId');
    const khachThueId = searchParams.get('khachThueId');

    const query: Record<string, unknown> = {};
    if (hopDongId) {
      // Tìm hóa đơn theo hợp đồng
      const hoaDons = await HoaDon.find({ hopDong: hopDongId }).select('_id');
      query.$or = [
        { hopDong: hopDongId },
        { hoaDon: { $in: hoaDons.map(hd => hd._id) } },
      ];
    }
    if (hoaDonId) {
      query.hoaDon = hoaDonId;
    }
    if (khachThueId) {
      query.khachThue = khachThueId;
    }

    const skip = (page - 1) * limit;

    const thanhToans = await ThanhToan.find(query)
      .populate({
        path: 'hoaDon',
        select: 'maHoaDon thang nam tongTien phong khachThue',
        populate: [
          { path: 'phong', select: 'maPhong' },
          { path: 'khachThue', select: 'hoTen' }
        ]
      })
      .populate('khachThue', 'hoTen soDienThoai')
      .populate('nguoiNhan', 'hoTen email')
      .sort({ ngayThanhToan: -1 })
      .skip(skip)
      .limit(limit);

    const total = await ThanhToan.countDocuments(query);

    return NextResponse.json({
      success: true,
      data: thanhToans,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching thanh toan:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Tạo thanh toán mới (theo khách thuê; cho phép đóng thiếu / đóng thừa / đóng trước)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();
    let input;
    try {
      input = await resolveThanhToanInput(body);
    } catch (e) {
      if (e instanceof ThanhToanInputError) {
        return NextResponse.json({ message: e.message }, { status: e.status });
      }
      throw e;
    }

    const thanhToan = await ThanhToan.create({
      ...input,
      nguoiNhan: session.user.id,
    });

    const congNo = await ghiNhanThanhToan(
      { _id: thanhToan._id, khachThue: input.khachThue, hopDong: input.hopDong, soTien: input.soTien, ngayThanhToan: input.ngayThanhToan },
      input.xuLyTienThua,
      session.user.id,
      input.ghiChu ? `Thu tiền — ${input.ghiChu}` : 'Thu tiền',
    );
    const canhBaoPhieuThu = await dongBoPhieuThuAnToan(thanhToan._id);

    // Chỉ lưu lựa chọn xử lý tiền thừa khi thực sự có phần thừa
    const xuLyTienThua = congNo.tienThua > 0 ? (input.xuLyTienThua ?? 'truKySau') : null;
    if (thanhToan.xuLyTienThua !== xuLyTienThua) {
      thanhToan.xuLyTienThua = xuLyTienThua;
      await thanhToan.save();
    }

    await thanhToan.populate([
      { path: 'hoaDon', select: 'maHoaDon thang nam tongTien daThanhToan conLai trangThai' },
      { path: 'khachThue', select: 'hoTen soDienThoai' },
      { path: 'nguoiNhan', select: 'hoTen email' }
    ]);

    const updatedHoaDon = input.hoaDon
      ? await HoaDon.findById(input.hoaDon)
        .populate('phong', 'maPhong')
        .populate('khachThue', 'hoTen')
        .populate('hopDong', 'maHopDong')
      : null;

    return NextResponse.json({
      success: true,
      data: {
        thanhToan,
        hoaDon: updatedHoaDon,
        congNo: { soDu: congNo.soDu, tienThua: congNo.tienThua },
      },
      ...(canhBaoPhieuThu ? { canhBao: canhBaoPhieuThu } : {}),
      message: 'Tạo thanh toán thành công'
    });
  } catch (error) {
    console.error('Error creating thanh toan:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
