import mongoose, { Schema, Document } from 'mongoose';

export type LoaiGanKetTaiSan = 'phong' | 'chung';

export interface ITaiSan extends Document {
  ten: string;
  icon: string;
  giaTri: number;
  giaNhap?: number;
  tongSoLuong: number;
  donVi: string;
  donViCungCap?: string;
  loaiGanKet: LoaiGanKetTaiSan;
  phong?: mongoose.Types.ObjectId;
  toaNha?: mongoose.Types.ObjectId;
  moTa?: string;
  ngayMua?: Date;
  ngayTao: Date;
  ngayCapNhat: Date;
}

const TaiSanSchema = new Schema<ITaiSan>({
  ten: {
    type: String,
    required: [true, 'Tên tài sản là bắt buộc'],
    trim: true,
    maxlength: [120, 'Tên không được quá 120 ký tự'],
  },
  icon: {
    type: String,
    default: 'package',
    trim: true,
  },
  giaTri: {
    type: Number,
    required: [true, 'Giá trị tài sản là bắt buộc'],
    min: [0, 'Giá trị phải lớn hơn hoặc bằng 0'],
  },
  giaNhap: {
    type: Number,
    min: [0, 'Giá nhập phải lớn hơn hoặc bằng 0'],
    default: null,
  },
  tongSoLuong: {
    type: Number,
    required: [true, 'Tổng số lượng là bắt buộc'],
    min: [1, 'Số lượng phải lớn hơn 0'],
    default: 1,
  },
  donVi: {
    type: String,
    default: 'Cái',
    trim: true,
    maxlength: 30,
  },
  donViCungCap: {
    type: String,
    trim: true,
    maxlength: 200,
  },
  loaiGanKet: {
    type: String,
    enum: ['phong', 'chung'],
    required: true,
    default: 'chung',
  },
  phong: {
    type: Schema.Types.ObjectId,
    ref: 'Phong',
    default: null,
  },
  toaNha: {
    type: Schema.Types.ObjectId,
    ref: 'ToaNha',
    default: null,
  },
  moTa: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  ngayMua: {
    type: Date,
    default: null,
  },
}, {
  timestamps: { createdAt: 'ngayTao', updatedAt: 'ngayCapNhat' },
});

// Validation: nếu loaiGanKet='phong' thì phải có phong; nếu 'chung' thì không bắt buộc
TaiSanSchema.pre('validate', function(next) {
  if (this.loaiGanKet === 'phong' && !this.phong) {
    return next(new Error('Tài sản gắn với phòng phải chọn phòng cụ thể'));
  }
  next();
});

TaiSanSchema.index({ loaiGanKet: 1 });
TaiSanSchema.index({ phong: 1 });
TaiSanSchema.index({ toaNha: 1 });
TaiSanSchema.index({ ten: 'text' });

export default mongoose.models.TaiSan
  || mongoose.model<ITaiSan>('TaiSan', TaiSanSchema);
