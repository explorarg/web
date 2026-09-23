import type { Auth } from 'firebase-admin/auth';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { ADMIN_EMAIL } from '@/lib/constants';
import { db } from '@/lib/firebase';
import { adminAuth } from '@/lib/firebaseAdmin';
import type { Vendor } from '@/types/vendor';

function normalizeVendorRecord(id: string, data: Record<string, unknown>): Vendor {
  return {
    id,
    name: String(data.name ?? data.email ?? ''),
    email: String(data.email ?? ''),
    active: typeof data.active === 'boolean' ? data.active : true,
    authUid: typeof data.authUid === 'string' ? data.authUid : null,
    mustChangePassword: typeof data.mustChangePassword === 'boolean' ? data.mustChangePassword : null,
    defaultCommission: {
      type: data?.defaultCommission && typeof (data as any).defaultCommission?.type === 'string'
        ? ((data as any).defaultCommission.type as 'percent' | 'fixed')
        : 'percent',
      value: Number((data as any)?.defaultCommission?.value ?? 0) || 0,
      currency:
        (String((data as any)?.defaultCommission?.currency ?? 'ars').toLowerCase() as 'ars' | 'brl' | 'usd'),
    },
    allowedPackages: Array.isArray(data.allowedPackages)
      ? (data.allowedPackages as string[])
      : Array.isArray(data.allowedExperiences)
        ? (data.allowedExperiences as string[])
        : null,
    allowedExperiences: Array.isArray(data.allowedExperiences)
      ? (data.allowedExperiences as string[])
      : Array.isArray(data.allowedPackages)
        ? (data.allowedPackages as string[])
        : null,
    paymentDetails:
      data.paymentDetails && typeof data.paymentDetails === 'object'
        ? (data.paymentDetails as Vendor['paymentDetails'])
        : null,
  };
}

export async function requireVendorToken(request: Request): Promise<Vendor> {
  if (!adminAuth) {
    throw new Error('Firebase Admin no está configurado.');
  }
  const auth = adminAuth as Auth;
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    throw new Error('Necesitás autenticarte');
  }

  const decoded = await auth.verifyIdToken(token);
  const email = String(decoded.email ?? '').trim().toLowerCase();
  if (!email) {
    throw new Error('Email no disponible en el token');
  }
  if (email === ADMIN_EMAIL) {
    throw new Error('Acceso denegado');
  }

  const snap = await getDocs(
    query(collection(db, 'vendors'), where('email', '==', email), where('active', '==', true), limit(1))
  );
  const vendorDoc = snap.docs[0];
  if (!vendorDoc) {
    throw new Error('Vendedor no encontrado o inactivo');
  }
  return normalizeVendorRecord(vendorDoc.id, vendorDoc.data() as Record<string, unknown>);
}

export function vendorHasPackageAccess(vendor: Pick<Vendor, 'allowedPackages' | 'allowedExperiences'>, packageId: string): boolean {
  const allowed =
    Array.isArray(vendor.allowedPackages) && vendor.allowedPackages.length > 0
      ? vendor.allowedPackages
      : Array.isArray(vendor.allowedExperiences) && vendor.allowedExperiences.length > 0
        ? vendor.allowedExperiences
        : null;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(packageId);
}
