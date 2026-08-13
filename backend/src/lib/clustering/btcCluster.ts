/**
 * BTC Common-Input-Ownership Clustering Heuristic
 *
 * Implements the standard Bitcoin heuristic:
 * Addresses co-spent as inputs (vin) in the same transaction belong
 * to the same entity / wallet cluster.
 */

import * as blockstream from '../chainClients/blockstream';
import { BlockstreamTx } from '../chainClients/blockstream';
import pino from 'pino';

const logger = pino({ name: 'btc-clustering' });

export interface BtcClusterResult {
  targetAddress: string;
  clusterAddresses: string[];
  totalClusterTxCount: number;
  confidence: 'HIGH' | 'MEDIUM';
}

export async function computeBtcCluster(address: string): Promise<BtcClusterResult> {
  logger.info({ address }, 'Computing BTC common-input-ownership cluster...');

  const cluster = new Set<string>();
  cluster.add(address.toLowerCase());

  try {
    const txs: BlockstreamTx[] = await blockstream.getAddressTransactions(address);

    for (const tx of txs) {
      // Check if targetAddress is among inputs
      const inputAddresses = tx.vin
        .map((vin) => vin.prevout?.scriptpubkey_address)
        .filter((addr): addr is string => !!addr);

      const targetIsInput = inputAddresses.some((addr) => addr.toLowerCase() === address.toLowerCase());

      // If target is an input and there are multiple inputs, all input addresses belong to the same cluster!
      if (targetIsInput && inputAddresses.length > 1) {
        for (const inputAddr of inputAddresses) {
          cluster.add(inputAddr.toLowerCase());
        }
      }
    }
  } catch (err) {
    logger.warn({ address, err }, 'Clustering computation encountered error');
  }

  const clusterAddresses = Array.from(cluster);

  return {
    targetAddress: address,
    clusterAddresses,
    totalClusterTxCount: clusterAddresses.length,
    confidence: clusterAddresses.length > 1 ? 'HIGH' : 'MEDIUM',
  };
}
