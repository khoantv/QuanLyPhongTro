/**
 * Bảng thu tiền tháng — tái hiện bảng Excel của chủ trọ: một dòng mỗi phòng
 * (hoặc nhiều dòng nếu trong tháng có chốt phòng + khách mới), kèm chỉ số, tiền, đã đóng, còn thiếu.
 */
import mongoose from 'mongoose';
import Phong from '@/models/Phong';
import HopDong from '@/models/HopDong';
import HoaDon from '@/models/HoaDon';
import ChiSoDienNuoc from '@/models/ChiSoDienNuoc';
import GiaoDichCongNo from '@/models/GiaoDichCongNo';
import '@/models/KhachThue';
import { soDuCongNo } from '@/lib/cong-no';
import { hoaDonGanNhat, LapHoaDonError, lapHoaDonHangThang, tinhHoaDonHangThang } from '@/lib/hoa-don/lap-hoa-don';
import { guiZaloTuDong } from '@/lib/hoa-don/gui-zalo';
import { fmtNgay, kyThuCuaThang } from '@/lib/ky-thu';

type OID = mongoose.Types.ObjectId;

export type TrangThaiDong = 'phongTrong' | 'chuaLap' | 'chuaDenKy' | 'daDu' | 'motPhan' | 'chuaDong' | 'quaHan';

export interface DongBangThuTien {
  key: string;
  loai: 'hangThang' | 'chotPhong' | 'chuaLap' | 'trong';
  phongId: string;
  maPhong: string;
  hopDongId: string | null;
  hoaDonId: string | null;
  maHoaDon: string | null;
  khachThueId: string | null;
  hoTen: string;
  soDienThoai: string;
  soNguoi: number;
  ngayThu: number | null;
  chiSoDienCu: number | null;
  chiSoDienMoi: number | null;
  soDien: number;
  chiSoNuocCu: number | null;
  chiSoNuocMoi: number | null;
  soNuoc: number;
  /** Tiền phòng kỳ + tiền phòng lẻ */
  tienPhong: number;
  tienPhongLe: number;
  /** Phí dịch vụ & khoản khác (không gồm tiền phòng lẻ) − giảm trừ + làm tròn */
  phiDichVu: number;
  tienDienNuoc: number;
  noKyTruoc: number;
  canDong: number;
  daDong: number;
  boQuaTienThua: number;
  conThieu: number;
  hanThanhToan: string | null;
  trangThai: TrangThaiDong;
  ghiChu: string;
  /** Chỉ số mới đã ghi vào sổ chỉ số (cho dòng chưa lập hóa đơn) */
  daGhiChiSo: boolean;
}

export interface BangThuTien {
  toaNha: { _id: string; tenToaNha: string } | null;
  thang: number;
  nam: number;
  dong: DongBangThuTien[];
  tong: Record<'soDien' | 'soNuoc' | 'tienPhong' | 'phiDichVu' | 'canDong' | 'daDong' | 'conThieu', number>;
}

const soSanhMaPhong = (a: string, b: string) => a.localeCompare(b, 'vi', { numeric: true });

interface ButToanLean { _id: OID; khachThue: OID; loai: string; soTien: number; hoaDon?: OID | null; ngayTao: Date }

/** Đã đóng / bỏ qua / còn thiếu cho một hóa đơn: các bút toán được tạo sau hóa đơn và trước hóa đơn kế tiếp của khách. */
function tinhDaDong(hoaDonId: string, butToans: ButToanLean[], canDong: number) {
  const idx = butToans.findIndex((b) => b.loai === 'hoaDon' && String(b.hoaDon) === hoaDonId);
  if (idx < 0) return { daDong: 0, boQua: 0, conThieu: canDong };
  let daDong = 0;
  let boQua = 0;
  let bienDong = 0;
  for (let i = idx + 1; i < butToans.length && butToans[i].loai !== 'hoaDon'; i++) {
    const b = butToans[i];
    if (b.loai === 'thanhToan') daDong += -b.soTien;
    if (b.loai === 'boQuaTienThua') boQua += b.soTien;
    bienDong += b.soTien;
  }
  return { daDong, boQua, conThieu: canDong + bienDong };
}

function trangThaiTheoTien(canDong: number, daDong: number, conThieu: number, han: Date | null): TrangThaiDong {
  if (conThieu <= 0) return 'daDu';
  if (daDong > 0) return 'motPhan';
  if (han && han.getTime() < Date.now()) return 'quaHan';
  return 'chuaDong';
}

export async function dungBangThuTien(toaNhaId: string, thang: number, nam: number): Promise<BangThuTien> {
  if (!mongoose.Types.ObjectId.isValid(toaNhaId)) throw new LapHoaDonError('Tòa nhà không hợp lệ');
  const ToaNha = mongoose.models.ToaNha ?? (await import('@/models/ToaNha')).default;
  const toaNha = await ToaNha.findById(toaNhaId).select('tenToaNha').lean<{ _id: OID; tenToaNha: string } | null>();
  if (!toaNha) throw new LapHoaDonError('Tòa nhà không tồn tại', 404);

  const phongs = await Phong.find({ toaNha: toaNha._id }).select('maPhong trangThai').lean<Array<{ _id: OID; maPhong: string; trangThai: string }>>();
  phongs.sort((a, b) => soSanhMaPhong(a.maPhong, b.maPhong));
  const phongIds = phongs.map((p) => p._id);

  const hoaDons = await HoaDon.find({ phong: { $in: phongIds }, thang, nam })
    .populate('khachThue', 'hoTen soDienThoai')
    .populate('hopDong', 'khachThueId ngayThanhToan')
    .lean<Array<Record<string, unknown> & {
      _id: OID; phong: OID; loaiHoaDon?: string; maHoaDon: string; hanThanhToan: Date; ngayTao: Date;
      khachThue: { _id: OID; hoTen: string; soDienThoai: string };
      hopDong: { _id: OID; khachThueId: OID[]; ngayThanhToan: number } | null;
      chiSoDienBanDau: number; chiSoDienCuoiKy: number; soDien: number; chiSoNuocBanDau: number; chiSoNuocCuoiKy: number; soNuoc: number;
      tienPhong: number; tienDien: number; tienNuoc: number; tongTien: number; noKyTruoc?: number; tongCanThanhToan?: number;
      phiDichVu: Array<{ gia: number; loai?: string }>; khoanGiamTru?: Array<{ soTien: number }>; tienLamTron?: number;
    }>>();

  const hopDongs = await HopDong.find({ phong: { $in: phongIds }, trangThai: 'hoatDong' })
    .populate('nguoiDaiDien', 'hoTen soDienThoai')
    .lean<Array<{ _id: OID; phong: OID; maHopDong: string; khachThueId: OID[]; ngayThanhToan: number; ngayBatDau: Date; nguoiDaiDien: { _id: OID; hoTen: string; soDienThoai: string } }>>();

  const chiSos = await ChiSoDienNuoc.find({ phong: { $in: phongIds }, thang, nam })
    .lean<Array<{ phong: OID; chiSoDienMoi: number; chiSoNuocMoi: number }>>();
  const chiSoTheoPhong = new Map(chiSos.map((c) => [String(c.phong), c]));

  const khachIds = [...new Set(hoaDons.map((h) => String(h.khachThue?._id)).filter(Boolean))];
  const butToans = await GiaoDichCongNo.find({ khachThue: { $in: khachIds }, daHuy: false })
    .select('khachThue loai soTien hoaDon ngayTao')
    .sort({ ngayTao: 1, _id: 1 })
    .lean<ButToanLean[]>();
  const butToanTheoKhach = new Map<string, ButToanLean[]>();
  for (const b of butToans) {
    const k = String(b.khachThue);
    if (!butToanTheoKhach.has(k)) butToanTheoKhach.set(k, []);
    butToanTheoKhach.get(k)!.push(b);
  }

  const dong: DongBangThuTien[] = [];
  for (const phong of phongs) {
    const pid = String(phong._id);
    const hdPhong = hoaDons
      .filter((h) => String(h.phong) === pid)
      .sort((a, b) => new Date(a.ngayTao).getTime() - new Date(b.ngayTao).getTime());

    for (const h of hdPhong) {
      const tienPhongLe = (h.phiDichVu || []).filter((p) => p.loai === 'tienPhongLe').reduce((s, p) => s + p.gia, 0);
      const phiKhac = (h.phiDichVu || []).filter((p) => p.loai !== 'tienPhongLe').reduce((s, p) => s + p.gia, 0)
        - (h.khoanGiamTru || []).reduce((s, g) => s + g.soTien, 0) + (h.tienLamTron || 0);
      const noKyTruoc = h.noKyTruoc ?? 0;
      const canDong = h.tongCanThanhToan ?? h.tongTien + noKyTruoc;
      const kq = tinhDaDong(String(h._id), butToanTheoKhach.get(String(h.khachThue?._id)) ?? [], canDong);
      dong.push({
        key: String(h._id),
        loai: h.loaiHoaDon === 'chotPhong' ? 'chotPhong' : 'hangThang',
        phongId: pid,
        maPhong: phong.maPhong,
        hopDongId: h.hopDong ? String(h.hopDong._id) : null,
        hoaDonId: String(h._id),
        maHoaDon: h.maHoaDon,
        khachThueId: h.khachThue ? String(h.khachThue._id) : null,
        hoTen: h.khachThue?.hoTen ?? '',
        soDienThoai: h.khachThue?.soDienThoai ?? '',
        soNguoi: h.hopDong?.khachThueId?.length ?? 1,
        ngayThu: h.hopDong?.ngayThanhToan ?? null,
        chiSoDienCu: h.chiSoDienBanDau, chiSoDienMoi: h.chiSoDienCuoiKy, soDien: h.soDien,
        chiSoNuocCu: h.chiSoNuocBanDau, chiSoNuocMoi: h.chiSoNuocCuoiKy, soNuoc: h.soNuoc,
        tienPhong: h.tienPhong + tienPhongLe,
        tienPhongLe,
        phiDichVu: phiKhac,
        tienDienNuoc: h.tienDien + h.tienNuoc,
        noKyTruoc,
        canDong,
        daDong: kq.daDong,
        boQuaTienThua: kq.boQua,
        conThieu: kq.conThieu,
        hanThanhToan: h.hanThanhToan ? new Date(h.hanThanhToan).toISOString() : null,
        trangThai: trangThaiTheoTien(canDong, kq.daDong, kq.conThieu, h.hanThanhToan ? new Date(h.hanThanhToan) : null),
        ghiChu: h.loaiHoaDon === 'chotPhong' ? 'Hóa đơn chốt phòng' : '',
        daGhiChiSo: true,
      });
    }

    // Hợp đồng đang hoạt động chưa có hóa đơn hàng tháng của tháng này
    const hdHoatDong = hopDongs.filter((x) => String(x.phong) === pid);
    for (const hd of hdHoatDong) {
      const daLap = hdPhong.some((h) => h.loaiHoaDon !== 'chotPhong' && String(h.hopDong?._id) === String(hd._id));
      if (daLap) continue;
      const ghi = chiSoTheoPhong.get(pid);
      const base: DongBangThuTien = {
        key: `hd-${hd._id}`,
        loai: 'chuaLap',
        phongId: pid,
        maPhong: phong.maPhong,
        hopDongId: String(hd._id),
        hoaDonId: null,
        maHoaDon: null,
        khachThueId: String(hd.nguoiDaiDien?._id ?? ''),
        hoTen: hd.nguoiDaiDien?.hoTen ?? '',
        soDienThoai: hd.nguoiDaiDien?.soDienThoai ?? '',
        soNguoi: hd.khachThueId?.length ?? 1,
        ngayThu: hd.ngayThanhToan,
        chiSoDienCu: null, chiSoDienMoi: ghi?.chiSoDienMoi ?? null, soDien: 0,
        chiSoNuocCu: null, chiSoNuocMoi: ghi?.chiSoNuocMoi ?? null, soNuoc: 0,
        tienPhong: 0, tienPhongLe: 0, phiDichVu: 0, tienDienNuoc: 0,
        noKyTruoc: 0, canDong: 0, daDong: 0, boQuaTienThua: 0, conThieu: 0,
        hanThanhToan: null,
        trangThai: 'chuaLap',
        ghiChu: 'Chưa lập hóa đơn',
        daGhiChiSo: Boolean(ghi),
      };
      try {
        const bt = await tinhHoaDonHangThang({ hopDongId: String(hd._id), thang, nam });
        const tienPhongLe = bt.phiDichVu.filter((p) => p.loai === 'tienPhongLe').reduce((s, p) => s + p.gia, 0);
        const phiKhac = bt.phiDichVu.filter((p) => p.loai !== 'tienPhongLe').reduce((s, p) => s + p.gia, 0)
          - bt.khoanGiamTru.reduce((s, g) => s + g.soTien, 0) + bt.tienLamTron;
        const coChiSo = bt.chiSoDienCuoiKy !== null && bt.chiSoNuocCuoiKy !== null;
        dong.push({
          ...base,
          chiSoDienCu: bt.chiSoDienBanDau, chiSoDienMoi: bt.chiSoDienCuoiKy, soDien: bt.soDien,
          chiSoNuocCu: bt.chiSoNuocBanDau, chiSoNuocMoi: bt.chiSoNuocCuoiKy, soNuoc: bt.soNuoc,
          tienPhong: bt.tienPhong + tienPhongLe,
          tienPhongLe,
          phiDichVu: phiKhac,
          tienDienNuoc: bt.tienDien + bt.tienNuoc,
          noKyTruoc: bt.noKyTruoc,
          canDong: bt.tongCanThanhToan,
          conThieu: bt.tongCanThanhToan,
          hanThanhToan: bt.hanThanhToan.toISOString(),
          ghiChu: coChiSo ? `Chưa lập hóa đơn — kỳ ${fmtNgay(bt.kyBatDau)}` : 'Chưa ghi chỉ số',
        });
      } catch (err) {
        // Kỳ chưa tới (hợp đồng bắt đầu sau ngày thu) hoặc đã lập tới kỳ sau
        const ky = kyThuCuaThang(hd.ngayThanhToan, thang, nam);
        const ganNhat = await hoaDonGanNhat(hd._id);
        dong.push({
          ...base,
          loai: 'chuaLap',
          trangThai: 'chuaDenKy',
          chiSoDienCu: ganNhat?.chiSoDienCuoiKy ?? null,
          chiSoNuocCu: ganNhat?.chiSoNuocCuoiKy ?? null,
          noKyTruoc: await soDuCongNo(hd.nguoiDaiDien?._id),
          ghiChu: err instanceof LapHoaDonError ? err.message : `Kỳ ${fmtNgay(ky.batDau)}`,
        });
      }
    }

    if (hdPhong.length === 0 && hdHoatDong.length === 0) {
      dong.push({
        key: `p-${pid}`, loai: 'trong', phongId: pid, maPhong: phong.maPhong,
        hopDongId: null, hoaDonId: null, maHoaDon: null, khachThueId: null,
        hoTen: '', soDienThoai: '', soNguoi: 0, ngayThu: null,
        chiSoDienCu: null, chiSoDienMoi: null, soDien: 0, chiSoNuocCu: null, chiSoNuocMoi: null, soNuoc: 0,
        tienPhong: 0, tienPhongLe: 0, phiDichVu: 0, tienDienNuoc: 0, noKyTruoc: 0,
        canDong: 0, daDong: 0, boQuaTienThua: 0, conThieu: 0, hanThanhToan: null,
        trangThai: 'phongTrong', ghiChu: 'Phòng trống', daGhiChiSo: false,
      });
    }
  }

  const coTien = dong.filter((d) => d.loai === 'hangThang' || d.loai === 'chotPhong');
  const sum = (k: keyof DongBangThuTien) => coTien.reduce((s, d) => s + (d[k] as number), 0);
  return {
    toaNha: { _id: String(toaNha._id), tenToaNha: toaNha.tenToaNha },
    thang,
    nam,
    dong,
    tong: {
      soDien: sum('soDien'), soNuoc: sum('soNuoc'), tienPhong: sum('tienPhong'), phiDichVu: sum('phiDichVu'),
      canDong: sum('canDong'), daDong: sum('daDong'), conThieu: sum('conThieu'),
    },
  };
}

// ───────────────────────────── Lưu chỉ số hàng loạt ─────────────────────────────

export interface ChiSoNhap {
  phongId: string;
  chiSoDienMoi: number;
  chiSoNuocMoi: number;
}

export async function luuChiSoHangLoat(thang: number, nam: number, items: ChiSoNhap[], nguoiGhi: string) {
  const daLuu: string[] = [];
  const loi: Array<{ phongId: string; maPhong?: string; message: string }> = [];

  for (const it of items) {
    try {
      if (!mongoose.Types.ObjectId.isValid(it.phongId)) throw new LapHoaDonError('Phòng không hợp lệ');
      const dien = Math.round(Number(it.chiSoDienMoi));
      const nuoc = Math.round(Number(it.chiSoNuocMoi));
      if (!Number.isFinite(dien) || !Number.isFinite(nuoc) || dien < 0 || nuoc < 0) throw new LapHoaDonError('Chỉ số không hợp lệ');

      const phong = await Phong.findById(it.phongId).select('maPhong').lean<{ _id: OID; maPhong: string } | null>();
      if (!phong) throw new LapHoaDonError('Phòng không tồn tại');
      const hd = await HopDong.findOne({ phong: phong._id, trangThai: 'hoatDong' })
        .select('chiSoDienBanDau chiSoNuocBanDau').lean<{ _id: OID; chiSoDienBanDau: number; chiSoNuocBanDau: number } | null>();
      if (!hd) throw new LapHoaDonError(`Phòng ${phong.maPhong} không có hợp đồng đang hoạt động`);
      const daLap = await HoaDon.exists({ hopDong: hd._id, thang, nam, loaiHoaDon: { $ne: 'chotPhong' } });
      if (daLap) throw new LapHoaDonError(`Phòng ${phong.maPhong} đã lập hóa đơn tháng ${thang}/${nam} — sửa chỉ số trong hóa đơn`);

      // Chưa có hóa đơn tháng này nên hóa đơn gần nhất chính là kỳ trước
      const ganNhat = await hoaDonGanNhat(hd._id);
      const dienCu = ganNhat?.chiSoDienCuoiKy ?? hd.chiSoDienBanDau ?? 0;
      const nuocCu = ganNhat?.chiSoNuocCuoiKy ?? hd.chiSoNuocBanDau ?? 0;
      if (dien < dienCu) throw new LapHoaDonError(`Phòng ${phong.maPhong}: chỉ số điện ${dien} nhỏ hơn chỉ số cũ ${dienCu}`);
      if (nuoc < nuocCu) throw new LapHoaDonError(`Phòng ${phong.maPhong}: chỉ số nước ${nuoc} nhỏ hơn chỉ số cũ ${nuocCu}`);

      await ChiSoDienNuoc.findOneAndUpdate(
        { phong: phong._id, thang, nam },
        {
          $set: {
            chiSoDienCu: dienCu, chiSoDienMoi: dien, soDienTieuThu: dien - dienCu,
            chiSoNuocCu: nuocCu, chiSoNuocMoi: nuoc, soNuocTieuThu: nuoc - nuocCu,
            nguoiGhi: new mongoose.Types.ObjectId(nguoiGhi), ngayGhi: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      daLuu.push(it.phongId);
    } catch (err) {
      loi.push({ phongId: it.phongId, message: err instanceof Error ? err.message : 'Lỗi không xác định' });
    }
  }
  return { daLuu: daLuu.length, loi };
}

// ───────────────────────────── Lập hóa đơn hàng loạt ─────────────────────────────

export async function lapHoaDonHangLoat(thang: number, nam: number, hopDongIds: string[], nguoiTao: string) {
  let daLap = 0;
  const loi: Array<{ hopDongId: string; message: string }> = [];
  for (const id of hopDongIds) {
    try {
      const hoaDon = await lapHoaDonHangThang({ hopDongId: id, thang, nam }, nguoiTao);
      daLap++;
      if (hoaDon) guiZaloTuDong(hoaDon);
    } catch (err) {
      loi.push({ hopDongId: id, message: err instanceof LapHoaDonError ? err.message : 'Lỗi không xác định' });
      if (!(err instanceof LapHoaDonError)) console.error('lapHoaDonHangLoat', id, err);
    }
  }
  return { daLap, loi };
}
