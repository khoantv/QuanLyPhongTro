/**
 * Phiếu thu tự động: mỗi lần thu tiền khách (ThanhToan) có đúng một phiếu thu trong module Thu/Chi,
 * liên kết qua PhieuThuChi.thanhToan. Sửa / xóa thanh toán thì phiếu thu được cập nhật / xóa theo.
 */
import mongoose from 'mongoose';
import ThanhToan from '@/models/ThanhToan';
import PhieuThuChi from '@/models/PhieuThuChi';
import DanhMucThuChi from '@/models/DanhMucThuChi';
import Phong from '@/models/Phong';
import '@/models/HoaDon';
import '@/models/HopDong';
import '@/models/KhachThue';
import { ensureDefaultThuChiCategories } from '@/lib/thu-chi-seed';

type OID = mongoose.Types.ObjectId;

interface ThanhToanDayDu {
  _id: OID;
  soTien: number;
  phuongThuc: 'tienMat' | 'chuyenKhoan' | 'viDienTu';
  ngayThanhToan: Date;
  ghiChu?: string;
  nguoiNhan?: OID | null;
  khachThue?: { hoTen: string } | null;
  hoaDon?: { maHoaDon: string; thang: number; nam: number; loaiHoaDon?: string; phong?: OID | null } | null;
  hopDong?: { phong?: OID | null } | null;
}

/** Nội dung phiếu thu sẽ tạo cho một thanh toán (không ghi DB). */
export async function lapNoiDungPhieuThu(thanhToanId: string | OID) {
  const tt = await ThanhToan.findById(thanhToanId)
    .populate('khachThue', 'hoTen')
    .populate('hoaDon', 'maHoaDon thang nam loaiHoaDon phong')
    .populate('hopDong', 'phong')
    .lean<ThanhToanDayDu | null>();
  if (!tt) return null;

  const phongId = tt.hoaDon?.phong ?? tt.hopDong?.phong ?? null;
  const phong = phongId
    ? await Phong.findById(phongId).select('maPhong toaNha').lean<{ maPhong: string; toaNha: OID } | null>()
    : null;
  const laChotPhong = tt.hoaDon?.loaiHoaDon === 'chotPhong';
  const noiDung = [
    laChotPhong ? 'Thu tiền kết thúc hợp đồng' : 'Thu tiền phòng',
    phong ? `P.${phong.maPhong}` : '',
    tt.hoaDon ? `HĐ ${tt.hoaDon.maHoaDon} (T${tt.hoaDon.thang}/${tt.hoaDon.nam})` : 'đóng trước',
    tt.ghiChu?.trim() ?? '',
  ].filter(Boolean).join(' — ');

  return {
    loai: 'thu' as const,
    soTien: tt.soTien,
    // Module thu/chi chỉ có tiền mặt / chuyển khoản; ví điện tử tính là chuyển khoản
    phuongThuc: tt.phuongThuc === 'tienMat' ? 'tienMat' as const : 'chuyenKhoan' as const,
    nguoiThanhToan: (tt.khachThue?.hoTen || 'Khách thuê').slice(0, 200),
    noiDung: noiDung.slice(0, 500),
    danhMucKey: laChotPhong ? 'thu-tien-ket-thuc-hop-dong' : 'thu-tien-hang-thang',
    ngayLapPhieu: tt.ngayThanhToan,
    toaNha: phong?.toaNha ?? null,
    nguoiTao: tt.nguoiNhan ?? null,
  };
}

/** Tạo hoặc cập nhật phiếu thu của một thanh toán. Idempotent. */
export async function dongBoPhieuThu(thanhToanId: string | OID) {
  const nd = await lapNoiDungPhieuThu(thanhToanId);
  if (!nd) return null;
  await ensureDefaultThuChiCategories();
  const danhMuc = await DanhMucThuChi.findOne({ key: nd.danhMucKey }).select('_id').lean<{ _id: OID } | null>();
  if (!danhMuc) throw new Error(`Thiếu danh mục thu/chi "${nd.danhMucKey}"`);
  const { danhMucKey: _key, ...data } = nd;
  void _key;
  return PhieuThuChi.findOneAndUpdate(
    { thanhToan: new mongoose.Types.ObjectId(String(thanhToanId)) },
    { $set: { ...data, danhMuc: danhMuc._id, tuDongTaoHangThang: false } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  );
}

export async function xoaPhieuThu(thanhToanId: string | OID) {
  return PhieuThuChi.deleteMany({ thanhToan: new mongoose.Types.ObjectId(String(thanhToanId)) });
}

/** Bọc lỗi: thanh toán đã ghi nhận thì không làm hỏng response — trả cảnh báo để hiển thị. */
export async function dongBoPhieuThuAnToan(thanhToanId: string | OID): Promise<string | null> {
  try {
    await dongBoPhieuThu(thanhToanId);
    return null;
  } catch (err) {
    console.error('Không tạo được phiếu thu tự động', thanhToanId, err);
    return 'Đã ghi nhận thanh toán nhưng chưa tạo được phiếu thu — thử sửa và lưu lại thanh toán.';
  }
}
