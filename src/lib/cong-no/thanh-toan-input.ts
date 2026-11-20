import mongoose from 'mongoose';
import HoaDon from '@/models/HoaDon';
import KhachThue from '@/models/KhachThue';
import { timHopDongCuaKhach, hoaDonMoCuaKhach } from './index';

export type PhuongThucThanhToan = 'tienMat' | 'chuyenKhoan' | 'viDienTu';

export interface ThanhToanBody {
  khachThueId?: string;
  hoaDonId?: string | null;
  soTien?: number;
  phuongThuc?: PhuongThucThanhToan;
  thongTinChuyenKhoan?: { nganHang: string; soGiaoDich: string };
  ngayThanhToan?: string;
  ghiChu?: string;
  anhBienLai?: string;
  xuLyTienThua?: 'truKySau' | 'khongTru' | null;
}

export interface ThanhToanResolved {
  khachThue: mongoose.Types.ObjectId;
  hopDong: mongoose.Types.ObjectId | null;
  hoaDon: mongoose.Types.ObjectId | null;
  soTien: number;
  phuongThuc: PhuongThucThanhToan;
  thongTinChuyenKhoan?: { nganHang: string; soGiaoDich: string };
  ngayThanhToan: Date;
  ghiChu?: string;
  anhBienLai?: string;
  xuLyTienThua: 'truKySau' | 'khongTru' | null;
}

export class ThanhToanInputError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const isId = (v: unknown): v is string => typeof v === 'string' && mongoose.Types.ObjectId.isValid(v);

/**
 * Chuẩn hóa body thanh toán. Nhận `khachThueId` hoặc `hoaDonId` (khi đó lấy khách từ hóa đơn).
 * Không giới hạn số tiền theo số còn nợ — phần thừa do sổ công nợ xử lý.
 */
export async function resolveThanhToanInput(body: ThanhToanBody): Promise<ThanhToanResolved> {
  const soTien = Math.round(Number(body.soTien));
  if (!Number.isFinite(soTien) || soTien <= 0) throw new ThanhToanInputError('Số tiền phải lớn hơn 0');

  const phuongThuc = body.phuongThuc;
  if (!phuongThuc || !['tienMat', 'chuyenKhoan', 'viDienTu'].includes(phuongThuc)) {
    throw new ThanhToanInputError('Phương thức thanh toán không hợp lệ');
  }
  if (phuongThuc === 'chuyenKhoan' && (!body.thongTinChuyenKhoan?.nganHang || !body.thongTinChuyenKhoan?.soGiaoDich)) {
    throw new ThanhToanInputError('Thông tin chuyển khoản là bắt buộc');
  }

  let khachThue: mongoose.Types.ObjectId | null = null;
  let hopDong: mongoose.Types.ObjectId | null = null;
  let hoaDon: mongoose.Types.ObjectId | null = null;

  if (body.hoaDonId) {
    if (!isId(body.hoaDonId)) throw new ThanhToanInputError('Hóa đơn không hợp lệ');
    const hd = await HoaDon.findById(body.hoaDonId).select('khachThue hopDong').lean<{ _id: mongoose.Types.ObjectId; khachThue: mongoose.Types.ObjectId; hopDong: mongoose.Types.ObjectId } | null>();
    if (!hd) throw new ThanhToanInputError('Hóa đơn không tồn tại', 404);
    hoaDon = hd._id;
    hopDong = hd.hopDong;
    khachThue = hd.khachThue;
    if (body.khachThueId && String(body.khachThueId) !== String(hd.khachThue)) {
      throw new ThanhToanInputError('Hóa đơn không thuộc khách thuê đã chọn');
    }
  } else if (body.khachThueId) {
    if (!isId(body.khachThueId)) throw new ThanhToanInputError('Khách thuê không hợp lệ');
    const kt = await KhachThue.exists({ _id: body.khachThueId });
    if (!kt) throw new ThanhToanInputError('Khách thuê không tồn tại', 404);
    khachThue = new mongoose.Types.ObjectId(body.khachThueId);
    const hdMo = await hoaDonMoCuaKhach(khachThue);
    if (hdMo.length) {
      hoaDon = hdMo[0]._id;
      hopDong = (hdMo[0].hopDong as mongoose.Types.ObjectId) ?? null;
    }
  } else {
    throw new ThanhToanInputError('Vui lòng chọn khách thuê hoặc hóa đơn');
  }

  if (!hopDong) hopDong = (await timHopDongCuaKhach(khachThue))?._id ?? null;

  const ngayThanhToan = body.ngayThanhToan ? new Date(body.ngayThanhToan) : new Date();
  if (Number.isNaN(ngayThanhToan.getTime())) throw new ThanhToanInputError('Ngày thanh toán không hợp lệ');

  const xuLyTienThua = body.xuLyTienThua === 'khongTru' || body.xuLyTienThua === 'truKySau' ? body.xuLyTienThua : null;

  return {
    khachThue,
    hopDong,
    hoaDon,
    soTien,
    phuongThuc,
    thongTinChuyenKhoan: phuongThuc === 'chuyenKhoan' ? body.thongTinChuyenKhoan : undefined,
    ngayThanhToan,
    ghiChu: body.ghiChu,
    anhBienLai: body.anhBienLai,
    xuLyTienThua,
  };
}
