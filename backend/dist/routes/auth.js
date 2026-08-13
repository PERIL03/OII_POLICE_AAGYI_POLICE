"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../lib/prisma");
const shared_1 = require("@cryptotrace/shared");
const index_1 = require("../index");
exports.authRouter = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-to-a-real-secret';
const JWT_EXPIRES_IN = '24h';
const SALT_ROUNDS = 10;
/**
 * POST /auth/register
 * Create a new user account.
 */
exports.authRouter.post('/register', async (req, res) => {
    try {
        const parsed = shared_1.registerRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
            return;
        }
        const { name, email, password, role, badgeId } = parsed.data;
        // Check if user already exists
        const existing = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existing) {
            res.status(409).json({ error: 'Email already registered' });
            return;
        }
        // Hash password
        const passwordHash = await bcrypt_1.default.hash(password, SALT_ROUNDS);
        // Create user
        const user = await prisma_1.prisma.user.create({
            data: { name, email, passwordHash, role, badgeId },
            select: { id: true, name: true, email: true, role: true, badgeId: true, createdAt: true },
        });
        // Audit log
        await prisma_1.prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'USER_REGISTERED',
                entityType: 'User',
                entityId: user.id,
                metadata: { email: user.email, role: user.role },
            },
        });
        // Issue JWT
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        index_1.logger.info({ userId: user.id, email: user.email }, 'User registered');
        res.status(201).json({ user, token });
    }
    catch (err) {
        index_1.logger.error({ err }, 'Registration failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * POST /auth/login
 * Authenticate and receive a JWT.
 */
exports.authRouter.post('/login', async (req, res) => {
    try {
        const parsed = shared_1.loginRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
            return;
        }
        const { email, password } = parsed.data;
        // Find user
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        // Verify password
        const isValid = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isValid) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        // Issue JWT
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        // Audit log
        await prisma_1.prisma.auditLog.create({
            data: {
                userId: user.id,
                action: 'USER_LOGIN',
                entityType: 'User',
                entityId: user.id,
                metadata: { email: user.email },
            },
        });
        index_1.logger.info({ userId: user.id, email: user.email }, 'User logged in');
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
    }
    catch (err) {
        index_1.logger.error({ err }, 'Login failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * GET /auth/me
 * Get current user profile (requires auth).
 */
exports.authRouter.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }
        const token = authHeader.split(' ')[1];
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: payload.id },
            select: { id: true, name: true, email: true, role: true, badgeId: true, createdAt: true },
        });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({ user });
    }
    catch (err) {
        if (err instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
        index_1.logger.error({ err }, 'Get profile failed');
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=auth.js.map