/**
 * Exchange Hot Wallet & Public Tagging Database
 *
 * Provides attribution tags for well-known exchange cold/hot wallets,
 * bridges, and high-profile DeFi protocols across BTC and ETH.
 */
export interface ExchangeTag {
    address: string;
    chain: 'BTC' | 'ETH';
    entityName: string;
    category: 'exchange' | 'bridge' | 'defi' | 'miner';
    confidence: 'HIGH' | 'VERIFIED';
}
export declare const KNOWN_EXCHANGE_TAGS: ExchangeTag[];
export declare function getExchangeTag(address: string, chain: 'BTC' | 'ETH'): ExchangeTag | null;
//# sourceMappingURL=exchangeTags.d.ts.map