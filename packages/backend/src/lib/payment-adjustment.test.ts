import { describe, expect, it } from 'vitest';
import { paymentAdjustmentType } from './payment-adjustment.js';

describe('paymentAdjustmentType', () => {
  it('returns null when amount matches the plan price', () => {
    expect(paymentAdjustmentType(1000, 1000)).toBeNull();
  });

  it('returns discount when amount is lower than the plan price', () => {
    expect(paymentAdjustmentType(800, 1000)).toBe('discount');
  });

  it('treats zero amount as a discount', () => {
    expect(paymentAdjustmentType(0, 1000)).toBe('discount');
  });

  it('returns custom_amount when amount is higher than the plan price', () => {
    expect(paymentAdjustmentType(1200, 1000)).toBe('custom_amount');
  });
});
