import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Phong from '@/models/Phong';
import ToaNha from '@/models/ToaNha';
import HopDong from '@/models/HopDong';
import { updatePhongStatus } from '@/lib/status-utils';
import { z } from 'zod';

const phongSchema = z.object({
  maPhong: z.string().min(1, 'Mã phòng là bắt buộc'),
  toaNha: z.string().min(1, 'Tòa nhà là bắt buộc'),
  tang: z.number().min(0, 'Tầng phải lớn hơn hoặc bằng 0'),
  dienTich: z.number().min(1, 'Diện tích phải lớn hơn 0'),
  giaThue: z.number().min(0, 'Giá thuê phải lớn hơn hoặc bằng 0'),
  tienCoc: z.number().min(0, 'Tiền cọc phải lớn hơn hoặc bằng 0'),
  moTa: z.string().optional(),
  anhPhong: z.array(z.string()).optional(),
  tienNghi: z.array(z.string()).optional(),
  soNguoiToiDa: z.number().min(1, 'Số người tối đa phải lớn hơn 0').max(10, 'Số người tối đa không được quá 10'),
  // Chỉ đặt tay được "Bảo trì" / "Trống"; "Đang thuê" / "Đã đặt" do hợp đồng quyết định (bị bỏ qua)
  trangThai: z.enum(['trong', 'daDat', 'dangThue', 'baoTri']).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();
    const { id } = await params;

    // Cập nhật trạng thái phòng trước khi trả về
    await updatePhongStatus(id);

    const phong = await Phong.findById(id)
      .populate('toaNha', 'tenToaNha diaChi');

    if (!phong) {
      return NextResponse.json(
        { message: 'Phòng không tồn tại' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: phong,
    });

  } catch (error) {
    console.error('Error fetching phong:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = phongSchema.parse(body);

    await dbConnect();
    const { id } = await params;

    // Check if toa nha exists
    const toaNha = await ToaNha.findById(validatedData.toaNha);
    if (!toaNha) {
      return NextResponse.json(
        { message: 'Tòa nhà không tồn tại' },
        { status: 400 }
      );
    }

    // Trạng thái đặt tay: chỉ nhận "Bảo trì" / "Trống"
    const { trangThai: trangThaiYeuCau, ...duLieuPhong } = validatedData;
    const datTay = trangThaiYeuCau === 'baoTri' || trangThaiYeuCau === 'trong' ? trangThaiYeuCau : undefined;
    if (datTay === 'baoTri') {
      const dangCoHopDong = await HopDong.exists({ phong: id, trangThai: 'hoatDong' });
      if (dangCoHopDong) {
        return NextResponse.json(
          { message: 'Phòng đang có hợp đồng hoạt động — không thể chuyển sang Bảo trì' },
          { status: 400 }
        );
      }
    }

    const phong = await Phong.findByIdAndUpdate(
      id,
      {
        ...duLieuPhong,
        ...(datTay ? { trangThai: datTay } : {}),
        anhPhong: validatedData.anhPhong || [],
        tienNghi: validatedData.tienNghi || [],
        // Trạng thái sẽ được cập nhật tự động dựa trên hợp đồng
      },
      { new: true, runValidators: true }
    ).populate('toaNha', 'tenToaNha diaChi');

    if (!phong) {
      return NextResponse.json(
        { message: 'Phòng không tồn tại' },
        { status: 404 }
      );
    }

    // Áp dụng giá thuê mới cho hợp đồng đang hoạt động của phòng (khi người dùng đồng ý).
    // Hóa đơn tính tiền phòng theo giá trong hợp đồng, không theo giá phòng.
    let soHopDongCapNhatGia = 0;
    if (body?.capNhatGiaHopDong === true) {
      const kq = await HopDong.updateMany(
        { phong: id, trangThai: 'hoatDong', giaThue: { $ne: validatedData.giaThue } },
        { $set: { giaThue: validatedData.giaThue } }
      );
      soHopDongCapNhatGia = kq.modifiedCount;
    }

    // Cập nhật trạng thái dựa trên hợp đồng sau khi cập nhật phòng
    await updatePhongStatus(id);

    // Lấy lại dữ liệu với trạng thái đã cập nhật
    const updatedPhong = await Phong.findById(id)
      .populate('toaNha', 'tenToaNha diaChi');

    return NextResponse.json({
      success: true,
      data: updatedPhong,
      soHopDongCapNhatGia,
      message: soHopDongCapNhatGia
        ? 'Đã cập nhật phòng và giá thuê của hợp đồng đang hoạt động'
        : 'Phòng đã được cập nhật thành công',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error updating phong:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();
    const { id } = await params;

    const phong = await Phong.findById(id);
    if (!phong) {
      return NextResponse.json(
        { message: 'Phòng không tồn tại' },
        { status: 404 }
      );
    }

    await Phong.findByIdAndDelete(id);

    return NextResponse.json({
      success: true,
      message: 'Phòng đã được xóa thành công',
    });

  } catch (error) {
    console.error('Error deleting phong:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
