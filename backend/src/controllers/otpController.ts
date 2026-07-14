import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Request } from 'express';
import { User } from '../models/User';
import { sendOtpEmail } from '../services/emailService';
import { AppError } from '../middleware/errorHandler';
import { generateToken } from '../utils/generateToken';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

const generateOtp = (): string => crypto.randomInt(100000, 999999).toString();

// POST /api/auth/otp/send  { email, purpose: 'login' | 'reset' }
// Used both as a 2FA step after password login and as the first step of
// password reset - same mechanism, different follow-up action.
export const sendOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) throw new AppError('email is required', 400);

    const user = await User.findOne({ email: email.toLowerCase() });
    // Don't reveal whether the email exists - respond the same either way
    if (!user) {
      return res.status(200).json({ message: 'If that email exists, a code has been sent.' });
    }

    const otp = generateOtp();
    const salt = await bcrypt.genSalt(10);
    user.otpHash = await bcrypt.hash(otp, salt);
    user.otpExpires = new Date(Date.now() + OTP_TTL_MS);
    await user.save();

    await sendOtpEmail(user.email, otp);

    res.status(200).json({ message: 'If that email exists, a code has been sent.' });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/otp/verify  { email, otp }
// On success, returns a normal login token - used to complete a 2FA login flow.
export const verifyOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) throw new AppError('email and otp are required', 400);

    const user = await User.findOne({ email: email.toLowerCase() }).select('+otpHash +otpExpires');
    if (!user || !user.otpHash || !user.otpExpires) {
      throw new AppError('Invalid or expired code', 400);
    }
    if (user.otpExpires.getTime() < Date.now()) {
      throw new AppError('Code has expired, please request a new one', 400);
    }

    const isValid = await bcrypt.compare(otp, user.otpHash);
    if (!isValid) throw new AppError('Invalid or expired code', 400);

    // One-time use - clear it immediately after a successful check
    user.otpHash = undefined;
    user.otpExpires = undefined;
    await user.save();

    const token = generateToken(user.id);
    res.status(200).json({ message: 'Code verified', token, user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/reset-password  { email, otp, newPassword }
export const resetPasswordWithOtp = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      throw new AppError('email, otp and newPassword are required', 400);
    }
    if (newPassword.length < 6) {
      throw new AppError('newPassword must be at least 6 characters', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+otpHash +otpExpires +password');
    if (!user || !user.otpHash || !user.otpExpires) {
      throw new AppError('Invalid or expired code', 400);
    }
    if (user.otpExpires.getTime() < Date.now()) {
      throw new AppError('Code has expired, please request a new one', 400);
    }

    const isValid = await bcrypt.compare(otp, user.otpHash);
    if (!isValid) throw new AppError('Invalid or expired code', 400);

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.otpHash = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successfully' });
  } catch (err) {
    next(err);
  }
};
