export class ZaloConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZaloConfigError';
  }
}

export class ZaloApiError extends Error {
  errorCode: string;
  zaloRawCode: number | null;
  responsePayload: Record<string, unknown> | null;

  constructor(message: string, opts: {
    errorCode: string;
    zaloRawCode?: number | null;
    responsePayload?: Record<string, unknown> | null;
  }) {
    super(message);
    this.name = 'ZaloApiError';
    this.errorCode = opts.errorCode;
    this.zaloRawCode = opts.zaloRawCode ?? null;
    this.responsePayload = opts.responsePayload ?? null;
  }
}

/**
 * Các errorCode mà cron retry KHÔNG nên thử lại — gửi mãi cũng fail.
 */
export const TERMINAL_ERROR_CODES = new Set<string>([
  'user_not_follower',
  'invalid_template',
  'access_denied',
  'invalid_recipient',
  'oa_quota_exceeded_permanent',
]);

/**
 * Map raw Zalo error code (number) → errorCode (string) hệ thống.
 * Tham khảo: https://developers.zalo.me/docs/api/official-account-api/phu-luc/danh-sach-loi
 */
export function mapZaloErrorCode(rawCode: number): string {
  switch (rawCode) {
    case -32:
      return 'user_not_follower';
    case -216:
    case -213:
      return 'access_token_expired';
    case -201:
    case -202:
      return 'invalid_template';
    case -224:
      return 'oa_quota_exceeded';
    case -238:
      return 'rate_limit';
    case -239:
      return 'message_outside_allowed_hours';
    case -114:
    case -115:
      return 'access_denied';
    default:
      return rawCode === 0 ? 'ok' : `zalo_${rawCode}`;
  }
}
