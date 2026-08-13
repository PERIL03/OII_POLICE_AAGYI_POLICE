import { z } from 'zod';
/**
 * BTC Address Validator
 * Supports:
 * - Legacy (P2PKH): starts with '1', 25–34 chars
 * - P2SH: starts with '3', 25–34 chars
 * - Bech32 (P2WPKH/P2WSH): starts with 'bc1', 42–62 chars
 * - Bech32m (P2TR Taproot): starts with 'bc1p', 62 chars
 */
export declare const btcAddressSchema: z.ZodEffects<z.ZodString, string, string>;
/**
 * ETH Address Validator
 * Accepts 0x-prefixed 40-hex-char addresses.
 * Does NOT enforce EIP-55 checksum here — just format validation.
 */
export declare const ethAddressSchema: z.ZodEffects<z.ZodString, string, string>;
/**
 * Chain-aware address schema — validates the address format
 * against the specified chain.
 */
export declare const chainAddressSchema: z.ZodDiscriminatedUnion<"chain", [z.ZodObject<{
    chain: z.ZodLiteral<"BTC">;
    address: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    address: string;
    chain: "BTC";
}, {
    address: string;
    chain: "BTC";
}>, z.ZodObject<{
    chain: z.ZodLiteral<"ETH">;
    address: z.ZodEffects<z.ZodString, string, string>;
}, "strip", z.ZodTypeAny, {
    address: string;
    chain: "ETH";
}, {
    address: string;
    chain: "ETH";
}>]>;
export type ChainAddress = z.infer<typeof chainAddressSchema>;
//# sourceMappingURL=address.d.ts.map