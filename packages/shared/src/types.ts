// Domain entities

export type PaymentMethod = 'cash' | 'upi' | 'other';
export type MembershipStatus = 'active' | 'expired' | 'cancelled';
export type MemberStatus = 'overdue' | 'expiring' | 'active' | 'payment_pending';

export interface Owner {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string; // ISO 8601
}

export interface Gym {
  id: string;
  name: string;
  slug: string;
  address: string;
  timings: string;
  contactPhone: string;
  upiId: string;
  upiDisplayName: string;
  gracePeriodDays: number;
  createdAt: string;
}

export interface Plan {
  id: string;
  gymId: string;
  durationMonths: number;
  price: number;
  name: string;
  isActive: boolean;
  memberCount?: number; // hydrated for plans list view
  createdAt: string;
}

export interface Member {
  id: string;
  gymId: string;
  name: string;
  phone: string;
  joinDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface Membership {
  id: string;
  memberId: string;
  planId: string;
  startDate: string;
  endDate: string;
  amountDue: number;
  amountPaid: number;
  customPrice: number | null;
  status: MembershipStatus;
  createdAt: string;
}

export interface Payment {
  id: string;
  membershipId: string;
  amount: number;
  method: PaymentMethod;
  paidOn: string;
  referenceNote: string;
  recordedBy: string; // Owner.id
  recordedByName: string; // hydrated
  createdAt: string;
}

// API response shapes

export interface MemberListItem {
  member: Member;
  currentMembership: Membership | null;
  plan: Plan | null; // plan of currentMembership
  status: MemberStatus;
  daysOverdue: number | null; // when status = 'overdue'
  daysRemaining: number | null; // when status = 'expiring' or 'active'
  amountDue: number | null; // when status = 'overdue' or 'payment_pending'
}

export interface MembersListResponse {
  members: MemberListItem[];
  counts: {
    all: number;
    overdue: number; // includes payment_pending
    expiring: number;
    active: number;
  };
}

export interface MemberDetailResponse {
  member: Member;
  currentMembership: Membership | null;
  queuedMemberships: Membership[];
  plan: Plan | null;
  status: MemberStatus;
  daysOverdue: number | null;
  daysRemaining: number | null;
  amountDue: number | null;
  paymentHistory: Array<
    Payment & {
      planName: string; // plan name at time of payment
    }
  >;
}

export interface PublicGymResponse {
  gym: Pick<
    Gym,
    'name' | 'slug' | 'address' | 'timings' | 'contactPhone' | 'upiId' | 'upiDisplayName'
  >;
}

// Request shapes

export interface CreateGymRequest {
  name: string;
  slug: string;
  address: string;
  timings: string;
  contactPhone: string;
  upiId: string;
  plans: Array<{ durationMonths: number; price: number }>;
}

export interface CreateMemberRequest {
  name: string;
  phone: string;
  planId: string;
  startDate: string; // defaults to today on the frontend
}

export interface UpdateMemberRequest {
  name?: string;
  phone?: string;
}

export interface RecordPaymentRequest {
  memberId: string;
  planId: string;
  amount: number;
  method: PaymentMethod;
  paidOn: string;
}

export interface UpdateGymRequest {
  name?: string;
  slug?: string;
  address?: string;
  timings?: string;
  contactPhone?: string;
  upiId?: string;
  upiDisplayName?: string;
  gracePeriodDays?: number;
}

export interface CreatePlanRequest {
  durationMonths: number;
  price: number;
  name?: string;
}

export interface UpdatePlanRequest {
  price?: number;
  name?: string;
  isActive?: boolean;
}
