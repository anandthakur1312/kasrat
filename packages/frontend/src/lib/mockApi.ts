import type {
  CreateGymRequest,
  CreateMemberRequest,
  CreatePlanRequest,
  Gym,
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
  UpdateGymRequest,
  UpdatePlanRequest,
} from '@gym-app/shared/types';
import { dateHelpers, mockState, nextId } from './mockData';

const { TODAY, iso, addDays, addMonths } = dateHelpers;

const EXPIRING_THRESHOLD_DAYS = 7;

const delay = (ms = 100) => new Promise((r) => setTimeout(r, ms));

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
  // otherwise the most recent expired/cancelled
  const past = ms.filter((m) => m.endDate <= today);
  return past[past.length - 1] ?? null;
}

function queuedMembershipsFor(memberId: string): Membership[] {
  const today = iso(TODAY);
  return membershipsForMember(memberId).filter(
    (m) => m.startDate > today && m.status !== 'cancelled',
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
  // overdue (most overdue first) → payment_pending → expiring (least time first) → active (alphabetical)
  const rank: Record<MemberStatus, number> = {
    overdue: 0,
    payment_pending: 1,
    expiring: 2,
    active: 3,
  };
  return [...items].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.status === 'overdue') return (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0);
    if (a.status === 'expiring') return (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0);
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
      active: sorted.filter((i) => i.status === 'active').length,
    };
    return { members: sorted, counts };
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
    const member: Member = {
      id: nextId('member'),
      gymId: mockState.gym.id,
      name: req.name,
      phone: req.phone,
      joinDate: req.startDate,
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

    // Find member's existing memberships
    const existing = membershipsForMember(member.id);
    const activeNow = existing.find(
      (m) => m.startDate <= today && today < m.endDate && m.status === 'active',
    );

    let membership: Membership;

    // If member has an unpaid active membership, attach payment to it.
    if (activeNow && activeNow.amountPaid === 0) {
      activeNow.amountPaid = req.amount;
      membership = activeNow;
    } else if (activeNow) {
      // Active membership is paid; queue a new one starting day after current ends.
      const start = addDays(parseDate(activeNow.endDate), 1);
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
      referenceNote: req.method === 'upi' ? `GYM-MEM-${member.id}` : '',
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
    Object.assign(mockState.gym, req);
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
    Object.assign(mockState.gym, {
      name: req.name,
      slug: req.slug,
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
