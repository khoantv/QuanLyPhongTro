import dbConnect from '@/lib/mongodb';
import ZaloMessageLog, { IZaloMessageLog, ZaloLogTrigger, ZaloRecipientType } from '@/models/ZaloMessageLog';
import { sendOaMessage } from './client';
import { isWithinAllowedHours, nextAllowedTime } from './time-gate';
import { renderInvoiceCard } from './template';
import { ZaloApiError, ZaloConfigError, TERMINAL_ERROR_CODES } from './errors';

interface SendInvoiceParams {
  hoaDon: Parameters<typeof renderInvoiceCard>[0];
  khachThue: Parameters<typeof renderInvoiceCard>[1] & { _id?: string };
  settings: Parameters<typeof renderInvoiceCard>[2];
  trigger: ZaloLogTrigger;
  recipientType: ZaloRecipientType;
  recipientZaloUserId: string;
  phongId?: string | null;
  tenNhaTro?: string;
  /** Khi resend lại 1 entry log có sẵn — truyền _id để cập nhật thay vì tạo mới */
  existingLogId?: string | null;
}

function baseUrl(): string {
  return process.env.NEXTAUTH_URL?.replace(/\/$/, '') || 'http://localhost:3000';
}

/**
 * Orchestrator gửi tin Zalo:
 * 1. Check khung giờ → nếu out → tạo/cập nhật log status=queued với nextRetryAt
 * 2. Gọi Zalo API → tạo/cập nhật log với status sent / failed / failed_permanent
 * Mọi nhánh đều trả về 1 IZaloMessageLog đã persist.
 */
export async function sendInvoiceMessage(params: SendInvoiceParams): Promise<IZaloMessageLog> {
  await dbConnect();

  const {
    hoaDon, khachThue, settings, trigger,
    recipientType, recipientZaloUserId,
    phongId = null, tenNhaTro, existingLogId = null,
  } = params;

  const recipient = { ...khachThue, zaloUserId: recipientZaloUserId };
  const payload = renderInvoiceCard(hoaDon, recipient, settings, { baseUrl: baseUrl(), tenNhaTro });

  // Helper cập-nhật-hay-tạo-mới
  async function upsertLog(patch: Partial<IZaloMessageLog>): Promise<IZaloMessageLog> {
    const baseDoc: Partial<IZaloMessageLog> = {
      hoaDonId: (hoaDon._id as unknown as IZaloMessageLog['hoaDonId']) || null,
      khachThueId: (khachThue._id as unknown as IZaloMessageLog['khachThueId']) || null,
      phongId: (phongId as unknown as IZaloMessageLog['phongId']) || null,
      recipientType,
      recipientZaloUserId,
      trigger,
      requestPayload: payload as unknown as Record<string, unknown>,
      ...patch,
    };

    if (existingLogId) {
      const updated = await ZaloMessageLog.findByIdAndUpdate(
        existingLogId,
        { ...baseDoc, $inc: trigger === 'retry' ? { retryCount: 1 } : {} },
        { new: true }
      );
      if (updated) return updated as IZaloMessageLog;
    }
    return await ZaloMessageLog.create(baseDoc) as IZaloMessageLog;
  }

  // 1. Time-gate check
  if (!isWithinAllowedHours()) {
    return upsertLog({
      status: 'queued',
      sentAt: null,
      errorCode: 'message_outside_allowed_hours',
      errorMessage: 'Ngoài khung giờ 6h-22h. Sẽ tự động gửi lại khi đến giờ.',
      nextRetryAt: nextAllowedTime(),
    });
  }

  // 2. Recipient missing
  if (!recipientZaloUserId) {
    return upsertLog({
      status: 'skipped',
      errorCode: 'khach_chua_quan_tam_oa',
      errorMessage: 'Người nhận không có zaloUserId (chưa quan tâm OA)',
    });
  }

  // 3. Gọi Zalo
  try {
    const { messageId, raw } = await sendOaMessage(payload);
    return upsertLog({
      status: 'sent',
      sentAt: new Date(),
      zaloMessageId: messageId,
      errorCode: null,
      errorMessage: null,
      responsePayload: raw as unknown as Record<string, unknown>,
      nextRetryAt: null,
    });
  } catch (err) {
    if (err instanceof ZaloConfigError) {
      return upsertLog({
        status: 'failed',
        errorCode: 'config_error',
        errorMessage: err.message,
        nextRetryAt: null,
      });
    }
    if (err instanceof ZaloApiError) {
      const terminal = TERMINAL_ERROR_CODES.has(err.errorCode);
      return upsertLog({
        status: terminal ? 'failed_permanent' : 'failed',
        errorCode: err.errorCode,
        errorMessage: err.message,
        responsePayload: err.responsePayload,
        nextRetryAt: terminal ? null : computeNextRetryAt(0),
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    return upsertLog({
      status: 'failed',
      errorCode: 'unknown',
      errorMessage: message,
      nextRetryAt: computeNextRetryAt(0),
    });
  }
}

/** Backoff: 5min, 15min, 60min */
export function computeNextRetryAt(retryCount: number): Date {
  const minutes = [5, 15, 60][Math.min(retryCount, 2)];
  return new Date(Date.now() + minutes * 60 * 1000);
}
