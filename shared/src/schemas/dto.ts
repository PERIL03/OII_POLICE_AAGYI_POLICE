import { z } from 'zod';

// ─── Auth DTOs ──────────────────────────────────────────────────────

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['INVESTIGATOR', 'ANALYST', 'ADMIN']),
  badgeId: z.string().optional(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

// ─── Wallet DTOs ────────────────────────────────────────────────────

export const walletLookupRequestSchema = z.object({
  chain: z.enum(['BTC', 'ETH']),
  address: z.string().min(1),
});

export type WalletLookupRequest = z.infer<typeof walletLookupRequestSchema>;

// ─── Case DTOs ──────────────────────────────────────────────────────

export const createCaseSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  firNumber: z.string().optional(),
});

export const addCaseNoteSchema = z.object({
  body: z.string().min(1, 'Note body is required'),
});

export const addCaseEvidenceSchema = z.object({
  walletId: z.string().uuid().optional(),
  transactionId: z.string().uuid().optional(),
}).refine(
  (data) => data.walletId || data.transactionId,
  { message: 'At least one of walletId or transactionId is required' }
);

export type CreateCaseRequest = z.infer<typeof createCaseSchema>;
export type AddCaseNoteRequest = z.infer<typeof addCaseNoteSchema>;
export type AddCaseEvidenceRequest = z.infer<typeof addCaseEvidenceSchema>;

// ─── Watchlist DTOs ─────────────────────────────────────────────────

export const addWatchlistEntrySchema = z.object({
  chain: z.enum(['BTC', 'ETH']),
  address: z.string().min(1),
  reason: z.string().optional(),
  caseId: z.string().uuid().optional(),
});

export type AddWatchlistEntryRequest = z.infer<typeof addWatchlistEntrySchema>;

// ─── Alert DTOs ─────────────────────────────────────────────────────

export const acknowledgeAlertSchema = z.object({
  alertId: z.string().uuid(),
});

export type AcknowledgeAlertRequest = z.infer<typeof acknowledgeAlertSchema>;
