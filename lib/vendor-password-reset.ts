import { createCipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const VENDOR_PASSWORD_RESET_COLLECTION = 'vendor_password_resets';
export const VENDOR_PASSWORD_RESET_EXPIRATION_MS = 60 * 60 * 1000;
export const VENDOR_PASSWORD_RESET_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const VENDOR_PASSWORD_RESET_RATE_LIMIT_MAX = 3;

export type VendorPasswordResetRecordLike = {
  requestedAt?: Date | string | number | { toDate?: () => Date; seconds?: number } | null;
};

function normalizeSecretSource(): string {
  const candidates = [
    process.env.VENDOR_PASSWORD_RESET_SECRET,
    process.env.FIREBASE_PRIVATE_KEY,
    process.env.FIREBASE_SERVICE_ACCOUNT,
    `${process.env.FIREBASE_PROJECT_ID ?? ''}:${process.env.NEXT_PUBLIC_SITE_URL ?? ''}`,
  ];

  for (const candidate of candidates) {
    const normalized = String(candidate ?? '').trim();
    if (normalized) return normalized;
  }

  return 'explorarg-vendor-password-reset-secret';
}

function getSecretKey(): Buffer {
  return createHash('sha256').update(normalizeSecretSource()).digest();
}

export function normalizeVendorResetEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase();
}

export function createVendorPasswordResetToken() {
  const token = randomBytes(32).toString('base64url');
  return {
    token,
    tokenHash: hashVendorPasswordResetToken(token),
    tokenEncrypted: encryptVendorPasswordResetToken(token),
  };
}

export function hashVendorPasswordResetToken(token: string): string {
  return createHmac('sha256', getSecretKey()).update(String(token ?? '')).digest('hex');
}

export function encryptVendorPasswordResetToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(token ?? ''), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function verifyVendorPasswordResetToken(token: string, storedHash: string): boolean {
  const received = Buffer.from(hashVendorPasswordResetToken(token), 'hex');
  const expected = Buffer.from(String(storedHash ?? ''), 'hex');
  if (received.length !== expected.length || received.length === 0) return false;
  return timingSafeEqual(received, expected);
}

export function getVendorPasswordResetExpiresAt(nowMs = Date.now()): Date {
  return new Date(nowMs + VENDOR_PASSWORD_RESET_EXPIRATION_MS);
}

export function isVendorPasswordResetExpired(expiresAt: Date | string | number | null | undefined, nowMs = Date.now()): boolean {
  const expiresAtMs = toMillis(expiresAt);
  if (!expiresAtMs) return true;
  return expiresAtMs <= nowMs;
}

export function evaluateVendorPasswordResetRateLimit(
  records: VendorPasswordResetRecordLike[],
  nowMs = Date.now()
): {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
  recentCount: number;
} {
  const windowStart = nowMs - VENDOR_PASSWORD_RESET_RATE_LIMIT_WINDOW_MS;
  const recent = records
    .map((item) => toMillis(item.requestedAt))
    .filter((value) => value >= windowStart)
    .sort((a, b) => a - b);

  if (recent.length < VENDOR_PASSWORD_RESET_RATE_LIMIT_MAX) {
    return {
      allowed: true,
      remaining: Math.max(0, VENDOR_PASSWORD_RESET_RATE_LIMIT_MAX - recent.length),
      retryAfterMs: 0,
      recentCount: recent.length,
    };
  }

  const oldestRelevant = recent[0];
  return {
    allowed: false,
    remaining: 0,
    retryAfterMs: Math.max(0, oldestRelevant + VENDOR_PASSWORD_RESET_RATE_LIMIT_WINDOW_MS - nowMs),
    recentCount: recent.length,
  };
}

export function validateVendorPasswordComplexity(password: string): { valid: boolean; errors: string[] } {
  const value = String(password ?? '');
  const errors: string[] = [];

  if (value.length < 8) errors.push('La contraseña debe tener al menos 8 caracteres.');
  if (!/[A-Za-z]/.test(value)) errors.push('La contraseña debe incluir letras.');
  if (!/[0-9]/.test(value)) errors.push('La contraseña debe incluir números.');
  if (!/[^A-Za-z0-9]/.test(value)) errors.push('La contraseña debe incluir un carácter especial.');

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function getVendorPasswordStrengthScore(password: string): number {
  const value = String(password ?? '');
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/[0-9]/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
}

export function buildVendorPasswordResetUrl(params: { baseUrl: string; email: string; token: string }): string {
  const normalizedBase = String(params.baseUrl ?? '').trim().replace(/\/+$/, '');
  const secureBase =
    normalizedBase.startsWith('http://') && process.env.NODE_ENV === 'production'
      ? normalizedBase.replace(/^http:\/\//i, 'https://')
      : normalizedBase;

  const url = new URL('/vendedor/restablecer', secureBase || 'https://example.com');
  url.searchParams.set('email', normalizeVendorResetEmail(params.email));
  url.searchParams.set('token', String(params.token ?? '').trim());
  return url.toString();
}

export function toMillis(value: Date | string | number | { toDate?: () => Date; seconds?: number } | null | undefined): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }
  return 0;
}
