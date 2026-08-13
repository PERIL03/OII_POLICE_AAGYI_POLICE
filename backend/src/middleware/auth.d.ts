/**
 * Auth middleware — JWT verification and role-based access control.
 */
import { Request, Response, NextFunction } from 'express';
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
export declare function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
/**
 * Middleware factory: Restrict access to specific roles.
 * Must be used AFTER requireAuth.
 */
export declare function requireRole(...roles: Array<'INVESTIGATOR' | 'ANALYST' | 'ADMIN'>): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map