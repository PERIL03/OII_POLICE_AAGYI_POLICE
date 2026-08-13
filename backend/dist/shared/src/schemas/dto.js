"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acknowledgeAlertSchema = exports.addWatchlistEntrySchema = exports.addCaseEvidenceSchema = exports.addCaseNoteSchema = exports.createCaseSchema = exports.walletLookupRequestSchema = exports.registerRequestSchema = exports.loginRequestSchema = void 0;
const zod_1 = require("zod");
// ─── Auth DTOs ──────────────────────────────────────────────────────
exports.loginRequestSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
});
exports.registerRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    role: zod_1.z.enum(['INVESTIGATOR', 'ANALYST', 'ADMIN']),
    badgeId: zod_1.z.string().optional(),
});
// ─── Wallet DTOs ────────────────────────────────────────────────────
exports.walletLookupRequestSchema = zod_1.z.object({
    chain: zod_1.z.enum(['BTC', 'ETH']),
    address: zod_1.z.string().min(1),
});
// ─── Case DTOs ──────────────────────────────────────────────────────
exports.createCaseSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    firNumber: zod_1.z.string().optional(),
});
exports.addCaseNoteSchema = zod_1.z.object({
    body: zod_1.z.string().min(1, 'Note body is required'),
});
exports.addCaseEvidenceSchema = zod_1.z.object({
    walletId: zod_1.z.string().uuid().optional(),
    transactionId: zod_1.z.string().uuid().optional(),
}).refine((data) => data.walletId || data.transactionId, { message: 'At least one of walletId or transactionId is required' });
// ─── Watchlist DTOs ─────────────────────────────────────────────────
exports.addWatchlistEntrySchema = zod_1.z.object({
    chain: zod_1.z.enum(['BTC', 'ETH']),
    address: zod_1.z.string().min(1),
    reason: zod_1.z.string().optional(),
    caseId: zod_1.z.string().uuid().optional(),
});
// ─── Alert DTOs ─────────────────────────────────────────────────────
exports.acknowledgeAlertSchema = zod_1.z.object({
    alertId: zod_1.z.string().uuid(),
});
//# sourceMappingURL=dto.js.map