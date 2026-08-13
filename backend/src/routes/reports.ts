import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import pino from 'pino';

const logger = pino({ name: 'reports-routes' });

export const reportsRouter = Router();

reportsRouter.use(requireAuth as any);

/**
 * GET /api/reports/case/:id/pdf
 * Export a PDF investigation report for a given case.
 */
reportsRouter.get('/case/:id/pdf', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const caseId = req.params.id as string;
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        createdBy: true,
        notes: {
          orderBy: { createdAt: 'asc' },
          include: { author: true },
        },
        evidence: {
          include: { wallet: true, transaction: true, addedBy: true },
        },
      },
    });

    if (!caseData) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }

    // Create PDF document using pdf-lib
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4 size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const { width, height } = page.getSize();
    let y = height - 50;

    // Header Banner
    page.drawRectangle({
      x: 30,
      y: y - 40,
      width: width - 60,
      height: 50,
      color: rgb(0.1, 0.15, 0.3),
    });

    page.drawText('CHANDIGARH POLICE — FINANCIAL INTELLIGENCE REPORT', {
      x: 45,
      y: y - 22,
      size: 13,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    page.drawText('CONFIDENTIAL / INVESTIGATIVE WORKING AID', {
      x: 45,
      y: y - 35,
      size: 9,
      font,
      color: rgb(0.8, 0.8, 0.8),
    });

    y -= 70;

    // Metadata Table
    page.drawText(`Case Title: ${caseData.title}`, { x: 30, y, size: 12, font: fontBold });
    y -= 18;
    page.drawText(`FIR Number: ${caseData.firNumber || 'N/A'}`, { x: 30, y, size: 10, font });
    y -= 15;
    page.drawText(`Status: ${caseData.status}`, { x: 30, y, size: 10, font });
    y -= 15;
    page.drawText(`Investigator: ${caseData.createdBy.name} (${caseData.createdBy.badgeId || 'No Badge'})`, { x: 30, y, size: 10, font });
    y -= 15;
    page.drawText(`Exported At: ${new Date().toISOString()}`, { x: 30, y, size: 10, font });
    y -= 25;

    // Divider
    page.drawLine({
      start: { x: 30, y },
      end: { x: width - 30, y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });

    y -= 20;

    // Evidence Section
    page.drawText(`Attached Evidence (${caseData.evidence.length})`, { x: 30, y, size: 12, font: fontBold });
    y -= 18;

    if (caseData.evidence.length === 0) {
      page.drawText('No evidence attached.', { x: 40, y, size: 10, font });
      y -= 15;
    } else {
      for (const item of caseData.evidence) {
        if (y < 80) {
          page = pdfDoc.addPage([595.28, 841.89]);
          y = height - 50;
        }

        if (item.wallet) {
          page.drawText(`• Wallet [${item.wallet.chain}]: ${item.wallet.address}`, { x: 40, y, size: 10, font: fontBold });
          y -= 14;
          page.drawText(`  Risk Score: ${item.wallet.currentRiskScore}/100 | Balance: ${item.wallet.balance}`, { x: 50, y, size: 9, font });
          y -= 14;
        } else if (item.transaction) {
          page.drawText(`• Transaction [${item.transaction.chain}]: ${item.transaction.txHash}`, { x: 40, y, size: 10, font: fontBold });
          y -= 14;
          page.drawText(`  Amount: ${item.transaction.amount} | Status: ${item.transaction.status}`, { x: 50, y, size: 9, font });
          y -= 14;
        }
      }
    }

    y -= 15;

    // Divider
    page.drawLine({
      start: { x: 30, y },
      end: { x: width - 30, y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });

    y -= 20;

    // Case Notes Section
    page.drawText(`Investigator Notes (${caseData.notes.length})`, { x: 30, y, size: 12, font: fontBold });
    y -= 18;

    if (caseData.notes.length === 0) {
      page.drawText('No notes added.', { x: 40, y, size: 10, font });
    } else {
      for (const note of caseData.notes) {
        if (y < 80) {
          page = pdfDoc.addPage([595.28, 841.89]);
          y = height - 50;
        }

        const dateStr = note.createdAt.toISOString().split('T')[0];
        page.drawText(`[${dateStr}] ${note.author.name}:`, { x: 40, y, size: 10, font: fontBold });
        y -= 14;

        // Simple text wrap for note body
        const lines = wrapText(note.body, 70);
        for (const line of lines) {
          page.drawText(line, { x: 50, y, size: 9, font });
          y -= 12;
        }
        y -= 6;
      }
    }

    // Write AuditLog
    await prisma.auditLog.create({
      data: {
        userId: req.user!.id,
        action: 'REPORT_EXPORTED',
        entityType: 'Case',
        entityId: caseId,
        metadata: { title: caseData.title, firNumber: caseData.firNumber },
      },
    });

    const pdfBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Case-Report-${caseId.slice(0, 8)}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    logger.error({ err }, 'Failed to export PDF report');
    res.status(500).json({ error: 'Failed to export report' });
  }
});

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}
