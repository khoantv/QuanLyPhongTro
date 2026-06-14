import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import ZaloMessageLog from '@/models/ZaloMessageLog';
import HoaDon from '@/models/HoaDon';
import KhachThue from '@/models/KhachThue';
import { getCaiDatHoaDonLean } from '@/lib/cai-dat';
import { sendInvoiceMessage, TERMINAL_ERROR_CODES, computeNextRetryAt } from '@/lib/zalo';

const MAX_PER_RUN = 50;
const MAX_RETRY = 3;

/**
 * Cron endpoint: lấy log status=queued|failed với nextRetryAt <= now, retry từng cái.
 * Auth: header `x-cron-secret` khớp `CRON_SECRET` env hoặc Vercel cron tự inject.
 */
export async function POST(request: NextRequest) {
  // Auth — Vercel Cron tự gửi header Authorization với CRON_SECRET nếu được set
  const auth = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  await dbConnect();
  const now = new Date();

  const pending = await ZaloMessageLog.find({
    status: { $in: ['queued', 'failed'] },
    nextRetryAt: { $lte: now },
    retryCount: { $lt: MAX_RETRY },
    errorCode: { $nin: Array.from(TERMINAL_ERROR_CODES) },
    hoaDonId: { $ne: null },
  })
    .sort({ nextRetryAt: 1 })
    .limit(MAX_PER_RUN);

  const results: Array<{ id: string; status: string; errorCode?: string | null }> = [];

  const settings = await getCaiDatHoaDonLean();

  for (const log of pending) {
    try {
      const hoaDon = await HoaDon.findById(log.hoaDonId).lean() as unknown as Record<string, unknown> | null;
      if (!hoaDon) {
        log.status = 'failed_permanent';
        log.errorCode = 'hoa_don_deleted';
        log.errorMessage = 'Hóa đơn gốc đã bị xóa';
        log.nextRetryAt = null;
        await log.save();
        results.push({ id: String(log._id), status: 'failed_permanent', errorCode: 'hoa_don_deleted' });
        continue;
      }
      const khachThue = await KhachThue.findById(log.khachThueId).lean() as unknown as { _id: unknown; hoTen: string; zaloUserId?: string } | null;
      if (!khachThue) {
        log.status = 'failed_permanent';
        log.errorCode = 'khach_deleted';
        log.errorMessage = 'Khách thuê đã bị xóa';
        log.nextRetryAt = null;
        await log.save();
        results.push({ id: String(log._id), status: 'failed_permanent', errorCode: 'khach_deleted' });
        continue;
      }

      // Increment retry count BEFORE call để tránh loop nếu service throw bất ngờ
      log.retryCount += 1;
      await log.save();

      const updated = await sendInvoiceMessage({
        hoaDon: hoaDon as unknown as Parameters<typeof sendInvoiceMessage>[0]['hoaDon'],
        khachThue: { ...khachThue, _id: String(khachThue._id) } as Parameters<typeof sendInvoiceMessage>[0]['khachThue'],
        settings,
        trigger: 'retry',
        recipientType: log.recipientType,
        recipientZaloUserId: log.recipientZaloUserId,
        phongId: log.phongId ? String(log.phongId) : null,
        existingLogId: String(log._id),
        tenNhaTro: (settings as { tenNhaTro?: string }).tenNhaTro || 'Nhà trọ',
      });

      // Nếu vẫn fail và còn retry budget → set backoff
      if (updated.status === 'failed' && updated.retryCount < MAX_RETRY) {
        updated.nextRetryAt = computeNextRetryAt(updated.retryCount);
        await updated.save();
      } else if (updated.status === 'failed' && updated.retryCount >= MAX_RETRY) {
        updated.status = 'failed_permanent';
        updated.nextRetryAt = null;
        await updated.save();
      }

      results.push({ id: String(updated._id), status: updated.status, errorCode: updated.errorCode });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ id: String(log._id), status: 'error', errorCode: message });
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
  });
}

// Vercel Cron sends GET. Để wrapper an toàn:
export async function GET(request: NextRequest) {
  return POST(request);
}
