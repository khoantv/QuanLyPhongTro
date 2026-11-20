import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import HoaDon from '@/models/HoaDon';
import { soDuNhieuKhach } from '@/lib/cong-no';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Phong from '@/models/Phong';
import ToaNha from '@/models/ToaNha';
import HopDong from '@/models/HopDong';
import '@/models/KhachThue';
import { updatePhongStatus } from '@/lib/status-utils';
import { z } from 'zod';

const phongSchema = z.object({
  maPhong: z.string().min(1, 'Mã phòng là bắt buộc'),
  toaNha: z.string().min(1, 'Tòa nhà là bắt buộc'),
  tang: z.number().min(0, 'Tầng phải lớn hơn hoặc bằng 0'),
  dienTich: z.number().min(1, 'Diện tích phải lớn hơn 0'),
  giaThue: z.number().min(0, 'Giá thuê phải lớn hơn hoặc bằng 0'),
  tienCoc: z.number().min(0, 'Tiền cọc phải lớn hơn hoặc bằng 0'),
  moTa: z.string().optional(),
  anhPhong: z.array(z.string()).optional(),
  tienNghi: z.array(z.string()).optional(),
  soNguoiToiDa: z.number().min(1, 'Số người tối đa phải lớn hơn 0').max(10, 'Số người tối đa không được quá 10'),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const toaNha = searchParams.get('toaNha') || '';
    const trangThai = searchParams.get('trangThai') || '';

    const query: Record<string, unknown> = {};
    
    if (search) {
      query.$or = [
        { maPhong: { $regex: search, $options: 'i' } },
        { moTa: { $regex: search, $options: 'i' } },
      ];
    }
    
    if (toaNha) {
      query.toaNha = toaNha;
    }
    
    if (trangThai) {
      query.trangThai = trangThai;
    }

    const now = new Date();
    const collation = { locale: 'vi', numericOrdering: true };

    // 1. Đồng bộ trạng thái phòng theo hợp đồng — gộp cho mọi phòng trong phạm vi lọc (không tính
    //    bộ lọc trạng thái, để lọc theo trạng thái dùng giá trị đã cập nhật). Quy tắc giống calculatePhongStatus.
    const { trangThai: _boLocTrangThai, ...queryKhongTrangThai } = query;
    void _boLocTrangThai;
    const phamVi = await Phong.find(queryKhongTrangThai).select('_id trangThai').lean<Array<{ _id: mongoose.Types.ObjectId; trangThai: string }>>();
    const hopDongPhamVi = await HopDong.find({ phong: { $in: phamVi.map((p) => p._id) }, trangThai: 'hoatDong' })
      .select('phong ngayBatDau ngayKetThuc')
      .lean<Array<{ phong: mongoose.Types.ObjectId; ngayBatDau: Date; ngayKetThuc: Date }>>();
    const trangThaiMoi = new Map<string, 'dangThue' | 'daDat' | 'trong'>();
    for (const hd of hopDongPhamVi) {
      const id = String(hd.phong);
      if (hd.ngayBatDau <= now && hd.ngayKetThuc >= now) trangThaiMoi.set(id, 'dangThue');
      else if (hd.ngayBatDau > now && trangThaiMoi.get(id) !== 'dangThue') trangThaiMoi.set(id, 'daDat');
    }
    const capNhatTrangThai = phamVi
      .map((p) => ({ p, moi: trangThaiMoi.get(String(p._id)) ?? 'trong' }))
      .filter(({ p, moi }) => p.trangThai !== moi)
      .map(({ p, moi }) => ({ updateOne: { filter: { _id: p._id }, update: { $set: { trangThai: moi } } } }));
    if (capNhatTrangThai.length) await Phong.bulkWrite(capNhatTrangThai);

    // 2. Trang phòng cần hiển thị + tổng số (song song)
    const [phongTrang, total] = await Promise.all([
      Phong.find(query)
        .populate('toaNha', 'tenToaNha diaChi')
        .sort({ maPhong: 1 })
        .collation(collation)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<Array<Record<string, unknown> & { _id: mongoose.Types.ObjectId }>>(),
      Phong.countDocuments(query),
    ]);
    const phongIds = phongTrang.map((p) => p._id);

    // 3. Hợp đồng hiện tại của các phòng trong trang — một truy vấn
    type HopDongHienTai = Record<string, unknown> & {
      _id: mongoose.Types.ObjectId;
      phong: mongoose.Types.ObjectId;
      ngayBatDau: Date;
      nguoiDaiDien?: { _id: mongoose.Types.ObjectId } | null;
    };
    const hopDongs = await HopDong.find({
      phong: { $in: phongIds },
      trangThai: 'hoatDong',
      ngayBatDau: { $lte: now },
      ngayKetThuc: { $gte: now },
    })
      .populate('khachThueId', 'hoTen soDienThoai')
      .populate('nguoiDaiDien', 'hoTen soDienThoai')
      .sort({ ngayBatDau: -1 })
      .lean<HopDongHienTai[]>();
    const hopDongTheoPhong = new Map<string, HopDongHienTai>();
    for (const hd of hopDongs) if (!hopDongTheoPhong.has(String(hd.phong))) hopDongTheoPhong.set(String(hd.phong), hd);
    const hopDongIds = [...hopDongTheoPhong.values()].map((hd) => hd._id);

    // 4. Hóa đơn gần nhất của mỗi hợp đồng + công nợ người đại diện (song song, mỗi loại một truy vấn)
    const daiDienIds = [...hopDongTheoPhong.values()]
      .map((hd) => hd.nguoiDaiDien?._id?.toString())
      .filter((x): x is string => Boolean(x));
    const [hoaDonGanNhat, congNo] = await Promise.all([
      hopDongIds.length
        ? HoaDon.aggregate<{ _id: mongoose.Types.ObjectId; hoaDon: Record<string, unknown> }>([
          { $match: { hopDong: { $in: hopDongIds } } },
          { $sort: { ngayTao: -1 } },
          {
            $group: {
              _id: '$hopDong',
              hoaDon: {
                $first: {
                  _id: '$_id', maHoaDon: '$maHoaDon', thang: '$thang', nam: '$nam', loaiHoaDon: '$loaiHoaDon',
                  tongTien: '$tongTien', conLai: '$conLai', trangThai: '$trangThai', kyBatDau: '$kyBatDau', kyKetThuc: '$kyKetThuc',
                },
              },
            },
          },
        ])
        : Promise.resolve([]),
      daiDienIds.length ? soDuNhieuKhach(daiDienIds) : Promise.resolve({} as Record<string, number>),
    ]);
    const hoaDonTheoHopDong = new Map(hoaDonGanNhat.map((x) => [String(x._id), x.hoaDon]));

    const phongListWithContracts = phongTrang.map((phong) => {
      const hd = hopDongTheoPhong.get(String(phong._id));
      const daiDien = hd?.nguoiDaiDien?._id?.toString();
      return {
        ...phong,
        hopDongHienTai: hd
          ? {
            ...hd,
            hoaDonGanNhat: hoaDonTheoHopDong.get(String(hd._id)) ?? null,
            ...(daiDien ? { soDuCongNo: congNo[daiDien] ?? 0 } : {}),
          }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: phongListWithContracts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error('Error fetching phong:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = phongSchema.parse(body);

    await dbConnect();

    // Check if toa nha exists
    const toaNha = await ToaNha.findById(validatedData.toaNha);
    if (!toaNha) {
      return NextResponse.json(
        { message: 'Tòa nhà không tồn tại' },
        { status: 400 }
      );
    }

    const newPhong = new Phong({
      ...validatedData,
      anhPhong: validatedData.anhPhong || [],
      tienNghi: validatedData.tienNghi || [],
      trangThai: 'trong', // Mặc định là trống, sẽ được cập nhật tự động
    });

    await newPhong.save();

    // Cập nhật trạng thái dựa trên hợp đồng
    await updatePhongStatus(newPhong._id.toString());

    return NextResponse.json({
      success: true,
      data: newPhong,
      message: 'Phòng đã được tạo thành công',
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Error creating phong:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
