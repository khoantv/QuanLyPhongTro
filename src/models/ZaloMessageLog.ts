import mongoose, { Schema, Document } from 'mongoose';

export type ZaloLogStatus = 'queued' | 'sent' | 'failed' | 'failed_permanent' | 'skipped';
export type ZaloLogTrigger = 'auto' | 'manual' | 'preview' | 'retry';
export type ZaloRecipientType = 'tenant' | 'owner_preview';

export interface IZaloMessageLog extends Document {
  hoaDonId: mongoose.Types.ObjectId | null;
  khachThueId: mongoose.Types.ObjectId | null;
  phongId: mongoose.Types.ObjectId | null;
  recipientType: ZaloRecipientType;
  recipientZaloUserId: string;
  trigger: ZaloLogTrigger;
  status: ZaloLogStatus;
  sentAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  zaloMessageId: string | null;
  retryCount: number;
  nextRetryAt: Date | null;
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown> | null;
  ngayTao: Date;
  ngayCapNhat: Date;
}

const ZaloMessageLogSchema = new Schema<IZaloMessageLog>({
  hoaDonId: { type: Schema.Types.ObjectId, ref: 'HoaDon', default: null },
  khachThueId: { type: Schema.Types.ObjectId, ref: 'KhachThue', default: null },
  phongId: { type: Schema.Types.ObjectId, ref: 'Phong', default: null },
  recipientType: { type: String, enum: ['tenant', 'owner_preview'], required: true },
  recipientZaloUserId: { type: String, required: true, trim: true },
  trigger: { type: String, enum: ['auto', 'manual', 'preview', 'retry'], required: true },
  status: {
    type: String,
    enum: ['queued', 'sent', 'failed', 'failed_permanent', 'skipped'],
    required: true,
    default: 'queued',
  },
  sentAt: { type: Date, default: null },
  errorCode: { type: String, default: null },
  errorMessage: { type: String, default: null },
  zaloMessageId: { type: String, default: null },
  retryCount: { type: Number, default: 0, min: 0 },
  nextRetryAt: { type: Date, default: null },
  requestPayload: { type: Schema.Types.Mixed, default: {} },
  responsePayload: { type: Schema.Types.Mixed, default: null },
}, {
  timestamps: { createdAt: 'ngayTao', updatedAt: 'ngayCapNhat' },
});

ZaloMessageLogSchema.index({ phongId: 1, sentAt: -1 });
ZaloMessageLogSchema.index({ status: 1, nextRetryAt: 1 });
ZaloMessageLogSchema.index({ sentAt: -1 });
ZaloMessageLogSchema.index({ hoaDonId: 1 });

export default mongoose.models.ZaloMessageLog
  || mongoose.model<IZaloMessageLog>('ZaloMessageLog', ZaloMessageLogSchema);
