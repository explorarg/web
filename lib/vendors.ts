import {
  collection,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy as firestoreOrderBy,
  limit as firestoreLimit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import type { Vendor, ReferralLink } from '@/types/vendor';
import type { Reservation, Experience } from '@/components/landing-reserva/types';

const VENDORS = 'vendors';
const REF_LINKS = 'referralLinks';
const RESERVATIONS = 'reservas';
const EXPERIENCES = 'experiencias';

function normalizeVendor(data: Vendor): Vendor {
  return {
    ...data,
    active: typeof data.active === 'boolean' ? data.active : true,
  };
}

export async function getVendors(options: { activeOnly?: boolean; limit?: number } = {}): Promise<Vendor[]> {
  const constraints: any[] = [];
  constraints.push(firestoreOrderBy('name', 'asc'));
  if (options.limit && options.limit > 0) constraints.push(firestoreLimit(options.limit));
  const snap = await getDocs(query(collection(db, VENDORS), ...constraints));
  const vendors = snap.docs.map(d => normalizeVendor(serializeFirestoreData<Vendor>({ id: d.id, ...d.data() })));
  return options.activeOnly ? vendors.filter((vendor) => vendor.active) : vendors;
}

export async function getVendorById(id: string): Promise<Vendor | null> {
  const ref = doc(db, VENDORS, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return normalizeVendor(serializeFirestoreData<Vendor>({ id: snap.id, ...snap.data() }));
}

export async function getVendorByEmail(email: string): Promise<Vendor | null> {
  const q = query(collection(db, VENDORS), where('email', '==', email), firestoreLimit(1));
  const snap = await getDocs(q);
  const d = snap.docs[0];
  return d ? normalizeVendor(serializeFirestoreData<Vendor>({ id: d.id, ...d.data() })) : null;
}

export async function createVendor(input: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const now = Timestamp.now();
  const allowedPackages = input.allowedPackages ?? input.allowedExperiences ?? null;
  const ref = await addDoc(collection(db, VENDORS), {
    ...input,
    allowedPackages,
    allowedExperiences: allowedPackages,
    paymentDetails: input.paymentDetails ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function updateVendor(id: string, input: Partial<Omit<Vendor, 'id'>>): Promise<void> {
  const allowedPackages = input.allowedPackages ?? input.allowedExperiences ?? null;
  await updateDoc(doc(db, VENDORS, id), {
    ...input,
    allowedPackages,
    allowedExperiences: allowedPackages,
    paymentDetails: input.paymentDetails ?? null,
    updatedAt: Timestamp.now(),
  } as any);
}

export async function deleteVendor(id: string): Promise<void> {
  await deleteDoc(doc(db, VENDORS, id));
}

export async function getReferralByCode(code: string): Promise<ReferralLink | null> {
  const q = query(collection(db, REF_LINKS), where('code', '==', code), where('active', '==', true), firestoreLimit(1));
  const snap = await getDocs(q);
  const d = snap.docs[0];
  return d ? serializeFirestoreData<ReferralLink>({ id: d.id, ...d.data() }) : null;
}

export async function getReferralLinksByVendor(vendorId: string): Promise<ReferralLink[]> {
  const q = query(collection(db, REF_LINKS), where('vendorId', '==', vendorId), firestoreOrderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  const links = snap.docs.map(d => serializeFirestoreData<ReferralLink>({ id: d.id, ...d.data() }));

  const enrichedLinks = await Promise.all(
    links.map(async link => {
      const reservationsQuery = query(
        collection(db, RESERVATIONS),
        where('referredBy.code', '==', link.code),
        where('status', '==', 'completed')
      );
      const reservationsSnap = await getDocs(reservationsQuery);
      const reservations = reservationsSnap.docs.map(d => serializeFirestoreData<Reservation>({ id: d.id, ...d.data() }));

      const salesCount = reservations.length;
      const revenueByCurrency: Record<'ars' | 'brl' | 'usd', number> = { ars: 0, brl: 0, usd: 0 };
      const commissionByCurrency: Record<'ars' | 'brl' | 'usd', number> = { ars: 0, brl: 0, usd: 0 };
      for (const r of reservations) {
        const currency = (r as any).currency as 'ars' | 'brl' | 'usd' | undefined;
        const amount = typeof (r as any).amountTotal === 'number' ? (r as any).amountTotal : 0;
        if (currency && currency in revenueByCurrency) {
          revenueByCurrency[currency] += amount;
        }
        const ccy = ((r as any).referredBy?.commissionCurrency ?? currency) as 'ars' | 'brl' | 'usd' | undefined;
        const cAmount = (r as any).referredBy?.commissionAmount ?? 0;
        if (ccy && ccy in commissionByCurrency) {
          commissionByCurrency[ccy] += cAmount;
        }
      }
      const totalRevenue = Object.values(revenueByCurrency).reduce((a, b) => a + b, 0);
      const totalCommission = Object.values(commissionByCurrency).reduce((a, b) => a + b, 0);

      let experienceName = 'Todas';
      let experienceSlug: string | undefined = undefined;
      if (link.experienceId) {
        const expDoc = await getDoc(doc(db, EXPERIENCES, link.experienceId));
        if (expDoc.exists()) {
          const exp = serializeFirestoreData<Experience>({ id: expDoc.id, ...expDoc.data() });
          experienceName = (exp as any).title ?? (exp as any).name ?? '';
          experienceSlug = (exp as any).slug ? String((exp as any).slug) : undefined;
        }
      }

      return {
        ...link,
        salesCount,
        totalRevenue,
        totalCommission,
        experienceName,
        experienceSlug,
        revenueByCurrency,
        commissionByCurrency,
      };
    })
  );

  return enrichedLinks;
}

export async function createReferralLink(input: Omit<ReferralLink, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  // Validaciones fuertes:
  // 1) Debe especificarse experienceId
  if (!input.experienceId) {
    throw new Error('MISSING_EXPERIENCE');
  }
  // 2) Un enlace por vendor + experienceId (independiente del estado)
  {
    const qDup = query(
      collection(db, REF_LINKS),
      where('vendorId', '==', input.vendorId),
      where('experienceId', '==', input.experienceId),
      firestoreLimit(1)
    );
    const dupSnap = await getDocs(qDup);
    if (!dupSnap.empty) {
      throw new Error('DUPLICATE_EXPERIENCE');
    }
  }
  // 3) Verificar que el código no exista
  {
    const qCode = query(collection(db, REF_LINKS), where('code', '==', input.code), firestoreLimit(1));
    const codeSnap = await getDocs(qCode);
    if (!codeSnap.empty) {
      throw new Error('CODE_TAKEN');
    }
  }
  // 4) Si el vendor tiene paquetes asignados, validar pertenencia
  {
    const vRef = doc(db, VENDORS, input.vendorId);
    const vSnap = await getDoc(vRef);
    if (vSnap.exists()) {
      const vd = vSnap.data() as any;
      const allowed: string[] | null | undefined = vd?.allowedPackages ?? vd?.allowedExperiences ?? null;
      if (Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(input.experienceId as string)) {
        throw new Error('NOT_ALLOWED_EXPERIENCE');
      }
    }
  }
  const now = Timestamp.now();
  const ref = await addDoc(collection(db, REF_LINKS), {
    ...input,
    experienceId: input.experienceId,
    utm: input.utm ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function deactivateReferralLink(id: string): Promise<void> {
  await updateDoc(doc(db, REF_LINKS, id), { active: false, updatedAt: Timestamp.now() });
}

export async function deleteReferralLink(id: string): Promise<void> {
  await deleteDoc(doc(db, REF_LINKS, id));
}
