import { PrismaClient } from '@prisma/client';
import { addDays, addMonths, iso, todayLocal } from '../src/lib/dates.js';
import { newId } from '../src/lib/ids.js';

const prisma = new PrismaClient();

// Seed parameters. Defaults are the local-dev fixture; override via env vars
// to seed a real Clerk user's account in a higher environment, e.g.:
//
//   SEED_CLERK_USER_ID=user_abc123 \
//   SEED_OWNER_NAME="Anand Thakur" \
//   SEED_OWNER_EMAIL=anand@example.com \
//   SEED_GYM_SLUG=gungun-anand \
//   DATABASE_URL=<neon main url> \
//     npm run db:seed --workspace packages/backend
const SEED_CLERK_USER_ID = process.env.SEED_CLERK_USER_ID ?? 'seed_user_anand';
const SEED_OWNER_NAME    = process.env.SEED_OWNER_NAME    ?? 'Anand Sharma';
const SEED_OWNER_EMAIL   = process.env.SEED_OWNER_EMAIL   ?? 'anand@example.com';
const SEED_GYM_SLUG      = process.env.SEED_GYM_SLUG      ?? 'gungun';
const SEED_GYM_NAME      = process.env.SEED_GYM_NAME      ?? 'Gungun Fitness Club';

async function main() {
  const TODAY = todayLocal();

  // Owner: upsert keyed on clerkUserId so a JIT-created Owner row in prod
  // (created when the user signed in for the first time) is preserved and
  // simply gets its mirror fields filled in.
  const owner = await prisma.owner.upsert({
    where: { clerkUserId: SEED_CLERK_USER_ID },
    update: { name: SEED_OWNER_NAME, email: SEED_OWNER_EMAIL },
    create: {
      id: newId('owner'),
      clerkUserId: SEED_CLERK_USER_ID,
      name: SEED_OWNER_NAME,
      email: SEED_OWNER_EMAIL,
    },
  });

  // Wipe THIS owner's existing gyms and dependent rows. Other owners are
  // untouched — important when running against a shared production DB.
  const existingGyms = await prisma.gym.findMany({
    where: { ownerId: owner.id },
    select: { id: true },
  });
  for (const g of existingGyms) {
    const memberships = await prisma.membership.findMany({
      where: { member: { gymId: g.id } },
      select: { id: true },
    });
    if (memberships.length) {
      await prisma.payment.deleteMany({
        where: { membershipId: { in: memberships.map((m) => m.id) } },
      });
    }
    await prisma.membership.deleteMany({ where: { member: { gymId: g.id } } });
    await prisma.member.deleteMany({ where: { gymId: g.id } });
    await prisma.plan.deleteMany({ where: { gymId: g.id } });
    await prisma.gym.delete({ where: { id: g.id } });
  }

  const gym = await prisma.gym.create({
    data: {
      id: newId('gym'),
      ownerId: owner.id,
      name: SEED_GYM_NAME,
      slug: SEED_GYM_SLUG,
      address: '123 MG Road,\nSagar, Madhya Pradesh 470001',
      timings: 'Mon–Sat\nMorning: 6:00 AM – 10:00 AM\nEvening: 5:00 PM – 9:00 PM',
      contactPhone: '+91 98765 43210',
      upiId: 'sagargym@okaxis',
      upiDisplayName: SEED_GYM_NAME,
      gracePeriodDays: 5,
    },
  });

  const planSpecs = [
    { durationMonths: 1,  price: 1000, name: '1 Month'   },
    { durationMonths: 3,  price: 2700, name: '3 Months'  },
    { durationMonths: 6,  price: 5000, name: '6 Months'  },
    { durationMonths: 12, price: 9000, name: '12 Months' },
  ];
  const plans: Record<number, { id: string }> = {};
  for (const p of planSpecs) {
    const created = await prisma.plan.create({
      data: { ...p, id: newId('plan'), gymId: gym.id, isActive: true },
    });
    plans[p.durationMonths] = { id: created.id };
  }

  // Rajesh: 4 expired 3-month memberships, last one expired 12 days ago
  // (8 calendar days past the 5-day grace = 3 days inside grace? — fixture
  // is calibrated so days-overdue lands at the SPEC §9 canary 7).
  const rajeshEnd4   = addDays(TODAY, -12);
  const rajeshStart4 = addMonths(rajeshEnd4, -3);
  const rajeshEnd3   = rajeshStart4;
  const rajeshStart3 = addMonths(rajeshEnd3, -3);
  const rajeshEnd2   = rajeshStart3;
  const rajeshStart2 = addMonths(rajeshEnd2, -3);
  const rajeshEnd1   = rajeshStart2;
  const rajeshStart1 = addMonths(rajeshEnd1, -3);

  // Sneha: active 6-month, ends in 3 days (canary "expiring").
  const snehaEnd   = addDays(TODAY, 3);
  const snehaStart = addMonths(snehaEnd, -6);

  // Anjali: active 3-month, 42 days remaining (canary "active").
  const anjaliEnd   = addDays(TODAY, 42);
  const anjaliStart = addMonths(anjaliEnd, -3);

  const rajeshId = newId('member');
  const snehaId  = newId('member');
  const anjaliId = newId('member');
  await prisma.member.createMany({
    data: [
      { id: rajeshId, gymId: gym.id, name: 'Rajesh Kumar', phone: '+91 98123 45678', joinDate: iso(rajeshStart1), isActive: true },
      { id: snehaId,  gymId: gym.id, name: 'Sneha Patel',  phone: '+91 99876 54321', joinDate: iso(snehaStart),    isActive: true },
      { id: anjaliId, gymId: gym.id, name: 'Anjali Singh', phone: '+91 97000 12345', joinDate: iso(anjaliStart),   isActive: true },
    ],
  });

  const rajeshHistory = [
    { start: rajeshStart1, end: rajeshEnd1 },
    { start: rajeshStart2, end: rajeshEnd2 },
    { start: rajeshStart3, end: rajeshEnd3 },
    { start: rajeshStart4, end: rajeshEnd4 },
  ];
  for (let i = 0; i < rajeshHistory.length; i++) {
    const m = rajeshHistory[i]!;
    const membershipId = newId('membership');
    await prisma.membership.create({
      data: {
        id: membershipId,
        memberId: rajeshId,
        planId: plans[3]!.id,
        startDate: iso(m.start),
        endDate: iso(m.end),
        amountDue: 2700,
        amountPaid: 2700,
        status: 'expired',
      },
    });
    const isUpi = i === 1 || i === 3; // alternate cash/upi for fixture variety
    await prisma.payment.create({
      data: {
        id: newId('payment'),
        membershipId,
        amount: 2700,
        method: isUpi ? 'upi' : 'cash',
        paidOn: iso(m.start),
        referenceNote: isUpi ? `GYM-MEM-${rajeshId}` : '',
        recordedBy: owner.id,
        recordedByName: owner.name,
      },
    });
  }

  const snehaMembershipId = newId('membership');
  await prisma.membership.create({
    data: {
      id: snehaMembershipId,
      memberId: snehaId,
      planId: plans[6]!.id,
      startDate: iso(snehaStart),
      endDate: iso(snehaEnd),
      amountDue: 5000,
      amountPaid: 5000,
      status: 'active',
    },
  });
  await prisma.payment.create({
    data: {
      id: newId('payment'),
      membershipId: snehaMembershipId,
      amount: 5000,
      method: 'upi',
      paidOn: iso(snehaStart),
      referenceNote: `GYM-MEM-${snehaId}`,
      recordedBy: owner.id,
      recordedByName: owner.name,
    },
  });

  await prisma.membership.create({
    data: {
      id: newId('membership'),
      memberId: anjaliId,
      planId: plans[3]!.id,
      startDate: iso(anjaliStart),
      endDate: iso(anjaliEnd),
      amountDue: 2700,
      amountPaid: 2700,
      status: 'active',
    },
  });

  console.log(
    `Seed complete for owner=${owner.id} (clerkUserId=${SEED_CLERK_USER_ID}): ` +
      `1 gym (${SEED_GYM_NAME} / ${SEED_GYM_SLUG}), 4 plans, 3 members, 6 memberships, 5 payments.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
