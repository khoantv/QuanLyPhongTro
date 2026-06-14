import dbConnect from '@/lib/mongodb';
import ZaloOAToken, { IZaloOAToken } from '@/models/ZaloOAToken';
import { ZaloConfigError } from './errors';

const ZALO_OAUTH_URL = 'https://oauth.zaloapp.com/v4/oa/access_token';

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

// Memory cache per-process. Cold start sẽ miss và đọc DB.
let cache: CachedToken | null = null;

function appId(): string {
  const v = process.env.ZALO_OA_APP_ID;
  if (!v) throw new ZaloConfigError('Thiếu ZALO_OA_APP_ID trong env');
  return v;
}

function secretKey(): string {
  const v = process.env.ZALO_OA_SECRET_KEY;
  if (!v) throw new ZaloConfigError('Thiếu ZALO_OA_SECRET_KEY trong env');
  return v;
}

/**
 * Lấy access token: ưu tiên cache → DB → env → refresh nếu hết hạn.
 */
export async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cache && cache.expiresAt > now + 60_000) {
    return cache.accessToken;
  }

  await dbConnect();
  let tokenDoc = await ZaloOAToken.findOne({ singleton: true }) as IZaloOAToken | null;

  // Lần đầu: seed từ env
  if (!tokenDoc) {
    const envAccess = process.env.ZALO_OA_ACCESS_TOKEN;
    const envRefresh = process.env.ZALO_OA_REFRESH_TOKEN;
    if (!envAccess || !envRefresh) {
      throw new ZaloConfigError('Chưa có Zalo OA token trong DB và env chưa cấu hình ZALO_OA_ACCESS_TOKEN/ZALO_OA_REFRESH_TOKEN');
    }
    tokenDoc = await ZaloOAToken.findOneAndUpdate(
      { singleton: true },
      {
        $setOnInsert: {
          singleton: true,
          accessToken: envAccess,
          refreshToken: envRefresh,
          expiresAt: new Date(now + 24 * 60 * 60 * 1000), // 24h
          lastRefreshAt: new Date(),
        },
      },
      { upsert: true, new: true }
    ) as IZaloOAToken;
  }

  // Còn hạn → cache & trả
  if (tokenDoc.expiresAt.getTime() > now + 60_000) {
    cache = { accessToken: tokenDoc.accessToken, expiresAt: tokenDoc.expiresAt.getTime() };
    return tokenDoc.accessToken;
  }

  // Hết hạn → refresh
  return refreshAccessToken();
}

/**
 * Force refresh token. Dùng khi gặp error -216 từ Zalo.
 */
export async function refreshAccessToken(): Promise<string> {
  await dbConnect();
  const tokenDoc = await ZaloOAToken.findOne({ singleton: true }) as IZaloOAToken | null;
  const refreshToken = tokenDoc?.refreshToken || process.env.ZALO_OA_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new ZaloConfigError('Không có refresh token để refresh');
  }

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    app_id: appId(),
    grant_type: 'refresh_token',
  });

  const res = await fetch(ZALO_OAUTH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'secret_key': secretKey(),
    },
    body: body.toString(),
  });

  const data = await res.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: string;
    error?: number;
    error_name?: string;
    error_description?: string;
  };

  if (!data.access_token || !data.refresh_token) {
    throw new ZaloConfigError(`Refresh token thất bại: ${data.error_name || data.error_description || JSON.stringify(data)}`);
  }

  const expiresInSec = parseInt(data.expires_in || '86400', 10);
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);

  await ZaloOAToken.findOneAndUpdate(
    { singleton: true },
    {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      lastRefreshAt: new Date(),
    },
    { upsert: true, new: true }
  );

  cache = { accessToken: data.access_token, expiresAt: expiresAt.getTime() };
  return data.access_token;
}

/** Cho test: clear in-memory cache */
export function _clearTokenCache() {
  cache = null;
}
