// Pure decision helper for what to do with a Membership row when a Payment
// is recorded against a member. Extracted from the POST /payments handler so
// the three-way branch can be unit-tested without spinning up Prisma.
//
// The three actions:
//   1. updateUnpaid  — there is an unpaid active or scheduled membership
//                       (the "Payment pending" / "Scheduled" state from
//                       /members/new). The owner may have changed the plan on
//                       the payment screen, so we update plan, end-date, due,
//                       paid, customPrice in place. See issues #3 and #8.
//   2. queueRenewal  — there is at least one non-cancelled membership whose
//                       endDate is still in the future (active and/or already
//                       queued). The new payment queues a renewal starting
//                       the day after the *latest* of those end dates — never
//                       overlapping a prior queued membership. See issue #5.
//   3. createFresh   — no future-ending memberships at all (lapsed long ago,
//                       or member's only memberships have already expired);
//                       the new payment creates a fresh membership starting
//                       on body.paidOn.

import { addDays, addMonths, iso, parseDate } from './dates.js';

export type ActiveMembership = {
  id: string;
  startDate: string;
  amountPaid: number;
};

export type ScheduledUnpaidMembership = {
  id: string;
  startDate: string;
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
  // The currently-active membership for this member, if any. "Active" here
  // means: startDate <= today < endDate AND status === 'active'.
  activeNow: ActiveMembership | null;
  // The earliest unpaid membership that starts in the future. Recording its
  // first payment should settle that scheduled row in place, preserving the
  // owner's selected coverage start date instead of starting on paidOn.
  scheduledUnpaid: ScheduledUnpaidMembership | null;
  // The latest endDate across all of the member's non-cancelled memberships
  // (including queued ones that haven't started yet). Used so a new payment
  // queues *after* the last queued membership, not after the active one
  // (which would overlap). null when the member has no memberships.
  latestNonCancelledEnd: string | null;
  plan: Plan;
  amount: number;
  paidOn: string;
}): MembershipAction {
  const { activeNow, scheduledUnpaid, latestNonCancelledEnd, plan, amount, paidOn } = args;
  const customPrice = amount !== plan.price ? amount : null;

  const unpaidToUpdate =
    activeNow
      ? activeNow.amountPaid === 0
        ? { id: activeNow.id, startDate: activeNow.startDate }
        : null
      : scheduledUnpaid;

  if (unpaidToUpdate) {
    // First payment on a "Payment pending" membership. Preserve the original
    // start date (when the member began using the gym) but recompute end
    // from the *selected* plan's duration. This is the issue-#3 fix: the
    // plan, end, due, customPrice all need to track the user's choice. For a
    // scheduled unpaid membership (issue #8), that same preservation prevents
    // an early payment date from becoming the coverage start date.
    const start = parseDate(unpaidToUpdate.startDate);
    const end = addMonths(start, plan.durationMonths);
    return {
      kind: 'updateUnpaid',
      membershipId: unpaidToUpdate.id,
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

  // From here on we're creating a new Membership row. The only question is
  // its startDate.
  //
  // If there's any non-cancelled membership ending strictly *after* the
  // payment date — current and/or queued — we queue this new one to begin
  // the day after the latest of those ends. This is the issue-#5 fix:
  // queueing must respect all queued memberships, not just the active one.
  //
  // Otherwise (no future end at all), it's a fresh start on the payment
  // date itself.
  if (latestNonCancelledEnd && latestNonCancelledEnd > paidOn) {
    const start = addDays(parseDate(latestNonCancelledEnd), 1);
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
