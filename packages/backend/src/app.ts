import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import type { Gym as DbGym, Membership as DbMembership } from '@prisma/client';
import type {
  AccessResponse,
  AcceptInviteResponse,
  CreateInviteResponse,
  MemberDetailResponse,
  MemberListItem,
  MembersListResponse,
  PendingInvite,
  PublicGymResponse,
  SlugCheckResponse,
  TeamResponse,
} from '@gym-app/shared/types';
import { prisma } from './db.js';
import { addMonths, iso, parseDate, todayLocal } from './lib/dates.js';
import { newId } from './lib/ids.js';
import { computeStatus } from './lib/status.js';
import {
  clerkAuth,
  getAuthenticatedOwner,
  getOwnerGym,
  requireGymRole,
  requirePlatformAdmin,
} from './lib/auth.js';
import { isPlatformAdmin } from './lib/platform-admin.js';
import { checkAccessChange, type GymUserSummary } from './lib/gym-access.js';
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiry,
} from './lib/invite-tokens.js';
import { planMembershipAction } from './lib/payment-policy.js';
import { paymentAdjustmentType } from './lib/payment-adjustment.js';
import { toErrorResponse } from './lib/http-errors.js';
import { validateSlug } from './lib/slug.js';
import { corsOrigin } from './lib/cors.js';
import {
  toGym,
  toMember,
  toMembership,
  toPayment,
  toPlan,
} from './lib/serialize.js';

function membershipContext(memberships: DbMembership[], today: string) {
  const nonCancelled = memberships.filter((m) => m.status !== 'cancelled');
  const active = nonCancelled.find(
    (m) => m.startDate <= today && today < m.endDate && m.status === 'active',
  );
  const scheduled = nonCancelled.find((m) => m.startDate > today);
  const past = nonCancelled.filter((m) => m.endDate <= today);
  const current = active ?? scheduled ?? past[past.length - 1] ?? null;
  const queued = nonCancelled.filter((m) => m.startDate > today && m.id !== current?.id);
  const scheduledUnpaid = nonCancelled.find(
    (m) => m.startDate > today && m.amountPaid === 0 && m.amountDue > 0,
  );
  return { current, queued, scheduledUnpaid };
}

async function buildListItem(memberId: string, gracePeriodDays: number): Promise<MemberListItem> {
  const today = iso(todayLocal());
  const member = (await prisma.member.findUnique({ where: { id: memberId } }))!;
  const memberships = await prisma.membership.findMany({
    where: { memberId, NOT: { status: 'cancelled' } },
    orderBy: { startDate: 'asc' },
  });
  const { current, queued } = membershipContext(memberships, today);
  const plan = current ? await prisma.plan.findUnique({ where: { id: current.planId } }) : null;
  const s = computeStatus(
    current ? toMembership(current) : null,
    queued.map(toMembership),
    gracePeriodDays,
    plan?.price ?? null,
  );
  return {
    member: toMember(member),
    currentMembership: current ? toMembership(current) : null,
    plan: plan ? toPlan(plan) : null,
    status: s.status,
    daysOverdue: s.daysOverdue,
    daysRemaining: s.daysRemaining,
    amountDue: s.amountDue,
  };
}

function sortListItems(items: MemberListItem[]): MemberListItem[] {
  const rank: Record<string, number> = {
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
    return a.member.name.localeCompare(b.member.name);
  });
}

async function plansWithCount(gymId: string) {
  const today = iso(todayLocal());
  const plans = await prisma.plan.findMany({ where: { gymId, isActive: true } });
  const result = [];
  for (const p of plans) {
    const memberships = await prisma.membership.findMany({
      where: { planId: p.id, startDate: { lte: today }, endDate: { gt: today } },
      select: { memberId: true },
    });
    const memberCount = new Set(memberships.map((m) => m.memberId)).size;
    result.push({ ...toPlan(p), memberCount });
  }
  return result;
}

function clientError(message: string, statusCode: number, code: string) {
  return Object.assign(new Error(message), { statusCode, code });
}

function requireValidGymSlug(value: string): string {
  const result = validateSlug(value);
  if (!result.ok) {
    throw clientError('Invalid public URL slug.', 400, result.code);
  }
  return result.slug;
}

function isSlugUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const error = err as { code?: string; meta?: { target?: unknown } };
  if (error.code !== 'P2002') return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes('slug') : target === 'slug';
}

function toSlugUnavailableError() {
  return clientError('Public URL is already taken.', 409, 'SLUG_UNAVAILABLE');
}

const nonEmptyText = z.string().trim().min(1);
const isoDateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => iso(parseDate(value)) === value);
const memberSessionSchema = z.enum(['morning', 'evening', 'flexible']);

async function assertSlugAvailable(slug: string, currentGymId?: string) {
  const existing = await prisma.gym.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing && existing.id !== currentGymId) {
    throw toSlugUnavailableError();
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: corsOrigin });

  app.setErrorHandler((err, req, reply) => {
    const response = toErrorResponse(err);
    if (response.shouldLog) {
      req.log.error({ err }, response.body.code ?? 'request failed');
    }
    reply.code(response.status).send(response.body);
  });

  // Public endpoints (no Clerk auth required).
  const PUBLIC_PREFIXES = ['/health', '/public/'];
  app.addHook('preHandler', async (req) => {
    const path = req.url.split('?')[0] ?? '';
    if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))) return;
    await clerkAuth(req);
  });

  app.get('/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  });

  // ---- members ----
  app.get('/members', async (req): Promise<MembersListResponse> => {
    const { gym } = await getOwnerGym(req);
    const members = await prisma.member.findMany({ where: { gymId: gym.id, isActive: true } });
    const items = await Promise.all(members.map((m) => buildListItem(m.id, gym.gracePeriodDays)));
    const sorted = sortListItems(items);
    return {
      members: sorted,
      counts: {
        all: sorted.length,
        overdue: sorted.filter((i) => i.status === 'overdue' || i.status === 'payment_pending').length,
        expiring: sorted.filter((i) => i.status === 'expiring').length,
        scheduled: sorted.filter((i) => i.status === 'scheduled').length,
        active: sorted.filter((i) => i.status === 'active').length,
      },
      sessionCounts: {
        all: sorted.length,
        morning: sorted.filter((i) => i.member.preferredSession === 'morning').length,
        evening: sorted.filter((i) => i.member.preferredSession === 'evening').length,
        flexible: sorted.filter((i) => i.member.preferredSession === 'flexible').length,
      },
    };
  });

  app.get<{ Params: { id: string } }>('/members/:id', async (req): Promise<MemberDetailResponse> => {
    const { gym } = await getOwnerGym(req);
    const today = iso(todayLocal());
    const member = await prisma.member.findFirst({
      where: { id: req.params.id, gymId: gym.id },
    });
    if (!member) throw Object.assign(new Error('Member not found'), { statusCode: 404 });

    const memberships = await prisma.membership.findMany({
      where: { memberId: member.id },
      orderBy: { startDate: 'asc' },
    });
    const { current, queued } = membershipContext(memberships, today);
    const plan = current ? await prisma.plan.findUnique({ where: { id: current.planId } }) : null;
    const s = computeStatus(
      current ? toMembership(current) : null,
      queued.map(toMembership),
      gym.gracePeriodDays,
      plan?.price ?? null,
    );

    const ids = memberships.map((m) => m.id);
    const payments = await prisma.payment.findMany({
      where: { membershipId: { in: ids } },
      orderBy: { paidOn: 'desc' },
    });
    const planById = new Map(
      (await prisma.plan.findMany({ where: { gymId: gym.id } })).map((p) => [p.id, p]),
    );
    const msById = new Map(memberships.map((m) => [m.id, m]));
    const paymentHistory = payments.map((p) => {
      const ms = msById.get(p.membershipId);
      const planForPay = ms ? planById.get(ms.planId) : null;
      return { ...toPayment(p), planName: planForPay?.name ?? '' };
    });

    return {
      member: toMember(member),
      currentMembership: current ? toMembership(current) : null,
      queuedMemberships: queued.map((m) => ({
        ...toMembership(m),
        planName: planById.get(m.planId)?.name ?? '',
      })),
      plan: plan ? toPlan(plan) : null,
      status: s.status,
      daysOverdue: s.daysOverdue,
      daysRemaining: s.daysRemaining,
      amountDue: s.amountDue,
      paymentHistory,
    };
  });

  const createMemberSchema = z.object({
    name: nonEmptyText,
    phone: nonEmptyText,
    planId: z.string(),
    startDate: isoDateString,
    preferredSession: memberSessionSchema.default('flexible'),
  });

  app.post('/members', async (req) => {
    const body = createMemberSchema.parse(req.body);
    const { gym } = await getOwnerGym(req);
    const plan = await prisma.plan.findFirst({
      where: { id: body.planId, gymId: gym.id, isActive: true },
    });
    if (!plan) throw Object.assign(new Error('Plan not found'), { statusCode: 404 });

    const member = await prisma.member.create({
      data: {
        id: newId('member'),
        gymId: gym.id,
        name: body.name,
        phone: body.phone,
        joinDate: body.startDate,
        preferredSession: body.preferredSession,
        isActive: true,
      },
    });
    const start = parseDate(body.startDate);
    const end = addMonths(start, plan.durationMonths);
    await prisma.membership.create({
      data: {
        id: newId('membership'),
        memberId: member.id,
        planId: plan.id,
        startDate: iso(start),
        endDate: iso(end),
        amountDue: plan.price,
        amountPaid: 0,
        status: 'active',
      },
    });
    return toMember(member);
  });

  const updateMemberSchema = z.object({
    name: nonEmptyText.optional(),
    phone: nonEmptyText.optional(),
    preferredSession: memberSessionSchema.optional(),
  });

  app.patch<{ Params: { id: string } }>('/members/:id', async (req) => {
    const body = updateMemberSchema.parse(req.body);
    const { gym } = await getOwnerGym(req);
    const existing = await prisma.member.findFirst({
      where: { id: req.params.id, gymId: gym.id },
    });
    if (!existing) throw Object.assign(new Error('Member not found'), { statusCode: 404 });
    const updated = await prisma.member.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.preferredSession !== undefined ? { preferredSession: body.preferredSession } : {}),
      },
    });
    return toMember(updated);
  });

  app.delete<{ Params: { id: string } }>('/members/:id', async (req) => {
    const { gym } = await getOwnerGym(req);
    const existing = await prisma.member.findFirst({
      where: { id: req.params.id, gymId: gym.id },
    });
    if (!existing) throw Object.assign(new Error('Member not found'), { statusCode: 404 });
    await prisma.member.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    return { ok: true };
  });

  const recordPaymentSchema = z.object({
    memberId: z.string(),
    planId: z.string(),
    amount: z.number().int().nonnegative(),
    method: z.enum(['cash', 'upi', 'other']),
    paidOn: isoDateString,
    referenceNote: z.string().trim().max(240).optional(),
  });

  app.post('/payments', async (req) => {
    const body = recordPaymentSchema.parse(req.body);
    const { owner, gym } = await getOwnerGym(req);
    const today = iso(todayLocal());
    if (body.paidOn > today) {
      throw Object.assign(new Error('Payment date cannot be in the future'), { statusCode: 400 });
    }
    const plan = await prisma.plan.findFirst({ where: { id: body.planId, gymId: gym.id } });
    if (!plan) throw Object.assign(new Error('Plan not found'), { statusCode: 404 });
    const member = await prisma.member.findFirst({
      where: { id: body.memberId, gymId: gym.id },
    });
    if (!member) throw Object.assign(new Error('Member not found'), { statusCode: 404 });

    const memberships = await prisma.membership.findMany({
      where: { memberId: member.id },
      orderBy: { startDate: 'asc' },
    });
    const activeNow = memberships.find(
      (m) => m.startDate <= today && today < m.endDate && m.status === 'active',
    );
    const scheduledUnpaid = memberships.find(
      (m) => m.startDate > today && m.status !== 'cancelled' && m.amountPaid === 0 && m.amountDue > 0,
    );
    // Issue #5: queue renewals after the LATEST non-cancelled end (which may
    // be a queued membership beyond activeNow.endDate), not after activeNow.
    // Otherwise multiple advance renewals would overlap each other.
    const latestNonCancelledEnd =
      memberships
        .filter((m) => m.status !== 'cancelled')
        .reduce<string | null>(
          (max, m) => (max === null || m.endDate > max ? m.endDate : max),
          null,
        );

    const action = planMembershipAction({
      activeNow: activeNow
        ? {
            id: activeNow.id,
            startDate: activeNow.startDate,
            amountPaid: activeNow.amountPaid,
          }
        : null,
      scheduledUnpaid: scheduledUnpaid
        ? {
            id: scheduledUnpaid.id,
            startDate: scheduledUnpaid.startDate,
          }
        : null,
      latestNonCancelledEnd,
      plan: { id: plan.id, durationMonths: plan.durationMonths, price: plan.price },
      amount: body.amount,
      paidOn: body.paidOn,
    });

    let membershipId: string;
    if (action.kind === 'updateUnpaid') {
      await prisma.membership.update({
        where: { id: action.membershipId },
        data: action.data,
      });
      membershipId = action.membershipId;
    } else {
      // Both queueRenewal and createFresh insert a new Membership row;
      // they only differ in startDate, which the policy already computed.
      const created = await prisma.membership.create({
        data: {
          id: newId('membership'),
          memberId: member.id,
          status: 'active',
          ...action.data,
        },
      });
      membershipId = created.id;
    }

    const payment = await prisma.payment.create({
      data: {
        id: newId('payment'),
        membershipId,
        amount: body.amount,
        method: body.method,
        paidOn: body.paidOn,
        adjustmentType: paymentAdjustmentType(body.amount, plan.price),
        referenceNote: body.referenceNote ?? '',
        recordedBy: owner.id,
        recordedByName: owner.name,
      },
    });
    return toPayment(payment);
  });

  // ---- plans ----
  app.get('/plans', async (req) => {
    const { gym } = await getOwnerGym(req);
    return plansWithCount(gym.id);
  });

  const createPlanSchema = z.object({
    durationMonths: z.number().int().positive(),
    price: z.number().int().nonnegative(),
    name: z.string().optional(),
  });

  app.post('/plans', { preHandler: requireGymRole('admin') }, async (req) => {
    const body = createPlanSchema.parse(req.body);
    const { gym } = await getOwnerGym(req);
    const plan = await prisma.plan.create({
      data: {
        id: newId('plan'),
        gymId: gym.id,
        durationMonths: body.durationMonths,
        price: body.price,
        name: body.name ?? `${body.durationMonths} Month${body.durationMonths === 1 ? '' : 's'}`,
        isActive: true,
      },
    });
    return { ...toPlan(plan), memberCount: 0 };
  });

  const updatePlanSchema = z.object({
    price: z.number().int().nonnegative().optional(),
    name: z.string().optional(),
    isActive: z.boolean().optional(),
  });

  app.patch<{ Params: { id: string } }>('/plans/:id', { preHandler: requireGymRole('admin') }, async (req) => {
    const body = updatePlanSchema.parse(req.body);
    const { gym } = await getOwnerGym(req);
    const existing = await prisma.plan.findFirst({
      where: { id: req.params.id, gymId: gym.id },
    });
    if (!existing) throw Object.assign(new Error('Plan not found'), { statusCode: 404 });
    const updated = await prisma.plan.update({ where: { id: existing.id }, data: body });
    const today = iso(todayLocal());
    const ms = await prisma.membership.findMany({
      where: { planId: updated.id, startDate: { lte: today }, endDate: { gt: today } },
      select: { memberId: true },
    });
    return { ...toPlan(updated), memberCount: new Set(ms.map((m) => m.memberId)).size };
  });

  // ---- gym ----
  app.get('/gym', async (req) => {
    const { gym } = await getOwnerGym(req);
    return toGym(gym);
  });

  const updateGymSchema = z.object({
    name: z.string().optional(),
    slug: z.string().optional(),
    address: z.string().optional(),
    timings: z.string().optional(),
    contactPhone: z.string().optional(),
    upiId: z.string().optional(),
    upiDisplayName: z.string().optional(),
    gracePeriodDays: z.number().int().nonnegative().optional(),
  });

  app.patch('/gym', { preHandler: requireGymRole('admin') }, async (req) => {
    const body = updateGymSchema.parse(req.body);
    const { gym } = await getOwnerGym(req);
    const data = { ...body };
    if (data.slug !== undefined) {
      data.slug = requireValidGymSlug(data.slug);
      await assertSlugAvailable(data.slug, gym.id);
    }

    let updated: DbGym;
    try {
      updated = await prisma.gym.update({ where: { id: gym.id }, data });
    } catch (err) {
      if (isSlugUniqueViolation(err)) throw toSlugUnavailableError();
      throw err;
    }
    return toGym(updated);
  });

  const createGymSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    address: z.string(),
    timings: z.string(),
    contactPhone: z.string(),
    upiId: z.string(),
    plans: z.array(z.object({ durationMonths: z.number().int().positive(), price: z.number().int().nonnegative() })),
  });

  // Issue #16: gym creation is platform-admin only. The platform admin
  // becomes the gym's first admin via GymUser; they typically invite the
  // real owner from the Team page after creation. The legacy Gym.ownerId
  // column is retained for migration compatibility — it points at the
  // platform admin who created the gym, not the operating owner.
  app.post('/gyms', { preHandler: requirePlatformAdmin }, async (req) => {
    const body = createGymSchema.parse(req.body);
    const slug = requireValidGymSlug(body.slug);
    const owner = await getAuthenticatedOwner(req);

    // Disallow creating a second gym for the same platform admin while we
    // only support one active gym per user. Lift this once the multi-gym
    // switcher lands.
    const alreadyMember = await prisma.gymUser.findFirst({
      where: { ownerId: owner.id, status: 'active' },
    });
    if (alreadyMember) {
      throw Object.assign(
        new Error('You already have an active gym. Disable that membership before creating another.'),
        { statusCode: 409, code: 'ALREADY_HAS_GYM' },
      );
    }

    await assertSlugAvailable(slug);

    let created: DbGym;
    try {
      created = await prisma.$transaction(async (tx) => {
        const gym = await tx.gym.create({
          data: {
            id: newId('gym'),
            ownerId: owner.id,
            name: body.name,
            slug,
            address: body.address,
            timings: body.timings,
            contactPhone: body.contactPhone,
            upiId: body.upiId,
            upiDisplayName: body.upiId,
            gracePeriodDays: 3,
          },
        });

        for (const p of body.plans) {
          await tx.plan.create({
            data: {
              id: newId('plan'),
              gymId: gym.id,
              durationMonths: p.durationMonths,
              price: p.price,
              name: `${p.durationMonths} Month${p.durationMonths === 1 ? '' : 's'}`,
              isActive: true,
            },
          });
        }

        await tx.gymUser.create({
          data: {
            id: newId('gymuser'),
            gymId: gym.id,
            ownerId: owner.id,
            role: 'admin',
            status: 'active',
          },
        });

        return gym;
      });
    } catch (err) {
      if (isSlugUniqueViolation(err)) throw toSlugUnavailableError();
      throw err;
    }

    return toGym(created);
  });

  // ---- gym access (issue #16) ----

  // Returns the caller's current access state. Used by the frontend to pick
  // the landing route: app, no-access screen, or platform-admin gym creation.
  app.get('/me/access', async (req): Promise<AccessResponse> => {
    const owner = await getAuthenticatedOwner(req);
    const membership = await prisma.gymUser.findFirst({
      where: { ownerId: owner.id, status: 'active' },
      include: { gym: true },
    });
    return {
      gym: membership
        ? { id: membership.gym.id, name: membership.gym.name, slug: membership.gym.slug }
        : null,
      role: membership ? (membership.role as 'admin' | 'staff') : null,
      isPlatformAdmin: isPlatformAdmin(owner.email),
    };
  });

  async function loadTeam(gymId: string): Promise<TeamResponse> {
    const [members, invites] = await Promise.all([
      prisma.gymUser.findMany({
        where: { gymId },
        include: { owner: true },
        orderBy: { joinedAt: 'asc' },
      }),
      prisma.gymInvite.findMany({
        where: { gymId, status: 'pending' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      members: members.map((m) => ({
        ownerId: m.ownerId,
        email: m.owner.email,
        name: m.owner.name,
        role: m.role as 'admin' | 'staff',
        status: m.status as 'active' | 'disabled',
        joinedAt: m.joinedAt.toISOString(),
      })),
      invites: invites.map(toPendingInvite),
    };
  }

  function toPendingInvite(row: {
    id: string;
    email: string;
    role: string;
    status: string;
    expiresAt: Date;
    createdAt: Date;
  }): PendingInvite {
    return {
      id: row.id,
      email: row.email,
      role: row.role as 'admin' | 'staff',
      status: row.status as 'pending' | 'accepted' | 'revoked' | 'expired',
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }

  app.get<{ Params: { gymId: string } }>(
    '/gyms/:gymId/team',
    { preHandler: requireGymRole('admin') },
    async (req): Promise<TeamResponse> => {
      const { gym } = await getOwnerGym(req);
      if (gym.id !== req.params.gymId) {
        throw Object.assign(new Error('Gym not found'), { statusCode: 404 });
      }
      return loadTeam(gym.id);
    },
  );

  const updateTeamMemberSchema = z.object({
    role: z.enum(['admin', 'staff']).optional(),
    status: z.enum(['active', 'disabled']).optional(),
  });

  app.patch<{ Params: { gymId: string; ownerId: string } }>(
    '/gyms/:gymId/team/:ownerId',
    { preHandler: requireGymRole('admin') },
    async (req) => {
      const body = updateTeamMemberSchema.parse(req.body);
      if (body.role === undefined && body.status === undefined) {
        throw Object.assign(new Error('Nothing to update'), { statusCode: 400 });
      }
      const { gym } = await getOwnerGym(req);
      if (gym.id !== req.params.gymId) {
        throw Object.assign(new Error('Gym not found'), { statusCode: 404 });
      }

      const all = await prisma.gymUser.findMany({ where: { gymId: gym.id } });
      const summaries: GymUserSummary[] = all.map((m) => ({
        ownerId: m.ownerId,
        role: m.role as 'admin' | 'staff',
        status: m.status as 'active' | 'disabled',
      }));

      if (body.role !== undefined) {
        const check = checkAccessChange(summaries, {
          kind: 'changeRole',
          targetOwnerId: req.params.ownerId,
          newRole: body.role,
        });
        if (!check.ok) {
          throw Object.assign(new Error(check.code), {
            statusCode: check.code === 'NOT_FOUND' ? 404 : 409,
            code: check.code,
          });
        }
      }
      if (body.status === 'disabled') {
        const check = checkAccessChange(summaries, {
          kind: 'disable',
          targetOwnerId: req.params.ownerId,
        });
        if (!check.ok) {
          throw Object.assign(new Error(check.code), {
            statusCode: check.code === 'NOT_FOUND' ? 404 : 409,
            code: check.code,
          });
        }
      }

      await prisma.gymUser.update({
        where: {
          gymId_ownerId: { gymId: gym.id, ownerId: req.params.ownerId },
        },
        data: {
          ...(body.role !== undefined ? { role: body.role } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        },
      });
      return loadTeam(gym.id);
    },
  );

  const createInviteSchema = z.object({
    email: z.string().email(),
    role: z.enum(['admin', 'staff']),
  });

  app.post<{ Params: { gymId: string } }>(
    '/gyms/:gymId/invites',
    { preHandler: requireGymRole('admin') },
    async (req): Promise<CreateInviteResponse> => {
      const body = createInviteSchema.parse(req.body);
      const { gym, owner } = await getOwnerGym(req);
      if (gym.id !== req.params.gymId) {
        throw Object.assign(new Error('Gym not found'), { statusCode: 404 });
      }
      const email = body.email.trim().toLowerCase();

      // If the email already maps to an active member of this gym, reject.
      const existingMember = await prisma.owner.findUnique({ where: { email } });
      if (existingMember) {
        const active = await prisma.gymUser.findFirst({
          where: { gymId: gym.id, ownerId: existingMember.id, status: 'active' },
        });
        if (active) {
          throw Object.assign(new Error('User already has access'), {
            statusCode: 409,
            code: 'ALREADY_MEMBER',
          });
        }
      }

      // One outstanding pending invite per email per gym keeps things simple.
      // Re-inviting revokes the old one.
      await prisma.gymInvite.updateMany({
        where: { gymId: gym.id, email, status: 'pending' },
        data: { status: 'revoked' },
      });

      const { raw, hash } = generateInviteToken();
      const created = await prisma.gymInvite.create({
        data: {
          id: newId('invite'),
          gymId: gym.id,
          email,
          role: body.role,
          tokenHash: hash,
          invitedById: owner.id,
          expiresAt: inviteExpiry(),
        },
      });
      return { invite: toPendingInvite(created), rawToken: raw };
    },
  );

  app.delete<{ Params: { gymId: string; inviteId: string } }>(
    '/gyms/:gymId/invites/:inviteId',
    { preHandler: requireGymRole('admin') },
    async (req) => {
      const { gym } = await getOwnerGym(req);
      if (gym.id !== req.params.gymId) {
        throw Object.assign(new Error('Gym not found'), { statusCode: 404 });
      }
      // Conditional update: only revoke if still pending. No-ops for already
      // accepted/revoked rows are silent — admin already got the outcome.
      await prisma.gymInvite.updateMany({
        where: { id: req.params.inviteId, gymId: gym.id, status: 'pending' },
        data: { status: 'revoked' },
      });
      return { ok: true };
    },
  );

  const acceptInviteSchema = z.object({ token: z.string().min(1) });

  app.post('/invites/accept', async (req): Promise<AcceptInviteResponse> => {
    const body = acceptInviteSchema.parse(req.body);
    const owner = await getAuthenticatedOwner(req);
    const tokenHash = hashInviteToken(body.token);

    const invite = await prisma.gymInvite.findUnique({
      where: { tokenHash },
      include: { gym: true },
    });
    if (!invite) {
      throw Object.assign(new Error('Invite not found'), {
        statusCode: 404,
        code: 'INVITE_NOT_FOUND',
      });
    }
    if (invite.status !== 'pending') {
      throw Object.assign(new Error('Invite is no longer valid'), {
        statusCode: 409,
        code: 'INVITE_NOT_PENDING',
      });
    }
    if (invite.expiresAt < new Date()) {
      // Mark it expired so the next list call drops it from the UI.
      await prisma.gymInvite.updateMany({
        where: { id: invite.id, status: 'pending' },
        data: { status: 'expired' },
      });
      throw Object.assign(new Error('Invite has expired'), {
        statusCode: 410,
        code: 'INVITE_EXPIRED',
      });
    }
    if (owner.email.trim().toLowerCase() !== invite.email.toLowerCase()) {
      throw Object.assign(new Error('Invite was issued to a different email'), {
        statusCode: 403,
        code: 'INVITE_EMAIL_MISMATCH',
      });
    }

    // Atomic single-use accept: claim the invite first. updateMany returns
    // count=0 if a concurrent request already accepted/revoked it.
    const claim = await prisma.gymInvite.updateMany({
      where: { id: invite.id, status: 'pending' },
      data: {
        status: 'accepted',
        acceptedById: owner.id,
        acceptedAt: new Date(),
      },
    });
    if (claim.count === 0) {
      throw Object.assign(new Error('Invite is no longer valid'), {
        statusCode: 409,
        code: 'INVITE_NOT_PENDING',
      });
    }

    // upsert in case the user was previously a disabled member of the same
    // gym — re-accepting reactivates with the new role.
    await prisma.gymUser.upsert({
      where: {
        gymId_ownerId: { gymId: invite.gymId, ownerId: owner.id },
      },
      create: {
        id: newId('gymuser'),
        gymId: invite.gymId,
        ownerId: owner.id,
        role: invite.role,
        status: 'active',
        joinedAt: new Date(),
      },
      update: {
        role: invite.role,
        status: 'active',
        joinedAt: new Date(),
      },
    });

    return {
      gym: { id: invite.gym.id, name: invite.gym.name, slug: invite.gym.slug },
      role: invite.role as 'admin' | 'staff',
    };
  });

  // ---- public gym page (no auth) ----
  app.get('/public/slugs/check', async (req): Promise<SlugCheckResponse> => {
    const query = z.object({ slug: z.string().optional().default('') }).parse(req.query);
    const result = validateSlug(query.slug);
    if (!result.ok) {
      return { slug: result.slug, available: false, code: result.code };
    }

    const existing = await prisma.gym.findUnique({
      where: { slug: result.slug },
      select: { id: true },
    });
    return existing
      ? { slug: result.slug, available: false, code: 'SLUG_UNAVAILABLE' }
      : { slug: result.slug, available: true };
  });

  app.get<{ Params: { slug: string } }>('/public/gyms/:slug', async (req): Promise<PublicGymResponse> => {
    const gym = await prisma.gym.findUnique({ where: { slug: req.params.slug } });
    if (!gym) throw Object.assign(new Error('Gym not found'), { statusCode: 404 });
    return {
      gym: {
        name: gym.name,
        slug: gym.slug,
        address: gym.address,
        timings: gym.timings,
        contactPhone: gym.contactPhone,
        upiId: gym.upiId,
        upiDisplayName: gym.upiDisplayName,
      },
    };
  });

  return app;
}
