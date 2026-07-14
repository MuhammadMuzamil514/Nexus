import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { generateToken } from '../utils/generateToken';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

// POST /api/auth/register
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      throw new AppError('name, email, password and role are all required', 400);
    }
    if (!['entrepreneur', 'investor'].includes(role)) {
      throw new AppError('role must be either "entrepreneur" or "investor"', 400);
    }
    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters', 400);
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      throw new AppError('Email already in use', 409);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
      bio: '',
      isOnline: true,
    });

    const token = generateToken(user.id);

    res.status(201).json({ user, token });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    // Explicitly select password since the schema excludes it by default
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // If the frontend sends a role (login form has a role selector), enforce it matches
    if (role && user.role !== role) {
      throw new AppError('Invalid credentials or user not found', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError('Invalid credentials', 401);
    }

    user.isOnline = true;
    await user.save();

    const token = generateToken(user.id);

    res.status(200).json({ user, token });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me  (protected)
export const getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) throw new AppError('User not found', 404);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/logout (protected) - mostly a client-side token discard,
// but we flip isOnline server-side so other users see accurate presence
export const logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await User.findByIdAndUpdate(req.userId, { isOnline: false });
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};
