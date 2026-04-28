import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import type {
  MemberDetailResponse,
  MemberListItem,
  MembersListResponse,
  PublicGymResponse,
} from '@gym-app/shared/types';
import { prisma } from './db.js';
import { addDays, addMonths, iso, parseDate, todayLocal } from './lib/dates.js';
import { newId } from './lib/ids.js';
import { computeStatus } from './lib/status.js';
import { clerkAuth, getAuthenticatedOwner, getOwnerGym } from './lib/auth.js';
import {
  toGym,
  toMember,
  toMembership,
  toPayment,
  toPlan,
} from './lib/serialize.js';

async function buildListItem(memberId: string, gracePeriodDays: number): Promise<MemberListItem> {
  const today = iso(todayLocal());
  const member = (await prisma.member.findUnique({ where: { id: memberId } }))!;
  const memberships = await prisma.membership.findMany({
    where: { memberId, NOT: { status: 'cancelled' } },
    orderBy: { startDate: 'asc' },
  });
  const active = memberships.find((m) => m.startDate <= today && today < m.endDate);
  const past = memberships.filter((m) => m.endDate <= today);
  const current = active ?? past[past.length - 1] ?? null;
  const queued = memberships.filter((m) => m.startDate > today);
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
  const rank: Record<string, number> = { overdue: 0, payment_pending: 1, expiring: 2, active: 3 };
  return [...items].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.status === 'overdue') return (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0);
    if (a.status === 'expiring') return (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0);
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

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.setErrorHandler((err, _req, reply) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    const code = (err as { code?: string }).code;
    reply.code(status).send({ error: err.message, ...(code ? { code } : {}) });
  });

  // Public endpoints (no Clerk auth required).
  const PUBLIC_PREFIXES = ['/health', '/public/'];
  app.addHook('preHandler', async (req) => {
    const path = req.url.split('?')[0] ?? '';
    if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))) return;
    await clerkAuth(req);
  });

  app.get('/health', async () => ({ ok: true }));

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
        active: sorted.filter((i) => i.status === 'active').length,
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
    const active = memberships.find(
      (m) => m.startDate <= today && today < m.endDate && m.status !== 'cancelled',
    );
    const past = memberships.filter((m) => m.endDate <= today);
    const current = active ?? past[past.length - 1] ?? null;
    const queued = memberships.filter((m) => m.startDate > today && m.status !== 'cancelled');
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
      queuedMemberships: queued.map(toMembership),
      plan: plan ? toPlan(plan) : null,
      status: s.status,
      daysOverdue: s.daysOverdue,
      daysRemaining: s.daysRemaining,
      amountDue: s.amountDue,
      paymentHistory,
    };
  });

  const createMemberSchema = z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    planId: z.string(),
    startDate: z.string(),
  });

  app.post('/members', async (req) => {
    const body = createMemberSchema.parse(req.body);
    const { gym } = await getOwnerGym(req);
    const plan = await prisma.plan.findFirst({ where: { id: body.planId, gymId: gym.id } });
    if (!plan) throw Object.assign(new Error('Plan not found'), { statusCode: 404 });

    const member = await prisma.member.create({
      data: {
        id: newId('member'),
        gymId: gym.id,
        name: body.name.trim(),
        phone: body.phone.trim(),
        joinDate: body.startDate,
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
    name: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
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
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.phone !== undefined ? { phone: body.phone.trim() } : {}),
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
    paidOn: z.string(),
  });

  app.post('/payments', async (req) => {
    const body = recordPaymentSchema.parse(req.body);
    const { owner, gym } = await getOwnerGym(req);
    const today = iso(todayLocal());
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

    let membershipId: string;
    if (activeNow && activeNow.amountPaid === 0) {
      await prisma.membership.update({
        where: { id: activeNow.id },
        data: { amountPaid: body.amount },
      });
      membershipId = activeNow.id;
    } else if (activeNow) {
      const start = addDays(parseDate(activeNow.endDate), 1);
      const end = addMonths(start, plan.durationMonths);
      const m = await prisma.membership.create({
        data: {
          id: newId('membership'),
          memberId: member.id,
          planId: plan.id,
          startDate: iso(start),
          endDate: iso(end),
          amountDue: plan.price,
          amountPaid: body.amount,
          customPrice: body.amount !== plan.price ? body.amount : null,
          status: 'active',
        },
      });
      membershipId = m.id;
    } else {
      const start = parseDate(body.paidOn);
      const end = addMonths(start, plan.durationMonths);
      const m = await prisma.membership.create({
        data: {
          id: newId('membership'),
          memberId: member.id,
          planId: plan.id,
          startDate: iso(start),
          endDate: iso(end),
          amountDue: plan.price,
          amountPaid: body.amount,
          customPrice: body.amount !== plan.price ? body.amount : null,
          status: 'active',
        },
      });
      membershipId = m.id;
    }

    const payment = await prisma.payment.create({
      data: {
        id: newId('payment'),
        membershipId,
        amount: body.amount,
        method: body.method,
        paidOn: body.paidOn,
        referenceNote: body.method === 'upi' ? `GYM-MEM-${member.id}` : '',
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

  app.post('/plans', async (req) => {
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

  app.patch<{ Params: { id: string } }>('/plans/:id', async (req) => {
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

  app.patch('/gym', async (req) => {
    const body = updateGymSchema.parse(req.body);
    const { gym } = await getOwnerGym(req);
    const updated = await prisma.gym.update({ where: { id: gym.id }, data: body });
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

  // First-time setup: authenticated owner creates (or replaces) their own gym.
  app.post('/gyms', async (req) => {
    const body = createGymSchema.parse(req.body);
    const owner = await getAuthenticatedOwner(req);
    const existing = await prisma.gym.findFirst({ where: { ownerId: owner.id } });
    let gymId = existing?.id;
    if (existing) {
      await prisma.gym.update({
        where: { id: existing.id },
        data: {
          name: body.name,
          slug: body.slug,
          address: body.address,
          timings: body.timings,
          contactPhone: body.contactPhone,
          upiId: body.upiId,
          upiDisplayName: body.upiId,
        },
      });
      await prisma.plan.deleteMany({ where: { gymId: existing.id } });
    } else {
      const created = await prisma.gym.create({
        data: {
          id: newId('gym'),
          ownerId: owner.id,
          name: body.name,
          slug: body.slug,
          address: body.address,
          timings: body.timings,
          contactPhone: body.contactPhone,
          upiId: body.upiId,
          upiDisplayName: body.upiId,
          gracePeriodDays: 3,
        },
      });
      gymId = created.id;
    }
    for (const p of body.plans) {
      await prisma.plan.create({
        data: {
          id: newId('plan'),
          gymId: gymId!,
          durationMonths: p.durationMonths,
          price: p.price,
          name: `${p.durationMonths} Month${p.durationMonths === 1 ? '' : 's'}`,
          isActive: true,
        },
      });
    }
    return toGym((await prisma.gym.findUnique({ where: { id: gymId! } }))!);
  });

  // ---- public gym page (no auth) ----
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
