import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import { soDuNhieuKhach } from '@/lib/cong-no';

// GET /api/cong-no/tong-hop?ids=a,b,c — số dư công nợ của nhiều khách (bỏ trống ids = tất cả khách có phát sinh)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    await connectToDatabase();
    const ids = new URL(request.url).searchParams.get('ids');
    const list = ids ? ids.split(',').filter((x) => /^[a-f\d]{24}$/i.test(x)) : undefined;
    const data = await soDuNhieuKhach(list);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching cong no tong hop:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
