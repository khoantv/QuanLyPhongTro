import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import HoaDon from '@/models/HoaDon';
import KhachThue from '@/models/KhachThue';
import NguoiDung from '@/models/NguoiDung';
import { getCaiDatHoaDonLean } from '@/lib/cai-dat';
import { sendInvoiceMessage } from '@/lib/zalo';
import { z } from 'zod';

const bodySchema = z.object({
  hoaDonId: z.string().min(1, 'hoaDonId là bắt buộc'),
  mode: z.enum(['send', 'preview']).default('send'),
  overrideZaloUserId: z.string().optional(),
});

function isPriviledged(role?: string | null) {
  return role === 'admin' || role === 'chuNha';
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  if (!isPriviledged((session.user as { role?: string }).role)) {
    return NextResponse.json({ message: 'Không có quyền truy cập' }, { status: 403 });
  }

  try {
    const { hoaDonId, mode, overrideZaloUserId } = bodySchema.parse(await request.json());
    await dbConnect();

    const hoaDon = await HoaDon.findById(hoaDonId).lean() as unknown as Record<string, unknown> | null;
    if (!hoaDon) {
      return NextResponse.json({ message: 'Hóa đơn không tồn tại' }, { status: 404 });
    }

    const khachThue = await KhachThue.findById(hoaDon.khachThue).lean() as unknown as { _id: unknown; hoTen: string; zaloUserId?: string } | null;
    if (!khachThue) {
      return NextResponse.json({ message: 'Khách thuê không tồn tại' }, { status: 404 });
    }

    const settings = await getCaiDatHoaDonLean();

    // Recipient
    let recipientZaloUserId = '';
    let recipientType: 'tenant' | 'owner_preview';

    if (mode === 'preview') {
      recipientType = 'owner_preview';
      if (overrideZaloUserId) {
        recipientZaloUserId = overrideZaloUserId;
      } else {
        const owner = await NguoiDung.findById((session.user as { id: string }).id).lean() as unknown as { zaloUserId?: string } | null;
        recipientZaloUserId = owner?.zaloUserId || '';
      }
    } else {
      recipientType = 'tenant';
      recipientZaloUserId = khachThue.zaloUserId || '';
    }

    const log = await sendInvoiceMessage({
      hoaDon: hoaDon as unknown as Parameters<typeof sendInvoiceMessage>[0]['hoaDon'],
      khachThue: { ...khachThue, _id: String(khachThue._id) } as Parameters<typeof sendInvoiceMessage>[0]['khachThue'],
      settings,
      trigger: mode === 'preview' ? 'preview' : 'manual',
      recipientType,
      recipientZaloUserId,
      phongId: String((hoaDon as { phong?: unknown }).phong || ''),
      tenNhaTro: (settings as { tenNhaTro?: string }).tenNhaTro || 'Nhà trọ',
    });

    return NextResponse.json({ success: true, data: log });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ message: err.issues[0].message }, { status: 400 });
    }
    console.error('Error sending zalo invoice:', err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
