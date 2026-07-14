import mongoose, { Document, Schema, Types } from 'mongoose';

export type TransactionType = 'deposit' | 'withdraw' | 'transfer';
export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface ITransaction extends Document {
  user: Types.ObjectId;
  type: TransactionType;
  amount: number; // in the smallest currency unit (cents) to avoid float issues
  currency: string;
  status: TransactionStatus;
  // Deposits: Stripe PaymentIntent id, used to verify/confirm status with Stripe
  stripePaymentIntentId?: string;
  // Transfers: who the money moved to/from (internal ledger only, not a real payout)
  counterpartyUser?: Types.ObjectId;
  description?: string;
  createdAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['deposit', 'withdraw', 'transfer'], required: true },
    amount: { type: Number, required: true, min: 1 }, // cents, must be positive
    currency: { type: String, default: 'usd' },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
    stripePaymentIntentId: { type: String },
    counterpartyUser: { type: Schema.Types.ObjectId, ref: 'User' },
    description: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

transactionSchema.index({ user: 1, createdAt: -1 });

transactionSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
