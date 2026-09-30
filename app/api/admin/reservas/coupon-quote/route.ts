import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminToken } from '@/lib/adminAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getPaqueteById } from '@/lib/paquetes';
import { computeReservationPricing } from '@/lib/packages/resolve-departure';
import { resolveDepartureConfig, resolveReservationExtraSelections } from '@/lib/packages/resolve-departure';
import type { SeatLayoutTemplate } from '@/types';
import { quoteCommunityPromotion } from '@/lib/community/redemptions';

export const runtime = 'nodejs';

const schema = z.object({
  packageId: z.string().min(1),
  date: z.string().min(1),
  peopleAdults: z.number().int().min(0).max(50),
  peopleMinors: z.number().int().min(0).max(50),
  roomType: z.string().optional(),
  pickupPoint: z.string().optional(),
  selectedSeats: z.array(z.string()).max(200).optional(),
  customerEmail: z.string().trim().email(),
  couponCode: z.string().trim().min(1).max(40),
});

export async function POST(request: Request) {
  try {
    await requireAdminToken(request);
  } catch {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  const db = getAdminDb();
  if (!db) return NextResponse.json({ error: 'El servicio de comunidad no está disponible.' }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Completá los datos del cliente y la reserva para validar el cupón.' }, { status: 400 });
  const input = parsed.data;
  const packageData = await getPaqueteById(input.packageId);
  if (!packageData) return NextResponse.json({ error: 'No se encontró el paquete.' }, { status: 404 });
  const people = input.peopleAdults + input.peopleMinors;
  if (people < 1) return NextResponse.json({ error: 'Indicá al menos un pasajero.' }, { status: 400 });
  let seatLayoutTemplate: SeatLayoutTemplate | null = null;
  const seatLayoutId = resolveDepartureConfig(packageData, input.date).seatLayoutId;
  if (seatLayoutId && input.selectedSeats?.length) {
    const templateSnapshot = await db.collection('seatLayouts').doc(seatLayoutId).get();
    if (templateSnapshot.exists) seatLayoutTemplate = { id: templateSnapshot.id, ...templateSnapshot.data() } as SeatLayoutTemplate;
  }
  const extras = resolveReservationExtraSelections({
    paquete: packageData,
    pickupPoint: input.pickupPoint || null,
    selectedSeats: input.selectedSeats ?? [],
    seatLayoutTemplate,
  });
  const pricing = computeReservationPricing(packageData, input.date, {
    people,
    peopleAdults: input.peopleAdults,
    peopleMinors: input.peopleMinors,
    roomType: input.roomType || null,
    selectedExtras: extras,
  });
  const normalizedEmail = input.customerEmail.trim().toLowerCase();
  const profileSnapshot = await db.collection('usuarios').where('email', '==', normalizedEmail).limit(2).get();
  if (profileSnapshot.size !== 1 || profileSnapshot.docs[0].data()?.activo === false) {
    return NextResponse.json({ error: 'El email del cliente debe pertenecer a un miembro activo de la comunidad.' }, { status: 400 });
  }
  try {
    const quote = await quoteCommunityPromotion({
      uid: profileSnapshot.docs[0].id,
      couponCode: input.couponCode.trim().toUpperCase(),
      subtotalCents: Number(pricing.baseSubtotalAmount ?? 0),
      currency: String(pricing.currency ?? 'ARS').toUpperCase(),
    });
    if (!quote.discount || quote.promotion?.kind !== 'coupon') {
      return NextResponse.json({ error: 'El cupón no aplica a esta reserva.' }, { status: 400 });
    }
    return NextResponse.json({
      couponCode: quote.promotion.code,
      discount: quote.discount,
      subtotalCents: Number(pricing.baseSubtotalAmount ?? 0),
      totalCents: Math.max(0, Number(pricing.subtotalAmount ?? 0) - quote.discount.montoDescuento),
      currency: String(pricing.currency ?? 'ARS').toUpperCase(),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo validar el cupón.' }, { status: 400 });
  }
}
