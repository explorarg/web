import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth } from '@/lib/firebaseAdmin';
import type { Auth } from 'firebase-admin/auth';
import { requireAdminToken } from '@/lib/adminAuth';
import { db } from '@/lib/firebase';
import { doc, updateDoc, getDocs, query, collection, where, Timestamp } from 'firebase/firestore';
import { resend, getFromEmail, isResendConfigured } from '@/lib/resend';
import { SITE_NAME, SITE_URL } from '@/lib/constants';
import { siteConfig } from '@/lib/siteConfig';

export const runtime = 'nodejs';

const Actions = z.enum(['create', 'reset', 'disable', 'enable']);
const schema = z.object({
  action: Actions,
  email: z.string().email(),
  vendorId: z.string().optional(),
});

function genTempPassword(): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const nums = '0123456789';
  const symbols = '!@#$%^&*()-_=+[]{};:,.<>?';
  const pick = (s: string, n = 1) => Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join('');
  const pool = upper + lower + nums + symbols;
  const rest = Array.from({ length: 10 }, () => pool[Math.floor(Math.random() * pool.length)]).join('');
  return (pick(upper) + pick(lower) + pick(nums) + pick(symbols) + rest).split('').sort(() => Math.random() - 0.5).join('');
}

async function findVendorIdByEmail(email: string): Promise<string | null> {
  const snap = await getDocs(query(collection(db, 'vendors'), where('email', '==', email.toLowerCase())));
  return snap.docs[0]?.id ?? null;
}

async function sendAccessEmail(to: string, tempPassword: string, action: 'create' | 'reset') {
  const configured = isResendConfigured() && Boolean(resend);
  if (!configured) {
    console.warn('[resend] not configured, skipping sendAccessEmail');
    return;
  }
  const fromName = `${SITE_NAME} • Portal de Vendedores`;
  const fromEmail = getFromEmail(false);
  const replyTo = process.env.SUPPORT_EMAIL || getFromEmail(false);
  const subject =
    action === 'create'
      ? `Tu acceso al Portal de Vendedores — ${SITE_NAME}`
      : 'Contraseña restablecida — Portal de Vendedores';
  const loginUrl = `${SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || ''}/vendedor/login`;
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height: 1.6">
      <h2 style="margin:0 0 12px">${SITE_NAME} — Portal de Vendedores</h2>
      <p>${action === 'create' ? 'Tu usuario ha sido creado.' : 'Tu contraseña fue restablecida.'}</p>
      <p>
        Email: <strong>${to}</strong><br/>
        Contraseña temporal: <strong>${tempPassword}</strong>
      </p>
      <p>Por seguridad, al ingresar se te pedirá cambiarla.</p>
      <p>
        Ingresá aquí: <a href="${loginUrl}">${loginUrl}</a>
      </p>
      <hr/>
      <p style="font-size:12px; color:#666">Si no solicitaste este acceso, ignorá este correo.</p>
    </div>
  `;
  const text =
    `${action === 'create' ? 'Tu usuario ha sido creado.' : 'Tu contraseña fue restablecida.'}\n` +
    `Email: ${to}\n` +
    `Contraseña temporal: ${tempPassword}\n` +
    `Ingresá aquí: ${loginUrl}\n` +
    `Si no solicitaste este acceso, ignorá este correo.`;
  try {
    console.info('[resend] sendAccessEmail start', { to, subject });
    const result: any = await resend!.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html,
      text,
      replyTo,
    });
    if (result?.error) {
      console.error('[resend] sendAccessEmail error', result.error);
    } else {
      console.info('[resend] sendAccessEmail ok', { id: result?.id, to });
    }
  } catch (err) {
    console.error('[resend] sendAccessEmail exception', err instanceof Error ? err.message : String(err));
  }
}

async function getOrCreateUidForEmail(auth: Auth, email: string, tempPassword: string): Promise<{ uid: string; created: boolean }> {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, {
      password: tempPassword,
      emailVerified: true,
      disabled: false,
    });
    return { uid: user.uid, created: false };
  } catch {
    const user = await auth.createUser({
      email,
      password: tempPassword,
      emailVerified: true,
      disabled: false,
    });
    return { uid: user.uid, created: true };
  }
}

export async function POST(request: Request) {
  if (!adminAuth) {
    return NextResponse.json(
      {
        error:
          'Firebase Admin no está configurado. Define FIREBASE_SERVICE_ACCOUNT en .env.local con el JSON del Service Account.',
      },
      { status: 500 }
    );
  }
  const AUTH = adminAuth as Auth;
  try {
    const adminUser = await requireAdminToken(request);
    const allowedEmailsEnv =
      process.env.ADMIN_EMAILS ||
      process.env.ADMIN_EMAIL ||
      process.env.NEXT_PUBLIC_ADMIN_EMAIL ||
      siteConfig.company.adminEmailDefault;
    const allowed = allowedEmailsEnv
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const email = (adminUser.email || '').toLowerCase();
    if (!email || !allowed.includes(email)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Autenticación inválida' }, { status: 401 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const email = body.email.toLowerCase();
  const vendorId = body.vendorId || (await findVendorIdByEmail(email));
  if (!vendorId) {
    return NextResponse.json({ error: 'Vendedor no encontrado para ese email' }, { status: 404 });
  }

  try {
    if (body.action === 'create') {
      const temp = genTempPassword();
      const { uid } = await getOrCreateUidForEmail(AUTH, email, temp);
      await updateDoc(doc(db, 'vendors', vendorId), {
        authUid: uid,
        active: true,
        mustChangePassword: true,
        updatedAt: Timestamp.now(),
      } as any);
      await sendAccessEmail(email, temp, 'create');
      return NextResponse.json({ ok: true, tempPassword: temp });
    }
    if (body.action === 'reset') {
      const temp = genTempPassword();
      const user = await AUTH.getUserByEmail(email);
      await AUTH.updateUser(user.uid, { password: temp, disabled: false });
      await updateDoc(doc(db, 'vendors', vendorId), {
        authUid: user.uid,
        mustChangePassword: true,
        updatedAt: Timestamp.now(),
      } as any);
      await sendAccessEmail(email, temp, 'reset');
      return NextResponse.json({ ok: true, tempPassword: temp });
    }
    if (body.action === 'disable') {
      const user = await AUTH.getUserByEmail(email).catch(() => null);
      if (user) {
        await AUTH.updateUser(user.uid, { disabled: true });
      }
      await updateDoc(doc(db, 'vendors', vendorId), { active: false, updatedAt: Timestamp.now() } as any);
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'enable') {
      const user = await AUTH.getUserByEmail(email).catch(() => null);
      if (user) {
        await AUTH.updateUser(user.uid, { disabled: false });
      }
      await updateDoc(doc(db, 'vendors', vendorId), { active: true, updatedAt: Timestamp.now() } as any);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
