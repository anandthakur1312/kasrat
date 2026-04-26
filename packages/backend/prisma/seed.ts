import { PrismaClient } from '@prisma/client';
import { addDays, addMonths, iso, todayLocal } from '../src/lib/dates.js';

const prisma = new PrismaClient();

async function main() {
  await prisma.payment.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.member.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.gym.deleteMany();
  await prisma.owner.deleteMany();

  const TODAY = todayLocal();

  const owner = await prisma.owner.create({
    data: { id: 'owner-1', name: 'Anand Sharma', email: 'anand@example.com' },
  });

  const gym = await prisma.gym.create({
    data: {
      id: 'gym-1',
      ownerId: owner.id,
      name: 'Gungun Fitness Club',
      slug: 'gungun',
      address: '123 MG Road,\nSagar, Madhya Pradesh 470001',
      timings: 'Mon–Sat\nMorning: 6:00 AM – 10:00 AM\nEvening: 5:00 PM – 9:00 PM',
      contactPhone: '+91 98765 43210',
      upiId: 'sagargym@okaxis',
      upiDisplayName: 'Gungun Fitness Club',
      gracePeriodDays: 5,
    },
  });

  const planSpecs = [
    { id: 'plan-1mo', durationMonths: 1, price: 1000, name: '1 Month' },
    { id: 'plan-3mo', durationMonths: 3, price: 2700, name: '3 Months' },
    { id: 'plan-6mo', durationMonths: 6, price: 5000, name: '6 Months' },
    { id: 'plan-12mo', durationMonths: 12, price: 9000, name: '12 Months' },
  ];
  for (const p of planSpecs) {
    await prisma.plan.create({ data: { ...p, gymId: gym.id, isActive: true } });
  }

  // Rajesh: 4 expired 3-month memberships, last one expired 12 days ago.
  const rajeshEnd4 = addDays(TODAY, -12);
  const rajeshStart4 = addMonths(rajeshEnd4, -3);
  const rajeshEnd3 = rajeshStart4;
  const rajeshStart3 = addMonths(rajeshEnd3, -3);
  const rajeshEnd2 = rajeshStart3;
  const rajeshStart2 = addMonths(rajeshEnd2, -3);
  const rajeshEnd1 = rajeshStart2;
  const rajeshStart1 = addMonths(rajeshEnd1, -3);

  // Sneha: active 6-month, ends in 3 days.
  const snehaEnd = addDays(TODAY, 3);
  const snehaStart = addMonths(snehaEnd, -6);
  // Anjali: active 3-month, 42 days remaining.
  const anjaliEnd = addDays(TODAY, 42);
  const anjaliStart = addMonths(anjaliEnd, -3);

  await prisma.member.createMany({
    data: [
      {
        id: 'member-1',
        gymId: gym.id,
        name: 'Rajesh Kumar',
        phone: '+91 98123 45678',
        joinDate: iso(rajeshStart1),
        isActive: true,
      },
      {
        id: 'member-2',
        gymId: gym.id,
        name: 'Sneha Patel',
        phone: '+91 99876 54321',
        joinDate: iso(snehaStart),
        isActive: true,
      },
      {
        id: 'member-3',
        gymId: gym.id,
        name: 'Anjali Singh',
        phone: '+91 97000 12345',
        joinDate: iso(anjaliStart),
        isActive: true,
      },
    ],
  });

  const rajeshHistory: Array<{ id: string; start: Date; end: Date }> = [
    { id: 'membership-r1', start: rajeshStart1, end: rajeshEnd1 },
    { id: 'membership-r2', start: rajeshStart2, end: rajeshEnd2 },
    { id: 'membership-r3', start: rajeshStart3, end: rajeshEnd3 },
    { id: 'membership-r4', start: rajeshStart4, end: rajeshEnd4 },
  ];
  for (const m of rajeshHistory) {
    await prisma.membership.create({
      data: {
        id: m.id,
        memberId: 'member-1',
        planId: 'plan-3mo',
        startDate: iso(m.start),
        endDate: iso(m.end),
        amountDue: 2700,
        amountPaid: 2700,
        status: 'expired',
      },
    });
    await prisma.payment.create({
      data: {
        id: `payment-${m.id}`,
        membershipId: m.id,
        amount: 2700,
        method: m.id.endsWith('2') || m.id.endsWith('4') ? 'upi' : 'cash',
        paidOn: iso(m.start),
        referenceNote: m.id.endsWith('2') || m.id.endsWith('4') ? 'GYM-MEM-001' : '',
        recordedBy: owner.id,
        recordedByName: owner.name,
      },
    });
  }

  await prisma.membership.create({
    data: {
      id: 'membership-s1',
      memberId: 'member-2',
      planId: 'plan-6mo',
      startDate: iso(snehaStart),
      endDate: iso(snehaEnd),
      amountDue: 5000,
      amountPaid: 5000,
      status: 'active',
    },
  });
  await prisma.payment.create({
    data: {
      id: 'payment-s1',
      membershipId: 'membership-s1',
      amount: 5000,
      method: 'upi',
      paidOn: iso(snehaStart),
      referenceNote: 'GYM-MEM-002',
      recordedBy: owner.id,
      recordedByName: owner.name,
    },
  });

  await prisma.membership.create({
    data: {
      id: 'membership-a1',
      memberId: 'member-3',
      planId: 'plan-3mo',
      startDate: iso(anjaliStart),
      endDate: iso(anjaliEnd),
      amountDue: 2700,
      amountPaid: 2700,
      status: 'active',
    },
  });

  console.log('Seed complete: 1 owner, 1 gym, 4 plans, 3 members, 6 memberships, 5 payments.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
