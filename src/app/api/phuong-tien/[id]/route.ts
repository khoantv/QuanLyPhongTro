import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import PhuongTien from '@/models/PhuongTien';
import KhachThue from '@/models/KhachThue';
import { z } from 'zod';

const phuongTienSchema = z.object({
  khachThue: z.string().min(1, 'Khách thuê là bắt buộc'),
  tenXe: z.string().min(1, 'Tên xe là bắt buộc').max(100),
  bienSo: z.string().min(1, 'Biển số xe là bắt buộc').max(20),
  loaiXe: z.enum(['xeMay', 'oTo', 'xeDap', 'xeDien', 'khac']),
  hinhAnh: z.array(z.string()).optional(),
  moTa: z.string().max(500).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;

    const data = await PhuongTien.findById(id)
      .populate('khachThue', 'hoTen soDienThoai');

    if (!data) {
      return NextResponse.json({ message: 'Phương tiện không tồn tại' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching phuong tien:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = phuongTienSchema.parse(body);

    await dbConnect();
    const { id } = await params;

    const khachThue = await KhachThue.findById(validated.khachThue);
    if (!khachThue) {
      return NextResponse.json({ message: 'Khách thuê không tồn tại' }, { status: 400 });
    }

    const bienSoUpper = validated.bienSo.toUpperCase();
    const duplicated = await PhuongTien.findOne({ bienSo: bienSoUpper, _id: { $ne: id } });
    if (duplicated) {
      return NextResponse.json({ message: 'Biển số xe đã tồn tại' }, { status: 400 });
    }

    const updated = await PhuongTien.findByIdAndUpdate(
      id,
      {
        ...validated,
        bienSo: bienSoUpper,
        hinhAnh: validated.hinhAnh || [],
      },
      { new: true, runValidators: true }
    ).populate('khachThue', 'hoTen soDienThoai');

    if (!updated) {
      return NextResponse.json({ message: 'Phương tiện không tồn tại' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Đã cập nhật phương tiện thành công',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0].message }, { status: 400 });
    }
    console.error('Error updating phuong tien:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;

    const deleted = await PhuongTien.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ message: 'Phương tiện không tồn tại' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Đã xóa phương tiện thành công',
    });
  } catch (error) {
    console.error('Error deleting phuong tien:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
