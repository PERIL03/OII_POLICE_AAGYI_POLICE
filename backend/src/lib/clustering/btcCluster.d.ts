/**
 * BTC Common-Input-Ownership Clustering Heuristic
 *
 * Implements the standard Bitcoin heuristic:
 * Addresses co-spent as inputs (vin) in the same transaction belong
 * to the same entity / wallet cluster.
 */
export interface BtcClusterResult {
    targetAddress: string;
    clusterAddresses: string[];
    totalClusterTxCount: number;
    confidence: 'HIGH' | 'MEDIUM';
}
export declare function computeBtcCluster(address: string): Promise<BtcClusterResult>;
//# sourceMappingURL=btcCluster.d.ts.map