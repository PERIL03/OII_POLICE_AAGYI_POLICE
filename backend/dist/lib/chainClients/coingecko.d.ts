/**
 * CoinGecko API client — BTC/ETH price data.
 *
 * Cached in Redis, refreshed every ~5 minutes.
 * Used to populate `amountUsdAtTime` on Transaction records.
 */
export interface CryptoPrice {
    bitcoin: {
        usd: number;
        inr: number;
    };
    ethereum: {
        usd: number;
        inr: number;
    };
}
/**
 * Get current BTC and ETH prices in USD and INR.
 */
export declare function getPrices(): Promise<CryptoPrice>;
/**
 * Convert a crypto amount to USD at current price.
 */
export declare function toUsd(chain: 'BTC' | 'ETH', amount: number): Promise<number>;
//# sourceMappingURL=coingecko.d.ts.map