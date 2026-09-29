import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const DEFAULT_FROM_EMAIL = 'reservas@explorarg.com';
const brandName = process.env.BRAND_NAME ?? 'Explorarg';

export const resend = apiKey ? new Resend(apiKey) : null;

/** Extrae solo la dirección de email de valores tipo "Nombre <email@dominio>". */
function extractEmailAddress(raw: string): string {
  const value = String(raw).trim();
  const match = value.match(/<([^>]+)>/);
  const candidate = (match ? match[1] : value).trim();
  return candidate.replace(/^<|>$/g, '').trim();
}

export function getFromEmail(branded = true): string {
  const envValue = String(process.env.RESEND_FROM_EMAIL ?? '').trim();
  const address = envValue ? extractEmailAddress(envValue) : DEFAULT_FROM_EMAIL;
  if (!address) return branded ? `${brandName} <${DEFAULT_FROM_EMAIL}>` : DEFAULT_FROM_EMAIL;
  if (!branded) return address;
  return `${brandName} <${address}>`;
}

export function isResendConfigured(): boolean {
  return Boolean(apiKey);
}
