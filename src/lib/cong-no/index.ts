import mongoose from 'mongoose';
import GiaoDichCongNo, { IGiaoDichCongNo, LoaiGiaoDichCongNo } from '@/models/GiaoDichCongNo';
import HoaDon from '@/models/HoaDon';
import HopDong from '@/models/HopDong';
import { phanBoFIFO, tinhTienThua, tinhTrangThaiHoaDon } from './phan-bo';

export * from './phan-bo';

type Id = string | mongoose.Types.ObjectId;

const toId = (v: Id | null | undefined) => (v ? new mongoose.Types.ObjectId(String(v)) : null);

export interface GhiButToanInput {
  khachThue: Id;
  loai: LoaiGiaoDichCongNo;
  soTien: number;
  ngayGhiNhan?: Date;
  hopDong?: Id | null;
  phong?: Id | null;
  hoaDon?: Id | null;
  thanhToan?: Id | null;
  moTa?: string;
  nguoiTao?: Id | null;
}

export async function ghiButToan(input: GhiButToanInput) {
  return GiaoDichCongNo.create({
    khachThue: toId(input.khachThue),
    loai: input.loai,
    soTien: Math.round(input.soTien),
    ngayGhiNhan: input.ngayGhiNhan ?? new Date(),
    hopDong: toId(input.hopDong),
    phong: toId(input.phong),
    hoaDon: toId(input.hoaDon),
    thanhToan: toId(input.thanhToan),
    moTa: input.moTa ?? '',
    nguoiTao: toId(input.nguoiTao),
  });
}

export async function huyButToan(
  filter: Record<string, unknown>,
  opts: { nguoiHuy?: Id | null; lyDo?: string } = {},
) {
  return GiaoDichCongNo.updateMany(
    { ...filter, daHuy: false },
    { $set: { daHuy: true, nguoiHuy: toId(opts.nguoiHuy), ngayHuy: new Date(), lyDoHuy: opts.lyDo ?? '' } },
  );
}

export async function soDuCongNo(khachThueId: Id, excludeIds: Id[] = []): Promise<number> {
  const match: Record<string, unknown> = { khachThue: toId(khachThueId), daHuy: false };
  if (excludeIds.length) match._id = { $nin: excludeIds.map(toId) };
  const [row] = await GiaoDichCongNo.aggregate([
    { $match: match },
    { $group: { _id: null, tong: { $sum: '$soTien' } } },
  ]);
  return row?.tong ?? 0;
}

/** Số dư của nhiều khách cùng lúc (cho danh sách khách thuê). */
export async function soDuNhieuKhach(khachThueIds?: Id[]): Promise<Record<string, number>> {
  const match: Record<string, unknown> = { daHuy: false };
  if (khachThueIds) match.khachThue = { $in: khachThueIds.map(toId) };
  const rows = await GiaoDichCongNo.aggregate([
    { $match: match },
    { $group: { _id: '$khachThue', tong: { $sum: '$soTien' } } },
  ]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.tong]));
}

/**
 * Tính lại toàn bộ phân bổ FIFO của một khách và ghi daThanhToan / conLai / trangThai
 * vào các hóa đơn của khách. Idempotent — gọi lại bao nhiêu lần cũng ra cùng kết quả.
 */
export async function recomputeCongNo(khachThueId: Id) {
  const khachThue = toId(khachThueId);
  const butToans = await GiaoDichCongNo.find({ khachThue, daHuy: false })
    .select('soTien ngayGhiNhan ngayTao hoaDon')
    .lean<Array<Pick<IGiaoDichCongNo, 'soTien' | 'ngayGhiNhan' | 'ngayTao' | 'hoaDon'> & { _id: mongoose.Types.ObjectId }>>();

  const ketQua = phanBoFIFO(butToans.map((b) => ({
    id: String(b._id),
    soTien: b.soTien,
    ngayGhiNhan: b.ngayGhiNhan,
    ngayTao: b.ngayTao,
    hoaDon: b.hoaDon ? String(b.hoaDon) : null,
  })));

  const hoaDons = await HoaDon.find({ khachThue })
    .select('tongTien daThanhToan conLai trangThai hanThanhToan')
    .lean<Array<{ _id: mongoose.Types.ObjectId; tongTien: number; daThanhToan: number; conLai: number; trangThai: string; hanThanhToan: Date }>>();

  const now = new Date();
  const ops = [];
  for (const hd of hoaDons) {
    const daThanhToan = Math.min(hd.tongTien, ketQua.daPhanBoTheoHoaDon.get(String(hd._id)) ?? 0);
    const { conLai, trangThai } = tinhTrangThaiHoaDon(hd.tongTien, daThanhToan, hd.hanThanhToan, now);
    if (hd.daThanhToan !== daThanhToan || hd.conLai !== conLai || hd.trangThai !== trangThai) {
      ops.push({ updateOne: { filter: { _id: hd._id }, update: { $set: { daThanhToan, conLai, trangThai } } } });
    }
  }
  if (ops.length) await HoaDon.bulkWrite(ops);

  return { soDu: ketQua.soDu, tienThua: ketQua.tienThua, soHoaDonCapNhat: ops.length };
}

interface HoaDonLike {
  _id: Id;
  khachThue: Id | { _id: Id };
  hopDong?: Id | { _id: Id } | null;
  phong?: Id | { _id: Id } | null;
  maHoaDon?: string;
  thang?: number;
  nam?: number;
  tongTien: number;
}

const refId = (v: Id | { _id: Id } | null | undefined): Id | null =>
  v == null ? null : (typeof v === 'object' && '_id' in v ? v._id : (v as Id));

/**
 * Ghi nhận hóa đơn mới vào sổ công nợ: lưu noKyTruoc / tongCanThanhToan lên hóa đơn,
 * tạo bút toán `hoaDon` (nếu chưa có) và tính lại phân bổ.
 */
export async function ghiNhanHoaDonMoi(hoaDon: HoaDonLike, nguoiTao?: Id | null) {
  const khachThue = refId(hoaDon.khachThue)!;
  const daCo = await GiaoDichCongNo.findOne({ hoaDon: toId(hoaDon._id), loai: 'hoaDon', daHuy: false });
  if (daCo) return recomputeCongNo(khachThue);

  const noKyTruoc = await soDuCongNo(khachThue);
  await HoaDon.updateOne(
    { _id: toId(hoaDon._id) },
    { $set: { noKyTruoc, tongCanThanhToan: hoaDon.tongTien + noKyTruoc } },
  );

  if (hoaDon.tongTien !== 0) {
    await ghiButToan({
      khachThue,
      loai: 'hoaDon',
      soTien: hoaDon.tongTien,
      hopDong: refId(hoaDon.hopDong),
      phong: refId(hoaDon.phong),
      hoaDon: hoaDon._id,
      moTa: `Hóa đơn ${hoaDon.maHoaDon ?? ''}${hoaDon.thang ? ` tháng ${hoaDon.thang}/${hoaDon.nam}` : ''}`.trim(),
      nguoiTao,
    });
  }
  return recomputeCongNo(khachThue);
}

/** Đồng bộ bút toán `hoaDon` sau khi sửa tổng tiền hóa đơn. */
export async function capNhatButToanHoaDon(hoaDon: HoaDonLike, nguoiId?: Id | null) {
  const khachThue = refId(hoaDon.khachThue)!;
  const butToan = await GiaoDichCongNo.findOne({ hoaDon: toId(hoaDon._id), loai: 'hoaDon', daHuy: false });

  if (!butToan) {
    if (hoaDon.tongTien !== 0) {
      await ghiButToan({
        khachThue,
        loai: 'hoaDon',
        soTien: hoaDon.tongTien,
        hopDong: refId(hoaDon.hopDong),
        phong: refId(hoaDon.phong),
        hoaDon: hoaDon._id,
        moTa: `Hóa đơn ${hoaDon.maHoaDon ?? ''}`.trim(),
        nguoiTao: nguoiId,
      });
    }
  } else if (hoaDon.tongTien === 0) {
    await huyButToan({ _id: butToan._id }, { nguoiHuy: nguoiId, lyDo: 'Tổng hóa đơn về 0' });
  } else if (butToan.soTien !== hoaDon.tongTien) {
    const cu = butToan.soTien;
    butToan.soTien = hoaDon.tongTien;
    butToan.moTa = `${butToan.moTa} (sửa ${cu.toLocaleString('vi-VN')} → ${hoaDon.tongTien.toLocaleString('vi-VN')})`.slice(0, 500);
    await butToan.save();
  }
  return recomputeCongNo(khachThue);
}

export async function huyButToanHoaDon(hoaDon: HoaDonLike, nguoiId?: Id | null) {
  await huyButToan({ hoaDon: toId(hoaDon._id), loai: 'hoaDon' }, { nguoiHuy: nguoiId, lyDo: 'Xóa hóa đơn' });
  return recomputeCongNo(refId(hoaDon.khachThue)!);
}

/** Hợp đồng đang hoạt động mà khách là người đại diện (để gắn vào thanh toán). */
export async function timHopDongCuaKhach(khachThueId: Id) {
  return HopDong.findOne({ nguoiDaiDien: toId(khachThueId), trangThai: 'hoatDong' })
    .sort({ ngayBatDau: -1 })
    .select('_id phong')
    .lean<{ _id: mongoose.Types.ObjectId; phong: mongoose.Types.ObjectId } | null>();
}

/** Hóa đơn còn nợ của khách, cũ → mới (theo thứ tự FIFO). */
export async function hoaDonMoCuaKhach(khachThueId: Id) {
  const khachThue = toId(khachThueId);
  const butToans = await GiaoDichCongNo.find({ khachThue, daHuy: false, loai: 'hoaDon' })
    .sort({ ngayGhiNhan: 1, ngayTao: 1, _id: 1 })
    .select('hoaDon')
    .lean<Array<{ hoaDon: mongoose.Types.ObjectId }>>();
  const thuTu = new Map(butToans.map((b, i) => [String(b.hoaDon), i]));
  const hoaDons = await HoaDon.find({ khachThue, conLai: { $gt: 0 } })
    .select('maHoaDon thang nam tongTien daThanhToan conLai trangThai hanThanhToan phong hopDong')
    .populate('phong', 'maPhong')
    .lean<Array<{ _id: mongoose.Types.ObjectId } & Record<string, unknown>>>();
  return hoaDons.sort((a, b) => (thuTu.get(String(a._id)) ?? 1e9) - (thuTu.get(String(b._id)) ?? 1e9));
}

interface ThanhToanLike {
  _id: Id;
  khachThue: Id;
  hopDong?: Id | null;
  soTien: number;
  ngayThanhToan: Date;
}

/**
 * Áp dụng lựa chọn xử lý tiền thừa cho một thanh toán: hủy bút toán bỏ qua cũ (nếu có),
 * rồi nếu `khongTru` và có phần thừa thì ghi bút toán `boQuaTienThua` dương bằng phần thừa.
 */
async function apDungXuLyTienThua(
  thanhToan: ThanhToanLike,
  xuLyTienThua: 'truKySau' | 'khongTru' | null | undefined,
  nguoiId?: Id | null,
) {
  await huyButToan(
    { thanhToan: toId(thanhToan._id), loai: 'boQuaTienThua' },
    { nguoiHuy: nguoiId, lyDo: 'Tính lại xử lý tiền thừa' },
  );
  const soDuSau = await soDuCongNo(thanhToan.khachThue);
  const tienThua = tinhTienThua(thanhToan.soTien, soDuSau);
  if (xuLyTienThua === 'khongTru' && tienThua > 0) {
    await ghiButToan({
      khachThue: thanhToan.khachThue,
      loai: 'boQuaTienThua',
      soTien: tienThua,
      ngayGhiNhan: thanhToan.ngayThanhToan,
      hopDong: thanhToan.hopDong,
      thanhToan: thanhToan._id,
      moTa: `Không trừ tiền thừa ${tienThua.toLocaleString('vi-VN')}đ vào kỳ sau`,
      nguoiTao: nguoiId,
    });
  }
  return tienThua;
}

export async function ghiNhanThanhToan(
  thanhToan: ThanhToanLike,
  xuLyTienThua: 'truKySau' | 'khongTru' | null | undefined,
  nguoiId?: Id | null,
  moTa?: string,
) {
  await ghiButToan({
    khachThue: thanhToan.khachThue,
    loai: 'thanhToan',
    soTien: -thanhToan.soTien,
    ngayGhiNhan: thanhToan.ngayThanhToan,
    hopDong: thanhToan.hopDong,
    thanhToan: thanhToan._id,
    moTa: moTa ?? 'Thu tiền',
    nguoiTao: nguoiId,
  });
  const tienThua = await apDungXuLyTienThua(thanhToan, xuLyTienThua, nguoiId);
  const kq = await recomputeCongNo(thanhToan.khachThue);
  return { ...kq, tienThua };
}

export async function capNhatThanhToan(
  thanhToan: ThanhToanLike,
  khachThueCu: Id,
  xuLyTienThua: 'truKySau' | 'khongTru' | null | undefined,
  nguoiId?: Id | null,
) {
  const khachDoi = String(khachThueCu) !== String(thanhToan.khachThue);
  const butToan = await GiaoDichCongNo.findOne({ thanhToan: toId(thanhToan._id), loai: 'thanhToan', daHuy: false });

  if (!butToan || khachDoi) {
    await huyButToan({ thanhToan: toId(thanhToan._id) }, { nguoiHuy: nguoiId, lyDo: 'Sửa thanh toán' });
    await ghiButToan({
      khachThue: thanhToan.khachThue,
      loai: 'thanhToan',
      soTien: -thanhToan.soTien,
      ngayGhiNhan: thanhToan.ngayThanhToan,
      hopDong: thanhToan.hopDong,
      thanhToan: thanhToan._id,
      moTa: 'Thu tiền',
      nguoiTao: nguoiId,
    });
  } else {
    butToan.soTien = -thanhToan.soTien;
    butToan.ngayGhiNhan = thanhToan.ngayThanhToan;
    await butToan.save();
  }

  const tienThua = await apDungXuLyTienThua(thanhToan, xuLyTienThua, nguoiId);
  if (khachDoi) await recomputeCongNo(khachThueCu);
  const kq = await recomputeCongNo(thanhToan.khachThue);
  return { ...kq, tienThua };
}

export async function huyThanhToan(thanhToan: { _id: Id; khachThue: Id }, nguoiId?: Id | null) {
  await huyButToan({ thanhToan: toId(thanhToan._id) }, { nguoiHuy: nguoiId, lyDo: 'Xóa thanh toán' });
  return recomputeCongNo(thanhToan.khachThue);
}
