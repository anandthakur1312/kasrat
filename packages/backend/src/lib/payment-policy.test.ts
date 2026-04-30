import { describe, expect, it } from 'vitest';
import { planMembershipAction } from './payment-policy.js';

const PLAN_1MO = { id: 'plan-1', durationMonths: 1, price: 1000 };
const PLAN_3MO = { id: 'plan-3', durationMonths: 3, price: 2700 };
const PLAN_12MO = { id: 'plan-12', durationMonths: 12, price: 9000 };

describe('planMembershipAction', () => {
  describe('no active membership and no future end', () => {
    it('creates a fresh membership starting on paidOn', () => {
      const action = planMembershipAction({
        activeNow: null,
        scheduledUnpaid: null,
        latestNonCancelledEnd: null,
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

    it('creates a fresh membership when only past memberships exist', () => {
      const action = planMembershipAction({
        activeNow: null,
        scheduledUnpaid: null,
        latestNonCancelledEnd: '2026-01-01', // long-expired
        plan: PLAN_1MO,
        amount: 1000,
        paidOn: '2026-04-29',
      });

      expect(action.kind).toBe('createFresh');
      if (action.kind !== 'createFresh') return;
      expect(action.data.startDate).toBe('2026-04-29');
    });
  });

  describe('active paid membership, no queued', () => {
    it('queues a renewal starting on the active membership end date', () => {
      const action = planMembershipAction({
        activeNow: {
          id: 'membership-current',
          startDate: '2026-04-01',
          amountPaid: 1000,
        },
        scheduledUnpaid: null,
        latestNonCancelledEnd: '2026-05-01', // = active.endDate
        plan: PLAN_3MO,
        amount: 2700,
        paidOn: '2026-04-29',
      });

      expect(action.kind).toBe('queueRenewal');
      if (action.kind !== 'queueRenewal') return;
      // endDate is exclusive, so a membership ending on May 1 is no longer
      // active on May 1. The renewal should start that same day, not May 2.
      expect(action.data.startDate).toBe('2026-05-01');
      expect(action.data.endDate).toBe('2026-08-01');
      expect(action.data.planId).toBe('plan-3');
      expect(action.data.amountDue).toBe(2700);
      expect(action.data.amountPaid).toBe(2700);
      expect(action.data.customPrice).toBeNull();
    });
  });

  describe('active paid membership with already-queued renewal (issue #5)', () => {
    it('queues a SECOND renewal after the latest queued end, not after activeNow', () => {
      // Member has Active Apr 1–May 1 + already-queued May 1–Aug 1.
      // Owner records another advance payment today (Apr 29). The new
      // membership must start Aug 1, not May 1 — otherwise it overlaps
      // the existing queued membership.
      const action = planMembershipAction({
        activeNow: {
          id: 'membership-active',
          startDate: '2026-04-01',
          amountPaid: 1000,
        },
        scheduledUnpaid: null,
        latestNonCancelledEnd: '2026-08-01', // the queued membership's exclusive end
        plan: PLAN_1MO,
        amount: 1000,
        paidOn: '2026-04-29',
      });

      expect(action.kind).toBe('queueRenewal');
      if (action.kind !== 'queueRenewal') return;
      expect(action.data.startDate).toBe('2026-08-01');
      expect(action.data.endDate).toBe('2026-09-01');
    });

    it('chains a third advance renewal after a second queued one', () => {
      // Active Apr 1–May 1, queued #1 May 1–Aug 1, queued #2 Aug 1–Nov 1.
      // Third advance must start Nov 1.
      const action = planMembershipAction({
        activeNow: {
          id: 'membership-active',
          startDate: '2026-04-01',
          amountPaid: 1000,
        },
        scheduledUnpaid: null,
        latestNonCancelledEnd: '2026-11-01',
        plan: PLAN_1MO,
        amount: 1000,
        paidOn: '2026-04-29',
      });

      expect(action.kind).toBe('queueRenewal');
      if (action.kind !== 'queueRenewal') return;
      expect(action.data.startDate).toBe('2026-11-01');
      expect(action.data.endDate).toBe('2026-12-01');
    });

    it('still queues after an active paid membership even if a future unpaid row exists', () => {
      const action = planMembershipAction({
        activeNow: {
          id: 'membership-active',
          startDate: '2026-04-01',
          amountPaid: 1000,
        },
        scheduledUnpaid: {
          id: 'membership-future-unpaid',
          startDate: '2026-05-10',
        },
        latestNonCancelledEnd: '2026-06-10',
        plan: PLAN_1MO,
        amount: 1000,
        paidOn: '2026-04-29',
      });

      expect(action.kind).toBe('queueRenewal');
      if (action.kind !== 'queueRenewal') return;
      expect(action.data.startDate).toBe('2026-06-10');
    });
  });

  describe('queued-only membership (no active)', () => {
    it('queues a new membership after the queued one when paidOn precedes it', () => {
      // Edge case: no active membership today, but a queued one in the future.
      // E.g. owner pre-paid for a membership that hasn't started yet, then
      // wants to record another advance payment. The new one queues after.
      const action = planMembershipAction({
        activeNow: null,
        scheduledUnpaid: null,
        latestNonCancelledEnd: '2026-07-01',
        plan: PLAN_1MO,
        amount: 1000,
        paidOn: '2026-04-29',
      });

      expect(action.kind).toBe('queueRenewal');
      if (action.kind !== 'queueRenewal') return;
      expect(action.data.startDate).toBe('2026-07-01');
    });
  });

  describe('scheduled unpaid membership (issue #8)', () => {
    it('updates the scheduled row in place and preserves its future start date', () => {
      const action = planMembershipAction({
        activeNow: null,
        scheduledUnpaid: {
          id: 'membership-scheduled-unpaid',
          startDate: '2026-05-10',
        },
        latestNonCancelledEnd: '2026-06-10',
        plan: PLAN_1MO,
        amount: 1000,
        paidOn: '2026-04-30',
      });

      expect(action.kind).toBe('updateUnpaid');
      if (action.kind !== 'updateUnpaid') return;
      expect(action.membershipId).toBe('membership-scheduled-unpaid');
      expect(action.data).toEqual({
        planId: 'plan-1',
        startDate: '2026-05-10',
        endDate: '2026-06-10',
        amountDue: 1000,
        amountPaid: 1000,
        customPrice: null,
      });
    });

    it('rewrites plan, end date, due, and custom price without using paidOn as coverage start', () => {
      const action = planMembershipAction({
        activeNow: null,
        scheduledUnpaid: {
          id: 'membership-scheduled-unpaid',
          startDate: '2026-05-10',
        },
        latestNonCancelledEnd: '2027-05-10',
        plan: PLAN_3MO,
        amount: 2500,
        paidOn: '2026-04-30',
      });

      expect(action.kind).toBe('updateUnpaid');
      if (action.kind !== 'updateUnpaid') return;
      expect(action.data).toEqual({
        planId: 'plan-3',
        startDate: '2026-05-10',
        endDate: '2026-08-10',
        amountDue: 2700,
        amountPaid: 2500,
        customPrice: 2500,
      });
    });
  });

  describe('active unpaid membership (Payment pending)', () => {
    it('updates the same membership when the same plan is selected', () => {
      const action = planMembershipAction({
        activeNow: {
          id: 'membership-unpaid',
          startDate: '2026-04-29',
          amountPaid: 0,
        },
        scheduledUnpaid: null,
        latestNonCancelledEnd: '2026-07-29',
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

    // Regression for issue #3: switching a 12-month "Payment pending"
    // membership to a 1-month plan at first payment time must rewrite plan,
    // end date, and amount due — not just amountPaid.
    it('rewrites plan + end date + due when a different plan is selected', () => {
      const action = planMembershipAction({
        activeNow: {
          id: 'membership-unpaid',
          startDate: '2026-04-29',
          amountPaid: 0,
        },
        scheduledUnpaid: null,
        latestNonCancelledEnd: '2027-04-29', // member added with 12-month plan
        plan: PLAN_1MO,
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
          startDate: '2026-04-15', // member started 14 days ago
          amountPaid: 0,
        },
        scheduledUnpaid: null,
        latestNonCancelledEnd: '2027-04-15',
        plan: PLAN_1MO,
        amount: 1000,
        paidOn: '2026-04-29', // payment recorded today
      });

      expect(action.kind).toBe('updateUnpaid');
      if (action.kind !== 'updateUnpaid') return;
      // Membership runs from when the member joined, not from when the
      // payment was recorded. So end = startDate + plan duration.
      expect(action.data.startDate).toBe('2026-04-15');
      expect(action.data.endDate).toBe('2026-05-15');
    });

    it('records customPrice when the amount differs from plan price', () => {
      const action = planMembershipAction({
        activeNow: {
          id: 'membership-unpaid',
          startDate: '2026-04-29',
          amountPaid: 0,
        },
        scheduledUnpaid: null,
        latestNonCancelledEnd: '2027-04-29',
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
