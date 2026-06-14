import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Phong from '@/models/Phong';

async function generateUniqueMaPhong(originalMaPhong: string): Promise<string> {
  const base = `${originalMaPhong}COPY`;
  let candidate = base;
  let suffix = 1;

  while (await Phong.exists({ maPhong: candidate })) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }

  return candidate;
}

export async function POST(
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

    const source = await Phong.findById(id);
    if (!source) {
      return NextResponse.json(
        { message: 'Phòng không tồn tại' },
        { status: 404 }
      );
    }

    const newMaPhong = await generateUniqueMaPhong(source.maPhong);

    const cloned = await Phong.create({
      maPhong: newMaPhong,
      toaNha: source.toaNha,
      tang: source.tang,
      dienTich: source.dienTich,
      giaThue: source.giaThue,
      tienCoc: source.tienCoc,
      moTa: source.moTa,
      anhPhong: [...(source.anhPhong || [])],
      tienNghi: [...(source.tienNghi || [])],
      soNguoiToiDa: source.soNguoiToiDa,
      trangThai: 'trong',
    });

    const populated = await Phong.findById(cloned._id)
      .populate('toaNha', 'tenToaNha diaChi');

    return NextResponse.json({
      success: true,
      data: populated,
      message: `Đã nhân bản phòng thành "${newMaPhong}"`,
    }, { status: 201 });

  } catch (error) {
    console.error('Error cloning phong:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
