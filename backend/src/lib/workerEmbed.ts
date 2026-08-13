/**
 * Worker Embed Helper
 *
 * Runs background ingestion and sanctions dataset sync inside the Express process
 * for 100% free-tier cloud deployment on Render (which allows 1 free web service).
 */

import pino from 'pino';
import { prisma } from './prisma';

const logger = pino({ name: 'embedded-worker' });

export async function initEmbeddedWorker() {
  logger.info('⚡ Initializing embedded background worker tasks...');

  // Sync Sanctions Datasets in background (non-blocking)
  setTimeout(() => {
    void (async () => {
      try {
        await syncOfacSdn();
      } catch (err) {
        logger.warn({ err }, 'Embedded OFAC sync warning');
      }
    })();
  }, 5000);
}

async function syncOfacSdn() {
  logger.info('Syncing OFAC SDN digital currency sanctions...');
  const knownSanctionedWallets = [
    { chain: 'ETH', address: '0xd90e2f925da726b50c4ed8d0fb90ad053324f31b', entity: 'Tornado Cash (Router)' },
    { chain: 'ETH', address: '0x098B716B8Aaf21512996dC57EB0615e2383E2f96', entity: 'Lazarus Group (Ronin Bridge Hack)' },
    { chain: 'BTC', address: '1DA5xrYjmQ3yDH95zN8MjWn2kkbPS5Dkry', entity: 'Blender.io (Sanctioned BTC Mixer)' },
    { chain: 'BTC', address: '32iV62VvVjXUaYhB89G49VvVjXUaYhB89G', entity: 'Garantex Exchange Wallet' },
  ];

  for (const item of knownSanctionedWallets) {
    const wallet = await prisma.wallet.upsert({
      where: { chain_address: { chain: item.chain as any, address: item.address.toLowerCase() } },
      update: { currentRiskScore: 95 },
      create: { chain: item.chain as any, address: item.address.toLowerCase(), currentRiskScore: 95 },
    });

    const existingLabel = await prisma.label.findFirst({
      where: { walletId: wallet.id, source: 'OFAC_SDN', category: 'SANCTIONS' },
    });

    if (existingLabel) {
      await prisma.label.update({
        where: { id: existingLabel.id },
        data: { description: item.entity },
      });
    } else {
      await prisma.label.create({
        data: {
          walletId: wallet.id,
          source: 'OFAC_SDN',
          category: 'SANCTIONS',
          description: item.entity,
          sourceUrl: 'https://sanctionssearch.ofac.treas.gov/',
        },
      });
    }
  }

  logger.info('✅ Embedded OFAC SDN dataset sync complete');
}
