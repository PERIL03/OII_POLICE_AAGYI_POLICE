import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { loginRequestSchema, registerRequestSchema } from '@cryptotrace/shared';
import { logger } from '../lib/logger';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-real-secret';
const JWT_EXPIRES_IN = '24h';
const SALT_ROUNDS = 10;

/**
 * POST /auth/register
 * Create a new user account.
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const parsed = registerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { name, email, password, role, badgeId } = parsed.data;

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, badgeId },
      select: { id: true, name: true, email: true, role: true, badgeId: true, createdAt: true },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: user.id,
        metadata: { email: user.email, role: user.role },
      },
    });

    // Issue JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    logger.info({ userId: user.id, email: user.email }, 'User registered');

    res.status(201).json({ user, token });
  } catch (err) {
    logger.error({ err }, 'Registration failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /auth/login
 * Authenticate and receive a JWT.
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { email, password } = parsed.data;

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Issue JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        entityType: 'User',
        entityId: user.id,
        metadata: { email: user.email },
      },
    });

    logger.info({ userId: user.id, email: user.email }, 'User logged in');

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        badgeId: user.badgeId,
      },
      token,
    });
  } catch (err) {
    logger.error({ err }, 'Login failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /auth/me
 * Get current user profile (requires auth).
 */
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };

    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { id: true, name: true, email: true, role: true, badgeId: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    logger.error({ err }, 'Get profile failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});
