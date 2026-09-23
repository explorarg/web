import { NextResponse } from 'next/server';
import { resend, getFromEmail, isResendConfigured } from '@/lib/resend';
import { SITE_NAME } from '@/lib/constants';

export const runtime = 'nodejs';

function getCronSecret(): string | null {
  return process.env.CRON_SECRET ?? null;
}

function isAuthorized(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!isResendConfigured() || !resend) {
    return NextResponse.json({ error: 'Resend no configurado (falta RESEND_API_KEY)' }, { status: 500 });
  }

  const url = new URL(request.url);
  const to = url.searchParams.get('to');
  const subject = url.searchParams.get('subject') || `Prueba de email — ${SITE_NAME}`;
  const html = url.searchParams.get('html') || `<p>Correo de prueba desde ${SITE_NAME}</p>`;

  if (!to) {
    return NextResponse.json({ error: 'Falta parámetro "to" en query. Ej: ?to=tu@ejemplo.com' }, { status: 400 });
  }

  try {
    const from = getFromEmail();
    const result: any = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });
    const { error } = result;
    if (error) {
      throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
    }
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'No se pudo enviar email', detail }, { status: 500 });
  }
}

