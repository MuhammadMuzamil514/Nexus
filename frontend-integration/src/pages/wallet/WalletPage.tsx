import React, { useEffect, useState, useCallback } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import {
  Wallet, ArrowDownLeft, ArrowUpRight, Send, Loader2, Clock, CheckCircle2, XCircle,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { getStripePromise } from '../../lib/stripeClient';
import { paymentsApi, ApiTransaction, centsToDisplay, dollarsToCents } from '../../lib/paymentsApi';
import { DepositForm } from './DepositForm';
import toast from 'react-hot-toast';

type Tab = 'deposit' | 'withdraw' | 'transfer';

const statusBadge = (status: ApiTransaction['status']) => {
  switch (status) {
    case 'completed':
      return <Badge variant="success" size="sm">Completed</Badge>;
    case 'pending':
      return <Badge variant="secondary" size="sm">Pending</Badge>;
    case 'failed':
      return <Badge variant="error" size="sm">Failed</Badge>;
  }
};

const statusIcon = (status: ApiTransaction['status']) => {
  if (status === 'completed') return <CheckCircle2 size={18} className="text-success-600" />;
  if (status === 'pending') return <Clock size={18} className="text-gray-400" />;
  return <XCircle size={18} className="text-error-600" />;
};

const typeLabel = (tx: ApiTransaction): string => {
  if (tx.type === 'deposit') return 'Deposit';
  if (tx.type === 'withdraw') return 'Withdrawal';
  const counterpartyName = typeof tx.counterpartyUser === 'object' ? tx.counterpartyUser?.name : undefined;
  return counterpartyName ? `Transfer to ${counterpartyName}` : 'Transfer';
};

export const WalletPage: React.FC = () => {
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('deposit');

  // Withdraw form state
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Transfer form state
  const [transferUserId, setTransferUserId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [bal, history] = await Promise.all([
        paymentsApi.getBalance(),
        paymentsApi.getHistory(),
      ]);
      setBalance(bal);
      setTransactions(history);
    } catch {
      toast.error('Could not load wallet data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const dollars = parseFloat(withdrawAmount);
    if (isNaN(dollars) || dollars <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setIsWithdrawing(true);
    try {
      await paymentsApi.withdraw(dollarsToCents(dollars));
      toast.success('Withdrawal completed');
      setWithdrawAmount('');
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Withdrawal failed');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const dollars = parseFloat(transferAmount);
    if (!transferUserId.trim()) {
      toast.error('Enter a recipient user ID');
      return;
    }
    if (isNaN(dollars) || dollars <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setIsTransferring(true);
    try {
      await paymentsApi.transfer(transferUserId.trim(), dollarsToCents(dollars));
      toast.success('Transfer completed');
      setTransferUserId('');
      setTransferAmount('');
      loadData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Transfer failed');
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
        <p className="text-gray-600">Deposit, withdraw, and transfer funds (Stripe test mode)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance + actions */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardBody>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-primary-50 rounded-lg">
                  <Wallet size={20} className="text-primary-600" />
                </div>
                <span className="text-sm text-gray-600">Available balance</span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mt-2">
                {isLoading ? (
                  <Loader2 className="animate-spin text-gray-400" size={28} />
                ) : (
                  centsToDisplay(balance ?? 0)
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex gap-1">
                <button
                  onClick={() => setActiveTab('deposit')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'deposit' ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <ArrowDownLeft size={16} /> Deposit
                </button>
                <button
                  onClick={() => setActiveTab('withdraw')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'withdraw' ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <ArrowUpRight size={16} /> Withdraw
                </button>
                <button
                  onClick={() => setActiveTab('transfer')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'transfer' ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <Send size={16} /> Transfer
                </button>
              </div>
            </CardHeader>
            <CardBody>
              {activeTab === 'deposit' && (
                <Elements stripe={getStripePromise()}>
                  <DepositForm onSuccess={loadData} />
                </Elements>
              )}

              {activeTab === 'withdraw' && (
                <form onSubmit={handleWithdraw} className="space-y-4">
                  <Input
                    label="Amount (USD)"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    fullWidth
                    required
                  />
                  <p className="text-xs text-gray-500">
                    Simulated instant withdrawal against your wallet balance - no real payout is made.
                  </p>
                  <Button type="submit" fullWidth isLoading={isWithdrawing}>
                    Withdraw
                  </Button>
                </form>
              )}

              {activeTab === 'transfer' && (
                <form onSubmit={handleTransfer} className="space-y-4">
                  <Input
                    label="Recipient user ID"
                    value={transferUserId}
                    onChange={(e) => setTransferUserId(e.target.value)}
                    placeholder="e.g. 64f1b2c3..."
                    fullWidth
                    required
                  />
                  <Input
                    label="Amount (USD)"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                    fullWidth
                    required
                  />
                  <Button type="submit" fullWidth isLoading={isTransferring}>
                    Send transfer
                  </Button>
                </form>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Transaction history */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-medium text-gray-900">Transaction History</h2>
            </CardHeader>
            <CardBody>
              {isLoading ? (
                <div className="flex justify-center py-12 text-gray-400">
                  <Loader2 className="animate-spin" size={28} />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No transactions yet.</div>
              ) : (
                <div className="space-y-1">
                  {transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <div className="mr-3">{statusIcon(tx.status)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{typeLabel(tx)}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(tx.createdAt).toLocaleString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="text-right mr-3">
                        <p
                          className={`text-sm font-semibold ${tx.type === 'deposit' ? 'text-success-600' : 'text-gray-900'}`}
                        >
                          {tx.type === 'deposit' ? '+' : '-'}
                          {centsToDisplay(tx.amount)}
                        </p>
                      </div>
                      {statusBadge(tx.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
};
