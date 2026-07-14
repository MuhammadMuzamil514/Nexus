import { Response, NextFunction, Request } from 'express';
import { getStripe } from '../services/stripeService';
import { Transaction } from '../models/Transaction';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

// Computes a user's spendable balance from completed transactions only.
// Deposits and incoming transfers add; withdrawals and outgoing transfers subtract.
const getBalance = async (userId: string): Promise<number> => {
  const transactions = await Transaction.find({
    $or: [{ user: userId }, { counterpartyUser: userId }],
    status: 'completed',
  });

  return transactions.reduce((balance, tx) => {
    const isOwner = tx.user.toString() === userId;
    if (tx.type === 'deposit' && isOwner) return balance + tx.amount;
    if (tx.type === 'withdraw' && isOwner) return balance - tx.amount;
    if (tx.type === 'transfer') {
      if (isOwner) return balance - tx.amount; // sender
      return balance + tx.amount; // recipient
    }
    return balance;
  }, 0);
};

// POST /api/payments/deposit  { amount } - amount in cents
// Creates a Stripe PaymentIntent in test mode. The frontend confirms it
// client-side with Stripe.js/Elements using the returned clientSecret.
export const createDeposit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount < 50) {
      throw new AppError('amount must be a number, minimum 50 cents', 400);
    }

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: { userId: req.userId! },
    });

    const transaction = await Transaction.create({
      user: req.userId,
      type: 'deposit',
      amount,
      status: 'pending',
      stripePaymentIntentId: paymentIntent.id,
      description: 'Wallet deposit via Stripe',
    });

    res.status(201).json({
      transaction,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/payments/deposit/:transactionId/confirm
// Called by the frontend after Stripe confirms the card payment client-side.
// We re-verify status directly with Stripe rather than trusting the client.
export const confirmDeposit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const transaction = await Transaction.findById(req.params.transactionId);
    if (!transaction) throw new AppError('Transaction not found', 404);
    if (transaction.user.toString() !== req.userId) throw new AppError('Forbidden', 403);
    if (!transaction.stripePaymentIntentId) throw new AppError('Not a Stripe-backed transaction', 400);

    const stripe = getStripe();
    const intent = await stripe.paymentIntents.retrieve(transaction.stripePaymentIntentId);

    transaction.status = intent.status === 'succeeded' ? 'completed' : 'failed';
    await transaction.save();

    res.status(200).json({ transaction });
  } catch (err) {
    next(err);
  }
};

// POST /api/payments/webhook - Stripe calls this directly (see server.ts for
// raw-body handling this route needs). This is the authoritative source of
// truth for payment status, since client-side confirmation can be spoofed
// or interrupted; production apps should rely on this over confirmDeposit.
export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !sig) {
    return res.status(400).send('Missing Stripe signature or webhook secret');
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[stripe webhook] signature verification failed', err);
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  if (event.type === 'payment_intent.succeeded' || event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as { id: string; status: string };
    const transaction = await Transaction.findOne({ stripePaymentIntentId: intent.id });
    if (transaction) {
      transaction.status = event.type === 'payment_intent.succeeded' ? 'completed' : 'failed';
      await transaction.save();
    }
  }

  res.json({ received: true });
};

// POST /api/payments/withdraw  { amount }
// Modeled as an internal ledger entry for this demo, not a real payout —
// wiring real payouts requires Stripe Connect + a verified bank account.
export const createWithdrawal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount < 1) {
      throw new AppError('amount must be a positive number', 400);
    }

    const balance = await getBalance(req.userId!);
    if (amount > balance) {
      throw new AppError('Insufficient balance', 400);
    }

    const transaction = await Transaction.create({
      user: req.userId,
      type: 'withdraw',
      amount,
      status: 'completed', // instant for this simulation
      description: 'Wallet withdrawal',
    });

    res.status(201).json({ transaction });
  } catch (err) {
    next(err);
  }
};

// POST /api/payments/transfer  { toUserId, amount }
export const createTransfer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { toUserId, amount } = req.body;
    if (!toUserId || !amount || typeof amount !== 'number' || amount < 1) {
      throw new AppError('toUserId and a positive amount are required', 400);
    }
    if (toUserId === req.userId) {
      throw new AppError('Cannot transfer funds to yourself', 400);
    }

    const recipient = await User.findById(toUserId);
    if (!recipient) throw new AppError('Recipient not found', 404);

    const balance = await getBalance(req.userId!);
    if (amount > balance) {
      throw new AppError('Insufficient balance', 400);
    }

    const transaction = await Transaction.create({
      user: req.userId,
      type: 'transfer',
      amount,
      status: 'completed',
      counterpartyUser: toUserId,
      description: `Transfer to ${recipient.name}`,
    });

    res.status(201).json({ transaction });
  } catch (err) {
    next(err);
  }
};

// GET /api/payments/history
export const getTransactionHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const transactions = await Transaction.find({
      $or: [{ user: req.userId }, { counterpartyUser: req.userId }],
    })
      .populate('user', 'name avatarUrl')
      .populate('counterpartyUser', 'name avatarUrl')
      .sort({ createdAt: -1 });

    res.status(200).json({ transactions });
  } catch (err) {
    next(err);
  }
};

// GET /api/payments/balance
export const getWalletBalance = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const balance = await getBalance(req.userId!);
    res.status(200).json({ balance }); // cents
  } catch (err) {
    next(err);
  }
};
