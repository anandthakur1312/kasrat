// Domain entities

export type PaymentMethod = 'cash' | 'upi' | 'other';
export type PaymentAdjustmentType = 'discount' | 'custom_amount';
export type MembershipStatus = 'active' | 'expired' | 'cancelled';
export type MemberStatus = 'overdue' | 'expiring' | 'scheduled' | 'active' | 'payment_pending';
export type MemberSession = 'morning' | 'evening' | 'flexible';
export type GymRole = 'admin' | 'staff';
export type GymUserStatus = 'active' | 'disabled';
export type GymInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface Owner {
  id: string;
  clerkUserId: string;
  name: string;
  email: string;
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
  preferredSession: MemberSession;
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
  adjustmentType: PaymentAdjustmentType | null;
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
  daysRemaining: number | null; // when status = 'expiring'/'active' or days until 'scheduled'
  amountDue: number | null; // when status = 'overdue' or 'payment_pending'
}

export interface MembersListResponse {
  members: MemberListItem[];
  counts: {
    all: number;
    overdue: number; // includes payment_pending
    expiring: number;
    scheduled: number;
    active: number;
  };
  sessionCounts: {
    all: number;
    morning: number;
    evening: number;
    flexible: number;
  };
}

export interface MemberDetailResponse {
  member: Member;
  currentMembership: Membership | null;
  queuedMemberships: Array<Membership & { planName: string }>;
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

export interface SlugCheckResponse {
  slug: string;
  available: boolean;
  code?: 'SLUG_INVALID_FORMAT' | 'SLUG_RESERVED' | 'SLUG_UNAVAILABLE';
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
  preferredSession?: MemberSession;
}

export interface UpdateMemberRequest {
  name?: string;
  phone?: string;
  preferredSession?: MemberSession;
}

export interface RecordPaymentRequest {
  memberId: string;
  planId: string;
  amount: number;
  method: PaymentMethod;
  paidOn: string;
  referenceNote?: string;
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

// Issue #16: shared gym access

export interface AccessResponse {
  // null when the signed-in user has no active gym membership.
  gym: { id: string; name: string; slug: string } | null;
  role: GymRole | null;
  isPlatformAdmin: boolean;
}

export interface TeamMember {
  ownerId: string;
  email: string;
  name: string;
  role: GymRole;
  status: GymUserStatus;
  joinedAt: string; // ISO 8601
}

export interface PendingInvite {
  id: string;
  email: string;
  role: GymRole;
  status: GymInviteStatus;
  expiresAt: string; // ISO 8601
  createdAt: string; // ISO 8601
}

export interface TeamResponse {
  members: TeamMember[];
  invites: PendingInvite[];
}

export interface CreateInviteRequest {
  email: string;
  role: GymRole;
}

export interface CreateInviteResponse {
  invite: PendingInvite;
  // The raw token is shown to the inviter exactly once. Combined with
  // the frontend origin to make a copyable invite URL.
  rawToken: string;
}

export interface UpdateTeamMemberRequest {
  role?: GymRole;
  status?: GymUserStatus;
}

export interface AcceptInviteRequest {
  token: string;
}

export interface AcceptInviteResponse {
  gym: { id: string; name: string; slug: string };
  role: GymRole;
}
