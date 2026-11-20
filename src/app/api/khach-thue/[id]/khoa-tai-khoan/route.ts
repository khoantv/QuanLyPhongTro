import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import KhachThue from '@/models/KhachThue';

const bodySchema = z.object({ khoa: z.boolean() });

// PATCH - Khóa / mở khóa tài khoản đăng nhập của khách thuê
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ message: 'Dữ liệu không hợp lệ' }, { status: 400 });
    }

    await dbConnect();
    const { id } = await params;

    const khachThue = await KhachThue.findByIdAndUpdate(
      id,
      { $set: { khoaTaiKhoan: parsed.data.khoa } },
      { new: true }
    );
    if (!khachThue) {
      return NextResponse.json({ message: 'Khách thuê không tồn tại' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: khachThue,
      message: parsed.data.khoa ? 'Đã khóa tài khoản đăng nhập' : 'Đã mở khóa tài khoản đăng nhập',
    });
  } catch (error) {
    console.error('Error toggling khach thue account lock:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
