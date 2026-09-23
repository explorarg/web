import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { resend, getFromEmail, isResendConfigured } from '@/lib/resend';
import { SITE_NAME, SITE_URL } from '@/lib/constants';
import {
  buildVendorPasswordResetUrl,
  createVendorPasswordResetToken,
  evaluateVendorPasswordResetRateLimit,
  getVendorPasswordResetExpiresAt,
  normalizeVendorResetEmail,
  VENDOR_PASSWORD_RESET_COLLECTION,
} from '@/lib/vendor-password-reset';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
});

function buildResetRequestEmailHtml(resetUrl: string) {
  const brandUrl = SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
  return `
  <div style="font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #111827;">
    <div style="text-align:center; padding: 24px 0;">
      <a href="${brandUrl}" style="text-decoration:none; display:inline-flex; align-items:center; gap:10px;">
        <span style="display:inline-block; width:44px; height:44px; background:#2BB8BF; border-radius:12px;"></span>
        <span style="font-size:18px; font-weight:700; color:#111827;">${SITE_NAME}</span>
      </a>
    </div>
    <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:16px; padding:24px;">
      <h1 style="margin:0 0 8px; font-size:20px;">Recuperá tu acceso</h1>
      <p style="margin:0 0 12px; color:#374151;">
        Recibimos una solicitud para restablecer la contraseña de tu <strong>Portal de Vendedores</strong>.
      </p>
      <p style="margin:0 0 18px; color:#374151;">
        Este enlace es personal, seguro y expira en <strong>1 hora</strong>. Una vez que generes tu nueva contraseña, el token quedará invalidado automáticamente.
      </p>
      <div style="text-align:center; margin: 24px 0;">
        <a href="${resetUrl}" style="display:inline-block; background:#2BB8BF; color:#ffffff; padding:12px 18px; border-radius:10px; font-weight:700; text-decoration:none;">
          Crear nueva contraseña
        </a>
      </div>
      <p style="margin:0 0 6px; color:#6b7280; font-size:14px;">
        Si el botón no funciona, copiá y pegá este enlace en tu navegador:
      </p>
      <p style="word-break:break-all; font-size:12px; color:#6b7280;">${resetUrl}</p>
      <hr style="border:none; border-top:1px solid #e5e7eb; margin:24px 0;" />
      <p style="margin:0; color:#6b7280; font-size:12px;">
        Si no solicitaste este cambio, ignorá este correo. Nadie podrá cambiar tu contraseña sin este enlace.
      </p>
    </div>
    <p style="text-align:center; color:#9ca3af; font-size:12px; margin-top:16px;">© ${new Date().getFullYear()} ${SITE_NAME}</p>
  </div>
  `;
}

async function sendVendorResetEmail(to: string, resetUrl: string) {
  if (!isResendConfigured() || !resend) {
    console.warn('[vendor/password-reset] Resend no configurado, se omite el envío del correo');
    return;
  }

  const fromEmail = getFromEmail(false);
  const fromName = `${SITE_NAME} • Portal de Vendedores`;
  const replyTo = process.env.SUPPORT_EMAIL || fromEmail;
  const text =
    `Solicitaste recuperar el acceso al Portal de Vendedores.\n` +
    `Usá este enlace seguro para crear una nueva contraseña (expira en 1 hora): ${resetUrl}\n` +
    `Si no solicitaste este cambio, ignorá este correo.`;

  try {
    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject: `Recuperá tu acceso — Portal de Vendedores | ${SITE_NAME}`,
      html: buildResetRequestEmailHtml(resetUrl),
      text,
      replyTo,
    });
  } catch (error) {
    console.error('[vendor/password-reset] error enviando email', error instanceof Error ? error.message : String(error));
  }
}

export async function POST(request: Request) {
  let email = '';

  try {
    const body = await request.json();
    const parsed = schema.parse(body);
    email = normalizeVendorResetEmail(parsed.email);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const adminDb = getAdminDb();
  if (!adminDb || !adminAuth) {
    console.warn('[vendor/password-reset] Firebase Admin no configurado, se omite la generación del token');
    return NextResponse.json({ ok: true });
  }

  try {
    const vendorSnap = await adminDb.collection('vendors').where('email', '==', email).limit(1).get();
    const vendorDoc = vendorSnap.docs[0];
    const vendorData = vendorDoc?.data();

    if (!vendorDoc || !vendorData || vendorData.active !== true) {
      return NextResponse.json({ ok: true });
    }

    const resetHistorySnap = await adminDb
      .collection(VENDOR_PASSWORD_RESET_COLLECTION)
      .where('email', '==', email)
      .get();

    const rateLimit = evaluateVendorPasswordResetRateLimit(
      resetHistorySnap.docs.map((doc) => ({ requestedAt: doc.data().requestedAt ?? null }))
    );

    if (!rateLimit.allowed) {
      return NextResponse.json({ ok: true });
    }

    const { token, tokenEncrypted, tokenHash } = createVendorPasswordResetToken();
    const requestedAt = new Date();
    const expiresAt = getVendorPasswordResetExpiresAt(requestedAt.getTime());
    const requestIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const userAgent = request.headers.get('user-agent') || null;
    const resetUrl = buildVendorPasswordResetUrl({
      baseUrl: SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com',
      email,
      token,
    });

    await adminDb.collection(VENDOR_PASSWORD_RESET_COLLECTION).add({
      vendorId: vendorDoc.id,
      email,
      tokenHash,
      tokenEncrypted,
      status: 'pending',
      requestedAt,
      expiresAt,
      requestIp,
      userAgent,
      requestCountWindowMs: 15 * 60 * 1000,
      requestCountMax: 3,
      flow: 'vendor-self-service',
    });

    await sendVendorResetEmail(email, resetUrl);
  } catch (error) {
    console.error('[vendor/password-reset] request error', error instanceof Error ? error.message : String(error));
  }

  return NextResponse.json({ ok: true });
}
