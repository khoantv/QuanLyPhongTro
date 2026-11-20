// Types cho hệ thống quản lý phòng trọ

export interface DiaChi {
  soNha: string;
  duong: string;
  phuong: string;
  quan: string;
  thanhPho: string;
}

export interface AnhCCCD {
  matTruoc: string;
  matSau: string;
}

export interface ThongTinChuyenKhoan {
  nganHang: string;
  soGiaoDich: string;
}

export type LoaiPhiHoaDon = 'dichVu' | 'tienPhongLe' | 'khac';

export interface ChiTietTienPhongLe {
  tuNgay: string | Date;
  denNgay: string | Date;
  soNgay: number;
  soNgayCuaKy: number;
  giaThue: number;
  soTienTuTinh: number;
}

export interface PhiDichVu {
  ten: string;
  gia: number;
  /** Chỉ có trên hóa đơn: dichVu (phí hợp đồng), tienPhongLe, khac (khoản phát sinh) */
  loai?: LoaiPhiHoaDon;
  chiTiet?: ChiTietTienPhongLe | null;
}

export interface KhoanGiamTru {
  ten: string;
  soTien: number;
}

export interface NguoiDung {
  _id?: string;
  ten: string;
  email: string;
  matKhau: string;
  soDienThoai: string;
  vaiTro: 'admin' | 'chuNha' | 'nhanVien';
  anhDaiDien?: string;
  trangThai: 'hoatDong' | 'khoa';
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface ToaNha {
  _id?: string;
  tenToaNha: string;
  diaChi: DiaChi;
  moTa?: string;
  anhToaNha: string[];
  chuSoHuu: string; // ObjectId ref NguoiDung
  tongSoPhong: number;
  tienNghiChung: string[];
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface Phong {
  _id?: string;
  maPhong: string;
  toaNha: string; // ObjectId ref ToaNha
  tang: number;
  dienTich: number;
  giaThue: number;
  tienCoc: number;
  moTa?: string;
  anhPhong: string[];
  tienNghi: string[];
  trangThai: 'trong' | 'daDat' | 'dangThue' | 'baoTri';
  soNguoiToiDa: number;
  ngayTao: Date;
  ngayCapNhat: Date;
  hopDongHienTai?: {
    _id: string;
    khachThueId: Array<{
      _id: string;
      hoTen: string;
      soDienThoai: string;
    }>;
    nguoiDaiDien: {
      _id: string;
      hoTen: string;
      soDienThoai: string;
    };
  };
}

export interface KhachThue {
  _id?: string;
  hoTen: string;
  soDienThoai: string;
  email?: string;
  cccd: string;
  ngaySinh: Date;
  gioiTinh: 'nam' | 'nu' | 'khac';
  queQuan: string;
  anhCCCD: AnhCCCD;
  ngheNghiep?: string;
  matKhau?: string;
  trangThai: 'dangThue' | 'daTraPhong' | 'chuaThue';
  zaloUserId?: string;
  daQuanTamOA?: boolean;
  ngayTao: Date;
  ngayCapNhat: Date;
  hopDongHienTai?: {
    _id: string;
    phong: {
      _id: string;
      maPhong: string;
      toaNha: {
        _id: string;
        tenToaNha: string;
      };
    };
  };
}

export type HinhThucThanhToan = 'tienMat' | 'chuyenKhoan' | 'momo' | 'vnpay' | 'khac';

/** Cách xử lý phần tiền khách đóng thừa: trừ vào kỳ sau hoặc bỏ qua. */
export type XuLyTienThua = 'truKySau' | 'khongTru';

export interface CaiDatHoaDon {
  _id?: string;
  singleton?: true;
  tenNhaTro: string;
  ngayLapHoaDon: number | null;
  hanDongTien: number;
  autoSendZalo: boolean;
  hienMaQR: boolean;
  phanLoaiThuChi: boolean;
  lamTronHoaDon: boolean;
  hinhThucThanhToanMacDinh: HinhThucThanhToan;
  ghiChuMacDinh: string;
  xuLyTienThuaMacDinh: XuLyTienThua;
  hoanTienPhongKhiTraPhong?: boolean;
  ngayTao?: Date;
  ngayCapNhat?: Date;
}

export type ZaloLogStatus = 'queued' | 'sent' | 'failed' | 'failed_permanent' | 'skipped';
export type ZaloLogTrigger = 'auto' | 'manual' | 'preview' | 'retry';
export type ZaloRecipientType = 'tenant' | 'owner_preview';

export interface ZaloMessageLog {
  _id?: string;
  hoaDonId?: string | { _id: string; maHoaDon: string } | null;
  khachThueId?: string | { _id: string; hoTen: string; soDienThoai?: string } | null;
  phongId?: string | { _id: string; maPhong: string } | null;
  recipientType: ZaloRecipientType;
  recipientZaloUserId: string;
  trigger: ZaloLogTrigger;
  status: ZaloLogStatus;
  sentAt: Date | string | null;
  errorCode: string | null;
  errorMessage: string | null;
  zaloMessageId: string | null;
  retryCount: number;
  nextRetryAt: Date | string | null;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown> | null;
  ngayTao?: Date | string;
  ngayCapNhat?: Date | string;
}

export type LoaiPhuongTien = 'xeMay' | 'oTo' | 'xeDap' | 'xeDien' | 'khac';

export type LoaiGanKetTaiSan = 'phong' | 'chung';

export interface TaiSan {
  _id?: string;
  ten: string;
  icon: string;
  giaTri: number;
  giaNhap?: number | null;
  tongSoLuong: number;
  donVi: string;
  donViCungCap?: string;
  loaiGanKet: LoaiGanKetTaiSan;
  phong?: string | { _id: string; maPhong: string } | null;
  toaNha?: string | { _id: string; tenToaNha: string } | null;
  moTa?: string;
  ngayMua?: Date | string | null;
  ngayTao?: Date | string;
  ngayCapNhat?: Date | string;
}

export interface PhuongTien {
  _id?: string;
  khachThue: string | {
    _id: string;
    hoTen: string;
    soDienThoai?: string;
  };
  tenXe: string;
  bienSo: string;
  loaiXe: LoaiPhuongTien;
  hinhAnh: string[];
  moTa?: string;
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface HopDong {
  _id?: string;
  maHopDong: string;
  phong: string; // ObjectId ref Phong
  khachThueId: string[]; // ObjectId[] ref KhachThue
  nguoiDaiDien: string; // ObjectId ref KhachThue
  ngayBatDau: Date;
  ngayKetThuc: Date;
  giaThue: number;
  tienCoc: number;
  chuKyThanhToan: 'thang' | 'quy' | 'nam';
  ngayThanhToan: number;
  dieuKhoan: string;
  giaDien: number;
  giaNuoc: number;
  chiSoDienBanDau: number;
  chiSoNuocBanDau: number;
  phiDichVu: PhiDichVu[];
  trangThai: 'hoatDong' | 'hetHan' | 'daHuy' | 'daThanhLy';
  daThuTienPhongDen?: string | Date | null;
  hopDongTruoc?: string | null;
  hopDongSau?: string | null;
  lyDoKetThuc?: 'hetHan' | 'traPhong' | 'chuyenPhong' | 'huy' | null;
  ngayTraPhong?: string | Date | null;
  fileHopDong?: string;
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface ChiSoDienNuoc {
  _id?: string;
  phong: string; // ObjectId ref Phong
  thang: number;
  nam: number;
  chiSoDienCu: number;
  chiSoDienMoi: number;
  soDienTieuThu: number;
  chiSoNuocCu: number;
  chiSoNuocMoi: number;
  soNuocTieuThu: number;
  anhChiSoDien?: string;
  anhChiSoNuoc?: string;
  nguoiGhi: string; // ObjectId ref NguoiDung
  ngayGhi: Date;
  ngayTao: Date;
}

export interface HoaDon {
  _id?: string;
  maHoaDon: string;
  hopDong: string; // ObjectId ref HopDong
  phong: string; // ObjectId ref Phong
  khachThue: string; // ObjectId ref KhachThue
  thang: number;
  nam: number;
  tienPhong: number;
  tienDien: number;
  soDien: number;
  chiSoDienBanDau: number;
  chiSoDienCuoiKy: number;
  tienNuoc: number;
  soNuoc: number;
  chiSoNuocBanDau: number;
  chiSoNuocCuoiKy: number;
  phiDichVu: PhiDichVu[];
  tongTien: number;
  daThanhToan: number;
  conLai: number;
  /** Số dư công nợ trước hóa đơn này: dương = nợ kỳ trước, âm = tiền thừa kỳ trước. */
  noKyTruoc?: number;
  /** tongTien + noKyTruoc */
  tongCanThanhToan?: number;
  khoanGiamTru?: KhoanGiamTru[];
  loaiHoaDon?: 'hangThang' | 'chotPhong';
  kyBatDau?: string | Date | null;
  kyKetThuc?: string | Date | null;
  tienLamTron?: number;
  hinhThucThanhToan?: HinhThucThanhToan | null;
  trangThai: 'chuaThanhToan' | 'daThanhToanMotPhan' | 'daThanhToan' | 'quaHan';
  hanThanhToan: Date;
  ghiChu?: string;
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface ThanhToan {
  _id?: string;
  khachThue: string; // ObjectId ref KhachThue
  hopDong?: string | null; // ObjectId ref HopDong
  hoaDon?: string | null; // ObjectId ref HoaDon — gợi ý; phân bổ thực tế theo FIFO
  xuLyTienThua?: XuLyTienThua | null;
  soTien: number;
  phuongThuc: 'tienMat' | 'chuyenKhoan' | 'viDienTu';
  thongTinChuyenKhoan?: ThongTinChuyenKhoan;
  ngayThanhToan: Date;
  nguoiNhan: string; // ObjectId ref NguoiDung
  ghiChu?: string;
  anhBienLai?: string;
  ngayTao: Date;
}

export type LoaiThuChi = 'thu' | 'chi';
export type PhuongThucThuChi = 'tienMat' | 'chuyenKhoan';

export interface DanhMucThuChi {
  _id?: string;
  ten: string;
  loai: LoaiThuChi;
  key?: string | null;
  icon?: string;
  heThong: boolean;
  choPhepSua: boolean;
  thuTu: number;
  ngayTao?: Date | string;
  ngayCapNhat?: Date | string;
}

export interface PhieuThuChi {
  _id?: string;
  loai: LoaiThuChi;
  soTien: number;
  phuongThuc: PhuongThucThuChi;
  nguoiThanhToan: string;
  noiDung: string;
  danhMuc: string | { _id: string; ten: string; loai: LoaiThuChi; key?: string | null };
  ngayLapPhieu: Date | string;
  tuDongTaoHangThang: boolean;
  toaNha?: string | { _id: string; tenToaNha: string } | null;
  nguoiTao?: string | null;
  ngayTao?: Date | string;
  ngayCapNhat?: Date | string;
}

export interface SuCo {
  _id?: string;
  phong: string; // ObjectId ref Phong
  khachThue: string; // ObjectId ref KhachThue
  tieuDe: string;
  moTa: string;
  anhSuCo: string[];
  loaiSuCo: 'dienNuoc' | 'noiThat' | 'vesinh' | 'anNinh' | 'khac';
  mucDoUuTien: 'thap' | 'trungBinh' | 'cao' | 'khancap';
  trangThai: 'moi' | 'dangXuLy' | 'daXong' | 'daHuy';
  nguoiXuLy?: string; // ObjectId ref NguoiDung
  ghiChuXuLy?: string;
  ngayBaoCao: Date;
  ngayXuLy?: Date;
  ngayHoanThanh?: Date;
  ngayTao: Date;
  ngayCapNhat: Date;
}

export interface ThongBao {
  _id?: string;
  tieuDe: string;
  noiDung: string;
  loai: 'chung' | 'hoaDon' | 'suCo' | 'hopDong' | 'khac';
  nguoiGui: string; // ObjectId ref NguoiDung
  nguoiNhan: string[]; // ObjectId[] ref KhachThue hoặc NguoiDung
  phong?: string[]; // ObjectId[] ref Phong
  toaNha?: string; // ObjectId ref ToaNha
  daDoc: string[]; // ObjectId[] danh sách người đã đọc
  ngayGui: Date;
  ngayTao: Date;
}

// Types cho API responses
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Types cho form validation
export interface LoginForm {
  email: string;
  matKhau: string;
}

export interface RegisterForm {
  ten: string;
  email: string;
  matKhau: string;
  soDienThoai: string;
  vaiTro: 'admin' | 'chuNha' | 'nhanVien';
}

// Dashboard stats
export interface DashboardStats {
  tongSoPhong: number;
  phongTrong: number;
  phongDangThue: number;
  phongBaoTri: number;
  doanhThuThang: number;
  doanhThuNam: number;
  hoaDonSapDenHan: number;
  suCoCanXuLy: number;
  hopDongSapHetHan: number;
}

export type LoaiGiaoDichCongNo =
  | 'hoaDon'
  | 'thanhToan'
  | 'giamTru'
  | 'truCoc'
  | 'tienCoc'
  | 'hoanTien'
  | 'boQuaTienThua'
  | 'dieuChinh';

export interface GiaoDichCongNo {
  _id: string;
  khachThue: string;
  hopDong?: string | null;
  phong?: string | { _id: string; maPhong: string } | null;
  loai: LoaiGiaoDichCongNo;
  soTien: number;
  ngayGhiNhan: string;
  hoaDon?: string | { _id: string; maHoaDon: string; thang: number; nam: number } | null;
  thanhToan?: string | { _id: string; phuongThuc: string; xuLyTienThua?: XuLyTienThua | null } | null;
  moTa: string;
  daHuy: boolean;
  lyDoHuy?: string;
  ngayTao: string;
  soDuLuyKe?: number | null;
}
