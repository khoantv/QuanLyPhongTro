import mongoose, { Schema, Document } from 'mongoose';

export type LoaiPhuongTien = 'xeMay' | 'oTo' | 'xeDap' | 'xeDien' | 'khac';

export interface IPhuongTien extends Document {
  khachThue: mongoose.Types.ObjectId;
  tenXe: string;
  bienSo: string;
  loaiXe: LoaiPhuongTien;
  hinhAnh: string[];
  moTa?: string;
  ngayTao: Date;
  ngayCapNhat: Date;
}

const PhuongTienSchema = new Schema<IPhuongTien>({
  khachThue: {
    type: Schema.Types.ObjectId,
    ref: 'KhachThue',
    required: [true, 'Khách thuê là bắt buộc'],
  },
  tenXe: {
    type: String,
    required: [true, 'Tên xe là bắt buộc'],
    trim: true,
    maxlength: [100, 'Tên xe không được quá 100 ký tự'],
  },
  bienSo: {
    type: String,
    required: [true, 'Biển số xe là bắt buộc'],
    unique: true,
    trim: true,
    uppercase: true,
    maxlength: [20, 'Biển số xe không được quá 20 ký tự'],
  },
  loaiXe: {
    type: String,
    enum: ['xeMay', 'oTo', 'xeDap', 'xeDien', 'khac'],
    default: 'xeMay',
    required: [true, 'Loại xe là bắt buộc'],
  },
  hinhAnh: [{
    type: String,
    trim: true,
  }],
  moTa: {
    type: String,
    trim: true,
    maxlength: [500, 'Mô tả không được quá 500 ký tự'],
  },
}, {
  timestamps: { createdAt: 'ngayTao', updatedAt: 'ngayCapNhat' },
});

PhuongTienSchema.index({ khachThue: 1 });
PhuongTienSchema.index({ loaiXe: 1 });

export default mongoose.models.PhuongTien
  || mongoose.model<IPhuongTien>('PhuongTien', PhuongTienSchema);
