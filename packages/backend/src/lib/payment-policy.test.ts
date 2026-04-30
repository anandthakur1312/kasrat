import { describe, expect, it } from 'vitest';
import { planMembershipAction } from './payment-policy.js';

const PLAN_1MO = { id: 'plan-1', durationMonths: 1, price: 1000 };
const PLAN_3MO = { id: 'plan-3', durationMonths: 3, price: 2700 };
const PLAN_12MO = { id: 'plan-12', durationMonths: 12, price: 9000 };

describe('planMembershipAction', () => {
  describe('no active membership', () => {
    it('creates a fresh membership starting on paidOn', () => {
      const action = planMembershipAction({
        activeNow: null,
        plan: PLAN_3MO,
        amount: 2700,
        paidOn: '2026-04-29',
      });

      expect(action.kind).toBe('createFresh');
      if (action.kind !== 'createFresh') return;
      expect(action.data).toEqual({
        planId: 'plan-3',
        startDate: '2026-04-29',
        endDate: '2026-07-29',
        amountDue: 2700,
        amountPaid: 2700,
        customPrice: null,
      });
    });
  });

  describe('active paid membership', () => {
    it('queues a renewal starting the day after the current ends', () => {
      const action = planMembershipAction({
        activeNow: {
          id: 'membership-current',
          startDate: '2026-04-01',
          endDate: '2026-05-01',
          amountPaid: 1000,
        },
        plan: PLAN_3MO,
        amount: 2700,
        paidOn: '2026-04-29',
      });

      expect(action.kind).toBe('queueRenewal');
      if (action.kind !== 'queueRenewal') return;
      expect(action.data.startDate).toBe('2026-05-02');
      expect(action.data.endDate).toBe('2026-08-02');
      expect(action.data.planId).toBe('plan-3');
      expect(action.data.amountDue).toBe(2700);
      expect(action.data.amountPaid).toBe(2700);
      expect(action.data.customPrice).toBeNull();
    });
  });

  describe('active unpaid membership (Payment pending)', () => {
    it('updates the same membership when the same plan is selected', () => {
      const action = planMembershipAction({
        activeNow: {
          id: 'membership-unpaid',
          startDate: '2026-04-29',
          endDate: '2026-07-29',
          amountPaid: 0,
        },
        plan: PLAN_3MO,
        amount: 2700,
        paidOn: '2026-04-29',
      });

      expect(action.kind).toBe('updateUnpaid');
      if (action.kind !== 'updateUnpaid') return;
      expect(action.membershipId).toBe('membership-unpaid');
      expect(action.data).toEqual({
        planId: 'plan-3',
        startDate: '2026-04-29',
        endDate: '2026-07-29',
        amountDue: 2700,
        amountPaid: 2700,
        customPrice: null,
      });
    });

    // Regression test for issue #3: switching a 12-month "Payment pending"
    // membership to a 1-month plan at first payment time must rewrite plan,
    // end date, and amount due — not just amountPaid.
    it('rewrites plan + end date + due when a different plan is selected', () => {
      const action = planMembershipAction({
        activeNow: {
          id: 'membership-unpaid',
          startDate: '2026-04-29',
          endDate: '2027-04-29', // member added with 12-month plan
          amountPaid: 0,
        },
        plan: PLAN_1MO, // owner switches to 1-month at payment time
        amount: 1000,
        paidOn: '2026-04-29',
      });

      expect(action.kind).toBe('updateUnpaid');
      if (action.kind !== 'updateUnpaid') return;
      expect(action.membershipId).toBe('membership-unpaid');
      expect(action.data).toEqual({
        planId: 'plan-1',
        startDate: '2026-04-29',
        endDate: '2026-05-29',
        amountDue: 1000,
        amountPaid: 1000,
        customPrice: null,
      });
    });

    it('preserves the original startDate even when the plan changes', () => {
      const action = planMembershipAction({
        activeNow: {
          id: 'membership-unpaid',
          startDate: '2026-04-15', // member started using the gym 14 days ago
          endDate: '2027-04-15',
          amountPaid: 0,
        },
        plan: PLAN_1MO,
        amount: 1000,
        paidOn: '2026-04-29', // payment recorded today
      });

      expect(action.kind).toBe('updateUnpaid');
      if (action.kind !== 'updateUnpaid') return;
      // The membership runs from when the member joined, not from when
      // the payment was recorded. So end = startDate + plan duration.
      expect(action.data.startDate).toBe('2026-04-15');
      expect(action.data.endDate).toBe('2026-05-15');
    });

    it('records customPrice when the amount differs from plan price', () => {
      const action = planMembershipAction({
        activeNow: {
          id: 'membership-unpaid',
          startDate: '2026-04-29',
          endDate: '2027-04-29',
          amountPaid: 0,
        },
        plan: PLAN_12MO, // ₹9000 default
        amount: 8000, // owner gave a ₹1000 discount
        paidOn: '2026-04-29',
      });

      expect(action.kind).toBe('updateUnpaid');
      if (action.kind !== 'updateUnpaid') return;
      expect(action.data.amountDue).toBe(9000); // the plan's stated price
      expect(action.data.amountPaid).toBe(8000); // what the member actually paid
      expect(action.data.customPrice).toBe(8000);
    });
  });
});
