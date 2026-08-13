/**
 * Blockstream Esplora API client — BTC address/transaction data.
 *
 * All calls go through Redis cache first (AGENTS.md ground rule 4).
 * Base URL: https://blockstream.info/api
 *
 * Endpoints used:
 *   GET /address/:address           → address summary (balance, tx count)
 *   GET /address/:address/txs       → transaction history (paginated)
 *   GET /tx/:txid                   → single transaction details
 */
export interface BlockstreamAddress {
    address: string;
    chain_stats: {
        funded_txo_count: number;
        funded_txo_sum: number;
        spent_txo_count: number;
        spent_txo_sum: number;
        tx_count: number;
    };
    mempool_stats: {
        funded_txo_count: number;
        funded_txo_sum: number;
        spent_txo_count: number;
        spent_txo_sum: number;
        tx_count: number;
    };
}
export interface BlockstreamTx {
    txid: string;
    version: number;
    locktime: number;
    vin: Array<{
        txid: string;
        vout: number;
        prevout: {
            scriptpubkey: string;
            scriptpubkey_asm: string;
            scriptpubkey_type: string;
            scriptpubkey_address?: string;
            value: number;
        } | null;
        scriptsig: string;
        sequence: number;
        is_coinbase: boolean;
    }>;
    vout: Array<{
        scriptpubkey: string;
        scriptpubkey_asm: string;
        scriptpubkey_type: string;
        scriptpubkey_address?: string;
        value: number;
    }>;
    size: number;
    weight: number;
    fee: number;
    status: {
        confirmed: boolean;
        block_height?: number;
        block_hash?: string;
        block_time?: number;
    };
}
export interface BlockstreamUtxo {
    txid: string;
    vout: number;
    status: {
        confirmed: boolean;
        block_height?: number;
        block_hash?: string;
        block_time?: number;
    };
    value: number;
}
/**
 * Get address summary (balance, tx counts).
 */
export declare function getAddress(address: string): Promise<BlockstreamAddress>;
/**
 * Get transaction history for an address.
 * Returns the 25 most recent confirmed transactions (Blockstream's default page size).
 * Pass `lastSeenTxid` for pagination.
 */
export declare function getAddressTransactions(address: string, lastSeenTxid?: string): Promise<BlockstreamTx[]>;
/**
 * Get a single transaction by txid.
 */
export declare function getTransaction(txid: string): Promise<BlockstreamTx>;
/**
 * Get UTXOs for an address.
 */
export declare function getAddressUtxos(address: string): Promise<BlockstreamUtxo[]>;
/**
 * Compute balance in BTC from satoshis using address stats.
 */
export declare function computeBalanceBtc(addr: BlockstreamAddress): number;
//# sourceMappingURL=blockstream.d.ts.map