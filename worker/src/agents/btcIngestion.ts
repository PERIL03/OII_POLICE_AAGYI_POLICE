/**
 * BTC Ingestion Agent — connects to mempool.space WebSocket
 * for real-time BTC transaction & block streaming.
 */

import WebSocket from 'ws';
import pino from 'pino';
import { redis } from '../lib/redis';

const logger = pino({ name: 'btc-ingestion' });

const MEMPOOL_WS_URL = 'wss://mempool.space/api/v1/ws';

export interface MempoolTxEvent {
  txid: string;
  value?: number;
  fee?: number;
}

export function startBtcIngestion(onTx?: (txid: string) => void): () => void {
  logger.info('Connecting to mempool.space WebSocket...');

  let ws: WebSocket | null = null;
  let isClosed = false;

  function connect() {
    if (isClosed) return;

    ws = new WebSocket(MEMPOOL_WS_URL);

    ws.on('open', () => {
      logger.info('Connected to mempool.space WebSocket');
      // Subscribe to live txs & blocks
      ws?.send(JSON.stringify({ action: 'want', data: ['blocks', 'mempool-blocks', 'stats'] }));
      ws?.send(JSON.stringify({ 'track-address': 'all' }));
    });

    ws.on('message', async (data: WebSocket.Data) => {
      try {
        const parsed = JSON.parse(data.toString());

        if (parsed.tx) {
          const txid = parsed.tx.txid || parsed.tx;
          logger.debug({ txid }, 'Live BTC mempool transaction received');

          // Publish to Redis channel for alert processing
          await redis.publish('btc:new-tx', JSON.stringify({ txid, timestamp: Date.now() }));

          if (onTx) onTx(txid);
        }
      } catch (err) {
        // Ignore unparseable control frames
      }
    });

    ws.on('error', (err) => {
      logger.error({ err }, 'mempool.space WebSocket error');
    });

    ws.on('close', () => {
      logger.warn('mempool.space WebSocket closed. Reconnecting in 5s...');
      if (!isClosed) {
        setTimeout(connect, 5000);
      }
    });
  }

  connect();

  return () => {
    isClosed = true;
    if (ws) ws.close();
  };
}
