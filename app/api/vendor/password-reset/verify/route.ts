import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebaseAdmin';
import {
  isVendorPasswordResetExpired,
  normalizeVendorResetEmail,
  verifyVendorPasswordResetToken,
  VENDOR_PASSWORD_RESET_COLLECTION,
} from '@/lib/vendor-password-reset';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  token: z.string().min(32),
});

export async function POST(request: Request) {
  const adminDb = getAdminDb();
  if (!adminDb) {
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

    return NextResponse.json({
      ok: true,
      email,
      expiresAt:
        matchedData.expiresAt instanceof Date
          ? matchedData.expiresAt.toISOString()
          : typeof matchedData.expiresAt?.toDate === 'function'
            ? matchedData.expiresAt.toDate().toISOString()
            : matchedData.expiresAt,
    });
  } catch (error) {
    console.error('[vendor/password-reset/verify] error', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'No se pudo validar el enlace.' }, { status: 500 });
  }
}
