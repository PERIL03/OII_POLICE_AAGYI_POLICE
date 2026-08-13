import { z } from 'zod';

/**
 * BTC Address Validator
 * Supports:
 * - Legacy (P2PKH): starts with '1', 25–34 chars
 * - P2SH: starts with '3', 25–34 chars
 * - Bech32 (P2WPKH/P2WSH): starts with 'bc1', 42–62 chars
 * - Bech32m (P2TR Taproot): starts with 'bc1p', 62 chars
 */
export const btcAddressSchema = z
  .string()
  .trim()
  .refine(
    (addr) => {
      // Legacy P2PKH
      if (/^1[a-km-zA-HJ-NP-Z1-9]{24,33}$/.test(addr)) return true;
      // P2SH
      if (/^3[a-km-zA-HJ-NP-Z1-9]{24,33}$/.test(addr)) return true;
      // Bech32 / Bech32m
      if (/^bc1[a-zA-HJ-NP-Z0-9]{25,59}$/.test(addr)) return true;
      return false;
    },
    { message: 'Invalid BTC address format' }
  );

/**
 * ETH Address Validator
 * Accepts 0x-prefixed 40-hex-char addresses.
 * Does NOT enforce EIP-55 checksum here — just format validation.
 */
export const ethAddressSchema = z
  .string()
  .trim()
  .refine(
    (addr) => /^0x[0-9a-fA-F]{40}$/.test(addr),
    { message: 'Invalid ETH address format' }
  );

/**
 * Chain-aware address schema — validates the address format
 * against the specified chain.
 */
export const chainAddressSchema = z.discriminatedUnion('chain', [
  z.object({
    chain: z.literal('BTC'),
    address: btcAddressSchema,
  }),
  z.object({
    chain: z.literal('ETH'),
    address: ethAddressSchema,
  }),
]);

export type ChainAddress = z.infer<typeof chainAddressSchema>;
