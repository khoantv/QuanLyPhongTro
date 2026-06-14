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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const khachThue = searchParams.get('khachThue') || '';
    const loaiXe = searchParams.get('loaiXe') || '';

    const query: any = {};
    if (search) {
      query.$or = [
        { tenXe: { $regex: search, $options: 'i' } },
        { bienSo: { $regex: search, $options: 'i' } },
      ];
    }
    if (khachThue) query.khachThue = khachThue;
    if (loaiXe) query.loaiXe = loaiXe;

    const [data, total] = await Promise.all([
      PhuongTien.find(query)
        .populate('khachThue', 'hoTen soDienThoai')
        .sort({ ngayTao: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      PhuongTien.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching phuong tien:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validated = phuongTienSchema.parse(body);

    await dbConnect();

    const khachThue = await KhachThue.findById(validated.khachThue);
    if (!khachThue) {
      return NextResponse.json({ message: 'Khách thuê không tồn tại' }, { status: 400 });
    }

    const bienSoUpper = validated.bienSo.toUpperCase();
    const existing = await PhuongTien.findOne({ bienSo: bienSoUpper });
    if (existing) {
      return NextResponse.json({ message: 'Biển số xe đã tồn tại' }, { status: 400 });
    }

    const created = await PhuongTien.create({
      ...validated,
      bienSo: bienSoUpper,
      hinhAnh: validated.hinhAnh || [],
    });

    const populated = await PhuongTien.findById(created._id)
      .populate('khachThue', 'hoTen soDienThoai');

    return NextResponse.json({
      success: true,
      data: populated,
      message: 'Đã thêm phương tiện thành công',
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.issues[0].message }, { status: 400 });
    }
    console.error('Error creating phuong tien:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
