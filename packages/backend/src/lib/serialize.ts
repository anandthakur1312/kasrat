import type { Gym, Member, Membership, Owner, Payment, Plan } from '@gym-app/shared/types';

type DbDate = Date | string;

function asISO(d: DbDate): string {
  return d instanceof Date ? d.toISOString() : d;
}

export function toOwner(row: {
  id: string;
  clerkUserId: string;
  name: string;
  email: string;
  phone: string | null;
  isPlatformAdmin: boolean;
  createdAt: DbDate;
}): Owner {
  return {
    id: row.id,
    clerkUserId: row.clerkUserId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    isPlatformAdmin: row.isPlatformAdmin,
    createdAt: asISO(row.createdAt),
  };
}

export function toGym(row: {
  id: string;
  name: string;
  slug: string;
  address: string;
  timings: string;
  contactPhone: string;
  upiId: string;
  upiDisplayName: string;
  gracePeriodDays: number;
  createdAt: DbDate;
}): Gym {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    address: row.address,
    timings: row.timings,
    contactPhone: row.contactPhone,
    upiId: row.upiId,
    upiDisplayName: row.upiDisplayName,
    gracePeriodDays: row.gracePeriodDays,
    createdAt: asISO(row.createdAt),
  };
}

export function toPlan(row: {
  id: string;
  gymId: string;
  durationMonths: number;
  price: number;
  name: string;
  isActive: boolean;
  createdAt: DbDate;
}): Plan {
  return {
    id: row.id,
    gymId: row.gymId,
    durationMonths: row.durationMonths,
    price: row.price,
    name: row.name,
    isActive: row.isActive,
    createdAt: asISO(row.createdAt),
  };
}

export function toMember(row: {
  id: string;
  gymId: string;
  name: string;
  phone: string;
  joinDate: string;
  preferredSession: string;
  isActive: boolean;
  createdAt: DbDate;
}): Member {
  return {
    id: row.id,
    gymId: row.gymId,
    name: row.name,
    phone: row.phone,
    joinDate: row.joinDate,
    preferredSession: row.preferredSession as Member['preferredSession'],
    isActive: row.isActive,
    createdAt: asISO(row.createdAt),
  };
}

export function toMembership(row: {
  id: string;
  memberId: string;
  planId: string;
  startDate: string;
  endDate: string;
  amountDue: number;
  amountPaid: number;
  customPrice: number | null;
  status: string;
  createdAt: DbDate;
}): Membership {
  return {
    id: row.id,
    memberId: row.memberId,
    planId: row.planId,
    startDate: row.startDate,
    endDate: row.endDate,
    amountDue: row.amountDue,
    amountPaid: row.amountPaid,
    customPrice: row.customPrice,
    status: row.status as Membership['status'],
    createdAt: asISO(row.createdAt),
  };
}

export function toPayment(
  row: {
    id: string;
    membershipId: string;
    amount: number;
    method: string;
    paidOn: string;
    adjustmentType: string | null;
    referenceNote: string;
    recordedBy: string;
    recordedByName: string;
    createdAt: DbDate;
  },
): Payment {
  return {
    id: row.id,
    membershipId: row.membershipId,
    amount: row.amount,
    method: row.method as Payment['method'],
    paidOn: row.paidOn,
    adjustmentType: row.adjustmentType as Payment['adjustmentType'],
    referenceNote: row.referenceNote,
    recordedBy: row.recordedBy,
    recordedByName: row.recordedByName,
    createdAt: asISO(row.createdAt),
  };
}
