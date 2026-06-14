import mongoose, { Schema, Document } from 'mongoose';

export interface IZaloOAToken extends Document {
  singleton: true;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  lastRefreshAt: Date;
  ngayTao: Date;
  ngayCapNhat: Date;
}

const ZaloOATokenSchema = new Schema<IZaloOAToken>({
  singleton: { type: Boolean, default: true, unique: true, required: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  lastRefreshAt: { type: Date, required: true, default: () => new Date() },
}, {
  timestamps: { createdAt: 'ngayTao', updatedAt: 'ngayCapNhat' },
});

export default mongoose.models.ZaloOAToken
  || mongoose.model<IZaloOAToken>('ZaloOAToken', ZaloOATokenSchema);
