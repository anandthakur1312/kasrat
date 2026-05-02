import type { PaymentAdjustmentType } from '@gym-app/shared/types';

export function paymentAdjustmentType(
  amount: number,
  planPrice: number,
): PaymentAdjustmentType | null {
  if (amount < planPrice) return 'discount';
  if (amount > planPrice) return 'custom_amount';
  return null;
}
