import { Router } from 'express';
import { body } from 'express-validator';
import { sendOtp, verifyOtp, resetPasswordWithOtp } from '../controllers/otpController';
import { validate } from '../middleware/validate';

const router = Router();

/**
 * @swagger
 * /auth/otp/send:
 *   post:
 *     summary: Send a 6-digit one-time code (used for 2FA login step or password reset)
 *     tags: [OTP / 2FA]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Code sent if the account exists (response is identical either way, to avoid leaking which emails are registered) }
 */
router.post(
  '/send',
  [body('email').isEmail().normalizeEmail().withMessage('a valid email is required')],
  validate,
  sendOtp
);

/**
 * @swagger
 * /auth/otp/verify:
 *   post:
 *     summary: Verify a one-time code, returns a login token on success
 *     tags: [OTP / 2FA]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string, example: "123456" }
 *     responses:
 *       200: { description: "Returns token and user" }
 *       400: { description: Invalid or expired code }
 */
router.post(
  '/verify',
  [
    body('email').isEmail().normalizeEmail().withMessage('a valid email is required'),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('otp must be a 6-digit code'),
  ],
  validate,
  verifyOtp
);

/**
 * @swagger
 * /auth/otp/reset-password:
 *   post:
 *     summary: Reset a forgotten password using a verified one-time code
 *     tags: [OTP / 2FA]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword]
 *             properties:
 *               email: { type: string, format: email }
 *               otp: { type: string, example: "123456" }
 *               newPassword: { type: string, minLength: 6 }
 *     responses:
 *       200: { description: Password reset successfully }
 *       400: { description: Invalid or expired code }
 */
router.post(
  '/reset-password',
  [
    body('email').isEmail().normalizeEmail().withMessage('a valid email is required'),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric().withMessage('otp must be a 6-digit code'),
    body('newPassword').isLength({ min: 6 }).withMessage('newPassword must be at least 6 characters'),
  ],
  validate,
  resetPasswordWithOtp
);

export default router;
