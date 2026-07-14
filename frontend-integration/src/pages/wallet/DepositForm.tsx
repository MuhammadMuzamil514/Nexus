import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '../../components/ui/Button';
import { paymentsApi, dollarsToCents } from '../../lib/paymentsApi';
import toast from 'react-hot-toast';

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '14px',
      color: '#111827',
      '::placeholder': { color: '#9CA3AF' },
    },
    invalid: { color: '#EF4444' },
  },
};

interface DepositFormProps {
  onSuccess: () => void;
}

// Lives inside <Elements> - see WalletPage.tsx. Test card: 4242 4242 4242 4242,
// any future expiry, any 3-digit CVC.
export const DepositForm: React.FC<DepositFormProps> = ({ onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [amount, setAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    const dollars = parseFloat(amount);
    if (isNaN(dollars) || dollars < 0.5) {
      toast.error('Enter an amount of at least $0.50');
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Ask our backend to create a Stripe PaymentIntent (server-side, test mode)
      const { transaction, clientSecret } = await paymentsApi.createDeposit(
        dollarsToCents(dollars)
      );

      // 2. Confirm the card payment client-side with Stripe directly
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('Card element not ready');

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (result.error) {
        toast.error(result.error.message || 'Payment failed');
        return;
      }

      // 3. Ask our backend to re-verify the status directly with Stripe
      await paymentsApi.confirmDeposit(transaction.id);

      toast.success('Deposit successful');
      cardElement.clear();
      setAmount('');
      onSuccess();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Deposit failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Amount (USD)</label>
        <input
          type="number"
          min="0.5"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="block w-full rounded-md shadow-sm border-gray-300 focus:border-primary-500 focus:ring-primary-500 focus:ring-2 focus:ring-opacity-50 sm:text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Card details</label>
        <div className="border border-gray-300 rounded-md px-3 py-2.5">
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Test mode - use 4242 4242 4242 4242, any future expiry, any CVC.
        </p>
      </div>

      <Button type="submit" fullWidth isLoading={isProcessing} disabled={!stripe}>
        Deposit
      </Button>
    </form>
  );
};
