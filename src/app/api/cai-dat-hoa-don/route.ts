import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import CaiDatHoaDon from '@/models/CaiDatHoaDon';
import { z } from 'zod';

const updateSchema = z.object({
  tenNhaTro: z.string().max(120).optional(),
  ngayLapHoaDon: z.number().int().min(1).max(31).nullable().optional(),
  hanDongTien: z.number().int().min(1).max(31).optional(),
  autoSendZalo: z.boolean().optional(),
  hienMaQR: z.boolean().optional(),
  phanLoaiThuChi: z.boolean().optional(),
  lamTronHoaDon: z.boolean().optional(),
  hinhThucThanhToanMacDinh: z.enum(['tienMat', 'chuyenKhoan', 'momo', 'vnpay', 'khac']).optional(),
  ghiChuMacDinh: z.string().max(500).optional(),
});

function isPriviledged(role?: string | null) {
  return role === 'admin' || role === 'chuNha';
}

async function ensureSingleton() {
  await dbConnect();
  const doc = await CaiDatHoaDon.findOneAndUpdate(
    { singleton: true },
    { $setOnInsert: { singleton: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const doc = await ensureSingleton();
  return NextResponse.json({ success: true, data: doc });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (!isPriviledged((session.user as { role?: string }).role)) {
    return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = updateSchema.parse(body);
    await dbConnect();
    const doc = await CaiDatHoaDon.findOneAndUpdate(
      { singleton: true },
      { $set: data, $setOnInsert: { singleton: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );
    return NextResponse.json({ success: true, data: doc, message: 'Đã lưu cấu hình' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.issues[0].message }, { status: 400 });
    }
    console.error('Error updating cai dat hoa don:', err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
