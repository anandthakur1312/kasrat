import type {
  Gym,
  Member,
  Membership,
  Owner,
  Payment,
  Plan,
} from '@gym-app/shared/types';

// ---------- date helpers ----------

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function iso(d: Date): string {
  // Local-date YYYY-MM-DD; avoids the toISOString UTC shift in non-UTC timezones.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoDateTime(d: Date): string {
  return d.toISOString();
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

export const dateHelpers = { TODAY, iso, isoDateTime, addDays, addMonths };

// ---------- seed entities ----------

const yearAgoIso = isoDateTime(addDays(TODAY, -380));

const owner: Owner = {
  id: 'owner-1',
  clerkUserId: 'mock_user_anand',
  name: 'Anand Sharma',
  email: 'anand@example.com',
  phone: null,
  isPlatformAdmin: true,
  createdAt: yearAgoIso,
};

const gym: Gym = {
  id: 'gym-1',
  name: 'Gungun Fitness Club',
  slug: 'gungun',
  address: '123 MG Road,\nSagar, Madhya Pradesh 470001',
  timings: 'Mon–Sat\nMorning: 6:00 AM – 10:00 AM\nEvening: 5:00 PM – 9:00 PM',
  contactPhone: '+91 98765 43210',
  upiId: 'sagargym@okaxis',
  upiDisplayName: 'Gungun Fitness Club',
  gracePeriodDays: 5,
  createdAt: yearAgoIso,
};

const plans: Plan[] = [
  {
    id: 'plan-1mo',
    gymId: gym.id,
    durationMonths: 1,
    price: 1000,
    name: '1 Month',
    isActive: true,
    createdAt: yearAgoIso,
  },
  {
    id: 'plan-3mo',
    gymId: gym.id,
    durationMonths: 3,
    price: 2700,
    name: '3 Months',
    isActive: true,
    createdAt: yearAgoIso,
  },
  {
    id: 'plan-6mo',
    gymId: gym.id,
    durationMonths: 6,
    price: 5000,
    name: '6 Months',
    isActive: true,
    createdAt: yearAgoIso,
  },
  {
    id: 'plan-12mo',
    gymId: gym.id,
    durationMonths: 12,
    price: 9000,
    name: '12 Months',
    isActive: true,
    createdAt: yearAgoIso,
  },
];

// ---------- members ----------

const members: Member[] = [
  {
    id: 'member-1',
    gymId: gym.id,
    name: 'Rajesh Kumar',
    phone: '+91 98123 45678',
    joinDate: iso(addDays(TODAY, -380)),
    preferredSession: 'morning',
    isActive: true,
    createdAt: isoDateTime(addDays(TODAY, -380)),
  },
  {
    id: 'member-2',
    gymId: gym.id,
    name: 'Sneha Patel',
    phone: '+91 99876 54321',
    joinDate: iso(addMonths(addDays(TODAY, 3), -6)),
    preferredSession: 'evening',
    isActive: true,
    createdAt: isoDateTime(addMonths(addDays(TODAY, 3), -6)),
  },
  {
    id: 'member-3',
    gymId: gym.id,
    name: 'Anjali Singh',
    phone: '+91 97000 12345',
    joinDate: iso(addMonths(addDays(TODAY, 42), -3)),
    preferredSession: 'flexible',
    isActive: true,
    createdAt: isoDateTime(addMonths(addDays(TODAY, 42), -3)),
  },
];

// ---------- memberships ----------

// Rajesh: 4 historical 3-month memberships, the last one expired 12 days ago.
const rajeshEnd4 = addDays(TODAY, -12);
const rajeshStart4 = addMonths(rajeshEnd4, -3);
const rajeshEnd3 = rajeshStart4;
const rajeshStart3 = addMonths(rajeshEnd3, -3);
const rajeshEnd2 = rajeshStart3;
const rajeshStart2 = addMonths(rajeshEnd2, -3);
const rajeshEnd1 = rajeshStart2;
const rajeshStart1 = addMonths(rajeshEnd1, -3);

// Sneha: active 6-month membership, ends in 3 days.
const snehaEnd = addDays(TODAY, 3);
const snehaStart = addMonths(snehaEnd, -6);

// Anjali: active 3-month membership, 42 days remaining.
const anjaliEnd = addDays(TODAY, 42);
const anjaliStart = addMonths(anjaliEnd, -3);

const memberships: Membership[] = [
  // Rajesh's 4 expired 3-month memberships
  {
    id: 'membership-r1',
    memberId: 'member-1',
    planId: 'plan-3mo',
    startDate: iso(rajeshStart1),
    endDate: iso(rajeshEnd1),
    amountDue: 2700,
    amountPaid: 2700,
    customPrice: null,
    status: 'expired',
    createdAt: isoDateTime(rajeshStart1),
  },
  {
    id: 'membership-r2',
    memberId: 'member-1',
    planId: 'plan-3mo',
    startDate: iso(rajeshStart2),
    endDate: iso(rajeshEnd2),
    amountDue: 2700,
    amountPaid: 2700,
    customPrice: null,
    status: 'expired',
    createdAt: isoDateTime(rajeshStart2),
  },
  {
    id: 'membership-r3',
    memberId: 'member-1',
    planId: 'plan-3mo',
    startDate: iso(rajeshStart3),
    endDate: iso(rajeshEnd3),
    amountDue: 2700,
    amountPaid: 2700,
    customPrice: null,
    status: 'expired',
    createdAt: isoDateTime(rajeshStart3),
  },
  {
    id: 'membership-r4',
    memberId: 'member-1',
    planId: 'plan-3mo',
    startDate: iso(rajeshStart4),
    endDate: iso(rajeshEnd4),
    amountDue: 2700,
    amountPaid: 2700,
    customPrice: null,
    status: 'expired',
    createdAt: isoDateTime(rajeshStart4),
  },
  // Sneha's active 6-month membership
  {
    id: 'membership-s1',
    memberId: 'member-2',
    planId: 'plan-6mo',
    startDate: iso(snehaStart),
    endDate: iso(snehaEnd),
    amountDue: 5000,
    amountPaid: 5000,
    customPrice: null,
    status: 'active',
    createdAt: isoDateTime(snehaStart),
  },
  // Anjali's active 3-month membership
  {
    id: 'membership-a1',
    memberId: 'member-3',
    planId: 'plan-3mo',
    startDate: iso(anjaliStart),
    endDate: iso(anjaliEnd),
    amountDue: 2700,
    amountPaid: 2700,
    customPrice: null,
    status: 'active',
    createdAt: isoDateTime(anjaliStart),
  },
];

// ---------- payments (5 total) ----------

const payments: Payment[] = [
  {
    id: 'payment-r1',
    membershipId: 'membership-r1',
    amount: 2700,
    method: 'cash',
    paidOn: iso(rajeshStart1),
    adjustmentType: null,
    referenceNote: '',
    recordedBy: owner.id,
    recordedByName: owner.name,
    createdAt: isoDateTime(rajeshStart1),
  },
  {
    id: 'payment-r2',
    membershipId: 'membership-r2',
    amount: 2700,
    method: 'upi',
    paidOn: iso(rajeshStart2),
    adjustmentType: null,
    referenceNote: 'GYM-MEM-001',
    recordedBy: owner.id,
    recordedByName: owner.name,
    createdAt: isoDateTime(rajeshStart2),
  },
  {
    id: 'payment-r3',
    membershipId: 'membership-r3',
    amount: 2700,
    method: 'cash',
    paidOn: iso(rajeshStart3),
    adjustmentType: null,
    referenceNote: '',
    recordedBy: owner.id,
    recordedByName: owner.name,
    createdAt: isoDateTime(rajeshStart3),
  },
  {
    id: 'payment-r4',
    membershipId: 'membership-r4',
    amount: 2700,
    method: 'upi',
    paidOn: iso(rajeshStart4),
    adjustmentType: null,
    referenceNote: 'GYM-MEM-001',
    recordedBy: owner.id,
    recordedByName: owner.name,
    createdAt: isoDateTime(rajeshStart4),
  },
  {
    id: 'payment-s1',
    membershipId: 'membership-s1',
    amount: 5000,
    method: 'upi',
    paidOn: iso(snehaStart),
    adjustmentType: null,
    referenceNote: 'GYM-MEM-002',
    recordedBy: owner.id,
    recordedByName: owner.name,
    createdAt: isoDateTime(snehaStart),
  },
];

// ---------- mutable in-memory store ----------

export const mockState = {
  owner,
  gym,
  plans,
  members,
  memberships,
  payments,
};

// ---------- id generator ----------

let idCounter = 1000;
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}
