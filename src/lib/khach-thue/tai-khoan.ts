import mongoose from 'mongoose';
import HopDong from '@/models/HopDong';
import HoaDon from '@/models/HoaDon';
import ThanhToan from '@/models/ThanhToan';
import GiaoDichCongNo from '@/models/GiaoDichCongNo';
import SuCo from '@/models/SuCo';
import PhuongTien from '@/models/PhuongTien';

type Id = string | mongoose.Types.ObjectId;

const dieuKienHopDongCuaKhach = (id: Id) => ({ $or: [{ khachThueId: id }, { nguoiDaiDien: id }] });

/**
 * Lý do khách thuê không được đăng nhập (null = được phép).
 * - Bị quản lý khóa thủ công (khoaTaiKhoan).
 * - Đã trả phòng: từng có hợp đồng nhưng hiện không còn hợp đồng nào đang hoạt động.
 *   Khách thuê lại (có hợp đồng mới đang hoạt động) sẽ tự đăng nhập lại được.
 */
export async function lyDoKhongDuocDangNhap(khachThue: { _id: Id; khoaTaiKhoan?: boolean }): Promise<string | null> {
  if (khachThue.khoaTaiKhoan) {
    return 'Tài khoản đã bị khóa. Vui lòng liên hệ quản lý.';
  }
  const dieuKien = dieuKienHopDongCuaKhach(khachThue._id);
  const [dangThue, tungThue] = await Promise.all([
    HopDong.exists({ ...dieuKien, trangThai: 'hoatDong' }),
    HopDong.exists(dieuKien),
  ]);
  if (!dangThue && tungThue) {
    return 'Bạn đã trả phòng nên tài khoản không còn đăng nhập được. Vui lòng liên hệ quản lý nếu cần hỗ trợ.';
  }
  return null;
}

/** Đếm dữ liệu đang tham chiếu tới khách thuê — dùng để chặn xóa làm mất lịch sử. */
export async function demDuLieuLienQuan(id: Id) {
  const [hopDong, hoaDon, thanhToan, congNo, suCo, phuongTien] = await Promise.all([
    HopDong.countDocuments(dieuKienHopDongCuaKhach(id)),
    HoaDon.countDocuments({ khachThue: id }),
    ThanhToan.countDocuments({ khachThue: id }),
    GiaoDichCongNo.countDocuments({ khachThue: id }),
    SuCo.countDocuments({ khachThue: id }),
    PhuongTien.countDocuments({ khachThue: id }),
  ]);
  return { hopDong, hoaDon, thanhToan, congNo, suCo, phuongTien };
}

const NHAN_DU_LIEU: Record<keyof Awaited<ReturnType<typeof demDuLieuLienQuan>>, string> = {
  hopDong: 'hợp đồng',
  hoaDon: 'hóa đơn',
  thanhToan: 'thanh toán',
  congNo: 'giao dịch công nợ',
  suCo: 'sự cố',
  phuongTien: 'phương tiện',
};

/** "3 hợp đồng, 5 hóa đơn" — rỗng nếu không có gì */
export function moTaDuLieuLienQuan(dem: Awaited<ReturnType<typeof demDuLieuLienQuan>>): string {
  return (Object.keys(dem) as Array<keyof typeof dem>)
    .filter((k) => dem[k] > 0)
    .map((k) => `${dem[k]} ${NHAN_DU_LIEU[k]}`)
    .join(', ');
}
