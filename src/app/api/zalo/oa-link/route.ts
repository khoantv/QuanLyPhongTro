import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * Trả về link Zalo OA + URL QR (dùng QuickChart hoặc Zalo permalink + qrserver.com).
 * Khách bấm link → vào trang OA → bấm "Quan tâm" → webhook follow trigger.
 */
export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const oaId = process.env.ZALO_OA_APP_ID;
  const oaUid = process.env.ZALO_OA_UID; // optional — uid hiển thị trên zalo.me/<uid>
  const permalink = oaUid
    ? `https://zalo.me/${oaUid}`
    : (oaId ? `https://zalo.me/${oaId}` : '');

  if (!permalink) {
    return NextResponse.json({
      success: false,
      message: 'Chưa cấu hình ZALO_OA_UID hoặc ZALO_OA_APP_ID trong env',
    }, { status: 400 });
  }

  // QR free từ qrserver.com (không cần thư viện)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(permalink)}&size=300x300`;

  return NextResponse.json({
    success: true,
    data: { permalink, qrUrl },
  });
}
