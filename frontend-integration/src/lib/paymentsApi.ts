import { api } from './api';

export type TransactionType = 'deposit' | 'withdraw' | 'transfer';
export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface ApiTransaction {
  id: string;
  user: { id: string; name: string; avatarUrl: string } | string;
  type: TransactionType;
  amount: number; // cents
  currency: string;
  status: TransactionStatus;
  stripePaymentIntentId?: string;
  counterpartyUser?: { id: string; name: string; avatarUrl: string } | string;
  description?: string;
  createdAt: string;
}

export const paymentsApi = {
  getBalance: async (): Promise<number> => {
    const { data } = await api.get('/payments/balance');
    return data.balance; // cents
  },

  getHistory: async (): Promise<ApiTransaction[]> => {
    const { data } = await api.get('/payments/history');
    return data.transactions;
  },

  // Returns a Stripe clientSecret - the frontend confirms this with
  // Stripe.js/Elements, then calls confirmDeposit with the transaction id.
  createDeposit: async (amountCents: number): Promise<{ transaction: ApiTransaction; clientSecret: string }> => {
    const { data } = await api.post('/payments/deposit', { amount: amountCents });
    return data;
  },

  confirmDeposit: async (transactionId: string): Promise<ApiTransaction> => {
    const { data } = await api.post(`/payments/deposit/${transactionId}/confirm`);
    return data.transaction;
  },

  withdraw: async (amountCents: number): Promise<ApiTransaction> => {
    const { data } = await api.post('/payments/withdraw', { amount: amountCents });
    return data.transaction;
  },

  transfer: async (toUserId: string, amountCents: number): Promise<ApiTransaction> => {
    const { data } = await api.post('/payments/transfer', { toUserId, amount: amountCents });
    return data.transaction;
  },
};

// Helpers - amounts are stored/transmitted in cents to avoid float bugs
export const centsToDisplay = (cents: number): string => `$${(cents / 100).toFixed(2)}`;
export const dollarsToCents = (dollars: number): number => Math.round(dollars * 100);
