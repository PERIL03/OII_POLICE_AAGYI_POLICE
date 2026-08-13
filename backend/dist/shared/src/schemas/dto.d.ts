import { z } from 'zod';
export declare const loginRequestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const registerRequestSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    role: z.ZodEnum<["INVESTIGATOR", "ANALYST", "ADMIN"]>;
    badgeId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    role: "INVESTIGATOR" | "ANALYST" | "ADMIN";
    password: string;
    badgeId?: string | undefined;
}, {
    name: string;
    email: string;
    role: "INVESTIGATOR" | "ANALYST" | "ADMIN";
    password: string;
    badgeId?: string | undefined;
}>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export declare const walletLookupRequestSchema: z.ZodObject<{
    chain: z.ZodEnum<["BTC", "ETH"]>;
    address: z.ZodString;
}, "strip", z.ZodTypeAny, {
    chain: "BTC" | "ETH";
    address: string;
}, {
    chain: "BTC" | "ETH";
    address: string;
}>;
export type WalletLookupRequest = z.infer<typeof walletLookupRequestSchema>;
export declare const createCaseSchema: z.ZodObject<{
    title: z.ZodString;
    firNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    firNumber?: string | undefined;
}, {
    title: string;
    firNumber?: string | undefined;
}>;
export declare const addCaseNoteSchema: z.ZodObject<{
    body: z.ZodString;
}, "strip", z.ZodTypeAny, {
    body: string;
}, {
    body: string;
}>;
export declare const addCaseEvidenceSchema: z.ZodEffects<z.ZodObject<{
    walletId: z.ZodOptional<z.ZodString>;
    transactionId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    walletId?: string | undefined;
    transactionId?: string | undefined;
}, {
    walletId?: string | undefined;
    transactionId?: string | undefined;
}>, {
    walletId?: string | undefined;
    transactionId?: string | undefined;
}, {
    walletId?: string | undefined;
    transactionId?: string | undefined;
}>;
export type CreateCaseRequest = z.infer<typeof createCaseSchema>;
export type AddCaseNoteRequest = z.infer<typeof addCaseNoteSchema>;
export type AddCaseEvidenceRequest = z.infer<typeof addCaseEvidenceSchema>;
export declare const addWatchlistEntrySchema: z.ZodObject<{
    chain: z.ZodEnum<["BTC", "ETH"]>;
    address: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
    caseId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    chain: "BTC" | "ETH";
    address: string;
    caseId?: string | undefined;
    reason?: string | undefined;
}, {
    chain: "BTC" | "ETH";
    address: string;
    caseId?: string | undefined;
    reason?: string | undefined;
}>;
export type AddWatchlistEntryRequest = z.infer<typeof addWatchlistEntrySchema>;
export declare const acknowledgeAlertSchema: z.ZodObject<{
    alertId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    alertId: string;
}, {
    alertId: string;
}>;
export type AcknowledgeAlertRequest = z.infer<typeof acknowledgeAlertSchema>;
//# sourceMappingURL=dto.d.ts.map