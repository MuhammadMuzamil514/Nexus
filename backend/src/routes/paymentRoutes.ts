import { Router } from 'express';
import { body } from 'express-validator';
import {
  createDeposit,
  confirmDeposit,
  createWithdrawal,
  createTransfer,
  getTransactionHistory,
  getWalletBalance,
} from '../controllers/paymentController';
import { protect } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(protect); // every payment route requires auth

/**
 * @swagger
 * /payments/deposit:
 *   post:
 *     summary: Start a deposit via Stripe (test mode)
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: integer, description: "Amount in cents, minimum 50", example: 5000 }
 *     responses:
 *       201: { description: "Returns { transaction, clientSecret } - confirm the clientSecret client-side with Stripe.js" }
 */
router.post(
  '/deposit',
  [body('amount').isInt({ min: 50 }).withMessage('amount must be an integer in cents, minimum 50')],
  validate,
  createDeposit
);

/**
 * @swagger
 * /payments/deposit/{transactionId}/confirm:
 *   post:
 *     summary: Re-verify a deposit's status directly with Stripe after client-side confirmation
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Returns the updated transaction }
 */
router.post('/deposit/:transactionId/confirm', confirmDeposit);

/**
 * @swagger
 * /payments/withdraw:
 *   post:
 *     summary: Withdraw funds (modeled as an internal ledger entry for this demo)
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: integer, description: Amount in cents }
 *     responses:
 *       201: { description: Returns the created transaction }
 *       400: { description: Insufficient balance }
 */
router.post(
  '/withdraw',
  [body('amount').isInt({ min: 1 }).withMessage('amount must be a positive integer in cents')],
  validate,
  createWithdrawal
);

/**
 * @swagger
 * /payments/transfer:
 *   post:
 *     summary: Transfer funds to another user (internal ledger)
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [toUserId, amount]
 *             properties:
 *               toUserId: { type: string }
 *               amount: { type: integer, description: Amount in cents }
 *     responses:
 *       201: { description: Returns the created transaction }
 *       400: { description: Insufficient balance or invalid recipient }
 */
router.post(
  '/transfer',
  [
    body('toUserId').isMongoId().withMessage('toUserId must be a valid user id'),
    body('amount').isInt({ min: 1 }).withMessage('amount must be a positive integer in cents'),
  ],
  validate,
  createTransfer
);

/**
 * @swagger
 * /payments/history:
 *   get:
 *     summary: List all transactions involving the current user
 *     tags: [Payments]
 *     responses:
 *       200: { description: "Returns the list of transactions" }
 */
router.get('/history', getTransactionHistory);

/**
 * @swagger
 * /payments/balance:
 *   get:
 *     summary: Get the current user's wallet balance (derived from completed transactions)
 *     tags: [Payments]
 *     responses:
 *       200: { description: "Returns { balance } in cents" }
 */
router.get('/balance', getWalletBalance);

export default router;
