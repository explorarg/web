import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const fromEnv = process.env.RESEND_FROM_EMAIL ?? 'reply@tucsdigital.com';
const brandName = process.env.BRAND_NAME ?? 'Explorarg';

export const resend = apiKey ? new Resend(apiKey) : null;

export function getFromEmail(branded = true): string {
  const val = String(fromEnv).trim();
  if (!branded) {
    const match = val.match(/<([^>]+)>/);
    return match ? match[1] : val;
  }
  if (val.includes('<') && val.includes('>')) {
    return val;
  }
  return `${brandName} <${val}>`;
}

export function isResendConfigured(): boolean {
  return Boolean(apiKey);
}
