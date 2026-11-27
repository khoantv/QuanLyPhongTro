import mongoose, { Schema, Document } from 'mongoose';

export type LoaiThuChi = 'thu' | 'chi';
export type PhuongThucThuChi = 'tienMat' | 'chuyenKhoan';

export interface IPhieuThuChi extends Document {
  loai: LoaiThuChi;
  soTien: number;
  phuongThuc: PhuongThucThuChi;
  nguoiThanhToan: string;
  noiDung: string;
  danhMuc: mongoose.Types.ObjectId;
  ngayLapPhieu: Date;
  tuDongTaoHangThang: boolean;
  toaNha?: mongoose.Types.ObjectId | null;
  nguoiTao?: mongoose.Types.ObjectId | null;
  /** Phiếu thu tự tạo khi thu tiền khách — sửa / xóa ở trang Thanh toán */
  thanhToan?: mongoose.Types.ObjectId | null;
  ngayTao: Date;
  ngayCapNhat: Date;
}

const PhieuThuChiSchema = new Schema<IPhieuThuChi>({
  loai: {
    type: String,
    enum: ['thu', 'chi'],
    required: [true, 'Loại phiếu là bắt buộc'],
  },
  soTien: {
    type: Number,
    required: [true, 'Số tiền là bắt buộc'],
    min: [1, 'Số tiền phải lớn hơn 0'],
  },
  phuongThuc: {
    type: String,
    enum: ['tienMat', 'chuyenKhoan'],
    required: true,
    default: 'tienMat',
  },
  nguoiThanhToan: {
    type: String,
    required: [true, 'Người thanh toán là bắt buộc'],
    trim: true,
    maxlength: [200, 'Tên người thanh toán không được quá 200 ký tự'],
  },
  noiDung: {
    type: String,
    required: [true, 'Nội dung thanh toán là bắt buộc'],
    trim: true,
    maxlength: [500, 'Nội dung không được quá 500 ký tự'],
  },
  danhMuc: {
    type: Schema.Types.ObjectId,
    ref: 'DanhMucThuChi',
    required: [true, 'Danh mục là bắt buộc'],
  },
  ngayLapPhieu: {
    type: Date,
    required: [true, 'Ngày lập phiếu là bắt buộc'],
    default: Date.now,
  },
  tuDongTaoHangThang: {
    type: Boolean,
    default: false,
  },
  toaNha: {
    type: Schema.Types.ObjectId,
    ref: 'ToaNha',
    default: null,
  },
  nguoiTao: {
    type: Schema.Types.ObjectId,
    ref: 'NguoiDung',
    default: null,
  },
  thanhToan: {
    type: Schema.Types.ObjectId,
    ref: 'ThanhToan',
    default: null,
  },
}, {
  timestamps: { createdAt: 'ngayTao', updatedAt: 'ngayCapNhat' },
});

PhieuThuChiSchema.index({ loai: 1 });
PhieuThuChiSchema.index({ danhMuc: 1 });
PhieuThuChiSchema.index({ toaNha: 1 });
PhieuThuChiSchema.index({ ngayLapPhieu: -1 });
PhieuThuChiSchema.index({ phuongThuc: 1 });
// Mỗi thanh toán tối đa một phiếu thu tự động
PhieuThuChiSchema.index({ thanhToan: 1 }, { unique: true, partialFilterExpression: { thanhToan: { $type: 'objectId' } } });

export default mongoose.models.PhieuThuChi
  || mongoose.model<IPhieuThuChi>('PhieuThuChi', PhieuThuChiSchema);
