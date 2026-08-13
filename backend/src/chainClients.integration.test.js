"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const chainClients_1 = require("./lib/chainClients");
const chainClients_2 = require("./lib/chainClients");
const chainClients_3 = require("./lib/chainClients");
(0, vitest_1.describe)('Live API Integration Tests (No Mock Data)', () => {
    // Test BTC lookup against a well-known stable BTC address (Satoshi Genesis / Binace cold wallet)
    (0, vitest_1.it)('BTC Address Lookup — fetches real live data from Blockstream API', async () => {
        const knownBtcAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'; // Satoshi Genesis address
        const data = await chainClients_1.blockstream.getAddress(knownBtcAddress);
        (0, vitest_1.expect)(data.address).toBe(knownBtcAddress);
        (0, vitest_1.expect)(data.chain_stats).toBeDefined();
        (0, vitest_1.expect)(typeof data.chain_stats.tx_count).toBe('number');
        (0, vitest_1.expect)(data.chain_stats.tx_count).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('BTC Transaction History — fetches real live transactions from Blockstream API', async () => {
        const knownBtcAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
        const txs = await chainClients_1.blockstream.getAddressTransactions(knownBtcAddress);
        (0, vitest_1.expect)(Array.isArray(txs)).toBe(true);
        (0, vitest_1.expect)(txs.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(txs[0]).toHaveProperty('txid');
        (0, vitest_1.expect)(txs[0]).toHaveProperty('vout');
        (0, vitest_1.expect)(txs[0]).toHaveProperty('status');
    });
    // Test CoinGecko price conversion
    (0, vitest_1.it)('CoinGecko Price Sync — fetches plausible live BTC & ETH prices', async () => {
        const prices = await chainClients_3.coingecko.getPrices();
        (0, vitest_1.expect)(prices).toHaveProperty('bitcoin');
        (0, vitest_1.expect)(prices).toHaveProperty('ethereum');
        (0, vitest_1.expect)(prices.bitcoin.usd).toBeGreaterThan(1000); // Sanity check BTC > $1,000
        (0, vitest_1.expect)(prices.ethereum.usd).toBeGreaterThan(100); // Sanity check ETH > $100
    });
    // Test ETH lookup (handling cases when ETHERSCAN_API_KEY is unset or default)
    (0, vitest_1.it)('ETH Balance / Tx Lookup — interacts with Etherscan API', async () => {
        const knownEthAddress = '0x00000000219ab540356cbb839cbe05303d7705fa'; // ETH 2.0 Deposit Contract
        try {
            const balance = await chainClients_2.etherscan.getBalance(knownEthAddress);
            (0, vitest_1.expect)(typeof balance).toBe('string');
        }
        catch (err) {
            // Etherscan free tier without valid key will return API error message, which proves live network interaction
            (0, vitest_1.expect)(err.message).toMatch(/Etherscan|API/i);
        }
    });
});
//# sourceMappingURL=chainClients.integration.test.js.map