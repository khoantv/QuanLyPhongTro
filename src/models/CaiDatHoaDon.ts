import mongoose, { Schema, Document } from 'mongoose';

export type HinhThucThanhToan = 'tienMat' | 'chuyenKhoan' | 'momo' | 'vnpay' | 'khac';

export interface ICaiDatHoaDon extends Document {
  singleton: true;
  tenNhaTro: string;
  ngayLapHoaDon: number | null;
  hanDongTien: number;
  autoSendZalo: boolean;
  hienMaQR: boolean;
  phanLoaiThuChi: boolean;
  lamTronHoaDon: boolean;
  hinhThucThanhToanMacDinh: HinhThucThanhToan;
  ghiChuMacDinh: string;
  xuLyTienThuaMacDinh: 'truKySau' | 'khongTru';
  /** Khi khách tự trả phòng có hoàn tiền phòng đã thu trước cho những ngày chưa ở không */
  hoanTienPhongKhiTraPhong: boolean;
  ngayTao: Date;
  ngayCapNhat: Date;
}

const CaiDatHoaDonSchema = new Schema<ICaiDatHoaDon>({
  singleton: { type: Boolean, default: true, unique: true, required: true },
  tenNhaTro: {
    type: String,
    maxlength: [120, 'Tên nhà trọ không được quá 120 ký tự'],
    default: 'Nhà trọ',
    trim: true,
  },
  ngayLapHoaDon: {
    type: Number,
    min: [1, 'Ngày lập hóa đơn phải từ 1 đến 31'],
    max: [31, 'Ngày lập hóa đơn phải từ 1 đến 31'],
    default: null,
  },
  hanDongTien: {
    type: Number,
    min: [1, 'Hạn đóng tiền phải từ 1 đến 31'],
    max: [31, 'Hạn đóng tiền phải từ 1 đến 31'],
    default: 5,
  },
  autoSendZalo: { type: Boolean, default: false },
  hienMaQR: { type: Boolean, default: true },
  phanLoaiThuChi: { type: Boolean, default: false },
  lamTronHoaDon: { type: Boolean, default: false },
  hinhThucThanhToanMacDinh: {
    type: String,
    enum: ['tienMat', 'chuyenKhoan', 'momo', 'vnpay', 'khac'],
    default: 'tienMat',
  },
  ghiChuMacDinh: {
    type: String,
    maxlength: [500, 'Ghi chú không được quá 500 ký tự'],
    default: '',
    trim: true,
  },
  xuLyTienThuaMacDinh: {
    type: String,
    enum: ['truKySau', 'khongTru'],
    default: 'truKySau',
  },
  hoanTienPhongKhiTraPhong: { type: Boolean, default: false },
}, {
  timestamps: { createdAt: 'ngayTao', updatedAt: 'ngayCapNhat' },
});

export default mongoose.models.CaiDatHoaDon
  || mongoose.model<ICaiDatHoaDon>('CaiDatHoaDon', CaiDatHoaDonSchema);
