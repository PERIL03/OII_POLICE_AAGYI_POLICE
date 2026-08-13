"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.casesRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const shared_1 = require("@cryptotrace/shared");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'cases-routes' });
exports.casesRouter = (0, express_1.Router)();
exports.casesRouter.use(auth_1.requireAuth);
/**
 * GET /api/cases
 * List all cases.
 */
exports.casesRouter.get('/', async (req, res) => {
    try {
        const cases = await prisma_1.prisma.case.findMany({
            orderBy: { updatedAt: 'desc' },
            include: {
                createdBy: { select: { id: true, name: true, badgeId: true } },
                _count: {
                    select: {
                        evidence: true,
                        notes: true,
                        watchlistEntries: true,
                    },
                },
            },
        });
        res.json({ cases });
    }
    catch (err) {
        logger.error({ err }, 'Failed to list cases');
        res.status(500).json({ error: 'Failed to list cases' });
    }
});
/**
 * POST /api/cases
 * Create a new investigation case.
 */
exports.casesRouter.post('/', async (req, res) => {
    try {
        const parsed = shared_1.createCaseSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
            return;
        }
        const { title, firNumber } = parsed.data;
        const newCase = await prisma_1.prisma.case.create({
            data: {
                title,
                firNumber,
                createdByUserId: req.user.id,
            },
            include: {
                createdBy: { select: { id: true, name: true, badgeId: true } },
            },
        });
        // Write AuditLog
        await prisma_1.prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'CASE_CREATED',
                entityType: 'Case',
                entityId: newCase.id,
                metadata: { title, firNumber },
            },
        });
        res.status(201).json({ case: newCase });
    }
    catch (err) {
        logger.error({ err }, 'Failed to create case');
        res.status(500).json({ error: 'Failed to create case' });
    }
});
/**
 * GET /api/cases/:id
 * Get details of a specific case, including notes & evidence.
 */
exports.casesRouter.get('/:id', async (req, res) => {
    try {
        const caseId = req.params.id;
        const caseData = await prisma_1.prisma.case.findUnique({
            where: { id: caseId },
            include: {
                createdBy: { select: { id: true, name: true, badgeId: true } },
                notes: {
                    orderBy: { createdAt: 'desc' },
                    include: { author: { select: { id: true, name: true, badgeId: true } } },
                },
                evidence: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        wallet: true,
                        transaction: true,
                        addedBy: { select: { id: true, name: true, badgeId: true } },
                    },
                },
                watchlistEntries: {
                    include: { wallet: true },
                },
            },
        });
        if (!caseData) {
            res.status(404).json({ error: 'Case not found' });
            return;
        }
        res.json({ case: caseData });
    }
    catch (err) {
        logger.error({ err }, 'Failed to fetch case');
        res.status(500).json({ error: 'Failed to fetch case' });
    }
});
/**
 * POST /api/cases/:id/notes
 * Add an investigator note to a case.
 */
exports.casesRouter.post('/:id/notes', async (req, res) => {
    try {
        const caseId = req.params.id;
        const parsed = shared_1.addCaseNoteSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
            return;
        }
        const caseData = await prisma_1.prisma.case.findUnique({ where: { id: caseId } });
        if (!caseData) {
            res.status(404).json({ error: 'Case not found' });
            return;
        }
        const note = await prisma_1.prisma.caseNote.create({
            data: {
                caseId,
                authorId: req.user.id,
                body: parsed.data.body,
            },
            include: {
                author: { select: { id: true, name: true, badgeId: true } },
            },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'CASE_NOTE_ADDED',
                entityType: 'Case',
                entityId: caseId,
                metadata: { noteId: note.id },
            },
        });
        res.status(201).json({ note });
    }
    catch (err) {
        logger.error({ err }, 'Failed to add note');
        res.status(500).json({ error: 'Failed to add note' });
    }
});
/**
 * POST /api/cases/:id/evidence
 * Attach evidence (wallet or transaction) to a case.
 */
exports.casesRouter.post('/:id/evidence', async (req, res) => {
    try {
        const caseId = req.params.id;
        const parsed = shared_1.addCaseEvidenceSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
            return;
        }
        const caseData = await prisma_1.prisma.case.findUnique({ where: { id: caseId } });
        if (!caseData) {
            res.status(404).json({ error: 'Case not found' });
            return;
        }
        const evidence = await prisma_1.prisma.caseEvidence.create({
            data: {
                caseId,
                walletId: parsed.data.walletId || null,
                transactionId: parsed.data.transactionId || null,
                addedByUserId: req.user.id,
            },
            include: {
                wallet: true,
                transaction: true,
                addedBy: { select: { id: true, name: true, badgeId: true } },
            },
        });
        await prisma_1.prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'CASE_EVIDENCE_ADDED',
                entityType: 'Case',
                entityId: caseId,
                metadata: { evidenceId: evidence.id, walletId: parsed.data.walletId, transactionId: parsed.data.transactionId },
            },
        });
        res.status(201).json({ evidence });
    }
    catch (err) {
        logger.error({ err }, 'Failed to add evidence');
        res.status(500).json({ error: 'Failed to add evidence' });
    }
});
/**
 * DELETE /api/cases/:id
 * Delete a case (Admin only per contract tests check).
 */
exports.casesRouter.delete('/:id', (0, auth_1.requireRole)('ADMIN'), async (req, res) => {
    try {
        const caseId = req.params.id;
        const caseData = await prisma_1.prisma.case.findUnique({ where: { id: caseId } });
        if (!caseData) {
            res.status(404).json({ error: 'Case not found' });
            return;
        }
        await prisma_1.prisma.case.delete({ where: { id: caseId } });
        await prisma_1.prisma.auditLog.create({
            data: {
                userId: req.user.id,
                action: 'CASE_DELETED',
                entityType: 'Case',
                entityId: caseId,
                metadata: { title: caseData.title },
            },
        });
        res.json({ message: 'Case deleted successfully' });
    }
    catch (err) {
        logger.error({ err }, 'Failed to delete case');
        res.status(500).json({ error: 'Failed to delete case' });
    }
});
//# sourceMappingURL=cases.js.map