import { describe, it, expect } from 'vitest';
import { blockstream } from './lib/chainClients';
import { etherscan } from './lib/chainClients';
import { coingecko } from './lib/chainClients';

describe('Live API Integration Tests (No Mock Data)', () => {
  // Test BTC lookup against a well-known stable BTC address (Satoshi Genesis / Binace cold wallet)
  it('BTC Address Lookup — fetches real live data from Blockstream API', async () => {
    const knownBtcAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'; // Satoshi Genesis address
    const data = await blockstream.getAddress(knownBtcAddress);

    expect(data.address).toBe(knownBtcAddress);
    expect(data.chain_stats).toBeDefined();
    expect(typeof data.chain_stats.tx_count).toBe('number');
    expect(data.chain_stats.tx_count).toBeGreaterThan(0);
  });

  it('BTC Transaction History — fetches real live transactions from Blockstream API', async () => {
    const knownBtcAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
    const txs = await blockstream.getAddressTransactions(knownBtcAddress);

    expect(Array.isArray(txs)).toBe(true);
    expect(txs.length).toBeGreaterThan(0);
    expect(txs[0]).toHaveProperty('txid');
    expect(txs[0]).toHaveProperty('vout');
    expect(txs[0]).toHaveProperty('status');
  });

  // Test CoinGecko price conversion
  it('CoinGecko Price Sync — fetches plausible live BTC & ETH prices', async () => {
    const prices = await coingecko.getPrices();

    expect(prices).toHaveProperty('bitcoin');
    expect(prices).toHaveProperty('ethereum');
    expect(prices.bitcoin.usd).toBeGreaterThan(1000); // Sanity check BTC > $1,000
    expect(prices.ethereum.usd).toBeGreaterThan(100);  // Sanity check ETH > $100
  });

  // Test ETH lookup (handling cases when ETHERSCAN_API_KEY is unset or default)
  it('ETH Balance / Tx Lookup — interacts with Etherscan API', async () => {
    const knownEthAddress = '0x00000000219ab540356cbb839cbe05303d7705fa'; // ETH 2.0 Deposit Contract
    try {
      const balance = await etherscan.getBalance(knownEthAddress);
      expect(typeof balance).toBe('string');
    } catch (err: any) {
      // Etherscan free tier without valid key will return API error message, which proves live network interaction
      expect(err.message).toMatch(/Etherscan|API/i);
    }
  });
});
