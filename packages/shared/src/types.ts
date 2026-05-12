// Domain entities

export type PaymentMethod = 'cash' | 'upi' | 'other';
export type PaymentAdjustmentType = 'discount' | 'custom_amount';
export type MembershipStatus = 'active' | 'expired' | 'cancelled';
export type MemberStatus = 'overdue' | 'expiring' | 'scheduled' | 'active' | 'payment_pending';
export type MemberSession = 'morning' | 'evening' | 'flexible';

export interface Owner {
  id: string;
  clerkUserId: string;
  name: string;
  email: string;
  phone: string | null;
  isPlatformAdmin: boolean;
  createdAt: string; // ISO 8601
}

export type GymRole = 'admin' | 'staff';
export type GymUserStatus = 'active' | 'disabled';
export type GymStatus = 'active' | 'pending' | 'rejected';
export type AccessRequestStatus = 'pending' | 'approved' | 'rejected' | 'duplicate';

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

// ---- Access / team / invites ----

export interface MeAccessResponse {
  owner: Owner;
  gyms: Array<{ gym: Gym; role: GymRole }>;
  invites: Array<{
    id: string;
    gymId: string;
    gymName: string;
    role: GymRole;
    expiresAt: string;
  }>;
}

export interface TeamMember {
  id: string; // GymUser.id
  ownerId: string;
  name: string;
  email: string;
  role: GymRole;
  status: GymUserStatus;
  createdAt: string;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: GymRole;
  expiresAt: string;
  createdAt: string;
}

export interface TeamResponse {
  members: TeamMember[];
  invites: TeamInvite[];
}

export interface CreateInviteRequest {
  email: string;
  role: GymRole;
}

// Returned exactly once when an invite is created — the admin shares the
// resulting URL manually until an email pipeline exists.
export interface CreateInviteResponse {
  id: string;
  email: string;
  role: GymRole;
  token: string;
  expiresAt: string;
}

export interface UpdateTeamMemberRequest {
  role?: GymRole;
  status?: GymUserStatus;
}

export interface AcceptInviteRequest {
  token: string;
}

export interface AcceptInviteResponse {
  gym: Gym;
  role: GymRole;
}

export interface CreateAccessRequestRequest {
  gymName: string;
  contactPhone: string;
  address: string;
  note?: string;
}

export interface AccessRequestSummary {
  id: string;
  gymName: string;
  status: AccessRequestStatus;
  createdAt: string;
}

export interface AdminAccessRequest {
  id: string;
  gymName: string;
  contactPhone: string;
  address: string;
  note: string | null;
  status: AccessRequestStatus;
  requesterName: string;
  requesterEmail: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AdminGymSummary {
  id: string;
  name: string;
  slug: string;
  status: GymStatus;
  createdByName: string;
  createdByEmail: string;
  memberCount: number;
  createdAt: string;
}
