/**
 * Etherscan API client — ETH address/transaction data.
 *
 * All calls go through Redis cache first (AGENTS.md ground rule 4).
 * Base URL: https://api.etherscan.io/api
 *
 * Requires ETHERSCAN_API_KEY environment variable (free tier).
 */
export interface EtherscanTx {
    blockNumber: string;
    timeStamp: string;
    hash: string;
    nonce: string;
    blockHash: string;
    transactionIndex: string;
    from: string;
    to: string;
    value: string;
    gas: string;
    gasPrice: string;
    isError: string;
    txreceipt_status: string;
    input: string;
    contractAddress: string;
    cumulativeGasUsed: string;
    gasUsed: string;
    confirmations: string;
    methodId: string;
    functionName: string;
}
export interface EtherscanInternalTx {
    blockNumber: string;
    timeStamp: string;
    hash: string;
    from: string;
    to: string;
    value: string;
    contractAddress: string;
    input: string;
    type: string;
    gas: string;
    gasUsed: string;
    traceId: string;
    isError: string;
    errCode: string;
}
export interface EtherscanERC20Transfer {
    blockNumber: string;
    timeStamp: string;
    hash: string;
    nonce: string;
    blockHash: string;
    from: string;
    contractAddress: string;
    to: string;
    value: string;
    tokenName: string;
    tokenSymbol: string;
    tokenDecimal: string;
    transactionIndex: string;
    gas: string;
    gasPrice: string;
    gasUsed: string;
    cumulativeGasUsed: string;
    input: string;
    confirmations: string;
}
/**
 * Get ETH balance for an address (in wei).
 */
export declare function getBalance(address: string): Promise<string>;
/**
 * Get normal (external) transactions for an address.
 */
export declare function getTransactions(address: string, startblock?: number, endblock?: number, page?: number, offset?: number): Promise<EtherscanTx[]>;
/**
 * Get internal transactions for an address.
 */
export declare function getInternalTransactions(address: string, startblock?: number, endblock?: number, page?: number, offset?: number): Promise<EtherscanInternalTx[]>;
/**
 * Get ERC-20 token transfers for an address.
 */
export declare function getERC20Transfers(address: string, page?: number, offset?: number): Promise<EtherscanERC20Transfer[]>;
/**
 * Convert wei string to ETH number.
 */
export declare function weiToEth(wei: string): number;
//# sourceMappingURL=etherscan.d.ts.map