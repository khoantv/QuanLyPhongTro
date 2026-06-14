import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/mongodb';
import KhachThue from '@/models/KhachThue';

/**
 * Verify webhook signature từ Zalo OA.
 * Zalo gửi header `X-ZEvent-Signature` = sha256={hex} của raw body + secret.
 */
function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = process.env.ZALO_OA_SECRET_KEY;
  if (!secret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  // Constant-time compare để chống timing attack
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

interface ZaloEvent {
  app_id?: string;
  event_name?: string; // 'follow', 'unfollow', 'user_send_text', ...
  oa_id?: string;
  follower?: { id?: string; phone?: string };
  user_id?: string;
  user_id_by_app?: string;
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: string;
  message?: { msg_id?: string; text?: string };
  // Có thể chứa info phone nếu user đã cấp permission
  followers?: Array<{ user_id?: string }>;
  // Một số event có nested user info
  user?: { id?: string; phone?: string };
}

/**
 * Chuẩn hóa số điện thoại VN: bỏ '+84' / '84' prefix, prepend '0'.
 * Vd: "+84987654321" → "0987654321", "84987654321" → "0987654321".
 */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('84')) return '0' + digits.slice(2);
  if (digits.startsWith('0')) return digits;
  return digits;
}

/**
 * Tìm khách thuê theo số điện thoại (chuẩn hóa cả 2 phía).
 * Trả về document đầu tiên match, hoặc null.
 */
async function findKhachThueByPhone(rawPhone: string) {
  const normalized = normalizePhone(rawPhone);
  if (!normalized || normalized.length < 9) return null;
  return KhachThue.findOne({ soDienThoai: normalized });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-zevent-signature');

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
  }

  let event: ZaloEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  await dbConnect();

  const userId = event.follower?.id || event.user_id || event.sender?.id || event.user?.id;
  const phone = event.follower?.phone || event.user?.phone;

  try {
    switch (event.event_name) {
      case 'follow': {
        // 1. Nếu có phone → match khách thuê đã có và link zaloUserId
        if (phone && userId) {
          const kt = await findKhachThueByPhone(phone);
          if (kt) {
            kt.zaloUserId = userId;
            kt.daQuanTamOA = true;
            await kt.save();
            break;
          }
        }
        // 2. Fallback: khách đã có zaloUserId này từ trước → chỉ set flag
        if (userId) {
          await KhachThue.updateMany(
            { zaloUserId: userId },
            { $set: { daQuanTamOA: true } }
          );
        }
        break;
      }
      case 'unfollow': {
        if (userId) {
          await KhachThue.updateMany(
            { zaloUserId: userId },
            { $set: { daQuanTamOA: false } }
          );
        }
        break;
      }
      case 'user_send_text': {
        // Khách gửi tin đầu tiên — có thể parse text để map.
        // Convention: khách gửi "MaKhach: <số điện thoại>" để bind.
        const text = event.message?.text?.trim() || '';
        const phoneMatch = text.match(/(\+?84|0)\d{8,10}/);
        if (phoneMatch && userId) {
          const kt = await findKhachThueByPhone(phoneMatch[0]);
          if (kt && !kt.zaloUserId) {
            kt.zaloUserId = userId;
            kt.daQuanTamOA = true;
            await kt.save();
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    // Vẫn trả 200 để Zalo không retry vô hạn
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  // Zalo verify URL: trả 200 OK
  return NextResponse.json({ success: true, message: 'Zalo webhook endpoint ready' });
}
