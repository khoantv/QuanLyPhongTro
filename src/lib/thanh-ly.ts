/**
 * Chốt phòng dùng chung cho chuyển phòng và trả phòng:
 * chốt chỉ số điện nước, tính tiền phòng điều chỉnh theo ngày (thu thêm / hoàn), lập hóa đơn chốt,
 * thanh lý hợp đồng, xử lý tiền cọc.
 */
import mongoose from 'mongoose';
import HoaDon from '@/models/HoaDon';
import HopDong from '@/models/HopDong';
import Phong from '@/models/Phong';
import '@/models/KhachThue';
import { getCaiDatHoaDonLean } from '@/lib/cai-dat';
import { ghiButToan, ghiNhanHoaDonMoi, recomputeCongNo, soDuCongNo } from '@/lib/cong-no';
import {
  chuanHoaGiamTru, chuanHoaPhi, DongGiamTru, DongPhi, HopDongLean, hoaDonGanNhat, LapHoaDonError,
  maPhong, phongId, taiHopDong, ThayDongHo, tinhTieuThu, tinhTong,
} from '@/lib/hoa-don/lap-hoa-don';
import { congNgay, dauNgayVN, fmtNgay, fmtNgayThang, ngayVN, soNgayGiua, tienPhongTheoNgay } from '@/lib/ky-thu';
import { updateAllKhachThueStatus, updatePhongStatus } from '@/lib/status-utils';

type OID = mongoose.Types.ObjectId;
export type LoaiThanhLy = 'chuyenPhong' | 'traPhong';

export interface ChotInput {
  hopDongId: string;
  ngayChot: string | Date;
  chiSoDienChot: number;
  chiSoNuocChot: number;
  thayDongHo?: ThayDongHo | null;
  /** Có hoàn tiền phòng đã thu trước cho những ngày chưa ở không. Chuyển phòng luôn true. */
  hoanTienPhong: boolean;
  /** Ghi đè các dòng đã sửa ở bước xem trước. */
  phiDichVu?: Array<Partial<DongPhi>> | null;
  khoanGiamTru?: Array<Partial<DongGiamTru>> | null;
}

export interface BanTinhChot {
  hopDong: { _id: string; maHopDong: string; maPhong: string; giaThue: number; giaDien: number; giaNuoc: number; tienCoc: number };
  ngayChot: Date;
  mocTienPhong: Date;
  chiSoDienBanDau: number;
  chiSoDienChot: number;
  soDien: number;
  tienDien: number;
  chiSoNuocBanDau: number;
  chiSoNuocChot: number;
  soNuoc: number;
  tienNuoc: number;
  /** Tiền phòng điều chỉnh tự tính, có dấu: dương = khách còn thiếu, âm = đã trả trước chưa ở. */
  tienPhongDieuChinh: { soTien: number; soNgay: number; tuNgay: Date; denNgay: Date };
  phiDichVu: DongPhi[];
  khoanGiamTru: DongGiamTru[];
  tongTruocLamTron: number;
  tienLamTron: number;
  tongTien: number;
  soDuTruoc: number;
  soDuSau: number;
}

async function hopDongDangHoatDong(hopDongId: string) {
  const hd = await taiHopDong(hopDongId);
  if (hd.trangThai !== 'hoatDong') throw new LapHoaDonError('Hợp đồng không còn hoạt động');
  return hd as HopDongLean & { tienCoc?: number };
}

/** Ngày chốt sớm nhất được phép: sau ngày bắt đầu và không trước ngày thu của hóa đơn hàng tháng mới nhất. */
async function ngayChotSomNhat(hd: HopDongLean) {
  const moiNhat = await HoaDon.findOne({ hopDong: hd._id, loaiHoaDon: { $ne: 'chotPhong' } })
    .sort({ kyBatDau: -1, nam: -1, thang: -1 })
    .select('kyBatDau').lean<{ kyBatDau?: Date | null } | null>();
  const batDau = dauNgayVN(hd.ngayBatDau);
  if (moiNhat?.kyBatDau && soNgayGiua(batDau, moiNhat.kyBatDau) > 0) return dauNgayVN(moiNhat.kyBatDau);
  return batDau;
}

/** Tính hóa đơn chốt phòng — không ghi DB. */
export async function tinhTienChot(input: ChotInput): Promise<BanTinhChot> {
  const hd = await hopDongDangHoatDong(input.hopDongId);
  const caiDat = await getCaiDatHoaDonLean();

  const ngayChot = dauNgayVN(input.ngayChot);
  if (Number.isNaN(ngayChot.getTime())) throw new LapHoaDonError('Ngày chốt không hợp lệ');
  const somNhat = await ngayChotSomNhat(hd);
  if (soNgayGiua(somNhat, ngayChot) < 0) {
    throw new LapHoaDonError(`Ngày rời phòng phải từ ${fmtNgay(somNhat)} trở đi`);
  }

  const ganNhat = await hoaDonGanNhat(hd._id);
  const chiSoDienBanDau = ganNhat?.chiSoDienCuoiKy ?? hd.chiSoDienBanDau ?? 0;
  const chiSoNuocBanDau = ganNhat?.chiSoNuocCuoiKy ?? hd.chiSoNuocBanDau ?? 0;
  const chiSoDienChot = Math.round(Number(input.chiSoDienChot));
  const chiSoNuocChot = Math.round(Number(input.chiSoNuocChot));
  if (!Number.isFinite(chiSoDienChot) || !Number.isFinite(chiSoNuocChot)) {
    throw new LapHoaDonError('Vui lòng nhập chỉ số điện nước lúc rời phòng');
  }
  const soDien = tinhTieuThu('điện', chiSoDienBanDau, chiSoDienChot, input.thayDongHo?.soDien);
  const soNuoc = tinhTieuThu('nước', chiSoNuocBanDau, chiSoNuocChot, input.thayDongHo?.soNuoc);

  // Tiền phòng điều chỉnh: từ mốc đã lập hóa đơn tiền phòng tới ngày chốt
  const mocTienPhong = dauNgayVN(hd.daThuTienPhongDen ?? hd.ngayBatDau);
  const dc = tienPhongTheoNgay(hd.giaThue, hd.ngayThanhToan, mocTienPhong, ngayChot);
  const tienPhongDieuChinh = {
    soTien: dc.soTien,
    soNgay: dc.soNgay,
    tuNgay: dc.soNgay >= 0 ? mocTienPhong : ngayChot,
    denNgay: dc.soNgay >= 0 ? ngayChot : mocTienPhong,
  };
  const khoangNgay = `${fmtNgayThang(tienPhongDieuChinh.tuNgay)} – ${fmtNgayThang(congNgay(tienPhongDieuChinh.denNgay, -1))}, ${Math.abs(dc.soNgay)} ngày`;
  const soNgayCuaKy = dc.chiTiet.length === 1 ? dc.chiTiet[0].soNgayCuaKy : dc.chiTiet.reduce((s, c) => s + c.soNgayCuaKy, 0);

  const phiMacDinh: DongPhi[] = dc.soTien > 0
    ? [{
      ten: `Tiền phòng (${khoangNgay})`,
      gia: dc.soTien,
      loai: 'tienPhongLe',
      chiTiet: {
        tuNgay: tienPhongDieuChinh.tuNgay, denNgay: tienPhongDieuChinh.denNgay, soNgay: dc.soNgay,
        soNgayCuaKy, giaThue: hd.giaThue, soTienTuTinh: dc.soTien,
      },
    }]
    : [];
  const giamTruMacDinh: DongGiamTru[] = dc.soTien < 0 && input.hoanTienPhong
    ? [{ ten: `Hoàn tiền phòng chưa ở (${khoangNgay})`, soTien: -dc.soTien }]
    : [];

  const phiDichVu = input.phiDichVu ? chuanHoaPhi(input.phiDichVu) : phiMacDinh;
  const khoanGiamTru = input.khoanGiamTru ? chuanHoaGiamTru(input.khoanGiamTru) : giamTruMacDinh;
  const tienDien = soDien * hd.giaDien;
  const tienNuoc = soNuoc * hd.giaNuoc;
  const tong = tinhTong({ tienPhong: 0, tienDien, tienNuoc, phiDichVu, khoanGiamTru }, Boolean(caiDat.lamTronHoaDon));
  const soDuTruoc = await soDuCongNo(hd.nguoiDaiDien);

  return {
    hopDong: {
      _id: String(hd._id), maHopDong: hd.maHopDong, maPhong: maPhong(hd),
      giaThue: hd.giaThue, giaDien: hd.giaDien, giaNuoc: hd.giaNuoc, tienCoc: hd.tienCoc ?? 0,
    },
    ngayChot,
    mocTienPhong,
    chiSoDienBanDau, chiSoDienChot, soDien, tienDien,
    chiSoNuocBanDau, chiSoNuocChot, soNuoc, tienNuoc,
    tienPhongDieuChinh,
    phiDichVu,
    khoanGiamTru,
    tongTruocLamTron: tong.truocLamTron,
    tienLamTron: tong.tienLamTron,
    tongTien: tong.tongTien,
    soDuTruoc,
    soDuSau: soDuTruoc + tong.tongTien,
  };
}

/**
 * Thực hiện chốt phòng. Thanh lý hợp đồng trước (điều kiện trangThai='hoatDong', kèm maThaoTac)
 * để hai request trùng không cùng chốt; lỗi ở các bước sau sẽ trả hợp đồng về 'hoatDong'.
 */
async function thucHienChot(
  input: ChotInput,
  loai: LoaiThanhLy,
  maThaoTac: string,
  nguoiId?: string | null,
) {
  const bt = await tinhTienChot(input);
  const hd = await taiHopDong(input.hopDongId);
  const caiDat = await getCaiDatHoaDonLean();

  const claim = await HopDong.updateOne(
    { _id: hd._id, trangThai: 'hoatDong' },
    {
      $set: {
        trangThai: 'daThanhLy',
        lyDoKetThuc: loai,
        ngayTraPhong: bt.ngayChot,
        daThuTienPhongDen: bt.ngayChot,
        maThaoTacThanhLy: maThaoTac,
      },
    },
  );
  if (claim.modifiedCount === 0) throw new LapHoaDonError('Hợp đồng không còn hoạt động');

  try {
    const { nam, thang } = ngayVN(bt.ngayChot);
    const ma = `CP${nam}${String(thang).padStart(2, '0')}${String(ngayVN(bt.ngayChot).ngay).padStart(2, '0')}${bt.hopDong.maPhong}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let maHoaDon = ma;
    for (let i = 2; await HoaDon.exists({ maHoaDon }); i++) maHoaDon = `${ma}-${i}`;

    const hoaDon = await HoaDon.create({
      maHoaDon,
      hopDong: hd._id,
      phong: phongId(hd),
      khachThue: hd.nguoiDaiDien,
      loaiHoaDon: 'chotPhong',
      thang,
      nam,
      kyBatDau: null,
      kyKetThuc: null,
      mocTienPhongTruoc: bt.mocTienPhong,
      tienPhong: 0,
      tienDien: bt.tienDien,
      soDien: bt.soDien,
      chiSoDienBanDau: bt.chiSoDienBanDau,
      chiSoDienCuoiKy: bt.chiSoDienChot,
      tienNuoc: bt.tienNuoc,
      soNuoc: bt.soNuoc,
      chiSoNuocBanDau: bt.chiSoNuocBanDau,
      chiSoNuocCuoiKy: bt.chiSoNuocChot,
      phiDichVu: bt.phiDichVu,
      khoanGiamTru: bt.khoanGiamTru,
      tienLamTron: bt.tienLamTron,
      tongTien: bt.tongTien,
      daThanhToan: 0,
      conLai: Math.max(0, bt.tongTien),
      hanThanhToan: congNgay(bt.ngayChot, caiDat.hanDongTien ?? 5),
      ghiChu: loai === 'chuyenPhong' ? 'Hóa đơn chốt khi chuyển phòng' : 'Hóa đơn chốt khi trả phòng',
      hinhThucThanhToan: caiDat.hinhThucThanhToanMacDinh,
    });
    await ghiNhanHoaDonMoi(hoaDon, nguoiId);
    return { bt, hoaDonChot: hoaDon, hopDongCu: hd };
  } catch (err) {
    await HopDong.updateOne(
      { _id: hd._id, maThaoTacThanhLy: maThaoTac },
      { $set: { trangThai: 'hoatDong', lyDoKetThuc: null, ngayTraPhong: null, daThuTienPhongDen: bt.mocTienPhong, maThaoTacThanhLy: null } },
    );
    throw err;
  }
}

/** Lần gọi lặp lại với cùng maThaoTac: trả kết quả đã có. */
async function ketQuaDaCo(hopDongId: string, maThaoTac: string) {
  const hd = await HopDong.findOne({ _id: hopDongId, maThaoTacThanhLy: maThaoTac, trangThai: 'daThanhLy' })
    .select('_id hopDongSau').lean<{ _id: OID; hopDongSau?: OID | null } | null>();
  if (!hd) return null;
  const hoaDonChot = await HoaDon.findOne({ hopDong: hd._id, loaiHoaDon: 'chotPhong' }).sort({ ngayTao: -1 });
  const hopDongMoi = hd.hopDongSau ? await HopDong.findById(hd.hopDongSau) : null;
  return { daXuLyTruocDo: true, hoaDonChot, hopDongMoi };
}

function kiemTraMaThaoTac(maThaoTac: unknown): string {
  if (typeof maThaoTac !== 'string' || !/^[\w-]{8,64}$/.test(maThaoTac)) {
    throw new LapHoaDonError('Thiếu mã thao tác (maThaoTac)');
  }
  return maThaoTac;
}

// ───────────────────────────── Chuyển phòng ─────────────────────────────

export interface ChuyenPhongInput {
  hopDongId: string;
  phongMoiId: string;
  ngayChuyen: string | Date;
  chiSoDienChot: number;
  chiSoNuocChot: number;
  chiSoDienBatDauPhongMoi: number;
  chiSoNuocBatDauPhongMoi: number;
  thayDongHo?: ThayDongHo | null;
  giaThueMoi?: number | null;
  tienCocMoi?: number | null;
  ngayThanhToanMoi?: number | null;
  phiDichVuMoi?: Array<{ ten: string; gia: number }> | null;
  phiDichVu?: Array<Partial<DongPhi>> | null;
  khoanGiamTru?: Array<Partial<DongGiamTru>> | null;
  maThaoTac: string;
}

async function kiemTraPhongMoi(hopDongCu: HopDongLean, phongMoiId: string) {
  if (!mongoose.Types.ObjectId.isValid(phongMoiId)) throw new LapHoaDonError('Phòng mới không hợp lệ');
  if (String(phongId(hopDongCu)) === String(phongMoiId)) throw new LapHoaDonError('Phòng mới trùng phòng hiện tại');
  const phong = await Phong.findById(phongMoiId).select('maPhong giaThue tienCoc trangThai').lean<{ _id: OID; maPhong: string; giaThue: number; tienCoc: number; trangThai: string } | null>();
  if (!phong) throw new LapHoaDonError('Phòng mới không tồn tại', 404);
  const dangCoHopDong = await HopDong.exists({ phong: phong._id, trangThai: 'hoatDong' });
  if (phong.trangThai !== 'trong' || dangCoHopDong) throw new LapHoaDonError('Phòng mới không còn trống');
  return phong;
}

/** Gợi ý chỉ số hiện tại của một phòng: chỉ số cuối của hóa đơn gần nhất, nếu không có thì của hợp đồng gần nhất. */
export async function chiSoHienTaiCuaPhong(phongIdStr: string) {
  const hoaDon = await HoaDon.findOne({ phong: phongIdStr }).sort({ ngayTao: -1 })
    .select('chiSoDienCuoiKy chiSoNuocCuoiKy').lean<{ chiSoDienCuoiKy: number; chiSoNuocCuoiKy: number } | null>();
  if (hoaDon) return { dien: hoaDon.chiSoDienCuoiKy, nuoc: hoaDon.chiSoNuocCuoiKy, nguon: 'hoaDon' as const };
  const hd = await HopDong.findOne({ phong: phongIdStr }).sort({ ngayBatDau: -1 })
    .select('chiSoDienBanDau chiSoNuocBanDau').lean<{ chiSoDienBanDau: number; chiSoNuocBanDau: number } | null>();
  if (hd) return { dien: hd.chiSoDienBanDau, nuoc: hd.chiSoNuocBanDau, nguon: 'hopDong' as const };
  return null;
}

export async function thongTinPhongMoi(hopDongId: string, phongMoiId: string) {
  const hd = await hopDongDangHoatDong(hopDongId);
  const phong = await kiemTraPhongMoi(hd, phongMoiId);
  return { phong, chiSoGoiY: await chiSoHienTaiCuaPhong(String(phong._id)) };
}

export async function chuyenPhong(input: ChuyenPhongInput, nguoiId?: string | null) {
  const maThaoTac = kiemTraMaThaoTac(input.maThaoTac);
  const daCo = await ketQuaDaCo(input.hopDongId, maThaoTac);
  if (daCo) return daCo;

  const hdCu = await hopDongDangHoatDong(input.hopDongId) as HopDongLean & {
    khachThueId: OID[]; ngayKetThuc: Date; tienCoc: number; dieuKhoan: string;
  };
  const phongMoi = await kiemTraPhongMoi(hdCu, input.phongMoiId);
  for (const [ten, v] of [['điện', input.chiSoDienBatDauPhongMoi], ['nước', input.chiSoNuocBatDauPhongMoi]] as const) {
    if (!Number.isFinite(Number(v)) || Number(v) < 0) throw new LapHoaDonError(`Vui lòng nhập chỉ số ${ten} bắt đầu của phòng mới`);
  }
  if (input.ngayThanhToanMoi != null && (input.ngayThanhToanMoi < 1 || input.ngayThanhToanMoi > 31)) {
    throw new LapHoaDonError('Ngày thu tiền phải từ 1 đến 31');
  }

  const { bt, hoaDonChot } = await thucHienChot({
    hopDongId: input.hopDongId,
    ngayChot: input.ngayChuyen,
    chiSoDienChot: input.chiSoDienChot,
    chiSoNuocChot: input.chiSoNuocChot,
    thayDongHo: input.thayDongHo,
    hoanTienPhong: true,
    phiDichVu: input.phiDichVu,
    khoanGiamTru: input.khoanGiamTru,
  }, 'chuyenPhong', maThaoTac, nguoiId);

  const full = await HopDong.findById(hdCu._id).lean<Record<string, unknown> & { maHopDong: string; ngayKetThuc: Date; tienCoc: number }>();
  let maHopDong = `${full!.maHopDong}-${phongMoi.maPhong}`.toUpperCase();
  for (let i = 2; await HopDong.exists({ maHopDong }); i++) maHopDong = `${full!.maHopDong}-${phongMoi.maPhong}-${i}`.toUpperCase();

  const tienCocCu = full!.tienCoc ?? 0;
  const tienCocMoi = input.tienCocMoi == null ? tienCocCu : Math.max(0, Math.round(input.tienCocMoi));
  const ngayKetThuc = soNgayGiua(bt.ngayChot, full!.ngayKetThuc) > 0 ? full!.ngayKetThuc : congNgay(bt.ngayChot, 365);

  const hopDongMoi = await HopDong.create({
    maHopDong,
    phong: phongMoi._id,
    khachThueId: hdCu.khachThueId,
    nguoiDaiDien: hdCu.nguoiDaiDien,
    ngayBatDau: bt.ngayChot,
    ngayKetThuc,
    giaThue: input.giaThueMoi == null ? phongMoi.giaThue : Math.max(0, Math.round(input.giaThueMoi)),
    tienCoc: tienCocMoi,
    chuKyThanhToan: 'thang',
    ngayThanhToan: input.ngayThanhToanMoi ?? hdCu.ngayThanhToan,
    dieuKhoan: hdCu.dieuKhoan || 'Chuyển từ hợp đồng ' + hdCu.maHopDong,
    giaDien: hdCu.giaDien,
    giaNuoc: hdCu.giaNuoc,
    chiSoDienBanDau: Math.round(Number(input.chiSoDienBatDauPhongMoi)),
    chiSoNuocBanDau: Math.round(Number(input.chiSoNuocBatDauPhongMoi)),
    phiDichVu: input.phiDichVuMoi ?? hdCu.phiDichVu,
    trangThai: 'hoatDong',
    daThuTienPhongDen: bt.ngayChot,
    hopDongTruoc: hdCu._id,
  });
  await HopDong.updateOne({ _id: hdCu._id }, { $set: { hopDongSau: hopDongMoi._id } });

  if (tienCocMoi !== tienCocCu) {
    await ghiButToan({
      khachThue: hdCu.nguoiDaiDien,
      loai: 'tienCoc',
      soTien: tienCocMoi - tienCocCu,
      hopDong: hopDongMoi._id,
      phong: phongMoi._id,
      ngayGhiNhan: bt.ngayChot,
      moTa: tienCocMoi > tienCocCu
        ? `Nộp thêm cọc khi chuyển sang phòng ${phongMoi.maPhong}`
        : `Cọc dư khi chuyển sang phòng ${phongMoi.maPhong}`,
      nguoiTao: nguoiId,
    });
    await recomputeCongNo(hdCu.nguoiDaiDien);
  }

  await updatePhongStatus(String(phongId(hdCu)));
  await updatePhongStatus(String(phongMoi._id));
  await updateAllKhachThueStatus(hdCu.khachThueId.map(String));

  return { daXuLyTruocDo: false, banTinh: bt, hoaDonChot, hopDongMoi };
}

// ───────────────────────────── Trả phòng ─────────────────────────────

export interface TraPhongInput {
  hopDongId: string;
  ngayTraPhong: string | Date;
  chiSoDienChot: number;
  chiSoNuocChot: number;
  thayDongHo?: ThayDongHo | null;
  hoanTienPhong?: boolean | null;
  dungCocTruNo?: boolean | null;
  phiDichVu?: Array<Partial<DongPhi>> | null;
  khoanGiamTru?: Array<Partial<DongGiamTru>> | null;
  maThaoTac: string;
}

export async function hoanTienPhongMacDinh(hoanTienPhong?: boolean | null) {
  if (typeof hoanTienPhong === 'boolean') return hoanTienPhong;
  const caiDat = await getCaiDatHoaDonLean();
  return Boolean(caiDat.hoanTienPhongKhiTraPhong);
}

export async function traPhong(input: TraPhongInput, nguoiId?: string | null) {
  const maThaoTac = kiemTraMaThaoTac(input.maThaoTac);
  const daCo = await ketQuaDaCo(input.hopDongId, maThaoTac);
  if (daCo) return daCo;

  const hd = await hopDongDangHoatDong(input.hopDongId) as HopDongLean & { khachThueId: OID[]; tienCoc: number };
  const { bt, hoaDonChot } = await thucHienChot({
    hopDongId: input.hopDongId,
    ngayChot: input.ngayTraPhong,
    chiSoDienChot: input.chiSoDienChot,
    chiSoNuocChot: input.chiSoNuocChot,
    thayDongHo: input.thayDongHo,
    hoanTienPhong: await hoanTienPhongMacDinh(input.hoanTienPhong),
    phiDichVu: input.phiDichVu,
    khoanGiamTru: input.khoanGiamTru,
  }, 'traPhong', maThaoTac, nguoiId);

  let truCoc = 0;
  if (input.dungCocTruNo !== false && (hd.tienCoc ?? 0) > 0) {
    const soDu = await soDuCongNo(hd.nguoiDaiDien);
    truCoc = Math.min(hd.tienCoc, Math.max(0, soDu));
    if (truCoc > 0) {
      await ghiButToan({
        khachThue: hd.nguoiDaiDien,
        loai: 'truCoc',
        soTien: -truCoc,
        hopDong: hd._id,
        phong: phongId(hd),
        ngayGhiNhan: bt.ngayChot,
        moTa: `Dùng tiền cọc trừ nợ khi trả phòng ${maPhong(hd)}`,
        nguoiTao: nguoiId,
      });
      await HopDong.updateOne({ _id: hd._id }, { $set: { tienCocDaTru: truCoc } });
      await recomputeCongNo(hd.nguoiDaiDien);
    }
  }

  await updatePhongStatus(String(phongId(hd)));
  await updateAllKhachThueStatus(hd.khachThueId.map(String));

  const soDuCuoi = await soDuCongNo(hd.nguoiDaiDien);
  return {
    daXuLyTruocDo: false,
    banTinh: bt,
    hoaDonChot,
    truCoc,
    cocConLai: (hd.tienCoc ?? 0) - truCoc,
    soDuCuoi,
  };
}

// ───────────────────────────── Hoàn tiền cho khách ─────────────────────────────

export interface HoanTienInput {
  khachThueId: string;
  /** tienThua: trả lại tiền thừa trong sổ công nợ; tienCoc: hoàn phần cọc còn lại của hợp đồng đã thanh lý */
  nguon: 'tienThua' | 'tienCoc';
  hopDongId?: string | null;
  soTien: number;
  phuongThuc?: 'tienMat' | 'chuyenKhoan';
  ngay?: string | Date | null;
  ghiChu?: string | null;
}

export async function hoanTienChoKhach(input: HoanTienInput, nguoiId?: string | null) {
  const soTien = Math.round(Number(input.soTien));
  if (!Number.isFinite(soTien) || soTien <= 0) throw new LapHoaDonError('Số tiền hoàn phải lớn hơn 0');
  if (!mongoose.Types.ObjectId.isValid(input.khachThueId)) throw new LapHoaDonError('Khách thuê không hợp lệ');
  const ngay = input.ngay ? dauNgayVN(input.ngay) : new Date();

  const KhachThue = mongoose.model('KhachThue');
  const khach = await KhachThue.findById(input.khachThueId).select('hoTen').lean<{ _id: OID; hoTen: string } | null>();
  if (!khach) throw new LapHoaDonError('Khách thuê không tồn tại', 404);

  type HopDongHoan = { _id: OID; maHopDong: string; phong: OID; tienCoc: number; tienCocDaTru?: number; tienCocDaHoan?: number; trangThai: string; nguoiDaiDien: OID };
  let hopDong: HopDongHoan | null = null;
  if (input.hopDongId) {
    if (!mongoose.Types.ObjectId.isValid(input.hopDongId)) throw new LapHoaDonError('Hợp đồng không hợp lệ');
    hopDong = await HopDong.findById(input.hopDongId).select('maHopDong phong tienCoc tienCocDaTru tienCocDaHoan trangThai nguoiDaiDien').lean<HopDongHoan | null>();
    if (!hopDong) throw new LapHoaDonError('Hợp đồng không tồn tại', 404);
    if (String(hopDong.nguoiDaiDien) !== String(khach._id)) throw new LapHoaDonError('Hợp đồng không thuộc khách thuê này');
  }

  let danhMucKey: string;
  let noiDung: string;
  if (input.nguon === 'tienThua') {
    const soDu = await soDuCongNo(khach._id);
    if (-soDu < soTien) {
      throw new LapHoaDonError(`Khách chỉ có ${Math.max(0, -soDu).toLocaleString('vi-VN')}đ tiền thừa`);
    }
    await ghiButToan({
      khachThue: khach._id,
      loai: 'hoanTien',
      soTien,
      ngayGhiNhan: ngay,
      hopDong: hopDong?._id,
      phong: hopDong?.phong,
      moTa: `Hoàn tiền thừa cho khách${input.ghiChu ? ` — ${input.ghiChu}` : ''}`,
      nguoiTao: nguoiId,
    });
    await recomputeCongNo(khach._id);
    danhMucKey = 'chi-hoan-tra-tien-ket-thuc-hop-dong';
    noiDung = `Hoàn tiền thừa — ${khach.hoTen}${hopDong ? ` — HĐ ${hopDong.maHopDong}` : ''}`;
  } else {
    if (!hopDong) throw new LapHoaDonError('Vui lòng chọn hợp đồng để hoàn cọc');
    if (hopDong.trangThai !== 'daThanhLy') throw new LapHoaDonError('Chỉ hoàn cọc cho hợp đồng đã thanh lý');
    const conLai = (hopDong.tienCoc ?? 0) - (hopDong.tienCocDaTru ?? 0) - (hopDong.tienCocDaHoan ?? 0);
    if (soTien > conLai) throw new LapHoaDonError(`Cọc còn lại chỉ ${Math.max(0, conLai).toLocaleString('vi-VN')}đ`);
    const capNhat = await HopDong.updateOne(
      { _id: hopDong._id, tienCocDaHoan: hopDong.tienCocDaHoan ?? 0 },
      { $inc: { tienCocDaHoan: soTien } },
    );
    if (capNhat.modifiedCount === 0) throw new LapHoaDonError('Cọc vừa được hoàn ở nơi khác — vui lòng tải lại', 409);
    danhMucKey = 'chi-hoan-tien-coc';
    noiDung = `Hoàn cọc — ${khach.hoTen} — HĐ ${hopDong.maHopDong}`;
  }

  // Phiếu chi trong module thu/chi
  const { ensureDefaultThuChiCategories } = await import('@/lib/thu-chi-seed');
  const DanhMucThuChi = (await import('@/models/DanhMucThuChi')).default;
  const PhieuThuChi = (await import('@/models/PhieuThuChi')).default;
  await ensureDefaultThuChiCategories();
  const danhMuc = await DanhMucThuChi.findOne({ key: danhMucKey }).select('_id').lean<{ _id: OID } | null>();
  let toaNha: OID | null = null;
  if (hopDong?.phong) {
    toaNha = (await Phong.findById(hopDong.phong).select('toaNha').lean<{ toaNha: OID } | null>())?.toaNha ?? null;
  }
  const phieuChi = danhMuc
    ? await PhieuThuChi.create({
      loai: 'chi',
      soTien,
      phuongThuc: input.phuongThuc === 'chuyenKhoan' ? 'chuyenKhoan' : 'tienMat',
      nguoiThanhToan: khach.hoTen,
      noiDung: (input.ghiChu ? `${noiDung} — ${input.ghiChu}` : noiDung).slice(0, 500),
      danhMuc: danhMuc._id,
      ngayLapPhieu: ngay,
      toaNha,
      nguoiTao: nguoiId ?? null,
    })
    : null;

  return { soDu: await soDuCongNo(khach._id), phieuChi };
}
