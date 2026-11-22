import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import HoaDon from '@/models/HoaDon';
import ThanhToan from '@/models/ThanhToan';
import mongoose from 'mongoose';
import { tinhConLaiDenHoaDon } from '@/lib/cong-no';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase();
    
    const { id: hoaDonId } = await params;
    
    if (!hoaDonId) {
      return NextResponse.json(
        { success: false, message: 'ID hóa đơn không hợp lệ' },
        { status: 400 }
      );
    }

    // Lấy thông tin hóa đơn với populate
    const hoaDon = await HoaDon.findById(hoaDonId)
      // Link công khai: chỉ trả các trường cần hiển thị, không lộ CCCD / thông tin cá nhân khác
      .populate('hopDong', 'maHopDong')
      .populate('phong', 'maPhong')
      .populate('khachThue', 'hoTen')
      .lean<Record<string, unknown> & { _id: mongoose.Types.ObjectId; khachThue: { _id: mongoose.Types.ObjectId } | null; ngayTao: Date }>();

    if (!hoaDon) {
      return NextResponse.json(
        { success: false, message: 'Không tìm thấy hóa đơn' },
        { status: 404 }
      );
    }

    // Lấy lịch sử thanh toán của hóa đơn này
    const thanhToanList = await ThanhToan.find({ hoaDon: hoaDonId })
      .sort({ ngayThanhToan: -1 })
      .lean();

    // Tổng còn phải trả tính cả nợ kỳ trước (dùng cho "Còn lại" và mã QR)
    const tongConLai = hoaDon.khachThue ? await tinhConLaiDenHoaDon({ _id: hoaDon._id, khachThue: hoaDon.khachThue, ngayTao: hoaDon.ngayTao }) : 0;

    return NextResponse.json({
      success: true,
      data: {
        hoaDon: { ...hoaDon, tongConLai },
        thanhToanList
      }
    });

  } catch (error) {
    console.error('Error fetching public invoice:', error);
    return NextResponse.json(
      { success: false, message: 'Có lỗi xảy ra khi tải thông tin hóa đơn' },
      { status: 500 }
    );
  }
}
