import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'entrepreneur' | 'investor';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string; // hashed
  role: UserRole;
  avatarUrl: string;
  bio: string;
  isOnline: boolean;

  // Entrepreneur-specific
  startupName?: string;
  pitchSummary?: string;
  fundingNeeded?: string;
  industry?: string;
  location?: string;
  foundedYear?: number;
  teamSize?: number;

  // Investor-specific
  investmentInterests?: string[];
  investmentStage?: string[];
  portfolioCompanies?: string[];
  totalInvestments?: number;
  minimumInvestment?: string;
  maximumInvestment?: string;

  // 2FA / OTP (also reused for password reset)
  otpHash?: string;
  otpExpires?: Date;

  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['entrepreneur', 'investor'], required: true },
    avatarUrl: { type: String, default: '' },
    bio: { type: String, default: '' },
    isOnline: { type: Boolean, default: false },

    // Entrepreneur fields
    startupName: String,
    pitchSummary: String,
    fundingNeeded: String,
    industry: String,
    location: String,
    foundedYear: Number,
    teamSize: Number,

    // Investor fields
    investmentInterests: [String],
    investmentStage: [String],
    portfolioCompanies: [String],
    totalInvestments: Number,
    minimumInvestment: String,
    maximumInvestment: String,

    // Never returned in toJSON - see transform below
    otpHash: { type: String, select: false },
    otpExpires: { type: Date, select: false },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

// Never leak the password hash in JSON responses
userSchema.set('toJSON', {
  transform: (_doc, ret: any) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    delete ret.otpHash;
    delete ret.otpExpires;
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', userSchema);
