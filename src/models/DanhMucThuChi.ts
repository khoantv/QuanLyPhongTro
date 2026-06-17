import mongoose, { Schema, Document } from 'mongoose';

export type LoaiThuChi = 'thu' | 'chi';

export interface IDanhMucThuChi extends Document {
  ten: string;
  loai: LoaiThuChi;
  /** Slug ổn định cho danh mục hệ thống (null với danh mục tự tạo). */
  key?: string | null;
  icon?: string;
  /** Do hệ thống khởi tạo. */
  heThong: boolean;
  /** Cho phép sửa tên / xóa. */
  choPhepSua: boolean;
  thuTu: number;
  ngayTao: Date;
  ngayCapNhat: Date;
}

const DanhMucThuChiSchema = new Schema<IDanhMucThuChi>({
  ten: {
    type: String,
    required: [true, 'Tên danh mục là bắt buộc'],
    trim: true,
    maxlength: [120, 'Tên không được quá 120 ký tự'],
  },
  loai: {
    type: String,
    enum: ['thu', 'chi'],
    required: [true, 'Loại danh mục là bắt buộc'],
  },
  key: {
    type: String,
    trim: true,
    default: null,
  },
  icon: {
    type: String,
    trim: true,
    default: '',
  },
  heThong: {
    type: Boolean,
    default: false,
  },
  choPhepSua: {
    type: Boolean,
    default: true,
  },
  thuTu: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: { createdAt: 'ngayTao', updatedAt: 'ngayCapNhat' },
});

DanhMucThuChiSchema.index({ loai: 1, thuTu: 1 });
// key duy nhất khi có giá trị (sparse) — tránh seed trùng danh mục hệ thống
DanhMucThuChiSchema.index({ key: 1 }, { unique: true, sparse: true });

export default mongoose.models.DanhMucThuChi
  || mongoose.model<IDanhMucThuChi>('DanhMucThuChi', DanhMucThuChiSchema);
