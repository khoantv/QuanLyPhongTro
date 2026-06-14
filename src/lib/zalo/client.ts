import { ZaloApiError, mapZaloErrorCode } from './errors';
import { getAccessToken, refreshAccessToken } from './token';
import type { ZaloMessagePayload } from './template';

const ZALO_BASE_URL = 'https://openapi.zalo.me/v3.0/oa';

interface ZaloApiResponse {
  error: number;
  message?: string;
  data?: { message_id?: string; [k: string]: unknown };
}

/**
 * Gửi tin OA template (consultation_request / transaction_order...).
 * Auto-retry 1 lần khi gặp -216 (token expired) bằng cách refresh token.
 */
export async function sendOaMessage(
  payload: ZaloMessagePayload,
  attempt = 0
): Promise<{ messageId: string | null; raw: ZaloApiResponse }> {
  const token = await getAccessToken();

  const res = await fetch(`${ZALO_BASE_URL}/message/cs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      access_token: token,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({ error: -1, message: 'Invalid JSON response' })) as ZaloApiResponse;

  if (data.error === 0) {
    return { messageId: data.data?.message_id || null, raw: data };
  }

  const errorCode = mapZaloErrorCode(data.error);

  // Token expired: refresh và retry 1 lần
  if (errorCode === 'access_token_expired' && attempt === 0) {
    await refreshAccessToken();
    return sendOaMessage(payload, attempt + 1);
  }

  throw new ZaloApiError(data.message || `Zalo error ${data.error}`, {
    errorCode,
    zaloRawCode: data.error,
    responsePayload: data as unknown as Record<string, unknown>,
  });
}
