"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const JWT_SECRET = 'test-secret';
(0, vitest_1.describe)('Auth - JWT', () => {
    (0, vitest_1.it)('should issue and verify a valid JWT', () => {
        const payload = { id: 'user-123', email: 'test@example.com', role: 'INVESTIGATOR' };
        const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '1h' });
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        (0, vitest_1.expect)(decoded.id).toBe('user-123');
        (0, vitest_1.expect)(decoded.email).toBe('test@example.com');
        (0, vitest_1.expect)(decoded.role).toBe('INVESTIGATOR');
    });
    (0, vitest_1.it)('should reject a token signed with wrong secret', () => {
        const token = jsonwebtoken_1.default.sign({ id: 'user-123' }, 'wrong-secret');
        (0, vitest_1.expect)(() => jsonwebtoken_1.default.verify(token, JWT_SECRET)).toThrow(jsonwebtoken_1.default.JsonWebTokenError);
    });
    (0, vitest_1.it)('should reject an expired token', () => {
        const token = jsonwebtoken_1.default.sign({ id: 'user-123' }, JWT_SECRET, { expiresIn: '0s' });
        // Wait a tick for expiration
        (0, vitest_1.expect)(() => jsonwebtoken_1.default.verify(token, JWT_SECRET)).toThrow(jsonwebtoken_1.default.TokenExpiredError);
    });
    (0, vitest_1.it)('should include all required fields in payload', () => {
        const payload = { id: 'user-456', email: 'analyst@police.gov', role: 'ANALYST' };
        const token = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '24h' });
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        (0, vitest_1.expect)(decoded).toHaveProperty('id', 'user-456');
        (0, vitest_1.expect)(decoded).toHaveProperty('email', 'analyst@police.gov');
        (0, vitest_1.expect)(decoded).toHaveProperty('role', 'ANALYST');
        (0, vitest_1.expect)(decoded).toHaveProperty('exp'); // expiration timestamp
        (0, vitest_1.expect)(decoded).toHaveProperty('iat'); // issued-at timestamp
    });
});
(0, vitest_1.describe)('Auth - Password Hashing', () => {
    (0, vitest_1.it)('should hash and verify a password correctly', async () => {
        const password = 'SecurePassword123!';
        const hash = await bcrypt_1.default.hash(password, 10);
        (0, vitest_1.expect)(hash).not.toBe(password);
        (0, vitest_1.expect)(await bcrypt_1.default.compare(password, hash)).toBe(true);
    });
    (0, vitest_1.it)('should reject wrong password', async () => {
        const hash = await bcrypt_1.default.hash('correct-password', 10);
        (0, vitest_1.expect)(await bcrypt_1.default.compare('wrong-password', hash)).toBe(false);
    });
    (0, vitest_1.it)('should produce different hashes for same password (salted)', async () => {
        const password = 'SamePassword123';
        const hash1 = await bcrypt_1.default.hash(password, 10);
        const hash2 = await bcrypt_1.default.hash(password, 10);
        (0, vitest_1.expect)(hash1).not.toBe(hash2);
        // But both should verify
        (0, vitest_1.expect)(await bcrypt_1.default.compare(password, hash1)).toBe(true);
        (0, vitest_1.expect)(await bcrypt_1.default.compare(password, hash2)).toBe(true);
    });
});
(0, vitest_1.describe)('Auth - Role Guard Logic', () => {
    const roles = ['INVESTIGATOR', 'ANALYST', 'ADMIN'];
    (0, vitest_1.it)('ADMIN should be recognized as a valid role', () => {
        (0, vitest_1.expect)(roles.includes('ADMIN')).toBe(true);
    });
    (0, vitest_1.it)('INVESTIGATOR should not match ADMIN-only check', () => {
        const allowedRoles = ['ADMIN'];
        (0, vitest_1.expect)(allowedRoles.includes('INVESTIGATOR')).toBe(false);
    });
    (0, vitest_1.it)('ANALYST should match ANALYST or ADMIN check', () => {
        const allowedRoles = ['ANALYST', 'ADMIN'];
        (0, vitest_1.expect)(allowedRoles.includes('ANALYST')).toBe(true);
    });
    (0, vitest_1.it)('should reject unknown roles', () => {
        const allowedRoles = ['INVESTIGATOR', 'ANALYST', 'ADMIN'];
        (0, vitest_1.expect)(allowedRoles.includes('SUPERADMIN')).toBe(false);
    });
});
//# sourceMappingURL=auth.test.js.map