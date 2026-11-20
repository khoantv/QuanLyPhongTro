import mongoose from 'mongoose';
import HoaDon, { ChiTietTienPhongLe, LoaiPhiHoaDon } from '@/models/HoaDon';
import HopDong from '@/models/HopDong';
import ChiSoDienNuoc from '@/models/ChiSoDienNuoc';
import '@/models/Phong';
import '@/models/KhachThue';
import { getCaiDatHoaDonLean } from '@/lib/cai-dat';
import {
  capNhatButToanHoaDon, ghiNhanHoaDonMoi, huyButToanHoaDon, soDuCongNo,
} from '@/lib/cong-no';
import {
  congNgay, dauNgayVN, fmtNgay, kyThuCuaThang, lamTron1000, soNgayGiua, tenTienPhongLe, tienPhongTheoNgay,
} from '@/lib/ky-thu';

type OID = mongoose.Types.ObjectId;

export class LapHoaDonError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface DongPhi {
  ten: string;
  gia: number;
  loai: LoaiPhiHoaDon;
  chiTiet?: ChiTietTienPhongLe | null;
}

export interface DongGiamTru {
  ten: string;
  soTien: number;
}

export interface ThayDongHo {
  /** Số điện tiêu thụ nhập tay khi đồng hồ điện đã thay (chỉ số cuối < đầu). */
  soDien?: number;
  soNuoc?: number;
}

export interface HoaDonInput {
  hopDongId: string;
  thang: number;
  nam: number;
  chiSoDienCuoiKy?: number | null;
  chiSoNuocCuoiKy?: number | null;
  tienPhong?: number | null;
  /** Bỏ trống → điền phí hợp đồng + tiền phòng lẻ tự tính. */
  phiDichVu?: Array<Partial<DongPhi>> | null;
  khoanGiamTru?: Array<Partial<DongGiamTru>> | null;
  thayDongHo?: ThayDongHo | null;
  hanThanhToan?: string | Date | null;
  ghiChu?: string | null;
  maHoaDon?: string | null;
  hinhThucThanhToan?: string | null;
}

interface HopDongLean {
  _id: OID;
  maHopDong: string;
  phong: { _id: OID; maPhong: string } | OID;
  nguoiDaiDien: OID;
  ngayBatDau: Date;
  giaThue: number;
  giaDien: number;
  giaNuoc: number;
  chiSoDienBanDau: number;
  chiSoNuocBanDau: number;
  ngayThanhToan: number;
  chuKyThanhToan: string;
  phiDichVu: Array<{ ten: string; gia: number }>;
  trangThai: string;
  daThuTienPhongDen?: Date | null;
}

const soNguyen = (v: unknown, fallback = 0) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : fallback;
};

function chuanHoaPhi(list: Array<Partial<DongPhi>>): DongPhi[] {
  return list
    .filter((p) => p && typeof p.ten === 'string' && p.ten.trim())
    .map((p) => {
      const gia = soNguyen(p.gia);
      if (gia < 0) throw new LapHoaDonError(`Số tiền của "${p.ten}" phải ≥ 0 — dùng mục Giảm trừ cho khoản bớt`);
      const loai: LoaiPhiHoaDon = p.loai === 'tienPhongLe' || p.loai === 'khac' ? p.loai : 'dichVu';
      return { ten: p.ten!.trim(), gia, loai, chiTiet: loai === 'tienPhongLe' ? (p.chiTiet ?? null) : null };
    });
}

function chuanHoaGiamTru(list: Array<Partial<DongGiamTru>>): DongGiamTru[] {
  return list
    .filter((g) => g && typeof g.ten === 'string' && g.ten.trim())
    .map((g) => {
      const soTien = soNguyen(g.soTien);
      if (soTien < 0) throw new LapHoaDonError(`Số tiền giảm trừ "${g.ten}" phải ≥ 0`);
      return { ten: g.ten!.trim(), soTien };
    });
}

function tinhTieuThu(ten: 'điện' | 'nước', dau: number, cuoi: number, nhapTay?: number) {
  if (cuoi >= dau) return cuoi - dau;
  if (nhapTay !== undefined && nhapTay !== null && Number.isFinite(Number(nhapTay)) && Number(nhapTay) >= 0) {
    return soNguyen(nhapTay);
  }
  throw new LapHoaDonError(
    `Chỉ số ${ten} cuối kỳ (${cuoi.toLocaleString('vi-VN')}) nhỏ hơn đầu kỳ (${dau.toLocaleString('vi-VN')}). `
    + 'Nếu đã thay đồng hồ, hãy chọn "Thay đồng hồ" và nhập số tiêu thụ.',
  );
}

function tinhTong(
  p: { tienPhong: number; tienDien: number; tienNuoc: number; phiDichVu: DongPhi[]; khoanGiamTru: DongGiamTru[] },
  lamTron: boolean,
) {
  const truocLamTron = p.tienPhong + p.tienDien + p.tienNuoc
    + p.phiDichVu.reduce((s, x) => s + x.gia, 0)
    - p.khoanGiamTru.reduce((s, x) => s + x.soTien, 0);
  const tongTien = lamTron ? lamTron1000(truocLamTron) : truocLamTron;
  return { truocLamTron, tongTien, tienLamTron: tongTien - truocLamTron };
}

async function taiHopDong(hopDongId: string): Promise<HopDongLean> {
  if (!mongoose.Types.ObjectId.isValid(hopDongId)) throw new LapHoaDonError('Hợp đồng không hợp lệ');
  const hd = await HopDong.findById(hopDongId).populate('phong', 'maPhong').lean<HopDongLean | null>();
  if (!hd) throw new LapHoaDonError('Hợp đồng không tồn tại', 404);
  return hd;
}

const phongId = (hd: HopDongLean) => ('_id' in hd.phong ? hd.phong._id : hd.phong) as OID;
const maPhong = (hd: HopDongLean) => ('maPhong' in hd.phong ? hd.phong.maPhong : '');

/** Hóa đơn gần nhất của hợp đồng (để lấy chỉ số đầu kỳ). */
async function hoaDonGanNhat(hopDongId: OID, truocKy?: Date) {
  const filter: Record<string, unknown> = { hopDong: hopDongId };
  if (truocKy) filter.$or = [{ kyBatDau: { $lt: truocKy } }, { kyBatDau: null }];
  return HoaDon.findOne(filter)
    .sort({ nam: -1, thang: -1, ngayTao: -1 })
    .select('chiSoDienCuoiKy chiSoNuocCuoiKy kyKetThuc thang nam')
    .lean<{ chiSoDienCuoiKy: number; chiSoNuocCuoiKy: number; kyKetThuc?: Date | null; thang: number; nam: number } | null>();
}

export interface BanTinhHoaDon {
  hopDong: { _id: string; maHopDong: string; maPhong: string; giaThue: number; giaDien: number; giaNuoc: number; ngayThanhToan: number };
  thang: number;
  nam: number;
  kyBatDau: Date;
  kyKetThuc: Date;
  soNgayKy: number;
  mocTienPhongTruoc: Date;
  tienPhong: number;
  chiSoDienBanDau: number;
  chiSoDienCuoiKy: number | null;
  soDien: number;
  tienDien: number;
  chiSoNuocBanDau: number;
  chiSoNuocCuoiKy: number | null;
  soNuoc: number;
  tienNuoc: number;
  chiSoCuoiTuGhiNhan: boolean;
  phiDichVu: DongPhi[];
  /** Dòng tiền phòng lẻ tự tính (để nút "Tính lại" trên form). */
  tienPhongLeGoiY: DongPhi | null;
  khoanGiamTru: DongGiamTru[];
  lamTron: boolean;
  tongTruocLamTron: number;
  tienLamTron: number;
  tongTien: number;
  noKyTruoc: number;
  tongCanThanhToan: number;
  hanThanhToan: Date;
  ghiChuMacDinh: string;
  hinhThucThanhToanMacDinh: string;
}

/**
 * Tính toàn bộ hóa đơn hàng tháng mà không ghi DB.
 * @param batBuocChiSo true khi lập thật: thiếu chỉ số cuối kỳ là lỗi.
 */
export async function tinhHoaDonHangThang(input: HoaDonInput, batBuocChiSo = false): Promise<BanTinhHoaDon> {
  const thang = soNguyen(input.thang);
  const nam = soNguyen(input.nam);
  if (thang < 1 || thang > 12 || nam < 2020) throw new LapHoaDonError('Tháng/năm không hợp lệ');

  const hd = await taiHopDong(input.hopDongId);
  if (hd.trangThai === 'daThanhLy') throw new LapHoaDonError('Hợp đồng đã thanh lý');
  if (hd.chuKyThanhToan && hd.chuKyThanhToan !== 'thang') {
    throw new LapHoaDonError('Hiện chỉ hỗ trợ lập hóa đơn cho hợp đồng thanh toán theo tháng');
  }

  const caiDat = await getCaiDatHoaDonLean();
  const ky = kyThuCuaThang(hd.ngayThanhToan, thang, nam);
  const ganNhat = await hoaDonGanNhat(hd._id, ky.batDau);
  // Mốc đã thu tiền phòng: ưu tiên giá trị lưu trên hợp đồng; dữ liệu cũ chưa migrate thì suy từ hóa đơn gần nhất
  const mocTuHoaDon = ganNhat
    ? (ganNhat.kyKetThuc ?? kyThuCuaThang(hd.ngayThanhToan, ganNhat.thang, ganNhat.nam).ketThuc)
    : null;
  const moc = dauNgayVN(hd.daThuTienPhongDen ?? mocTuHoaDon ?? hd.ngayBatDau);

  if (soNgayGiua(moc, ky.batDau) < 0) {
    throw new LapHoaDonError(
      `Tiền phòng đã được lập hóa đơn đến ${fmtNgay(moc)} nên không lập được kỳ ${fmtNgay(ky.batDau)}. `
      + `Hãy chọn tháng có ngày thu từ ${fmtNgay(moc)} trở đi.`,
    );
  }

  const trung = await HoaDon.exists({
    hopDong: hd._id,
    loaiHoaDon: { $ne: 'chotPhong' },
    $or: [{ kyBatDau: ky.batDau }, { kyBatDau: null, thang, nam }],
  });
  if (trung) {
    throw new LapHoaDonError(`Hóa đơn kỳ ${fmtNgay(ky.batDau)} – ${fmtNgay(congNgay(ky.ketThuc, -1))} đã tồn tại`);
  }

  // Chỉ số điện nước
  const chiSoDienBanDau = ganNhat?.chiSoDienCuoiKy ?? hd.chiSoDienBanDau ?? 0;
  const chiSoNuocBanDau = ganNhat?.chiSoNuocCuoiKy ?? hd.chiSoNuocBanDau ?? 0;
  let chiSoDienCuoiKy = input.chiSoDienCuoiKy ?? null;
  let chiSoNuocCuoiKy = input.chiSoNuocCuoiKy ?? null;
  let chiSoCuoiTuGhiNhan = false;
  if (chiSoDienCuoiKy === null || chiSoNuocCuoiKy === null) {
    const ghi = await ChiSoDienNuoc.findOne({ phong: phongId(hd), thang, nam })
      .select('chiSoDienMoi chiSoNuocMoi').lean<{ chiSoDienMoi: number; chiSoNuocMoi: number } | null>();
    if (ghi) {
      chiSoDienCuoiKy ??= ghi.chiSoDienMoi;
      chiSoNuocCuoiKy ??= ghi.chiSoNuocMoi;
      chiSoCuoiTuGhiNhan = true;
    }
  }
  if (batBuocChiSo && (chiSoDienCuoiKy === null || chiSoNuocCuoiKy === null)) {
    throw new LapHoaDonError(`Chưa có chỉ số điện nước phòng ${maPhong(hd)} tháng ${thang}/${nam}`);
  }

  const soDien = chiSoDienCuoiKy === null ? 0 : tinhTieuThu('điện', chiSoDienBanDau, soNguyen(chiSoDienCuoiKy), input.thayDongHo?.soDien);
  const soNuoc = chiSoNuocCuoiKy === null ? 0 : tinhTieuThu('nước', chiSoNuocBanDau, soNguyen(chiSoNuocCuoiKy), input.thayDongHo?.soNuoc);

  // Tiền phòng lẻ từ mốc đã thu đến ngày thu của kỳ này
  let tienPhongLeGoiY: DongPhi | null = null;
  if (soNgayGiua(moc, ky.batDau) > 0) {
    const le = tienPhongTheoNgay(hd.giaThue, hd.ngayThanhToan, moc, ky.batDau);
    const soNgayCuaKy = le.chiTiet.length === 1 ? le.chiTiet[0].soNgayCuaKy : le.chiTiet.reduce((s, c) => s + c.soNgayCuaKy, 0);
    tienPhongLeGoiY = {
      ten: tenTienPhongLe(moc, ky.batDau, le.soNgay),
      gia: le.soTien,
      loai: 'tienPhongLe',
      chiTiet: {
        tuNgay: moc,
        denNgay: ky.batDau,
        soNgay: le.soNgay,
        soNgayCuaKy,
        giaThue: hd.giaThue,
        soTienTuTinh: le.soTien,
      },
    };
  }

  const phiDichVu = input.phiDichVu
    ? chuanHoaPhi(input.phiDichVu)
    : [
      ...(hd.phiDichVu || []).map((p) => ({ ten: p.ten, gia: p.gia, loai: 'dichVu' as const, chiTiet: null })),
      ...(tienPhongLeGoiY ? [tienPhongLeGoiY] : []),
    ];
  const khoanGiamTru = chuanHoaGiamTru(input.khoanGiamTru ?? []);

  const tienPhong = input.tienPhong === undefined || input.tienPhong === null ? hd.giaThue : soNguyen(input.tienPhong);
  if (tienPhong < 0) throw new LapHoaDonError('Tiền phòng phải ≥ 0');
  const tienDien = soDien * hd.giaDien;
  const tienNuoc = soNuoc * hd.giaNuoc;
  const tong = tinhTong({ tienPhong, tienDien, tienNuoc, phiDichVu, khoanGiamTru }, Boolean(caiDat.lamTronHoaDon));
  if (tong.tongTien < 0) throw new LapHoaDonError('Tổng hóa đơn không được âm — kiểm tra lại mục Giảm trừ');

  const noKyTruoc = await soDuCongNo(hd.nguoiDaiDien);
  const hanThanhToan = input.hanThanhToan ? dauNgayVN(input.hanThanhToan) : congNgay(ky.batDau, caiDat.hanDongTien ?? 5);

  return {
    hopDong: {
      _id: String(hd._id), maHopDong: hd.maHopDong, maPhong: maPhong(hd),
      giaThue: hd.giaThue, giaDien: hd.giaDien, giaNuoc: hd.giaNuoc, ngayThanhToan: hd.ngayThanhToan,
    },
    thang: ky.thang,
    nam: ky.nam,
    kyBatDau: ky.batDau,
    kyKetThuc: ky.ketThuc,
    soNgayKy: ky.soNgay,
    mocTienPhongTruoc: moc,
    tienPhong,
    chiSoDienBanDau,
    chiSoDienCuoiKy: chiSoDienCuoiKy === null ? null : soNguyen(chiSoDienCuoiKy),
    soDien,
    tienDien,
    chiSoNuocBanDau,
    chiSoNuocCuoiKy: chiSoNuocCuoiKy === null ? null : soNguyen(chiSoNuocCuoiKy),
    soNuoc,
    tienNuoc,
    chiSoCuoiTuGhiNhan,
    phiDichVu,
    tienPhongLeGoiY,
    khoanGiamTru,
    lamTron: Boolean(caiDat.lamTronHoaDon),
    tongTruocLamTron: tong.truocLamTron,
    tienLamTron: tong.tienLamTron,
    tongTien: tong.tongTien,
    noKyTruoc,
    tongCanThanhToan: tong.tongTien + noKyTruoc,
    hanThanhToan,
    ghiChuMacDinh: caiDat.ghiChuMacDinh ?? '',
    hinhThucThanhToanMacDinh: caiDat.hinhThucThanhToanMacDinh ?? 'tienMat',
  };
}

async function sinhMaHoaDon(nam: number, thang: number, maPhongStr: string) {
  const goc = `HD${nam}${String(thang).padStart(2, '0')}${(maPhongStr || 'P').toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
  let ma = goc;
  for (let i = 2; await HoaDon.exists({ maHoaDon: ma }); i++) ma = `${goc}-${i}`;
  return ma;
}

/** Lập hóa đơn hàng tháng (thủ công, tự động, hàng loạt đều dùng hàm này). */
export async function lapHoaDonHangThang(input: HoaDonInput, nguoiTao?: string | null) {
  const bt = await tinhHoaDonHangThang(input, true);
  const hd = await taiHopDong(input.hopDongId);

  let maHoaDon = input.maHoaDon?.trim().toUpperCase() || '';
  if (!maHoaDon || await HoaDon.exists({ maHoaDon })) maHoaDon = await sinhMaHoaDon(bt.nam, bt.thang, bt.hopDong.maPhong);

  let hoaDon;
  try {
    hoaDon = await HoaDon.create({
      maHoaDon,
      hopDong: hd._id,
      phong: phongId(hd),
      khachThue: hd.nguoiDaiDien,
      loaiHoaDon: 'hangThang',
      thang: bt.thang,
      nam: bt.nam,
      kyBatDau: bt.kyBatDau,
      kyKetThuc: bt.kyKetThuc,
      mocTienPhongTruoc: bt.mocTienPhongTruoc,
      tienPhong: bt.tienPhong,
      tienDien: bt.tienDien,
      soDien: bt.soDien,
      chiSoDienBanDau: bt.chiSoDienBanDau,
      chiSoDienCuoiKy: bt.chiSoDienCuoiKy,
      tienNuoc: bt.tienNuoc,
      soNuoc: bt.soNuoc,
      chiSoNuocBanDau: bt.chiSoNuocBanDau,
      chiSoNuocCuoiKy: bt.chiSoNuocCuoiKy,
      phiDichVu: bt.phiDichVu,
      khoanGiamTru: bt.khoanGiamTru,
      tienLamTron: bt.tienLamTron,
      tongTien: bt.tongTien,
      daThanhToan: 0,
      conLai: bt.tongTien,
      hanThanhToan: bt.hanThanhToan,
      ghiChu: input.ghiChu?.trim() || bt.ghiChuMacDinh || undefined,
      hinhThucThanhToan: input.hinhThucThanhToan || bt.hinhThucThanhToanMacDinh,
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new LapHoaDonError(`Hóa đơn kỳ ${fmtNgay(bt.kyBatDau)} của hợp đồng đã tồn tại`);
    }
    throw err;
  }

  // Đẩy mốc tiền phòng — điều kiện theo mốc cũ để tránh hai request đồng thời cùng lập
  const capNhat = await HopDong.updateOne(
    { _id: hd._id, $or: [{ daThuTienPhongDen: bt.mocTienPhongTruoc }, { daThuTienPhongDen: null }, { daThuTienPhongDen: { $exists: false } }] },
    { $set: { daThuTienPhongDen: bt.kyKetThuc } },
  );
  if (capNhat.matchedCount === 0) {
    await HoaDon.deleteOne({ _id: hoaDon._id });
    throw new LapHoaDonError('Hợp đồng vừa được lập hóa đơn ở nơi khác — vui lòng tải lại', 409);
  }

  await ghiNhanHoaDonMoi(hoaDon, nguoiTao);
  return HoaDon.findById(hoaDon._id).populate([
    { path: 'hopDong', select: 'maHopDong' },
    { path: 'phong', select: 'maPhong' },
    { path: 'khachThue', select: 'hoTen soDienThoai zaloUserId' },
  ]);
}

export interface CapNhatHoaDonInput {
  maHoaDon?: string;
  tienPhong?: number;
  chiSoDienBanDau?: number;
  chiSoDienCuoiKy?: number;
  chiSoNuocBanDau?: number;
  chiSoNuocCuoiKy?: number;
  phiDichVu?: Array<Partial<DongPhi>>;
  khoanGiamTru?: Array<Partial<DongGiamTru>>;
  thayDongHo?: ThayDongHo | null;
  hanThanhToan?: string | Date;
  ghiChu?: string;
  hinhThucThanhToan?: string | null;
}

/**
 * Sửa số liệu hóa đơn. Không đổi hợp đồng / kỳ / tháng; daThanhToan, conLai, trangThai do sổ công nợ tính.
 */
export async function capNhatHoaDon(id: string, input: CapNhatHoaDonInput, nguoiId?: string | null) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new LapHoaDonError('Hóa đơn không hợp lệ');
  const hoaDon = await HoaDon.findById(id);
  if (!hoaDon) throw new LapHoaDonError('Hóa đơn không tồn tại', 404);
  const hd = await taiHopDong(String(hoaDon.hopDong));
  const caiDat = await getCaiDatHoaDonLean();

  const chiSoDienBanDau = input.chiSoDienBanDau ?? hoaDon.chiSoDienBanDau;
  const chiSoDienCuoiKy = input.chiSoDienCuoiKy ?? hoaDon.chiSoDienCuoiKy;
  const chiSoNuocBanDau = input.chiSoNuocBanDau ?? hoaDon.chiSoNuocBanDau;
  const chiSoNuocCuoiKy = input.chiSoNuocCuoiKy ?? hoaDon.chiSoNuocCuoiKy;
  const soDien = tinhTieuThu('điện', soNguyen(chiSoDienBanDau), soNguyen(chiSoDienCuoiKy), input.thayDongHo?.soDien);
  const soNuoc = tinhTieuThu('nước', soNguyen(chiSoNuocBanDau), soNguyen(chiSoNuocCuoiKy), input.thayDongHo?.soNuoc);

  const phiDichVu = input.phiDichVu ? chuanHoaPhi(input.phiDichVu) : (hoaDon.phiDichVu as DongPhi[]);
  const khoanGiamTru = input.khoanGiamTru ? chuanHoaGiamTru(input.khoanGiamTru) : (hoaDon.khoanGiamTru as DongGiamTru[]);
  const tienPhong = input.tienPhong === undefined ? hoaDon.tienPhong : soNguyen(input.tienPhong);
  const tienDien = soDien * hd.giaDien;
  const tienNuoc = soNuoc * hd.giaNuoc;
  const tong = tinhTong({ tienPhong, tienDien, tienNuoc, phiDichVu, khoanGiamTru }, Boolean(caiDat.lamTronHoaDon));
  if (tong.tongTien < 0 && hoaDon.loaiHoaDon !== 'chotPhong') {
    throw new LapHoaDonError('Tổng hóa đơn không được âm — kiểm tra lại mục Giảm trừ');
  }

  hoaDon.set({
    maHoaDon: input.maHoaDon?.trim() ? input.maHoaDon.trim().toUpperCase() : hoaDon.maHoaDon,
    tienPhong,
    chiSoDienBanDau, chiSoDienCuoiKy, soDien, tienDien,
    chiSoNuocBanDau, chiSoNuocCuoiKy, soNuoc, tienNuoc,
    phiDichVu,
    khoanGiamTru,
    tienLamTron: tong.tienLamTron,
    tongTien: tong.tongTien,
    hanThanhToan: input.hanThanhToan ? dauNgayVN(input.hanThanhToan) : hoaDon.hanThanhToan,
    ghiChu: input.ghiChu ?? hoaDon.ghiChu,
    hinhThucThanhToan: input.hinhThucThanhToan ?? hoaDon.hinhThucThanhToan,
  });
  await hoaDon.save();
  await capNhatButToanHoaDon(hoaDon, nguoiId);

  return HoaDon.findById(hoaDon._id).populate([
    { path: 'hopDong', select: 'maHopDong' },
    { path: 'phong', select: 'maPhong' },
    { path: 'khachThue', select: 'hoTen soDienThoai' },
  ]);
}

/** Xóa hóa đơn — chỉ cho xóa hóa đơn mới nhất của hợp đồng; khôi phục mốc tiền phòng. */
export async function xoaHoaDon(id: string, nguoiId?: string | null) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new LapHoaDonError('Hóa đơn không hợp lệ');
  const hoaDon = await HoaDon.findById(id);
  if (!hoaDon) throw new LapHoaDonError('Hóa đơn không tồn tại', 404);

  const sauNo = await HoaDon.exists({
    hopDong: hoaDon.hopDong,
    _id: { $ne: hoaDon._id },
    $or: [
      ...(hoaDon.kyBatDau ? [{ kyBatDau: { $gt: hoaDon.kyBatDau } }] : []),
      { nam: { $gt: hoaDon.nam } },
      { nam: hoaDon.nam, thang: { $gt: hoaDon.thang } },
      { loaiHoaDon: 'chotPhong', ngayTao: { $gt: hoaDon.ngayTao } },
    ],
  });
  if (sauNo) throw new LapHoaDonError('Chỉ được xóa hóa đơn mới nhất của hợp đồng');

  await HoaDon.deleteOne({ _id: hoaDon._id });
  if (hoaDon.loaiHoaDon !== 'chotPhong' && hoaDon.kyKetThuc && hoaDon.mocTienPhongTruoc) {
    await HopDong.updateOne(
      { _id: hoaDon.hopDong, daThuTienPhongDen: hoaDon.kyKetThuc },
      { $set: { daThuTienPhongDen: hoaDon.mocTienPhongTruoc } },
    );
  }
  await huyButToanHoaDon(hoaDon, nguoiId);
  return hoaDon;
}
