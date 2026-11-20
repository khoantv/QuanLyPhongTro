import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import ThanhToan from '@/models/ThanhToan';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { capNhatThanhToan, huyThanhToan } from '@/lib/cong-no';
import { resolveThanhToanInput, ThanhToanInputError } from '@/lib/cong-no/thanh-toan-input';

type Params = { params: Promise<{ id: string }> };

// PUT - Cập nhật thanh toán (số dư công nợ và trạng thái hóa đơn được tính lại)
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;
    const thanhToan = await ThanhToan.findById(id);
    if (!thanhToan) {
      return NextResponse.json({ message: 'Thanh toán không tồn tại' }, { status: 404 });
    }

    const body = await request.json();
    // Giữ khách thuê cũ nếu client không gửi lại
    if (!body.khachThueId && !body.hoaDonId && thanhToan.khachThue) {
      body.khachThueId = String(thanhToan.khachThue);
    }

    let input;
    try {
      input = await resolveThanhToanInput(body);
    } catch (e) {
      if (e instanceof ThanhToanInputError) {
        return NextResponse.json({ message: e.message }, { status: e.status });
      }
      throw e;
    }

    const khachThueCu = thanhToan.khachThue ?? input.khachThue;
    // Không gửi xuLyTienThua thì giữ lựa chọn cũ
    const xuLyTienThua = body.xuLyTienThua === undefined ? thanhToan.xuLyTienThua : input.xuLyTienThua;

    thanhToan.set({ ...input, xuLyTienThua });
    await thanhToan.save();

    const congNo = await capNhatThanhToan(
      { _id: thanhToan._id, khachThue: input.khachThue, hopDong: input.hopDong, soTien: input.soTien, ngayThanhToan: input.ngayThanhToan },
      khachThueCu,
      xuLyTienThua,
      session.user.id,
    );

    const xuLyLuu = congNo.tienThua > 0 ? (xuLyTienThua ?? 'truKySau') : null;
    if (thanhToan.xuLyTienThua !== xuLyLuu) {
      thanhToan.xuLyTienThua = xuLyLuu;
      await thanhToan.save();
    }

    await thanhToan.populate([
      { path: 'hoaDon', select: 'maHoaDon thang nam tongTien daThanhToan conLai trangThai' },
      { path: 'khachThue', select: 'hoTen soDienThoai' },
      { path: 'nguoiNhan', select: 'hoTen email' }
    ]);

    return NextResponse.json({
      success: true,
      data: thanhToan,
      congNo: { soDu: congNo.soDu, tienThua: congNo.tienThua },
      message: 'Cập nhật thanh toán thành công'
    });
  } catch (error) {
    console.error('Error updating thanh toan:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Xóa thanh toán. Bút toán công nợ được hủy mềm để giữ lịch sử.
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const { id } = await params;
    const thanhToan = await ThanhToan.findById(id);
    if (!thanhToan) {
      return NextResponse.json({ message: 'Thanh toán không tồn tại' }, { status: 404 });
    }

    if (thanhToan.khachThue) {
      await huyThanhToan({ _id: thanhToan._id, khachThue: thanhToan.khachThue }, session.user.id);
    }
    await ThanhToan.findByIdAndDelete(id);

    return NextResponse.json({ success: true, message: 'Xóa thanh toán thành công' });
  } catch (error) {
    console.error('Error deleting thanh toan:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
