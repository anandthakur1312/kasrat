// Pure decision helper for what to do with a Membership row when a Payment
// is recorded against a member. Extracted from the POST /payments handler so
// the three-way branch can be unit-tested without spinning up Prisma.
//
// The three actions:
//   1. updateUnpaid  — there is an active membership with amountPaid === 0
//                       (the "Payment pending" state from /members/new). The
//                       owner may have changed the plan on the payment screen,
//                       so we update plan, end-date, due, paid, customPrice
//                       in place. See issue #3.
//   2. queueRenewal  — there is an active paid membership; the new payment
//                       creates a queued membership starting on activeNow.endDate + 1.
//   3. createFresh   — no current membership at all (lapsed long ago, etc.);
//                       the new payment creates a fresh membership starting
//                       on body.paidOn.

import { addDays, addMonths, iso, parseDate } from './dates.js';

export type ActiveMembership = {
  id: string;
  startDate: string;
  endDate: string;
  amountPaid: number;
};

export type Plan = {
  id: string;
  durationMonths: number;
  price: number;
};

export type MembershipFields = {
  planId: string;
  startDate: string;
  endDate: string;
  amountDue: number;
  amountPaid: number;
  customPrice: number | null;
};

export type MembershipAction =
  | { kind: 'updateUnpaid'; membershipId: string; data: MembershipFields }
  | { kind: 'queueRenewal'; data: MembershipFields }
  | { kind: 'createFresh'; data: MembershipFields };

export function planMembershipAction(args: {
  activeNow: ActiveMembership | null;
  plan: Plan;
  amount: number;
  paidOn: string;
}): MembershipAction {
  const { activeNow, plan, amount, paidOn } = args;
  const customPrice = amount !== plan.price ? amount : null;

  if (activeNow && activeNow.amountPaid === 0) {
    // First payment on a "Payment pending" membership. Preserve the original
    // start date (when the member began using the gym) but recompute end
    // from the *selected* plan's duration. This is the issue-#3 fix: the
    // plan, end, due, customPrice all need to track the user's choice.
    const start = parseDate(activeNow.startDate);
    const end = addMonths(start, plan.durationMonths);
    return {
      kind: 'updateUnpaid',
      membershipId: activeNow.id,
      data: {
        planId: plan.id,
        startDate: iso(start),
        endDate: iso(end),
        amountDue: plan.price,
        amountPaid: amount,
        customPrice,
      },
    };
  }

  if (activeNow) {
    // Active paid membership exists — queue the renewal to start the day
    // after the current one ends.
    const start = addDays(parseDate(activeNow.endDate), 1);
    const end = addMonths(start, plan.durationMonths);
    return {
      kind: 'queueRenewal',
      data: {
        planId: plan.id,
        startDate: iso(start),
        endDate: iso(end),
        amountDue: plan.price,
        amountPaid: amount,
        customPrice,
      },
    };
  }

  // No active membership (lapsed, or never had one) — fresh start.
  const start = parseDate(paidOn);
  const end = addMonths(start, plan.durationMonths);
  return {
    kind: 'createFresh',
    data: {
      planId: plan.id,
      startDate: iso(start),
      endDate: iso(end),
      amountDue: plan.price,
      amountPaid: amount,
      customPrice,
    },
  };
}
