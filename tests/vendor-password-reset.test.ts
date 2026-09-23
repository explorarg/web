import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVendorPasswordResetUrl,
  createVendorPasswordResetToken,
  evaluateVendorPasswordResetRateLimit,
  isVendorPasswordResetExpired,
  validateVendorPasswordComplexity,
  verifyVendorPasswordResetToken,
} from '../lib/vendor-password-reset';

test('valida complejidad correcta de contraseña', () => {
  const valid = validateVendorPasswordComplexity('Clave#2026');
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, []);

  const invalid = validateVendorPasswordComplexity('clave');
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length >= 2);
});

test('genera token verificable y protegido', () => {
  const token = createVendorPasswordResetToken();
  assert.ok(token.token.length > 20);
  assert.notEqual(token.tokenEncrypted.includes(token.token), true);
  assert.equal(verifyVendorPasswordResetToken(token.token, token.tokenHash), true);
  assert.equal(verifyVendorPasswordResetToken(`${token.token}-otro`, token.tokenHash), false);
});

test('aplica rate limit de 3 solicitudes cada 15 minutos', () => {
  const now = new Date('2026-07-28T12:00:00.000Z').getTime();
  const first = now - 2 * 60 * 1000;
  const second = now - 4 * 60 * 1000;
  const third = now - 10 * 60 * 1000;
  const recent = [{ requestedAt: first }, { requestedAt: second }, { requestedAt: third }];

  const blocked = evaluateVendorPasswordResetRateLimit(recent, now);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterMs > 0);

  const allowed = evaluateVendorPasswordResetRateLimit([{ requestedAt: first }, { requestedAt: second }], now);
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.remaining, 1);
});

test('detecta expiración del token', () => {
  const now = new Date('2026-07-28T12:00:00.000Z').getTime();
  assert.equal(isVendorPasswordResetExpired(new Date(now - 1000), now), true);
  assert.equal(isVendorPasswordResetExpired(new Date(now + 10 * 60 * 1000), now), false);
});

test('construye enlace seguro de recuperación', () => {
  const url = buildVendorPasswordResetUrl({
    baseUrl: 'https://explorarg.vercel.app',
    email: 'Vendor@Explorarg.ar',
    token: 'abc123token',
  });

  assert.ok(url.startsWith('https://explorarg.vercel.app/vendedor/restablecer?'));
  assert.ok(url.includes('email=vendor%40explorarg.ar'));
  assert.ok(url.includes('token=abc123token'));
});
