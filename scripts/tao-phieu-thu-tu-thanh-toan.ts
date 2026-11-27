/**
 * Tạo phiếu thu (module Thu/Chi) cho các thanh toán đã có từ trước khi có tính năng phiếu thu tự động.
 *
 *   npm run db:tao-phieu-thu -- --dry-run   # chỉ liệt kê, không ghi DB
 *   npm run db:tao-phieu-thu                # ghi thật
 *
 * Idempotent: thanh toán đã có phiếu thu (PhieuThuChi.thanhToan) thì bỏ qua.
 */
import mongoose from 'mongoose';
import dbConnect from '../src/lib/mongodb';
import ThanhToan from '../src/models/ThanhToan';
import PhieuThuChi from '../src/models/PhieuThuChi';
import { dongBoPhieuThu, lapNoiDungPhieuThu } from '../src/lib/phieu-thu-tu-dong';

const DRY_RUN = process.argv.includes('--dry-run');
// Chạy thử không được ghi gì — kể cả tạo index
if (DRY_RUN) mongoose.set('autoIndex', false);

(async () => {
  await dbConnect();
  const daCo = new Set((await PhieuThuChi.find({ thanhToan: { $type: 'objectId' } }).select('thanhToan').lean<Array<{ thanhToan: unknown }>>())
    .map((p) => String(p.thanhToan)));
  const thieu = (await ThanhToan.find({}).select('_id').sort({ ngayThanhToan: 1 }).lean<Array<{ _id: mongoose.Types.ObjectId }>>())
    .filter((t) => !daCo.has(String(t._id)));
  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Thanh toán chưa có phiếu thu: ${thieu.length} (đã có: ${daCo.size})`);
  let tong = 0;
  for (const t of thieu) {
    const nd = await lapNoiDungPhieuThu(t._id);
    if (!nd) continue;
    tong += nd.soTien;
    console.log(`  ${nd.ngayLapPhieu.toISOString().slice(0, 10)}  ${nd.soTien.toLocaleString('vi-VN').padStart(12)}đ  ${nd.noiDung}`);
    if (!DRY_RUN) await dongBoPhieuThu(t._id);
  }
  console.log(`Tổng: ${tong.toLocaleString('vi-VN')}đ${DRY_RUN ? ' — chưa ghi gì' : ' — đã tạo phiếu thu'}`);
  await mongoose.disconnect();
})().catch(async (e) => { console.error(e); await mongoose.disconnect(); process.exit(1); });
