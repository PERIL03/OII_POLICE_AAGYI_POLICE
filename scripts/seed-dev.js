const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding development users, cases, and watchlists...');

  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@cryptotrace.dev' },
    update: {},
    create: {
      name: 'Admin Officer',
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

  // Create demo investigation case
  const demoCase = await prisma.case.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      title: 'Crypto Ransomware & Phishing Scheme',
      firNumber: 'FIR-2026-CHD-00042',
      status: 'OPEN',
      createdByUserId: investigator.id,
    },
  });

  // Add notes
  await prisma.caseNote.create({
    data: {
      caseId: demoCase.id,
      authorId: investigator.id,
      body: 'Initial complaint filed by victim. Transferred 1.5 BTC to suspect wallet following fraudulent phone call impersonating bank officials.',
    },
  });

  // Create watched wallets & watchlist entries
  const btcWallet = await prisma.wallet.upsert({
    where: { chain_address: { chain: 'BTC', address: '1DA5xrYjmQ3yDH95zN8MjWn2kkbPS5Dkry' } },
    update: { isWatchlisted: true, currentRiskScore: 60 },
    create: { chain: 'BTC', address: '1DA5xrYjmQ3yDH95zN8MjWn2kkbPS5Dkry', isWatchlisted: true, currentRiskScore: 60 },
  });

  const ethWallet = await prisma.wallet.upsert({
    where: { chain_address: { chain: 'ETH', address: '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b' } },
    update: { isWatchlisted: true, currentRiskScore: 90 },
    create: { chain: 'ETH', address: '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b', isWatchlisted: true, currentRiskScore: 90 },
  });

  await prisma.watchlistEntry.create({
    data: {
      walletId: btcWallet.id,
      addedByUserId: investigator.id,
      caseId: demoCase.id,
      reason: 'Primary suspect address in FIR 42',
    },
  });

  await prisma.watchlistEntry.create({
    data: {
      walletId: ethWallet.id,
      addedByUserId: investigator.id,
      caseId: demoCase.id,
      reason: 'Tornado Cash mixer contract linked to illicit funds',
    },
  });

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
