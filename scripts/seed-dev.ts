/**
 * seed-dev.ts — Development seed script
 *
 * Seeds User/Case/CaseNote scaffolding for local UI development.
 * NEVER seeds Transaction rows — only structural entities.
 * All seeded records are visibly marked with source: "seed".
 *
 * Usage: npx ts-node scripts/seed-dev.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding development data...');

  // Create demo users
  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@cryptotrace.dev' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@cryptotrace.dev',
      passwordHash,
      role: 'ADMIN',
      badgeId: 'ADM-001',
    },
  });

  const investigator = await prisma.user.upsert({
    where: { email: 'investigator@cryptotrace.dev' },
    update: {},
    create: {
      name: 'Inspector Sharma',
      email: 'investigator@cryptotrace.dev',
      passwordHash,
      role: 'INVESTIGATOR',
      badgeId: 'INV-042',
    },
  });

  const analyst = await prisma.user.upsert({
    where: { email: 'analyst@cryptotrace.dev' },
    update: {},
    create: {
      name: 'Analyst Verma',
      email: 'analyst@cryptotrace.dev',
      passwordHash,
      role: 'ANALYST',
      badgeId: 'ANL-017',
    },
  });

  // Create a demo case
  const demoCase = await prisma.case.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      title: '[SEED] Demo Crypto Fraud Investigation',
      firNumber: 'FIR-2026-CHD-00042',
      status: 'OPEN',
      createdByUserId: investigator.id,
    },
  });

  // Add a case note
  await prisma.caseNote.create({
    data: {
      caseId: demoCase.id,
      authorId: investigator.id,
      body: '[SEED] Initial complaint received regarding suspicious crypto transactions linked to online fraud scheme. Victim reports funds sent to unknown BTC address.',
    },
  });

  console.log('✅ Seed complete');
  console.log(`   Admin:        ${admin.email}`);
  console.log(`   Investigator: ${investigator.email}`);
  console.log(`   Analyst:      ${analyst.email}`);
  console.log(`   Demo Case:    ${demoCase.title}`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
