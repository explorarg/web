import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Auth } from 'firebase-admin/auth';
import { adminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { resend, getFromEmail, isResendConfigured } from '@/lib/resend';
import { SITE_NAME, SITE_URL } from '@/lib/constants';
import {
  isVendorPasswordResetExpired,
  normalizeVendorResetEmail,
  validateVendorPasswordComplexity,
  verifyVendorPasswordResetToken,
  VENDOR_PASSWORD_RESET_COLLECTION,
} from '@/lib/vendor-password-reset';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  token: z.string().min(32),
  password: z.string().min(8),
});

function buildPasswordChangedHtml(email: string) {
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
      <h1 style="margin:0 0 8px; font-size:20px;">Tu contraseña fue actualizada</h1>
      <p style="margin:0 0 12px; color:#374151;">
        Confirmamos que la contraseña del <strong>Portal de Vendedores</strong> asociada a <strong>${email}</strong> fue restablecida correctamente.
      </p>
      <p style="margin:0; color:#6b7280; font-size:14px;">
        Si no realizaste este cambio, contactate de inmediato con soporte para proteger tu cuenta.
      </p>
    </div>
  </div>
  `;
}

async function sendPasswordChangedEmail(email: string) {
  if (!isResendConfigured() || !resend) return;

  try {
    const fromEmail = getFromEmail(false);
    await resend.emails.send({
      from: `${SITE_NAME} • Seguridad <${fromEmail}>`,
      to: email,
      subject: `Tu contraseña fue actualizada — Portal de Vendedores | ${SITE_NAME}`,
      html: buildPasswordChangedHtml(email),
      text:
        `La contraseña del Portal de Vendedores para ${email} fue actualizada correctamente.\n` +
        `Si no realizaste este cambio, contactate de inmediato con soporte.`,
      replyTo: process.env.SUPPORT_EMAIL || fromEmail,
    });
  } catch (error) {
    console.error('[vendor/password-reset/complete] notify error', error instanceof Error ? error.message : String(error));
  }
}

async function getOrCreateVendorAuthUser(auth: Auth, email: string, password: string): Promise<string> {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, {
      password,
      disabled: false,
      emailVerified: true,
    });
    return user.uid;
  } catch {
    const created = await auth.createUser({
      email,
      password,
      disabled: false,
      emailVerified: true,
    });
    return created.uid;
  }
}

export async function POST(request: Request) {
  const adminDb = getAdminDb();
  if (!adminDb || !adminAuth) {
    return NextResponse.json({ error: 'Servicio no disponible.' }, { status: 503 });
  }

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 });
  }

  const email = normalizeVendorResetEmail(payload.email);
  const token = String(payload.token).trim();
  const password = String(payload.password ?? '');
  const passwordValidation = validateVendorPasswordComplexity(password);
  if (!passwordValidation.valid) {
    return NextResponse.json({ error: 'La nueva contraseña no cumple los requisitos.', details: passwordValidation.errors }, { status: 400 });
  }

  try {
    const vendorSnap = await adminDb.collection('vendors').where('email', '==', email).limit(1).get();
    const vendorDoc = vendorSnap.docs[0];
    const vendorData = vendorDoc?.data();

    if (!vendorDoc || !vendorData || vendorData.active !== true) {
      return NextResponse.json({ error: 'El enlace no es válido o ya expiró.' }, { status: 400 });
    }

    const tokenSnap = await adminDb
      .collection(VENDOR_PASSWORD_RESET_COLLECTION)
      .where('email', '==', email)
      .get();

    const matched = tokenSnap.docs.find((doc) => {
      const data = doc.data();
      return data.status === 'pending' && verifyVendorPasswordResetToken(token, String(data.tokenHash ?? ''));
    });

    if (!matched) {
      return NextResponse.json({ error: 'El enlace no es válido o ya expiró.' }, { status: 400 });
    }

    const matchedData = matched.data();
    if (isVendorPasswordResetExpired(matchedData.expiresAt ?? null)) {
      await matched.ref.update({
        status: 'expired',
        expiredAt: new Date(),
      });
      return NextResponse.json({ error: 'El enlace no es válido o ya expiró.' }, { status: 400 });
    }

    const authUid = await getOrCreateVendorAuthUser(adminAuth as Auth, email, password);
    const batch = adminDb.batch();
    const now = new Date();

    batch.update(vendorDoc.ref, {
      authUid,
      active: true,
      mustChangePassword: false,
      updatedAt: now,
      lastPasswordResetAt: now,
    });

    for (const docSnap of tokenSnap.docs) {
      const data = docSnap.data();
      if (docSnap.id === matched.id) {
        batch.update(docSnap.ref, {
          status: 'used',
          usedAt: now,
        });
      } else if (data.status === 'pending') {
        batch.update(docSnap.ref, {
          status: 'invalidated',
          invalidatedAt: now,
        });
      }
    }

    await batch.commit();
    await sendPasswordChangedEmail(email);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[vendor/password-reset/complete] error', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'No se pudo restablecer la contraseña.' }, { status: 500 });
  }
}
