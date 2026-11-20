import mongoose, { Schema, Document } from 'mongoose';

/**
 * Bút toán sổ công nợ theo khách thuê.
 * soTien có dấu: dương = tăng nợ (khách phải trả thêm), âm = giảm nợ (khách đã trả / được trừ).
 * Số dư khách = Σ soTien các bút toán chưa hủy. Dương = đang nợ, âm = tiền thừa.
 */
export type LoaiGiaoDichCongNo =
  | 'hoaDon'
  | 'thanhToan'
  | 'giamTru'
  | 'truCoc'
  | 'tienCoc'
  | 'hoanTien'
  | 'boQuaTienThua'
  | 'dieuChinh';

export const LOAI_GIAO_DICH_CONG_NO: LoaiGiaoDichCongNo[] = [
  'hoaDon', 'thanhToan', 'giamTru', 'truCoc', 'tienCoc', 'hoanTien', 'boQuaTienThua', 'dieuChinh',
];

export interface IGiaoDichCongNo extends Document {
  khachThue: mongoose.Types.ObjectId;
  hopDong?: mongoose.Types.ObjectId | null;
  phong?: mongoose.Types.ObjectId | null;
  loai: LoaiGiaoDichCongNo;
  soTien: number;
  ngayGhiNhan: Date;
  hoaDon?: mongoose.Types.ObjectId | null;
  thanhToan?: mongoose.Types.ObjectId | null;
  moTa: string;
  nguoiTao?: mongoose.Types.ObjectId | null;
  daHuy: boolean;
  nguoiHuy?: mongoose.Types.ObjectId | null;
  ngayHuy?: Date | null;
  lyDoHuy?: string;
  ngayTao: Date;
  ngayCapNhat: Date;
}

const GiaoDichCongNoSchema = new Schema<IGiaoDichCongNo>({
  khachThue: { type: Schema.Types.ObjectId, ref: 'KhachThue', required: [true, 'Khách thuê là bắt buộc'] },
  hopDong: { type: Schema.Types.ObjectId, ref: 'HopDong', default: null },
  phong: { type: Schema.Types.ObjectId, ref: 'Phong', default: null },
  loai: { type: String, enum: LOAI_GIAO_DICH_CONG_NO, required: true },
  soTien: {
    type: Number,
    required: [true, 'Số tiền là bắt buộc'],
    validate: {
      validator: (v: number) => Number.isFinite(v) && v !== 0,
      message: 'Số tiền phải khác 0',
    },
  },
  ngayGhiNhan: { type: Date, required: true, default: Date.now },
  hoaDon: { type: Schema.Types.ObjectId, ref: 'HoaDon', default: null },
  thanhToan: { type: Schema.Types.ObjectId, ref: 'ThanhToan', default: null },
  moTa: { type: String, trim: true, default: '', maxlength: [500, 'Mô tả không được quá 500 ký tự'] },
  nguoiTao: { type: Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
  daHuy: { type: Boolean, default: false },
  nguoiHuy: { type: Schema.Types.ObjectId, ref: 'NguoiDung', default: null },
  ngayHuy: { type: Date, default: null },
  lyDoHuy: { type: String, trim: true, default: '' },
}, {
  timestamps: { createdAt: 'ngayTao', updatedAt: 'ngayCapNhat' },
});

GiaoDichCongNoSchema.index({ khachThue: 1, daHuy: 1, ngayGhiNhan: 1 });
GiaoDichCongNoSchema.index({ hoaDon: 1 });
GiaoDichCongNoSchema.index({ thanhToan: 1 });

export default mongoose.models.GiaoDichCongNo
  || mongoose.model<IGiaoDichCongNo>('GiaoDichCongNo', GiaoDichCongNoSchema);
