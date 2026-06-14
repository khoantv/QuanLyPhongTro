import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import ZaloMessageLog from '@/models/ZaloMessageLog';

function isPriviledged(role?: string | null) {
  return role === 'admin' || role === 'chuNha';
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (!isPriviledged((session.user as { role?: string }).role)) {
    return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 403 });
  }

  await dbConnect();
  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);
  const phongId = searchParams.get('phongId') || '';
  const status = searchParams.get('status') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  // Lọc theo tháng dựa trên ngayTao (vì sentAt có thể null cho queued/failed)
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1));

  const baseQuery: Record<string, unknown> = {
    ngayTao: { $gte: monthStart, $lt: monthEnd },
  };
  if (phongId) baseQuery.phongId = phongId;

  const query = { ...baseQuery };
  if (status) (query as Record<string, unknown>).status = status;

  const [data, total, successCount, failedCount] = await Promise.all([
    ZaloMessageLog.find(query)
      .populate('khachThueId', 'hoTen soDienThoai')
      .populate('phongId', 'maPhong')
      .populate('hoaDonId', 'maHoaDon')
      .sort({ ngayTao: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ZaloMessageLog.countDocuments(query),
    ZaloMessageLog.countDocuments({ ...baseQuery, status: 'sent' }),
    ZaloMessageLog.countDocuments({ ...baseQuery, status: { $in: ['failed', 'failed_permanent'] } }),
  ]);

  return NextResponse.json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    counters: { successCount, failedCount },
  });
}
