import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Membership } from '@gym-app/shared/types';
import { computeStatus } from './status.js';

function membership(over: Partial<Membership> = {}): Membership {
  return {
    id: 'membership-test',
    memberId: 'member-1',
    planId: 'plan-1',
    startDate: '2026-01-01',
    endDate: '2026-04-30',
    amountDue: 2700,
    amountPaid: 2700,
    customPrice: null,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

const TODAY = '2026-04-26';
const GRACE = 3;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T08:00:00`));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('computeStatus', () => {
  it('returns payment_pending when there is no current membership', () => {
    const r = computeStatus(null, [], GRACE, null);
    expect(r.status).toBe('payment_pending');
    expect(r.amountDue).toBeNull();
  });

  it('returns payment_pending when current membership has amountPaid=0 and amountDue>0', () => {
    const r = computeStatus(membership({ amountPaid: 0 }), [], GRACE, 2700);
    expect(r.status).toBe('payment_pending');
    expect(r.amountDue).toBe(2700);
  });

  it('returns scheduled before a future-start unpaid membership begins', () => {
    const r = computeStatus(
      membership({ startDate: '2026-05-10', endDate: '2026-06-10', amountPaid: 0 }),
      [],
      GRACE,
      2700,
    );
    expect(r.status).toBe('scheduled');
    expect(r.daysRemaining).toBe(14);
    expect(r.amountDue).toBeNull();
  });

  it('returns scheduled before a future-start paid membership begins', () => {
    const r = computeStatus(
      membership({ startDate: '2026-05-10', endDate: '2026-06-10', amountPaid: 2700 }),
      [],
      GRACE,
      2700,
    );
    expect(r.status).toBe('scheduled');
    expect(r.daysRemaining).toBe(14);
  });

  it('returns active when end date is well in the future', () => {
    const r = computeStatus(membership({ endDate: '2026-06-30' }), [], GRACE, 2700);
    expect(r.status).toBe('active');
    expect(r.daysRemaining).toBe(65);
  });

  it('returns expiring within the 7-day window', () => {
    const r = computeStatus(membership({ endDate: '2026-04-29' }), [], GRACE, 2700);
    expect(r.status).toBe('expiring');
    expect(r.daysRemaining).toBe(3);
  });

  it('returns overdue once past end date + grace period and no queued membership', () => {
    const r = computeStatus(membership({ endDate: '2026-04-16' }), [], GRACE, 2700);
    expect(r.status).toBe('overdue');
    expect(r.daysOverdue).toBe(7);
    expect(r.amountDue).toBe(2700);
  });

  it('does NOT mark as overdue if there is a queued membership lined up', () => {
    const r = computeStatus(
      membership({ endDate: '2026-04-16' }),
      [membership({ id: 'queued', startDate: '2026-04-17', endDate: '2026-07-17' })],
      GRACE,
      2700,
    );
    expect(r.status).not.toBe('overdue');
  });

  it('does NOT mark as expiring if a queued membership is lined up', () => {
    const r = computeStatus(
      membership({ endDate: '2026-04-29' }),
      [membership({ id: 'queued', startDate: '2026-04-30', endDate: '2026-07-30' })],
      GRACE,
      2700,
    );
    expect(r.status).toBe('active');
  });

  it('uses planPriceForCurrent for amountDue when overdue', () => {
    const r = computeStatus(
      membership({ endDate: '2026-04-16', amountDue: 2700 }),
      [],
      GRACE,
      3000, // plan price changed since membership was created
    );
    expect(r.status).toBe('overdue');
    expect(r.amountDue).toBe(3000);
  });
});
