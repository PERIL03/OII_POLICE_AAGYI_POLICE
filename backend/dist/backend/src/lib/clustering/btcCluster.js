"use strict";
/**
 * BTC Common-Input-Ownership Clustering Heuristic
 *
 * Implements the standard Bitcoin heuristic:
 * Addresses co-spent as inputs (vin) in the same transaction belong
 * to the same entity / wallet cluster.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeBtcCluster = computeBtcCluster;
const blockstream = __importStar(require("../chainClients/blockstream"));
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'btc-clustering' });
async function computeBtcCluster(address) {
    logger.info({ address }, 'Computing BTC common-input-ownership cluster...');
    const cluster = new Set();
    cluster.add(address.toLowerCase());
    try {
        const txs = await blockstream.getAddressTransactions(address);
        for (const tx of txs) {
            // Check if targetAddress is among inputs
            const inputAddresses = tx.vin
                .map((vin) => vin.prevout?.scriptpubkey_address)
                .filter((addr) => !!addr);
            const targetIsInput = inputAddresses.some((addr) => addr.toLowerCase() === address.toLowerCase());
            // If target is an input and there are multiple inputs, all input addresses belong to the same cluster!
            if (targetIsInput && inputAddresses.length > 1) {
                for (const inputAddr of inputAddresses) {
                    cluster.add(inputAddr.toLowerCase());
                }
            }
        }
    }
    catch (err) {
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
//# sourceMappingURL=btcCluster.js.map