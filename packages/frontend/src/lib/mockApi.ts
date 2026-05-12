import type {
  AcceptInviteRequest,
  AcceptInviteResponse,
  AccessRequestSummary,
  AdminAccessRequest,
  AdminGymSummary,
  CreateAccessRequestRequest,
  CreateGymRequest,
  CreateInviteRequest,
  CreateInviteResponse,
  CreateMemberRequest,
  CreatePlanRequest,
  GymRole,
  Gym,
  MeAccessResponse,
  Member,
  UpdateMemberRequest,
  MemberDetailResponse,
  MemberListItem,
  MemberStatus,
  Membership,
  MembersListResponse,
  Payment,
  Plan,
  PublicGymResponse,
  RecordPaymentRequest,
  SlugCheckResponse,
  TeamMember,
  TeamResponse,
  UpdateGymRequest,
  UpdatePlanRequest,
  UpdateTeamMemberRequest,
} from '@gym-app/shared/types';
import { validateSlug } from '@gym-app/shared/reservedSlugs';
import { dateHelpers, mockState, nextId } from './mockData';

const { TODAY, iso, addDays, addMonths } = dateHelpers;

const EXPIRING_THRESHOLD_DAYS = 7;

const delay = (ms = 100) => new Promise((r) => setTimeout(r, ms));

function paymentAdjustmentType(amount: number, planPrice: number): Payment['adjustmentType'] {
  if (amount < planPrice) return 'discount';
  if (amount > planPrice) return 'custom_amount';
  return null;
}

// ---------- internal helpers ----------

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function parseDate(s: string): Date {
  // Parse YYYY-MM-DD as local-date midnight; avoids the UTC shift of `new Date(s)`.
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function findMember(id: string): Member {
  const m = mockState.members.find((x) => x.id === id);
  if (!m) throw new Error(`Member not found: ${id}`);
  return m;
}

function findPlan(id: string): Plan {
  const p = mockState.plans.find((x) => x.id === id);
  if (!p) throw new Error(`Plan not found: ${id}`);
  return p;
}

function membershipsForMember(memberId: string): Membership[] {
  return mockState.memberships
    .filter((m) => m.memberId === memberId)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function currentMembershipFor(memberId: string): Membership | null {
  const today = iso(TODAY);
  const ms = membershipsForMember(memberId);
  // current = startDate <= today < endDate, prefer active over expired
  const active = ms.find(
    (m) => m.startDate <= today && today < m.endDate && m.status !== 'cancelled',
  );
  if (active) return active;
  const scheduled = ms.find((m) => m.startDate > today && m.status !== 'cancelled');
  if (scheduled) return scheduled;
  // otherwise the most recent expired/cancelled
  const past = ms.filter((m) => m.endDate <= today);
  return past[past.length - 1] ?? null;
}

function queuedMembershipsFor(memberId: string): Membership[] {
  const today = iso(TODAY);
  const current = currentMembershipFor(memberId);
  return membershipsForMember(memberId).filter(
    (m) => m.startDate > today && m.status !== 'cancelled' && m.id !== current?.id,
  );
}

function computeStatus(
  current: Membership | null,
  queued: Membership[],
  gracePeriodDays: number,
): {
  status: MemberStatus;
  daysOverdue: number | null;
  daysRemaining: number | null;
  amountDue: number | null;
} {
  if (!current) {
    return {
      status: 'payment_pending',
      daysOverdue: null,
      daysRemaining: null,
      amountDue: null,
    };
  }

  const start = parseDate(current.startDate);
  if (start > TODAY) {
    return {
      status: 'scheduled',
      daysOverdue: null,
      daysRemaining: daysBetween(TODAY, start),
      amountDue: null,
    };
  }

  // Payment pending: a current/queued membership exists with no payment recorded yet.
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
  const daysPastGrace = daysBetween(overdueAfter, TODAY);

  const hasActiveQueued = queued.length > 0;

  // Overdue: end + grace < today AND no queued renewal
  if (TODAY > overdueAfter && !hasActiveQueued) {
    const plan = mockState.plans.find((p) => p.id === current.planId);
    const renewalAmount = plan?.price ?? current.amountDue;
    return {
      status: 'overdue',
      daysOverdue: daysPastGrace,
      daysRemaining: null,
      amountDue: renewalAmount,
    };
  }

  const daysRemaining = daysBetween(TODAY, end);
  if (daysRemaining <= EXPIRING_THRESHOLD_DAYS && !hasActiveQueued) {
    return {
      status: 'expiring',
      daysOverdue: null,
      daysRemaining: Math.max(0, daysRemaining),
      amountDue: null,
    };
  }

  return {
    status: 'active',
    daysOverdue: null,
    daysRemaining,
    amountDue: null,
  };
}

function buildListItem(member: Member): MemberListItem {
  const current = currentMembershipFor(member.id);
  const queued = queuedMembershipsFor(member.id);
  const plan = current ? mockState.plans.find((p) => p.id === current.planId) ?? null : null;
  const s = computeStatus(current, queued, mockState.gym.gracePeriodDays);
  return {
    member,
    currentMembership: current,
    plan,
    status: s.status,
    daysOverdue: s.daysOverdue,
    daysRemaining: s.daysRemaining,
    amountDue: s.amountDue,
  };
}

function sortListItems(items: MemberListItem[]): MemberListItem[] {
  // overdue → payment_pending → expiring → scheduled → active
  const rank: Record<MemberStatus, number> = {
    overdue: 0,
    payment_pending: 1,
    expiring: 2,
    scheduled: 3,
    active: 4,
  };
  return [...items].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.status === 'overdue') return (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0);
    if (a.status === 'expiring') return (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0);
    if (a.status === 'scheduled') return (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0);
    if (a.status === 'active') return a.member.name.localeCompare(b.member.name);
    return a.member.name.localeCompare(b.member.name);
  });
}

// ---------- API ----------

export const mockApi = {
  async getMembersList(): Promise<MembersListResponse> {
    await delay();
    const items = mockState.members
      .filter((m) => m.isActive)
      .map(buildListItem);
    const sorted = sortListItems(items);
    const counts = {
      all: sorted.length,
      overdue: sorted.filter(
        (i) => i.status === 'overdue' || i.status === 'payment_pending',
      ).length,
      expiring: sorted.filter((i) => i.status === 'expiring').length,
      scheduled: sorted.filter((i) => i.status === 'scheduled').length,
      active: sorted.filter((i) => i.status === 'active').length,
    };
    const sessionCounts = {
      all: sorted.length,
      morning: sorted.filter((i) => i.member.preferredSession === 'morning').length,
      evening: sorted.filter((i) => i.member.preferredSession === 'evening').length,
      flexible: sorted.filter((i) => i.member.preferredSession === 'flexible').length,
    };
    return { members: sorted, counts, sessionCounts };
  },

  async getMemberDetail(id: string): Promise<MemberDetailResponse> {
    await delay();
    const member = findMember(id);
    const current = currentMembershipFor(member.id);
    const queued = queuedMembershipsFor(member.id);
    const plan = current ? mockState.plans.find((p) => p.id === current.planId) ?? null : null;
    const s = computeStatus(current, queued, mockState.gym.gracePeriodDays);

    const memberMembershipIds = new Set(
      membershipsForMember(member.id).map((m) => m.id),
    );
    const paymentHistory = mockState.payments
      .filter((p) => memberMembershipIds.has(p.membershipId))
      .sort((a, b) => b.paidOn.localeCompare(a.paidOn))
      .map((p) => {
        const ms = mockState.memberships.find((m) => m.id === p.membershipId);
        const planForPayment = ms ? mockState.plans.find((pl) => pl.id === ms.planId) : null;
        return { ...p, planName: planForPayment?.name ?? '' };
      });

    return {
      member,
      currentMembership: current,
      queuedMemberships: queued.map((m) => ({
        ...m,
        planName: mockState.plans.find((pl) => pl.id === m.planId)?.name ?? '',
      })),
      plan,
      status: s.status,
      daysOverdue: s.daysOverdue,
      daysRemaining: s.daysRemaining,
      amountDue: s.amountDue,
      paymentHistory,
    };
  },

  async createMember(req: CreateMemberRequest): Promise<Member> {
    await delay();
    const plan = findPlan(req.planId);
    if (!plan.isActive) throw new Error(`Plan is archived: ${req.planId}`);
    const member: Member = {
      id: nextId('member'),
      gymId: mockState.gym.id,
      name: req.name,
      phone: req.phone,
      joinDate: req.startDate,
      preferredSession: req.preferredSession ?? 'flexible',
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    mockState.members.push(member);

    const start = parseDate(req.startDate);
    const end = addMonths(start, plan.durationMonths);
    const membership: Membership = {
      id: nextId('membership'),
      memberId: member.id,
      planId: plan.id,
      startDate: iso(start),
      endDate: iso(end),
      amountDue: plan.price,
      amountPaid: 0,
      customPrice: null,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    mockState.memberships.push(membership);

    return member;
  },

  async updateMember(id: string, req: UpdateMemberRequest): Promise<Member> {
    await delay();
    const member = findMember(id);
    if (req.name !== undefined) member.name = req.name.trim();
    if (req.phone !== undefined) member.phone = req.phone.trim();
    if (req.preferredSession !== undefined) member.preferredSession = req.preferredSession;
    return { ...member };
  },

  async deleteMember(id: string): Promise<void> {
    await delay();
    const member = findMember(id);
    member.isActive = false;
  },

  async recordPayment(req: RecordPaymentRequest): Promise<Payment> {
    await delay();
    const member = findMember(req.memberId);
    const plan = findPlan(req.planId);
    const today = iso(TODAY);
    if (req.paidOn > today) throw new Error('Payment date cannot be in the future');

    // Find member's existing memberships
    const existing = membershipsForMember(member.id);
    const activeNow = existing.find(
      (m) => m.startDate <= today && today < m.endDate && m.status === 'active',
    );
    const scheduledUnpaid = existing.find(
      (m) => m.startDate > today && m.status !== 'cancelled' && m.amountPaid === 0 && m.amountDue > 0,
    );
    const latestNonCancelledEnd = existing
      .filter((m) => m.status !== 'cancelled')
      .reduce<string | null>(
        (max, m) => (max === null || m.endDate > max ? m.endDate : max),
        null,
      );

    let membership: Membership;

    // If member has an unpaid active or scheduled membership, attach payment
    // to it and preserve its selected coverage start date.
    const unpaidToUpdate = activeNow
      ? activeNow.amountPaid === 0
        ? activeNow
        : null
      : scheduledUnpaid;
    if (unpaidToUpdate) {
      const start = parseDate(unpaidToUpdate.startDate);
      const end = addMonths(start, plan.durationMonths);
      unpaidToUpdate.planId = plan.id;
      unpaidToUpdate.endDate = iso(end);
      unpaidToUpdate.amountDue = plan.price;
      unpaidToUpdate.customPrice = req.amount !== plan.price ? req.amount : null;
      unpaidToUpdate.amountPaid = req.amount;
      membership = unpaidToUpdate;
    } else if (latestNonCancelledEnd && latestNonCancelledEnd > req.paidOn) {
      // Queue after the latest future-ending membership. endDate is exclusive,
      // so starting on that date keeps coverage continuous without overlap.
      const start = parseDate(latestNonCancelledEnd);
      const end = addMonths(start, plan.durationMonths);
      membership = {
        id: nextId('membership'),
        memberId: member.id,
        planId: plan.id,
        startDate: iso(start),
        endDate: iso(end),
        amountDue: plan.price,
        amountPaid: req.amount,
        customPrice: req.amount !== plan.price ? req.amount : null,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      mockState.memberships.push(membership);
    } else {
      // No current membership (or current is expired) — create new starting on paidOn.
      const start = parseDate(req.paidOn);
      const end = addMonths(start, plan.durationMonths);
      membership = {
        id: nextId('membership'),
        memberId: member.id,
        planId: plan.id,
        startDate: iso(start),
        endDate: iso(end),
        amountDue: plan.price,
        amountPaid: req.amount,
        customPrice: req.amount !== plan.price ? req.amount : null,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      mockState.memberships.push(membership);
    }

    const payment: Payment = {
      id: nextId('payment'),
      membershipId: membership.id,
      amount: req.amount,
      method: req.method,
      paidOn: req.paidOn,
      adjustmentType: paymentAdjustmentType(req.amount, plan.price),
      referenceNote: req.referenceNote?.trim() ?? '',
      recordedBy: mockState.owner.id,
      recordedByName: mockState.owner.name,
      createdAt: new Date().toISOString(),
    };
    mockState.payments.push(payment);

    return payment;
  },

  async getPlans(): Promise<Plan[]> {
    await delay();
    return mockState.plans
      .filter((p) => p.isActive)
      .map((p) => ({
        ...p,
        memberCount: countMembersOnPlan(p.id),
      }));
  },

  async updatePlan(id: string, req: UpdatePlanRequest): Promise<Plan> {
    await delay();
    const plan = findPlan(id);
    if (req.price !== undefined) plan.price = req.price;
    if (req.name !== undefined) plan.name = req.name;
    if (req.isActive !== undefined) plan.isActive = req.isActive;
    return { ...plan, memberCount: countMembersOnPlan(plan.id) };
  },

  async createPlan(req: CreatePlanRequest): Promise<Plan> {
    await delay();
    const plan: Plan = {
      id: nextId('plan'),
      gymId: mockState.gym.id,
      durationMonths: req.durationMonths,
      price: req.price,
      name: req.name ?? `${req.durationMonths} Month${req.durationMonths === 1 ? '' : 's'}`,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    mockState.plans.push(plan);
    return { ...plan, memberCount: 0 };
  },

  async getGym(): Promise<Gym> {
    await delay();
    return { ...mockState.gym };
  },

  async updateGym(req: UpdateGymRequest): Promise<Gym> {
    await delay();
    const slug = req.slug !== undefined ? validateSlug(req.slug) : null;
    if (slug && !slug.ok) throw new Error(slug.code);
    Object.assign(mockState.gym, {
      ...req,
      ...(slug?.ok ? { slug: slug.slug } : {}),
    });
    return { ...mockState.gym };
  },

  async getPublicGym(slug: string): Promise<PublicGymResponse> {
    await delay();
    if (mockState.gym.slug !== slug) throw new Error(`Gym not found: ${slug}`);
    const { name, address, timings, contactPhone, upiId, upiDisplayName } = mockState.gym;
    return {
      gym: { name, slug, address, timings, contactPhone, upiId, upiDisplayName },
    };
  },

  async createGym(req: CreateGymRequest): Promise<Gym> {
    await delay();
    const slug = validateSlug(req.slug);
    if (!slug.ok) throw new Error(slug.code);
    Object.assign(mockState.gym, {
      name: req.name,
      slug: slug.slug,
      address: req.address,
      timings: req.timings,
      contactPhone: req.contactPhone,
      upiId: req.upiId,
      upiDisplayName: req.upiId,
    });
    // Replace plans with the ones from setup.
    mockState.plans.length = 0;
    for (const p of req.plans) {
      mockState.plans.push({
        id: nextId('plan'),
        gymId: mockState.gym.id,
        durationMonths: p.durationMonths,
        price: p.price,
        name: `${p.durationMonths} Month${p.durationMonths === 1 ? '' : 's'}`,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
    }
    return { ...mockState.gym };
  },

  async checkSlug(slug: string): Promise<SlugCheckResponse> {
    await delay();
    const result = validateSlug(slug);
    if (!result.ok) return { slug: result.slug, available: false, code: result.code };
    const available = mockState.gym.slug !== result.slug;
    return {
      slug: result.slug,
      available,
      ...(available ? {} : { code: 'SLUG_UNAVAILABLE' as const }),
    };
  },

  // ---- access / team / invites (mock stubs — single owner is admin) ----
  async getMyAccess(): Promise<MeAccessResponse> {
    await delay();
    return {
      owner: { ...mockState.owner },
      gyms: [{ gym: { ...mockState.gym }, role: 'admin' }],
      invites: [],
    };
  },

  async listMyAccessRequests(): Promise<AccessRequestSummary[]> {
    await delay();
    return [];
  },

  async createAccessRequest(req: CreateAccessRequestRequest): Promise<AccessRequestSummary> {
    await delay();
    return {
      id: nextId('accreq'),
      gymName: req.gymName,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  },

  async acceptInvite(_req: AcceptInviteRequest): Promise<AcceptInviteResponse> {
    void _req;
    await delay();
    return { gym: { ...mockState.gym }, role: 'admin' };
  },

  async getTeam(): Promise<TeamResponse> {
    await delay();
    const self: TeamMember = {
      id: 'gymuser-self',
      ownerId: mockState.owner.id,
      name: mockState.owner.name,
      email: mockState.owner.email,
      role: 'admin',
      status: 'active',
      createdAt: mockState.owner.createdAt,
    };
    return { members: [self], invites: [] };
  },

  async createInvite(req: CreateInviteRequest): Promise<CreateInviteResponse> {
    await delay();
    return {
      id: nextId('invite'),
      email: req.email,
      role: req.role,
      token: nextId('tok'),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    };
  },

  async revokeInvite(_id: string): Promise<void> {
    void _id;
    await delay();
  },

  async updateTeamMember(id: string, req: UpdateTeamMemberRequest): Promise<{
    id: string;
    role: GymRole;
    status: 'active' | 'disabled';
  }> {
    await delay();
    return { id, role: req.role ?? 'admin', status: req.status ?? 'active' };
  },

  async removeTeamMember(_id: string): Promise<void> {
    void _id;
    await delay();
  },

  async adminListAccessRequests(): Promise<AdminAccessRequest[]> {
    await delay();
    return [];
  },

  async adminReviewAccessRequest(id: string, status: 'approved' | 'rejected' | 'duplicate') {
    await delay();
    return { id, status };
  },

  async adminListGyms(): Promise<AdminGymSummary[]> {
    await delay();
    return [
      {
        id: mockState.gym.id,
        name: mockState.gym.name,
        slug: mockState.gym.slug,
        status: 'active',
        createdByName: mockState.owner.name,
        createdByEmail: mockState.owner.email,
        memberCount: 1,
        createdAt: mockState.gym.createdAt,
      },
    ];
  },
};

function countMembersOnPlan(planId: string): number {
  const today = iso(TODAY);
  const memberIds = new Set(
    mockState.memberships
      .filter((m) => m.planId === planId && m.startDate <= today && today < m.endDate)
      .map((m) => m.memberId),
  );
  return memberIds.size;
}

// Re-export for diagnostics / future direct access
export { mockState };
