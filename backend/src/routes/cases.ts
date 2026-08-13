import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest, requireRole } from '../middleware/auth';
import { createCaseSchema, addCaseNoteSchema, addCaseEvidenceSchema } from '@cryptotrace/shared';
import pino from 'pino';

const logger = pino({ name: 'cases-routes' });

export const casesRouter = Router();

casesRouter.use(requireAuth as any);

/**
 * GET /api/cases
 * List all cases.
 */
casesRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const cases = await prisma.case.findMany({
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
  } catch (err) {
    logger.error({ err }, 'Failed to list cases');
    res.status(500).json({ error: 'Failed to list cases' });
  }
});

/**
 * POST /api/cases
 * Create a new investigation case.
 */
casesRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = createCaseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { title, firNumber } = parsed.data;

    const newCase = await prisma.case.create({
      data: {
        title,
        firNumber,
        createdByUserId: req.user!.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, badgeId: true } },
      },
    });

    // Write AuditLog
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CASE_CREATED',
        entityType: 'Case',
        entityId: newCase.id,
        metadata: { title, firNumber },
      },
    });

    res.status(201).json({ case: newCase });
  } catch (err) {
    logger.error({ err }, 'Failed to create case');
    res.status(500).json({ error: 'Failed to create case' });
  }
});

/**
 * GET /api/cases/:id
 * Get details of a specific case, including notes & evidence.
 */
casesRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = req.params.id as string;
    const caseData = await prisma.case.findUnique({
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
  } catch (err) {
    logger.error({ err }, 'Failed to fetch case');
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

/**
 * POST /api/cases/:id/notes
 * Add an investigator note to a case.
 */
casesRouter.post('/:id/notes', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = req.params.id as string;
    const parsed = addCaseNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const caseData = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseData) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }

    const note = await prisma.caseNote.create({
      data: {
        caseId,
        authorId: req.user!.id,
        body: parsed.data.body,
      },
      include: {
        author: { select: { id: true, name: true, badgeId: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CASE_NOTE_ADDED',
        entityType: 'Case',
        entityId: caseId,
        metadata: { noteId: note.id },
      },
    });

    res.status(201).json({ note });
  } catch (err) {
    logger.error({ err }, 'Failed to add note');
    res.status(500).json({ error: 'Failed to add note' });
  }
});

/**
 * POST /api/cases/:id/evidence
 * Attach evidence (wallet or transaction) to a case.
 */
casesRouter.post('/:id/evidence', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = req.params.id as string;
    const parsed = addCaseEvidenceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const caseData = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseData) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }

    const evidence = await prisma.caseEvidence.create({
      data: {
        caseId,
        walletId: parsed.data.walletId || null,
        transactionId: parsed.data.transactionId || null,
        addedByUserId: req.user!.id,
      },
      include: {
        wallet: true,
        transaction: true,
        addedBy: { select: { id: true, name: true, badgeId: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CASE_EVIDENCE_ADDED',
        entityType: 'Case',
        entityId: caseId,
        metadata: { evidenceId: evidence.id, walletId: parsed.data.walletId, transactionId: parsed.data.transactionId },
      },
    });

    res.status(201).json({ evidence });
  } catch (err) {
    logger.error({ err }, 'Failed to add evidence');
    res.status(500).json({ error: 'Failed to add evidence' });
  }
});

/**
 * DELETE /api/cases/:id
 * Delete a case (Admin only per contract tests check).
 */
casesRouter.delete('/:id', requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = req.params.id as string;
    const caseData = await prisma.case.findUnique({ where: { id: caseId } });
    if (!caseData) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }

    await prisma.case.delete({ where: { id: caseId } });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'CASE_DELETED',
        entityType: 'Case',
        entityId: caseId,
        metadata: { title: caseData.title },
      },
    });

    res.json({ message: 'Case deleted successfully' });
  } catch (err) {
    logger.error({ err }, 'Failed to delete case');
    res.status(500).json({ error: 'Failed to delete case' });
  }
});
