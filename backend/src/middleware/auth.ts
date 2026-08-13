/**
 * Auth middleware — JWT verification and role-based access control.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-real-secret';

/**
 * Extend Express Request to include the authenticated user.
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'INVESTIGATOR' | 'ANALYST' | 'ADMIN';
  };
}

/**
 * Middleware: Verify JWT token from Authorization header.
 * Attaches `req.user` with { id, email, role } on success.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: 'INVESTIGATOR' | 'ANALYST' | 'ADMIN';
    };

    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware factory: Restrict access to specific roles.
 * Must be used AFTER requireAuth.
 */
export function requireRole(...roles: Array<'INVESTIGATOR' | 'ANALYST' | 'ADMIN'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role,
      });
      return;
    }

    next();
  };
}
