/**
 * Migration: chuyển hóa đơn / thanh toán hiện có sang sổ công nợ (GiaoDichCongNo).
 *
 *   npm run db:migrate-cong-no -- --dry-run   # chỉ báo cáo, không ghi DB
 *   npm run db:migrate-cong-no                # ghi thật
 *
 * Idempotent: chạy lại không tạo bút toán trùng (kiểm tra theo hoaDon / thanhToan).
 * Nên backup trước: npm run db:backup
 */
import mongoose from 'mongoose';
import dbConnect from '../src/lib/mongodb';
import HoaDon from '../src/models/HoaDon';
import ThanhToan from '../src/models/ThanhToan';
import GiaoDichCongNo from '../src/models/GiaoDichCongNo';
import '../src/models/KhachThue';
import { phanBoFIFO, recomputeCongNo, ButToanPhanBo } from '../src/lib/cong-no';

type OID = mongoose.Types.ObjectId;

const DRY_RUN = process.argv.includes('--dry-run');
const fmt = (n: number) => n.toLocaleString('vi-VN');

interface PlannedEntry {
  khachThue: OID;
  loai: 'hoaDon' | 'thanhToan';
  soTien: number;
  ngayGhiNhan: Date;
  hopDong: OID | null;
  phong: OID | null;
  hoaDon: OID | null;
  thanhToan: OID | null;
  moTa: string;
}

async function main() {
  await dbConnect();
  console.log(`== Migration công nợ ${DRY_RUN ? '(DRY RUN — không ghi DB)' : ''} ==`);

  const hoaDons = await HoaDon.find({})
    .select('maHoaDon thang nam khachThue hopDong phong tongTien daThanhToan ngayTao noKyTruoc')
    .lean<Array<{ _id: OID; maHoaDon: string; thang: number; nam: number; khachThue: OID; hopDong: OID; phong: OID; tongTien: number; daThanhToan: number; ngayTao: Date; noKyTruoc?: number }>>();
  const hoaDonById = new Map(hoaDons.map((h) => [String(h._id), h]));

  const thanhToans = await ThanhToan.find({})
    .select('khachThue hopDong hoaDon soTien ngayThanhToan')
    .lean<Array<{ _id: OID; khachThue?: OID; hopDong?: OID; hoaDon?: OID; soTien: number; ngayThanhToan: Date }>>();

  const daCoHoaDon = new Set(
    (await GiaoDichCongNo.find({ loai: 'hoaDon', hoaDon: { $ne: null } }).select('hoaDon').lean<Array<{ hoaDon: OID }>>())
      .map((b) => String(b.hoaDon)),
  );
  const daCoThanhToan = new Set(
    (await GiaoDichCongNo.find({ loai: 'thanhToan', thanhToan: { $ne: null } }).select('thanhToan').lean<Array<{ thanhToan: OID }>>())
      .map((b) => String(b.thanhToan)),
  );

  const planned: PlannedEntry[] = [];
  const thanhToanCanGanKhach: Array<{ id: OID; khachThue: OID; hopDong: OID | null }> = [];
  const canhBao: string[] = [];

  for (const hd of hoaDons) {
    if (daCoHoaDon.has(String(hd._id)) || !hd.tongTien) continue;
    planned.push({
      khachThue: hd.khachThue,
      loai: 'hoaDon',
      soTien: hd.tongTien,
      ngayGhiNhan: hd.ngayTao ?? new Date(),
      hopDong: hd.hopDong ?? null,
      phong: hd.phong ?? null,
      hoaDon: hd._id,
      thanhToan: null,
      moTa: `Hóa đơn ${hd.maHoaDon} tháng ${hd.thang}/${hd.nam} (migration)`,
    });
  }

  for (const tt of thanhToans) {
    const hd = tt.hoaDon ? hoaDonById.get(String(tt.hoaDon)) : undefined;
    const khachThue = tt.khachThue ?? hd?.khachThue;
    if (!khachThue) {
      canhBao.push(`Thanh toán ${tt._id} (${fmt(tt.soTien)}đ) không xác định được khách thuê — bỏ qua`);
      continue;
    }
    if (!tt.khachThue) thanhToanCanGanKhach.push({ id: tt._id, khachThue, hopDong: tt.hopDong ?? hd?.hopDong ?? null });
    if (daCoThanhToan.has(String(tt._id))) continue;
    planned.push({
      khachThue,
      loai: 'thanhToan',
      soTien: -tt.soTien,
      ngayGhiNhan: tt.ngayThanhToan ?? new Date(),
      hopDong: tt.hopDong ?? hd?.hopDong ?? null,
      phong: hd?.phong ?? null,
      hoaDon: null,
      thanhToan: tt._id,
      moTa: `Thu tiền${hd ? ` hóa đơn ${hd.maHoaDon}` : ''} (migration)`,
    });
  }

  // Mô phỏng phân bổ để báo cáo chênh lệch với daThanhToan đang lưu
  const existing = await GiaoDichCongNo.find({ daHuy: false })
    .select('khachThue soTien ngayGhiNhan ngayTao hoaDon')
    .lean<Array<{ _id: OID; khachThue: OID; soTien: number; ngayGhiNhan: Date; ngayTao: Date; hoaDon?: OID }>>();
  const theoKhach = new Map<string, ButToanPhanBo[]>();
  const push = (k: OID, b: ButToanPhanBo) => {
    const key = String(k);
    if (!theoKhach.has(key)) theoKhach.set(key, []);
    theoKhach.get(key)!.push(b);
  };
  existing.forEach((b) => push(b.khachThue, { id: String(b._id), soTien: b.soTien, ngayGhiNhan: b.ngayGhiNhan, ngayTao: b.ngayTao, hoaDon: b.hoaDon ? String(b.hoaDon) : null }));
  planned.forEach((b, i) => push(b.khachThue, { id: `new-${String(i).padStart(6, '0')}`, soTien: b.soTien, ngayGhiNhan: b.ngayGhiNhan, ngayTao: b.ngayGhiNhan, hoaDon: b.hoaDon ? String(b.hoaDon) : null }));

  const chenhLech: string[] = [];
  const soDuKhach: Array<[string, number]> = [];
  for (const [khach, list] of theoKhach) {
    const kq = phanBoFIFO(list);
    soDuKhach.push([khach, kq.soDu]);
    for (const hd of hoaDons.filter((h) => String(h.khachThue) === khach)) {
      const moi = Math.min(hd.tongTien, kq.daPhanBoTheoHoaDon.get(String(hd._id)) ?? 0);
      if (moi !== (hd.daThanhToan ?? 0)) {
        chenhLech.push(`  ${hd.maHoaDon} (${hd.thang}/${hd.nam}): đang lưu đã trả ${fmt(hd.daThanhToan ?? 0)}đ → theo sổ công nợ ${fmt(moi)}đ`);
      }
    }
  }

  console.log(`Hóa đơn: ${hoaDons.length} (sẽ tạo ${planned.filter((p) => p.loai === 'hoaDon').length} bút toán)`);
  console.log(`Thanh toán: ${thanhToans.length} (sẽ tạo ${planned.filter((p) => p.loai === 'thanhToan').length} bút toán, gán khách cho ${thanhToanCanGanKhach.length})`);
  console.log(`Khách có phát sinh: ${theoKhach.size}; đang nợ: ${soDuKhach.filter(([, s]) => s > 0).length}; có tiền thừa: ${soDuKhach.filter(([, s]) => s < 0).length}`);
  if (canhBao.length) console.log(`\nCảnh báo:\n  ${canhBao.join('\n  ')}`);
  console.log(chenhLech.length
    ? `\nHóa đơn có "đã thanh toán" thay đổi sau migration (${chenhLech.length}):\n${chenhLech.join('\n')}`
    : '\nKhông có hóa đơn nào thay đổi số đã thanh toán.');

  if (DRY_RUN) {
    console.log('\nDRY RUN: không ghi gì vào DB.');
    return;
  }

  for (const t of thanhToanCanGanKhach) {
    await ThanhToan.updateOne({ _id: t.id }, { $set: { khachThue: t.khachThue, ...(t.hopDong ? { hopDong: t.hopDong } : {}) } });
  }
  if (planned.length) await GiaoDichCongNo.insertMany(planned);
  await HoaDon.updateMany({ noKyTruoc: { $exists: false } }, { $set: { noKyTruoc: 0 } });
  await HoaDon.updateMany({ tongCanThanhToan: { $exists: false } }, [{ $set: { tongCanThanhToan: '$tongTien' } }]);

  for (const khach of theoKhach.keys()) await recomputeCongNo(khach);
  console.log(`\nĐã ghi ${planned.length} bút toán và tính lại công nợ cho ${theoKhach.size} khách.`);
}

main()
  .then(() => mongoose.disconnect())
  .catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
  });
