import mongoose, { Document as MongooseDocument, Schema, Types } from 'mongoose';

export type DocumentStatus = 'draft' | 'signed' | 'archived';

export interface IDocument extends MongooseDocument {
  name: string;
  fileUrl: string;      // path/URL to the stored file (local disk in dev, S3 in prod)
  fileType: string;      // mime type
  fileSize: number;      // bytes
  uploadedBy: Types.ObjectId;
  sharedWith: Types.ObjectId[]; // users who can view this document
  meetingId?: Types.ObjectId;    // optional link to a Meeting
  version: number;
  status: DocumentStatus;
  signatureUrl?: string;  // PNG of the e-signature, once signed
  signedBy?: Types.ObjectId;
  signedAt?: Date;
  createdAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    name: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sharedWith: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting' },
    version: { type: Number, default: 1 },
    status: { type: String, enum: ['draft', 'signed', 'archived'], default: 'draft' },
    signatureUrl: { type: String },
    signedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    signedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

documentSchema.index({ uploadedBy: 1, createdAt: -1 });

documentSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const DocumentModel = mongoose.model<IDocument>('Document', documentSchema);
