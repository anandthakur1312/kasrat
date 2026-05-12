import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import type { Gym as DbGym, Membership as DbMembership } from '@prisma/client';
import type {
  MeAccessResponse,
  MemberDetailResponse,
  MemberListItem,
  MembersListResponse,
  PublicGymResponse,
  SlugCheckResponse,
} from '@gym-app/shared/types';
import { prisma } from './db.js';
import { addMonths, iso, parseDate, todayLocal } from './lib/dates.js';
import { newId } from './lib/ids.js';
import { computeStatus } from './lib/status.js';
import {
  clerkAuth,
  getAuthenticatedOwner,
  getGymAccess,
  requireGymRole,
  requirePlatformAdmin,
} from './lib/auth.js';
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
const roleSchema = z.enum(['admin', 'staff']);

function normalizeGymName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function newInviteToken(): { raw: string; hash: string } {
  const raw = randomBytes(24).toString('base64url');
  return { raw, hash: sha256Hex(raw) };
}

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

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

  // ---- /me/access ----
  // Reports the caller's available gyms and pending invites. The frontend
  // uses this on app boot to decide between members list, invite-accept,
  // no-access page, and platform-admin landing.
  app.get('/me/access', async (req): Promise<MeAccessResponse> => {
    const owner = await getAuthenticatedOwner(req);
    const memberships = await prisma.gymUser.findMany({
      where: { ownerId: owner.id, status: 'active' },
      include: { gym: true },
    });
    const invites = await prisma.gymInvite.findMany({
      where: {
        email: owner.email,
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      include: { gym: true },
    });
    return {
      owner: {
        id: owner.id,
        clerkUserId: owner.clerkUserId,
        name: owner.name,
        email: owner.email,
        phone: owner.phone,
        isPlatformAdmin: owner.isPlatformAdmin,
        createdAt:
          owner.createdAt instanceof Date ? owner.createdAt.toISOString() : owner.createdAt,
      },
      gyms: memberships.map((m) => ({
        gym: toGym(m.gym),
        role: m.role as 'admin' | 'staff',
      })),
      invites: invites.map((inv) => ({
        id: inv.id,
        gymId: inv.gymId,
        gymName: inv.gym.name,
        role: inv.role as 'admin' | 'staff',
        expiresAt: inv.expiresAt.toISOString(),
      })),
    };
  });

  // ---- members ----
  app.get('/members', async (req): Promise<MembersListResponse> => {
    const { gym } = await getGymAccess(req);
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
    const { gym } = await getGymAccess(req);
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

  // Members can be created/edited by admin and staff.
  app.post('/members', async (req) => {
    const body = createMemberSchema.parse(req.body);
    const { gym } = await requireGymRole(req, ['admin', 'staff']);
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
    const { gym } = await requireGymRole(req, ['admin', 'staff']);
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

  // Deleting (archiving) a member is admin-only. Staff can edit but not remove.
  app.delete<{ Params: { id: string } }>('/members/:id', async (req) => {
    const { gym } = await requireGymRole(req, ['admin']);
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
    const { owner, gym } = await requireGymRole(req, ['admin', 'staff']);
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
  // Reading plans is open to anyone with gym access; mutation requires admin.
  app.get('/plans', async (req) => {
    const { gym } = await getGymAccess(req);
    return plansWithCount(gym.id);
  });

  const createPlanSchema = z.object({
    durationMonths: z.number().int().positive(),
    price: z.number().int().nonnegative(),
    name: z.string().optional(),
  });

  app.post('/plans', async (req) => {
    const body = createPlanSchema.parse(req.body);
    const { gym } = await requireGymRole(req, ['admin']);
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

  app.patch<{ Params: { id: string } }>('/plans/:id', async (req) => {
    const body = updatePlanSchema.parse(req.body);
    const { gym } = await requireGymRole(req, ['admin']);
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
    const { gym } = await getGymAccess(req);
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

  // Settings mutations are admin-only.
  app.patch('/gym', async (req) => {
    const body = updateGymSchema.parse(req.body);
    const { gym } = await requireGymRole(req, ['admin']);
    const data = {
      ...body,
      ...(body.name !== undefined ? { normalizedName: normalizeGymName(body.name) } : {}),
    };
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

  // ---- team management (per-gym) ----
  app.get('/team', async (req) => {
    const { gym } = await requireGymRole(req, ['admin']);
    const members = await prisma.gymUser.findMany({
      where: { gymId: gym.id },
      include: { owner: true },
      orderBy: { createdAt: 'asc' },
    });
    const invites = await prisma.gymInvite.findMany({
      where: { gymId: gym.id, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
    return {
      members: members.map((m) => ({
        id: m.id,
        ownerId: m.ownerId,
        name: m.owner.name,
        email: m.owner.email,
        role: m.role as 'admin' | 'staff',
        status: m.status as 'active' | 'disabled',
        createdAt:
          m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
      })),
      invites: invites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role as 'admin' | 'staff',
        expiresAt: inv.expiresAt.toISOString(),
        createdAt:
          inv.createdAt instanceof Date ? inv.createdAt.toISOString() : inv.createdAt,
      })),
    };
  });

  const createInviteSchema = z.object({
    email: z.string().email(),
    role: roleSchema,
  });

  // Admin creates an invite. We return the raw token exactly once so the
  // admin can share the accept link manually — there is no email pipeline yet.
  app.post('/team/invites', async (req) => {
    const body = createInviteSchema.parse(req.body);
    const { gym, owner } = await requireGymRole(req, ['admin']);
    const email = body.email.trim().toLowerCase();

    const existingMember = await prisma.gymUser.findFirst({
      where: { gymId: gym.id, owner: { email } },
    });
    if (existingMember) {
      throw clientError('User already has access to this gym.', 409, 'ALREADY_MEMBER');
    }
    const existingPending = await prisma.gymInvite.findFirst({
      where: { gymId: gym.id, email, status: 'pending' },
    });
    if (existingPending) {
      throw clientError('A pending invite already exists for this email.', 409, 'INVITE_EXISTS');
    }

    const { raw, hash } = newInviteToken();
    const invite = await prisma.gymInvite.create({
      data: {
        id: newId('invite'),
        gymId: gym.id,
        email,
        role: body.role,
        tokenHash: hash,
        invitedById: owner.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    });
    return {
      id: invite.id,
      email: invite.email,
      role: invite.role as 'admin' | 'staff',
      token: raw, // shown ONCE to the admin
      expiresAt: invite.expiresAt.toISOString(),
    };
  });

  app.delete<{ Params: { id: string } }>('/team/invites/:id', async (req) => {
    const { gym } = await requireGymRole(req, ['admin']);
    const invite = await prisma.gymInvite.findFirst({
      where: { id: req.params.id, gymId: gym.id },
    });
    if (!invite) throw Object.assign(new Error('Invite not found'), { statusCode: 404 });
    if (invite.status !== 'pending') {
      throw clientError('Invite is no longer pending.', 409, 'INVITE_NOT_PENDING');
    }
    await prisma.gymInvite.update({
      where: { id: invite.id },
      data: { status: 'revoked' },
    });
    return { ok: true };
  });

  const updateMembershipSchema = z.object({
    role: roleSchema.optional(),
    status: z.enum(['active', 'disabled']).optional(),
  });

  app.patch<{ Params: { id: string } }>('/team/members/:id', async (req) => {
    const body = updateMembershipSchema.parse(req.body);
    const { gym } = await requireGymRole(req, ['admin']);
    const target = await prisma.gymUser.findFirst({
      where: { id: req.params.id, gymId: gym.id },
    });
    if (!target) throw Object.assign(new Error('Member not found'), { statusCode: 404 });

    // Guard against accidentally removing the last active admin.
    if (
      target.role === 'admin' &&
      ((body.role !== undefined && body.role !== 'admin') ||
        (body.status !== undefined && body.status !== 'active'))
    ) {
      const otherActiveAdmins = await prisma.gymUser.count({
        where: {
          gymId: gym.id,
          role: 'admin',
          status: 'active',
          NOT: { id: target.id },
        },
      });
      if (otherActiveAdmins === 0) {
        throw clientError(
          'Cannot remove or demote the last active admin.',
          409,
          'LAST_ADMIN',
        );
      }
    }

    const updated = await prisma.gymUser.update({
      where: { id: target.id },
      data: {
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
      include: { owner: true },
    });
    return {
      id: updated.id,
      ownerId: updated.ownerId,
      name: updated.owner.name,
      email: updated.owner.email,
      role: updated.role as 'admin' | 'staff',
      status: updated.status as 'active' | 'disabled',
    };
  });

  app.delete<{ Params: { id: string } }>('/team/members/:id', async (req) => {
    const { gym } = await requireGymRole(req, ['admin']);
    const target = await prisma.gymUser.findFirst({
      where: { id: req.params.id, gymId: gym.id },
    });
    if (!target) throw Object.assign(new Error('Member not found'), { statusCode: 404 });
    if (target.role === 'admin') {
      const otherActiveAdmins = await prisma.gymUser.count({
        where: {
          gymId: gym.id,
          role: 'admin',
          status: 'active',
          NOT: { id: target.id },
        },
      });
      if (otherActiveAdmins === 0) {
        throw clientError(
          'Cannot remove the last active admin.',
          409,
          'LAST_ADMIN',
        );
      }
    }
    await prisma.gymUser.delete({ where: { id: target.id } });
    return { ok: true };
  });

  // ---- invites: accept (authenticated, not gym-scoped) ----
  const acceptInviteSchema = z.object({
    token: z.string().min(1),
  });

  app.post('/invites/accept', async (req) => {
    const body = acceptInviteSchema.parse(req.body);
    const owner = await getAuthenticatedOwner(req);
    const tokenHash = sha256Hex(body.token.trim());
    const invite = await prisma.gymInvite.findUnique({
      where: { tokenHash },
      include: { gym: true },
    });
    if (!invite) {
      throw clientError('Invite not found or already used.', 404, 'INVITE_NOT_FOUND');
    }
    if (invite.status !== 'pending') {
      throw clientError('Invite is no longer pending.', 409, 'INVITE_NOT_PENDING');
    }
    if (invite.expiresAt <= new Date()) {
      await prisma.gymInvite.update({
        where: { id: invite.id },
        data: { status: 'expired' },
      });
      throw clientError('Invite has expired.', 410, 'INVITE_EXPIRED');
    }
    if (invite.email.toLowerCase() !== owner.email.toLowerCase()) {
      throw clientError(
        'This invite was issued to a different email address.',
        403,
        'INVITE_EMAIL_MISMATCH',
      );
    }

    // Idempotent: if a GymUser already exists for this pair, just reactivate
    // it and mark the invite accepted. Avoids 500s on double-click.
    const existing = await prisma.gymUser.findUnique({
      where: { gymId_ownerId: { gymId: invite.gymId, ownerId: owner.id } },
    });
    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.gymUser.update({
          where: { id: existing.id },
          data: { status: 'active', role: invite.role },
        });
      } else {
        await tx.gymUser.create({
          data: {
            id: newId('gymuser'),
            gymId: invite.gymId,
            ownerId: owner.id,
            role: invite.role,
            status: 'active',
            joinedAt: new Date(),
          },
        });
      }
      await tx.gymInvite.update({
        where: { id: invite.id },
        data: {
          status: 'accepted',
          acceptedById: owner.id,
          acceptedAt: new Date(),
        },
      });
    });

    return {
      gym: toGym(invite.gym),
      role: invite.role as 'admin' | 'staff',
    };
  });

  // ---- gym setup (legacy POST /gyms) ----
  const createGymSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    address: z.string(),
    timings: z.string(),
    contactPhone: z.string(),
    upiId: z.string(),
    plans: z.array(z.object({ durationMonths: z.number().int().positive(), price: z.number().int().nonnegative() })),
  });

  // Gym creation is now platform-admin only. Self-serve users go through
  // POST /access-requests instead.
  app.post('/gyms', async (req) => {
    const body = createGymSchema.parse(req.body);
    const slug = requireValidGymSlug(body.slug);
    const platformAdmin = await requirePlatformAdmin(req);
    await assertSlugAvailable(slug);

    let created: DbGym;
    try {
      created = await prisma.$transaction(async (tx) => {
        const gym = await tx.gym.create({
          data: {
            id: newId('gym'),
            ownerId: platformAdmin.id,
            name: body.name,
            normalizedName: normalizeGymName(body.name),
            slug,
            address: body.address,
            timings: body.timings,
            contactPhone: body.contactPhone,
            upiId: body.upiId,
            upiDisplayName: body.upiId,
            gracePeriodDays: 3,
            status: 'active',
            approvedById: platformAdmin.id,
            approvedAt: new Date(),
          },
        });

        // Platform admin who creates a gym also gets a GymUser{admin} so
        // they can drive setup until they assign a real gym admin.
        await tx.gymUser.create({
          data: {
            id: newId('gymuser'),
            gymId: gym.id,
            ownerId: platformAdmin.id,
            role: 'admin',
            status: 'active',
            joinedAt: new Date(),
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

        return gym;
      });
    } catch (err) {
      if (isSlugUniqueViolation(err)) throw toSlugUnavailableError();
      throw err;
    }

    return toGym(created);
  });

  // ---- access requests ----
  const createAccessRequestSchema = z.object({
    gymName: nonEmptyText,
    contactPhone: nonEmptyText,
    address: nonEmptyText,
    note: z.string().trim().max(1000).optional(),
  });

  app.post('/access-requests', async (req) => {
    const body = createAccessRequestSchema.parse(req.body);
    const owner = await getAuthenticatedOwner(req);
    const existingPending = await prisma.gymAccessRequest.findFirst({
      where: { ownerId: owner.id, status: 'pending' },
    });
    if (existingPending) {
      throw clientError('You already have a pending access request.', 409, 'ACCESS_REQUEST_EXISTS');
    }
    const created = await prisma.gymAccessRequest.create({
      data: {
        id: newId('accreq'),
        ownerId: owner.id,
        gymName: body.gymName,
        contactPhone: body.contactPhone,
        address: body.address,
        note: body.note,
      },
    });
    return {
      id: created.id,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
    };
  });

  // List the caller's own access requests so the frontend can show "pending".
  app.get('/me/access-requests', async (req) => {
    const owner = await getAuthenticatedOwner(req);
    const requests = await prisma.gymAccessRequest.findMany({
      where: { ownerId: owner.id },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((r) => ({
      id: r.id,
      gymName: r.gymName,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }));
  });

  // ---- platform admin endpoints ----
  app.get('/admin/access-requests', async (req) => {
    await requirePlatformAdmin(req);
    const q = z
      .object({ status: z.string().optional() })
      .parse(req.query);
    const where = q.status ? { status: q.status } : {};
    const requests = await prisma.gymAccessRequest.findMany({
      where,
      include: { owner: true, reviewedBy: true },
      orderBy: { createdAt: 'desc' },
    });
    return requests.map((r) => ({
      id: r.id,
      gymName: r.gymName,
      contactPhone: r.contactPhone,
      address: r.address,
      note: r.note,
      status: r.status,
      requesterName: r.owner.name,
      requesterEmail: r.owner.email,
      reviewedByName: r.reviewedBy?.name ?? null,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    }));
  });

  const reviewAccessRequestSchema = z.object({
    status: z.enum(['approved', 'rejected', 'duplicate']),
  });

  app.patch<{ Params: { id: string } }>(
    '/admin/access-requests/:id',
    async (req) => {
      const body = reviewAccessRequestSchema.parse(req.body);
      const platformAdmin = await requirePlatformAdmin(req);
      const existing = await prisma.gymAccessRequest.findUnique({
        where: { id: req.params.id },
      });
      if (!existing) {
        throw Object.assign(new Error('Access request not found'), { statusCode: 404 });
      }
      if (existing.status !== 'pending') {
        throw clientError('Access request already reviewed.', 409, 'ALREADY_REVIEWED');
      }
      const updated = await prisma.gymAccessRequest.update({
        where: { id: existing.id },
        data: {
          status: body.status,
          reviewedById: platformAdmin.id,
          reviewedAt: new Date(),
        },
      });
      return { id: updated.id, status: updated.status };
    },
  );

  // Admin listing of all gyms (for the platform admin dashboard).
  app.get('/admin/gyms', async (req) => {
    await requirePlatformAdmin(req);
    const gyms = await prisma.gym.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        owner: true,
        gymUsers: { include: { owner: true } },
      },
    });
    return gyms.map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      status: g.status,
      createdByName: g.owner.name,
      createdByEmail: g.owner.email,
      memberCount: g.gymUsers.length,
      createdAt: g.createdAt.toISOString(),
    }));
  });

  // Duplicate check by normalized name / phone / upi — informational only.
  app.get('/admin/gyms/duplicates', async (req) => {
    await requirePlatformAdmin(req);
    const q = z
      .object({
        name: z.string().optional(),
        contactPhone: z.string().optional(),
        upiId: z.string().optional(),
      })
      .parse(req.query);
    const filters: Array<Record<string, unknown>> = [];
    if (q.name) filters.push({ normalizedName: normalizeGymName(q.name) });
    if (q.contactPhone) filters.push({ contactPhone: q.contactPhone });
    if (q.upiId) filters.push({ upiId: q.upiId });
    if (filters.length === 0) return [];
    const gyms = await prisma.gym.findMany({
      where: { OR: filters },
      select: {
        id: true,
        name: true,
        slug: true,
        contactPhone: true,
        upiId: true,
        status: true,
      },
    });
    return gyms;
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
    if (!gym || gym.status !== 'active') {
      throw Object.assign(new Error('Gym not found'), { statusCode: 404 });
    }
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
