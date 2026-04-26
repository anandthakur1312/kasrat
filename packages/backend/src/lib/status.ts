import type { MemberStatus, Membership } from '@gym-app/shared/types';
import { addDays, daysBetween, parseDate, todayLocal } from './dates.js';

const EXPIRING_THRESHOLD_DAYS = 7;

export function computeStatus(
  current: Membership | null,
  queued: Membership[],
  gracePeriodDays: number,
  planPriceForCurrent: number | null,
): {
  status: MemberStatus;
  daysOverdue: number | null;
  daysRemaining: number | null;
  amountDue: number | null;
} {
  const TODAY = todayLocal();
  if (!current) {
    return { status: 'payment_pending', daysOverdue: null, daysRemaining: null, amountDue: null };
  }
  if (current.amountPaid === 0 && current.amountDue > 0) {
    return {
      status: 'payment_pending',
      daysOverdue: null,
      daysRemaining: null,
      amountDue: current.amountDue,
    };
  }
  const end = parseDate(current.endDate);
  const overdueAfter = addDays(end, gracePeriodDays);
  const hasQueued = queued.length > 0;
  if (TODAY > overdueAfter && !hasQueued) {
    return {
      status: 'overdue',
      daysOverdue: daysBetween(overdueAfter, TODAY),
      daysRemaining: null,
      amountDue: planPriceForCurrent ?? current.amountDue,
    };
  }
  const daysRemaining = daysBetween(TODAY, end);
  if (daysRemaining <= EXPIRING_THRESHOLD_DAYS && !hasQueued) {
    return {
      status: 'expiring',
      daysOverdue: null,
      daysRemaining: Math.max(0, daysRemaining),
      amountDue: null,
    };
  }
  return { status: 'active', daysOverdue: null, daysRemaining, amountDue: null };
}
