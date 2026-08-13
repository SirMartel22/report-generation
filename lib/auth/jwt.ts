import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-reportapp-jwt-token-key-2026';

export interface UserTokenPayload {
  userId: string;
  email: string;
  name: string;
  tenantId: string;
  tenantSlug: string;
  role: 'ADMIN' | 'SUBUNIT_HEAD' | 'SYSTEM_ADMIN';
  subunit?: string | null;
}

export function signToken(payload: UserTokenPayload, expiresIn: SignOptions['expiresIn'] = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string): UserTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserTokenPayload;
    return decoded;
  } catch {
    return null;
  }
}
