import { Response, NextFunction } from 'express';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

// GET /api/profile/:id  (public profile view)
export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) throw new AppError('User not found', 404);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
};

// PUT /api/profile  (protected - update your own profile)
// Accepts any subset of the extended profile fields; role-specific fields
// (startupName vs investmentInterests, etc.) are simply ignored if not
// relevant to the user's role, since the schema allows both to coexist.
const ALLOWED_FIELDS = [
  'name',
  'bio',
  'avatarUrl',
  // entrepreneur
  'startupName',
  'pitchSummary',
  'fundingNeeded',
  'industry',
  'location',
  'foundedYear',
  'teamSize',
  // investor
  'investmentInterests',
  'investmentStage',
  'portfolioCompanies',
  'totalInvestments',
  'minimumInvestment',
  'maximumInvestment',
];

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updates: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in req.body) updates[field] = req.body[field];
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) throw new AppError('User not found', 404);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
};

// GET /api/profile  (list, useful for browse/discover pages - investors browsing entrepreneurs etc.)
export const listProfiles = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { role } = req.query;
    const filter = role ? { role } : {};
    const users = await User.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
};
