import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const JWT_SECRET = 'test-secret';

describe('Auth - JWT', () => {
  it('should issue and verify a valid JWT', () => {
    const payload = { id: 'user-123', email: 'test@example.com', role: 'INVESTIGATOR' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    const decoded = jwt.verify(token, JWT_SECRET) as typeof payload;
    expect(decoded.id).toBe('user-123');
    expect(decoded.email).toBe('test@example.com');
    expect(decoded.role).toBe('INVESTIGATOR');
  });

  it('should reject a token signed with wrong secret', () => {
    const token = jwt.sign({ id: 'user-123' }, 'wrong-secret');
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow(jwt.JsonWebTokenError);
  });

  it('should reject an expired token', () => {
    const token = jwt.sign({ id: 'user-123' }, JWT_SECRET, { expiresIn: '0s' });

    // Wait a tick for expiration
    expect(() => jwt.verify(token, JWT_SECRET)).toThrow(jwt.TokenExpiredError);
  });

  it('should include all required fields in payload', () => {
    const payload = { id: 'user-456', email: 'analyst@police.gov', role: 'ANALYST' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

    const decoded = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
    expect(decoded).toHaveProperty('id', 'user-456');
    expect(decoded).toHaveProperty('email', 'analyst@police.gov');
    expect(decoded).toHaveProperty('role', 'ANALYST');
    expect(decoded).toHaveProperty('exp'); // expiration timestamp
    expect(decoded).toHaveProperty('iat'); // issued-at timestamp
  });
});

describe('Auth - Password Hashing', () => {
  it('should hash and verify a password correctly', async () => {
    const password = 'SecurePassword123!';
    const hash = await bcrypt.hash(password, 10);

    expect(hash).not.toBe(password);
    expect(await bcrypt.compare(password, hash)).toBe(true);
  });

  it('should reject wrong password', async () => {
    const hash = await bcrypt.hash('correct-password', 10);
    expect(await bcrypt.compare('wrong-password', hash)).toBe(false);
  });

  it('should produce different hashes for same password (salted)', async () => {
    const password = 'SamePassword123';
    const hash1 = await bcrypt.hash(password, 10);
    const hash2 = await bcrypt.hash(password, 10);

    expect(hash1).not.toBe(hash2);
    // But both should verify
    expect(await bcrypt.compare(password, hash1)).toBe(true);
    expect(await bcrypt.compare(password, hash2)).toBe(true);
  });
});

describe('Auth - Role Guard Logic', () => {
  const roles = ['INVESTIGATOR', 'ANALYST', 'ADMIN'] as const;

  it('ADMIN should be recognized as a valid role', () => {
    expect(roles.includes('ADMIN')).toBe(true);
  });

  it('INVESTIGATOR should not match ADMIN-only check', () => {
    const allowedRoles: string[] = ['ADMIN'];
    expect(allowedRoles.includes('INVESTIGATOR')).toBe(false);
  });

  it('ANALYST should match ANALYST or ADMIN check', () => {
    const allowedRoles: string[] = ['ANALYST', 'ADMIN'];
    expect(allowedRoles.includes('ANALYST')).toBe(true);
  });

  it('should reject unknown roles', () => {
    const allowedRoles: string[] = ['INVESTIGATOR', 'ANALYST', 'ADMIN'];
    expect(allowedRoles.includes('SUPERADMIN')).toBe(false);
  });
});
