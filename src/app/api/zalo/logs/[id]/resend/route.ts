import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import ZaloMessageLog from '@/models/ZaloMessageLog';
import HoaDon from '@/models/HoaDon';
import KhachThue from '@/models/KhachThue';
import { getCaiDatHoaDonLean } from '@/lib/cai-dat';
import { sendInvoiceMessage } from '@/lib/zalo';

function isPriviledged(role?: string | null) {
  return role === 'admin' || role === 'chuNha';
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (!isPriviledged((session.user as { role?: string }).role)) {
    return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 403 });
  }

  await dbConnect();
  const { id } = await params;

  const log = await ZaloMessageLog.findById(id);
  if (!log) return NextResponse.json({ message: 'Log không tồn tại' }, { status: 404 });
  if (!log.hoaDonId) {
    return NextResponse.json({ message: 'Log không gắn hóa đơn, không thể resend' }, { status: 400 });
  }

  const hoaDon = await HoaDon.findById(log.hoaDonId).lean() as unknown as Record<string, unknown> | null;
  if (!hoaDon) return NextResponse.json({ message: 'Hóa đơn gốc đã bị xóa' }, { status: 404 });

  const khachThue = await KhachThue.findById(hoaDon.khachThue).lean() as unknown as { _id: unknown; hoTen: string; zaloUserId?: string } | null;
  if (!khachThue) return NextResponse.json({ message: 'Khách thuê không tồn tại' }, { status: 404 });

  const settings = await getCaiDatHoaDonLean();

  // Reset retry state
  log.retryCount = 0;
  log.status = 'queued';
  log.errorCode = null;
  log.errorMessage = null;
  log.nextRetryAt = null;
  await log.save();

  const updated = await sendInvoiceMessage({
    hoaDon: hoaDon as unknown as Parameters<typeof sendInvoiceMessage>[0]['hoaDon'],
    khachThue: { ...khachThue, _id: String(khachThue._id) } as Parameters<typeof sendInvoiceMessage>[0]['khachThue'],
    settings,
    trigger: 'manual',
    recipientType: log.recipientType,
    recipientZaloUserId: log.recipientZaloUserId,
    phongId: log.phongId ? String(log.phongId) : null,
    existingLogId: String(log._id),
    tenNhaTro: (settings as { tenNhaTro?: string }).tenNhaTro || 'Nhà trọ',
  });

  return NextResponse.json({ success: true, data: updated });
}
