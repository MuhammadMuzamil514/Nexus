import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getMe, logout } from '../controllers/authController';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Create a new account
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name: { type: string, example: Jane Founder }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 6 }
 *               role: { type: string, enum: [entrepreneur, investor] }
 *     responses:
 *       201: { description: "Account created, returns user and token" }
 *       400: { description: Validation error }
 *       409: { description: Email already in use }
 */
router.post(
  '/register',
  [
    body('name').trim().isLength({ min: 2, max: 100 }).escape().withMessage('name must be 2-100 characters'),
    body('email').isEmail().normalizeEmail().withMessage('a valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('password must be at least 6 characters'),
    body('role').isIn(['entrepreneur', 'investor']).withMessage('role must be entrepreneur or investor'),
  ],
  validate,
  register
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Log in with email and password
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *               role: { type: string, enum: [entrepreneur, investor], description: Optional - must match the account's role if provided }
 *     responses:
 *       200: { description: "Returns user and token" }
 *       401: { description: Invalid credentials }
 */
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('a valid email is required'),
    body('password').notEmpty().withMessage('password is required'),
  ],
  validate,
  login
);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags: [Auth]
 *     responses:
 *       200: { description: "Returns the user" }
 *       401: { description: Not authorized }
 */
router.get('/me', protect, getMe);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log out (marks the user offline server-side)
 *     tags: [Auth]
 *     responses:
 *       200: { description: Logged out }
 */
router.post('/logout', protect, logout);

export default router;
