import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  addReservaAttachments,
  getReservaById,
  removeReservaAttachmentsById,
  updateReservaStatus,
} from '@/lib/reservas';
import { getPaqueteById } from '@/lib/paquetes';
import { requireAdminToken } from '@/lib/adminAuth';
import { getStockDisponible, registrarMovimientoStock } from '@/lib/stock';
import { randomUUID } from 'crypto';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getVendorById, getReferralByCode } from '@/lib/vendors';
import { computeCommission, nextPayoutStatusForReservationStatus } from '@/lib/referrals';
import { buildBaseSeatReservationSeats, getSeatDepartureId, seatIdsFromLabels } from '@/lib/seats/server';
import {
  normalizeDigits,
  normalizeEmail,
  prepareNextReservationCodeInTransaction,
} from '@/lib/reservas/code';
import { getReservationExtrasAmount, getReservationOfficialBaseAmount } from '@/lib/reservas/pricing';
import type { SeatLayoutTemplate, SeatStatus } from '@/types';
import { buildDefaultEmailDelivery } from '@/lib/sales/status';
import { buildEmailDeliveryState, buildEmailJobDocument, emailDeliveryPathForJobType } from '@/lib/sales/email-jobs';
import { getFromEmail, isResendConfigured, resend } from '@/lib/resend';
import {
  buildAdminNuevaReservaHtml,
  buildAdminNuevaReservaText,
  buildClienteCompraConfirmadaHtml,
  buildClienteCompraConfirmadaText,
  buildClienteVoucher48hsHtml,
  buildClienteVoucher48hsText,
} from '@/lib/emails/reserva-confirmada';
import { CONTACT_INFO, SITE_NAME } from '@/lib/constants';
import {
  computeReservationPricing,
  resolveDepartureConfig,
  resolveReservationExtraSelections,
  withSinglePassengerSurcharge,
} from '@/lib/packages/resolve-departure';
import { buildReservationPricingSnapshot } from '@/lib/sales/orchestrator';
import { adminAuth } from '@/lib/firebaseAdmin';
import type { Auth } from 'firebase-admin/auth';
import type { Vendor } from '@/types/vendor';
import {
  deriveLegacyRoomTypeFromSelection,
  isPackageRoomTypeAvailable,
  normalizeRoomSelection,
} from '@/lib/reservas/room-types';

const COLLECTION = 'reservas';
const roomTypeSchema = z.string().trim().min(1).max(120);

export const runtime = 'nodejs';

const reservationStatusEnum = z.enum(['pending', 'reserved', 'completed', 'cancelled']);
const attachmentSchema = z.object({
  url: z.string().url(),
  name: z.string().max(200).optional(),
  type: z.string().max(50).optional(),
  uploadedBy: z.enum(['admin', 'user']).default('admin'),
  key: z.string().optional(),
});

const paymentMovementAttachmentSchema = z.object({
  url: z.string().url().min(8).max(800),
  key: z.string().max(240).optional().or(z.literal('')),
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(80),
  uploadedBy: z.string().max(80).optional(),
});

const paymentMovementSchema = z.object({
  movementType: z.enum(['payment', 'extra', 'discount', 'refund', 'adjustment']),
  amount: z.number().int().positive(),
  currency: z.string().min(3).max(10).optional(),
  method: z.string().min(2).max(30),
  reference: z.string().max(80).optional(),
  message: z.string().min(2).max(160),
  occurredAt: z.string().datetime().optional(),
  attachments: z.array(paymentMovementAttachmentSchema).max(12).optional(),
});

const paymentEventEditSchema = z.object({
  paymentId: z.string().min(1).max(160),
  movement: paymentMovementSchema.omit({ attachments: true }),
});

const travelerSchema = z.object({
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  age: z.number().int().min(0).max(120),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: z.string().min(8).max(40),
  document: z.string().min(3).max(40),
  country: z.string().min(2).max(80),
  travelerType: z.enum(['adult', 'minor']).nullable().optional(),
});

const adminReservaSchema = z.object({
  packageId: z.string().min(1),
  date: z.string().min(1),
  people: z.number().int().min(1).optional(),
  peopleAdults: z.number().int().min(0).max(50).optional(),
  peopleMinors: z.number().int().min(0).max(50).optional(),
  depositPercentAdults: z.number().min(0).max(100).optional(),
  depositPercentMinors: z.number().min(0).max(100).optional(),
  allowOverbook: z.boolean().optional(),
  customerEmail: z.string().trim().email().or(z.literal('')),
  customerName: z.string().min(2).optional(),
  customerFirstName: z.string().min(2),
  customerLastName: z.string().min(2),
  customerPhone: z.string().max(40).optional(),
  customerCountry: z.string().max(40).optional(),
  customerDocument: z.string().max(40).optional(),
  customerBirthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customerComments: z.string().max(500).optional(),
  passengerDetails: z.array(travelerSchema).max(49).optional(),
  attachments: z.array(attachmentSchema).optional(),
  status: reservationStatusEnum.optional(),
  statusNote: z.string().max(500).optional(),
  vendorId: z.string().min(1).optional(),
  referralCode: z.string().max(60).optional(),
  roomType: roomTypeSchema.optional(),
  roomSelection: z.array(z.object({
    roomType: roomTypeSchema,
    quantity: z.number().int().min(1).max(50),
  })).max(20).optional(),
  pickupPoint: z.string().max(120).optional(),
  pickupPointTime: z.string().max(20).nullable().optional(),
  selectedSeats: z.array(z.string().min(1).max(20)).max(200).optional(),
}).refine((data) => {
  const a = typeof data.peopleAdults === 'number' ? data.peopleAdults : 0;
  const m = typeof data.peopleMinors === 'number' ? data.peopleMinors : 0;
  const total = a + m;
  if (total > 0) return total >= 1 && total <= 50;
  return typeof data.people === 'number' && data.people >= 1 && data.people <= 50;
}).superRefine((data, ctx) => {
  const a = typeof data.peopleAdults === 'number' ? data.peopleAdults : 0;
  const m = typeof data.peopleMinors === 'number' ? data.peopleMinors : 0;
  const total = a + m;
  const people = total > 0 ? total : typeof data.people === 'number' ? data.people : 0;
  if (!data.customerBirthDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customerBirthDate'],
      message: 'La fecha de nacimiento es obligatoria.',
    });
  }
  if (Array.isArray(data.passengerDetails)) {
    for (let i = 0; i < data.passengerDetails.length; i++) {
      const traveler = data.passengerDetails[i];
      if (!traveler.firstName || !traveler.lastName) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['passengerDetails', i, 'firstName'],
          message: 'El nombre y apellido del pasajero son obligatorios.',
        });
      }
    }
  }
});

const travelerUpdateSchema = z.object({
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: z.string().min(8).max(40),
  document: z.string().min(3).max(40),
  country: z.string().min(2).max(80),
  travelerType: z.enum(['adult', 'minor']).nullable().optional(),
});

const adminUpdateSchema = z.object({
  reservationId: z.string().min(1),
  status: reservationStatusEnum.optional(),
  note: z.string().max(500).optional(),
  attachments: z.array(attachmentSchema).optional(),
  removeAttachments: z.array(z.object({ id: z.string().min(1) })).optional(),
  date: z.string().min(1).optional(),
  vendorId: z.string().min(1).optional(),
  referralCode: z.string().max(60).optional(),
  clearReferredBy: z.boolean().optional(),
  enqueueCustomerVoucherEmail: z.boolean().optional(),
  enqueueAdminNotificationEmail: z.boolean().optional(),
  addPaymentEvent: paymentMovementSchema.optional(),
  editPaymentEvent: paymentEventEditSchema.optional(),
  deletePaymentEvent: z.object({ paymentId: z.string().min(1).max(160) }).optional(),
  roomType: roomTypeSchema.optional(),
  roomSelection: z.array(z.object({
    roomType: roomTypeSchema,
    quantity: z.number().int().min(1).max(50),
  })).max(20).optional(),
  customerFirstName: z.string().min(2).max(80).optional(),
  customerLastName: z.string().min(2).max(80).optional(),
  customerEmail: z.string().max(120).optional().or(z.literal('')),
  customerPhone: z.string().max(40).optional().or(z.literal('')),
  customerCountry: z.string().max(40).optional().or(z.literal('')),
  customerDocument: z.string().max(40).optional().or(z.literal('')),
  customerBirthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  customerComments: z.string().max(500).optional().or(z.literal('')),
  peopleAdults: z.number().int().min(0).max(50).optional(),
  peopleMinors: z.number().int().min(0).max(50).optional(),
  people: z.number().int().min(1).max(50).optional(),
  seatType: z.string().max(80).optional().or(z.literal('')),
  pickupPoint: z.string().max(120).optional().or(z.literal('')),
  pickupPointTime: z.string().max(20).nullable().optional(),
  selectedSeats: z.array(z.string().min(1).max(20)).max(200).optional(),
  passengerDetails: z.array(travelerUpdateSchema).max(49).optional(),
});

function parseDate(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return 'sin-fecha';
}

async function requireAuth(request: Request) {
  try {
    const user = await requireAdminToken(request);
    return user;
  } catch (error) {
    console.error('[admin/reservas] Token inválido', error);
    throw new Error('Autenticación inválida');
  }
}

type ReservationCreatorAuth =
  | { kind: 'admin'; email: string | null }
  | { kind: 'vendor'; email: string; vendor: Vendor };

async function requireReservationCreatorAuth(request: Request): Promise<ReservationCreatorAuth> {
  try {
    const user = await requireAdminToken(request);
    return {
      kind: 'admin',
      email: typeof user?.email === 'string' ? String(user.email).trim().toLowerCase() : null,
    };
  } catch {
    // Fallback para vendedores autenticados.
  }

  if (!adminAuth) {
    throw new Error('Autenticación inválida');
  }

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    throw new Error('Necesitás autenticarte');
  }

  const auth = adminAuth as Auth;
  const decoded = await auth.verifyIdToken(token);
  const email = String(decoded.email ?? '').trim().toLowerCase();
  if (!email) {
    throw new Error('Email no disponible en el token');
  }

  const vendorSnap = await getDocs(
    query(collection(db, 'vendors'), where('email', '==', email), where('active', '==', true), limit(1))
  );
  const vendorDoc = vendorSnap.docs[0];
  if (!vendorDoc) {
    throw new Error('Acceso denegado');
  }

  const vendor = await getVendorById(vendorDoc.id).catch(() => null);
  if (!vendor || !vendor.active) {
    throw new Error('Vendedor no habilitado');
  }

  return { kind: 'vendor', email, vendor };
}

function getErrorMessage(error: unknown, fallback = 'Error desconocido'): string {
  return error instanceof Error ? error.message : fallback;
}

function getBaseCapacity(
  paquete: Awaited<ReturnType<typeof getPaqueteById>> | null,
  date: string
): number {
  if (!paquete) return 0;
  return resolveDepartureConfig(paquete, date).baseCapacity;
}

function isEnabledDate(paquete: Awaited<ReturnType<typeof getPaqueteById>> | null, date: string): boolean {
  if (!paquete) return false;
  return resolveDepartureConfig(paquete, date).enabled;
}

function formatEmailDate(date: string): string {
  if (!date || date === 'sin-fecha') return 'A coordinar';
  try {
    return new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

function formatEmailAmount(amountTotal: number, currency: string): string {
  const value = (amountTotal ?? 0) / 100;
  const normalized = String(currency || 'ARS').toUpperCase();
  if (normalized === 'ARS') return `$${value.toLocaleString('es-AR')}`;
  if (normalized === 'BRL') return `R$ ${value.toLocaleString('pt-BR')}`;
  if (normalized === 'USD') return `USD ${value.toLocaleString('en-US')}`;
  return `${value.toFixed(2)} ${normalized}`;
}

function normalizePaymentMovementStatus(movementType: z.infer<typeof paymentMovementSchema>['movementType']): string {
  if (movementType === 'payment') return 'paid';
  if (movementType === 'refund') return 'refunded';
  return 'recorded';
}

function normalizePaymentMovementMethod(method: string, movementType: z.infer<typeof paymentMovementSchema>['movementType']): string {
  const normalized = String(method || '').trim().toLowerCase();
  if (normalized) return normalized;
  return movementType === 'payment' ? 'admin' : 'manual';
}

async function resolveReservationReferralAssignment(params: {
  packageId: string;
  amountTotal: number;
  commissionBaseAmount: number;
  extrasExcludedAmount: number;
  people: number;
  status: z.infer<typeof reservationStatusEnum>;
  vendorId?: string;
  referralCode?: string;
  existingPayoutStatus?: 'pending' | 'accrued' | 'paid' | 'cancelled' | null;
}) {
  const packageId = String(params.packageId || '').trim();
  if (!packageId) {
    throw new Error('No se pudo identificar el paquete de la venta.');
  }

  const paquete = await getPaqueteById(packageId).catch(() => null);
  const commissionOverride =
    paquete?.bookingConfig?.referralCommission
      ? {
          type: paquete.bookingConfig.referralCommission.type,
          value: paquete.bookingConfig.referralCommission.value,
          currency: paquete.bookingConfig.referralCommission.currency,
        }
      : undefined;
  const payoutStatus =
    params.existingPayoutStatus === 'paid'
      ? params.existingPayoutStatus
      : nextPayoutStatusForReservationStatus(params.status);
  const vendorId = String(params.vendorId ?? '').trim();
  const selectedVendor = vendorId ? await getVendorById(vendorId).catch(() => null) : null;

  if (vendorId) {
    if (!selectedVendor || !selectedVendor.active) {
      throw new Error('El vendedor seleccionado no está disponible.');
    }
    const allowedPackages = selectedVendor.allowedPackages ?? selectedVendor.allowedExperiences ?? null;
    if (
      Array.isArray(allowedPackages) &&
      allowedPackages.length > 0 &&
      !allowedPackages.includes(packageId)
    ) {
      throw new Error('El vendedor seleccionado no opera este paquete.');
    }
  }

  const referralCode = String(params.referralCode ?? '').trim();
  if (referralCode) {
    const link = await getReferralByCode(referralCode).catch(() => null);
    if (link) {
      if (link.experienceId && String(link.experienceId) !== packageId) {
        throw new Error('El código elegido no corresponde a este paquete.');
      }
      const vendor = await getVendorById(link.vendorId).catch(() => null);
      if (!vendor || !vendor.active) {
        throw new Error('El vendedor asociado al código no está disponible.');
      }
      const allowedPackages = vendor.allowedPackages ?? vendor.allowedExperiences ?? null;
      if (Array.isArray(allowedPackages) && allowedPackages.length > 0 && !allowedPackages.includes(packageId)) {
        throw new Error('El vendedor no tiene habilitado este paquete.');
      }
      if (selectedVendor && vendor.id !== selectedVendor.id) {
        throw new Error('El código ingresado pertenece a otro vendedor.');
      }
      const comm = computeCommission({
        amountTotal: params.amountTotal,
        commissionBaseAmount: params.commissionBaseAmount,
        extrasExcludedAmount: params.extrasExcludedAmount,
        people: params.people,
        vendor,
        commissionOverride,
      });
      return {
        vendorId: vendor.id,
        vendorName: vendor.name,
        code: link.code,
        channel: 'link' as const,
        commissionType: comm.type,
        commissionValue: comm.value,
        commissionCurrency: comm.currency,
        commissionAmount: comm.commissionAmount,
        commissionBaseAmount: params.commissionBaseAmount,
        extrasExcludedAmount: params.extrasExcludedAmount,
        payoutStatus,
      };
    }

    if (!selectedVendor) {
      throw new Error('El código de vendedor no existe o está inactivo.');
    }

    const comm = computeCommission({
      amountTotal: params.amountTotal,
      commissionBaseAmount: params.commissionBaseAmount,
      extrasExcludedAmount: params.extrasExcludedAmount,
      people: params.people,
      vendor: selectedVendor,
      commissionOverride,
    });
    return {
      vendorId: selectedVendor.id,
      vendorName: selectedVendor.name,
      code: referralCode,
      channel: 'manual' as const,
      commissionType: comm.type,
      commissionValue: comm.value,
      commissionCurrency: comm.currency,
      commissionAmount: comm.commissionAmount,
      commissionBaseAmount: params.commissionBaseAmount,
      extrasExcludedAmount: params.extrasExcludedAmount,
      payoutStatus,
    };
  }

  if (selectedVendor) {
    const comm = computeCommission({
      amountTotal: params.amountTotal,
      commissionBaseAmount: params.commissionBaseAmount,
      extrasExcludedAmount: params.extrasExcludedAmount,
      people: params.people,
      vendor: selectedVendor,
      commissionOverride,
    });
    return {
      vendorId: selectedVendor.id,
      vendorName: selectedVendor.name,
      channel: 'manual' as const,
      commissionType: comm.type,
      commissionValue: comm.value,
      commissionCurrency: comm.currency,
      commissionAmount: comm.commissionAmount,
      commissionBaseAmount: params.commissionBaseAmount,
      extrasExcludedAmount: params.extrasExcludedAmount,
      payoutStatus,
    };
  }

  return null;
}

function resolvePickupPointTime(paquete: Awaited<ReturnType<typeof getPaqueteById>> | null, pickupPoint: string, rawTime?: string | null): string | null {
  const incoming = String(rawTime ?? '').trim();
  if (incoming) return incoming;
  const config = Array.isArray((paquete as any)?.pickupPointsConfig) ? (paquete as any).pickupPointsConfig : [];
  const found = config.find((item: any) => String(item?.label ?? '').trim() === pickupPoint);
  const time = found ? String(found?.time ?? '').trim() : '';
  return time || null;
}

function computeVoucherNextAttemptAt(params: {
  date: string;
  pickupPointTime?: string | null;
  now: Timestamp;
}): Timestamp {
  const date = String(params.date ?? '').trim();
  const time = String(params.pickupPointTime ?? '').trim();
  if (!date || date === 'sin-fecha') return params.now;
  const hhmm = /^\d{2}:\d{2}$/.test(time) ? time : '09:00';
  const ts = new Date(`${date}T${hhmm}:00-03:00`).getTime();
  if (!Number.isFinite(ts) || ts <= 0) return params.now;
  const dueMs = ts - 48 * 60 * 60 * 1000;
  const nowMs = params.now.toMillis();
  if (dueMs <= nowMs + 30 * 1000) return params.now;
  return Timestamp.fromMillis(dueMs);
}

function getReservationEmailCopy(
  type: 'cliente_confirmacion_compra' | 'cliente_voucher_48hs' | 'admin_aviso',
  reservation: any
) {
  const reservationCode = String((reservation as any).reservationCode ?? reservation.id);
  const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  const lookupUrl = siteUrl
    ? `${siteUrl}/consultar-reserva?code=${encodeURIComponent(reservationCode)}`
    : undefined;
  const peopleLabel = reservation.people === 1 ? '1 persona' : `${reservation.people} personas`;
  const seatsLabel = Array.isArray((reservation as any).selectedSeats) && (reservation as any).selectedSeats.length > 0
    ? (reservation as any).selectedSeats.join(', ')
    : undefined;
  const emailData = {
    customerName: reservation.customerName ?? '',
    experienceTitle: reservation.packageTitle || reservation.experienceTitle || SITE_NAME,
    dateFormatted: formatEmailDate(reservation.date),
    peopleLabel,
    seatsLabel,
    amountFormatted: formatEmailAmount(reservation.amountTotal ?? 0, reservation.currency ?? 'ARS'),
    reservationCode,
    lookupUrl,
    sessionId: reservation.orderId || reservation.id,
    customerEmail: reservation.customerEmail ?? '',
    customerPhone: reservation.customerPhone,
    customerCountry: reservation.customerCountry,
    customerComments: reservation.customerComments,
    pickupPoint: (reservation as any).pickupPoint ?? null,
    pickupPointTime: (reservation as any).pickupPointTime ?? null,
  };

  const subject =
    type === 'cliente_confirmacion_compra'
      ? `Compra confirmada: ${reservation.packageTitle || reservation.experienceTitle || SITE_NAME}`
      : type === 'cliente_voucher_48hs'
        ? `Recordatorio de salida (48 hs): ${reservation.packageTitle || reservation.experienceTitle || SITE_NAME}`
        : `Nueva venta: ${reservation.packageTitle || reservation.experienceTitle || 'Paquete'} — ${reservation.customerName || reservation.customerEmail}`;
  const to =
    type === 'cliente_confirmacion_compra' || type === 'cliente_voucher_48hs'
      ? reservation.customerEmail
      : CONTACT_INFO.email;
  const html =
    type === 'cliente_confirmacion_compra'
      ? buildClienteCompraConfirmadaHtml(emailData)
      : type === 'cliente_voucher_48hs'
        ? buildClienteVoucher48hsHtml(emailData)
        : buildAdminNuevaReservaHtml(emailData);
  const text =
    type === 'cliente_confirmacion_compra'
      ? buildClienteCompraConfirmadaText(emailData)
      : type === 'cliente_voucher_48hs'
        ? buildClienteVoucher48hsText(emailData)
        : buildAdminNuevaReservaText(emailData);

  return {
    to,
    from: getFromEmail(),
    subject,
    html,
    text,
  };
}

function getFriendlyEmailError(type: 'cliente_confirmacion_compra' | 'cliente_voucher_48hs' | 'admin_aviso') {
  if (type === 'cliente_voucher_48hs') return 'No se pudo enviar el voucher en este momento.';
  if (type === 'cliente_confirmacion_compra') return 'No se pudo enviar la confirmación en este momento.';
  return 'No se pudo enviar el aviso interno en este momento.';
}

async function enqueueReservationEmailJob(options: {
  reservationId: string;
  type: 'cliente_confirmacion_compra' | 'cliente_voucher_48hs' | 'admin_aviso';
  nextAttemptAt?: Timestamp;
  jobId?: string;
}) {
  const reservation = await getReservaById(options.reservationId);
  if (!reservation) throw new Error('Venta no encontrada');
  const copy = getReservationEmailCopy(options.type, reservation);

  const now = Timestamp.now();
  const jobId = options.jobId || `${options.reservationId}_${options.type}_${Date.now()}`;
  const emailJobRef = doc(db, 'emailJobs', jobId);
  const reservationRef = doc(db, COLLECTION, options.reservationId);

  await setDoc(
    emailJobRef,
    buildEmailJobDocument({
      type: options.type,
      to: copy.to,
      from: copy.from,
      subject: copy.subject,
      html: copy.html,
      text: copy.text,
      reservationId: options.reservationId,
      now,
      nextAttemptAt: options.nextAttemptAt || now,
    })
  );

  await updateDoc(reservationRef, {
    [emailDeliveryPathForJobType(options.type)]: buildEmailDeliveryState({
      status: 'queued',
      now,
      jobId,
    }),
    updatedAt: now,
  }).catch(() => null);

  return jobId;
}

async function cancelQueuedReservationVoucherEmails(reservationId: string) {
  const jobsRef = collection(db, 'emailJobs');
  const snapshot = await getDocs(
    query(jobsRef, where('reservationId', '==', reservationId), where('type', '==', 'cliente_voucher_48hs'))
  );
  await Promise.all(
    snapshot.docs
      .filter((job) => {
        const status = String((job.data() as any)?.status ?? '');
        return status === 'pending' || status === 'failed';
      })
      .map((job) => deleteDoc(job.ref).catch(() => null))
  );
}

async function sendReservationVoucherNow(reservationId: string) {
  if (!isResendConfigured() || !resend) {
    throw new Error('El servicio de correo no está configurado.');
  }

  const reservation = await getReservaById(reservationId);
  if (!reservation) throw new Error('Venta no encontrada');

  await cancelQueuedReservationVoucherEmails(reservationId);

  const copy = getReservationEmailCopy('cliente_voucher_48hs', reservation);
  if (!copy.to || !copy.subject || !copy.html) {
    throw new Error('No se pudo preparar el voucher para enviar.');
  }

  const reservationRef = doc(db, COLLECTION, reservationId);
  const deliveryPath = emailDeliveryPathForJobType('cliente_voucher_48hs');
  const queuedAt = Timestamp.now();
  const jobId = `${reservationId}_cliente_voucher_manual_${Date.now()}`;

  await updateDoc(reservationRef, {
    [deliveryPath]: buildEmailDeliveryState({
      status: 'queued',
      now: queuedAt,
      jobId,
    }),
    voucherScheduledAt: null,
    updatedAt: queuedAt,
  }).catch(() => null);

  try {
    const { data, error } = await resend.emails.send({
      from: copy.from,
      to: copy.to,
      subject: copy.subject,
      html: copy.html,
      text: copy.text ?? undefined,
    });

    if (error) {
      throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
    }

    const sentAt = Timestamp.now();
    await updateDoc(reservationRef, {
      [deliveryPath]: buildEmailDeliveryState({
        status: 'sent',
        now: sentAt,
        jobId,
        provider: 'resend',
        providerMessageId: data?.id ?? null,
      }),
      voucherSent: true,
      voucherSentAt: sentAt,
      voucherScheduledAt: null,
      updatedAt: sentAt,
    }).catch(() => null);
  } catch (error) {
    const failedAt = Timestamp.now();
    await updateDoc(reservationRef, {
      [deliveryPath]: buildEmailDeliveryState({
        status: 'failed',
        now: failedAt,
        jobId,
        provider: 'resend',
        error: getFriendlyEmailError('cliente_voucher_48hs'),
      }),
      voucherScheduledAt: null,
      updatedAt: failedAt,
    }).catch(() => null);
    throw error;
  }
}

export async function POST(request: Request) {
  let creatorAuth: ReservationCreatorAuth;
  try {
    creatorAuth = await requireReservationCreatorAuth(request);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, 'Autenticación inválida') },
      { status: 401 }
    );
  }

  let payload: z.infer<typeof adminReservaSchema>;
  try {
    const body = await request.json();
    payload = adminReservaSchema.parse({
      ...body,
      date: parseDate(body.date),
    });
  } catch (error) {
    console.error('[admin/reservas] Error parseando payload:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors.map((item) => item.message).join(', ') },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const paquete = await getPaqueteById(payload.packageId);
  if (!paquete) {
    return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 });
  }

  try {
    const packageSlug = paquete.slug ?? paquete.id;
    const bc = paquete.bookingConfig;
    const departureConfig = resolveDepartureConfig(paquete, payload.date);
    const maxPeople = departureConfig.maxPeople;
    const adults = Math.max(0, Number((payload as any).peopleAdults ?? 0) || 0);
    const minors = Math.max(0, Number((payload as any).peopleMinors ?? 0) || 0);
    const derivedPeople = adults + minors;
    const people = derivedPeople > 0 ? derivedPeople : Math.max(1, Number((payload as any).people ?? 1) || 1);
    const peopleAdults = derivedPeople > 0 ? adults : null;
    const peopleMinors = derivedPeople > 0 ? minors : null;
    const depositPercentAdults = typeof (payload as any).depositPercentAdults === 'number' ? Number((payload as any).depositPercentAdults) : null;
    const depositPercentMinors = typeof (payload as any).depositPercentMinors === 'number' ? Number((payload as any).depositPercentMinors) : null;
    const allowOverbook = Boolean((payload as any).allowOverbook);
    const effectiveVendorId =
      creatorAuth.kind === 'vendor'
        ? creatorAuth.vendor.id
        : typeof payload.vendorId === 'string'
          ? payload.vendorId
          : undefined;

    if (creatorAuth.kind === 'vendor') {
      const allowedPackages =
        creatorAuth.vendor.allowedPackages ?? creatorAuth.vendor.allowedExperiences ?? null;
      if (
        Array.isArray(allowedPackages) &&
        allowedPackages.length > 0 &&
        !allowedPackages.includes(payload.packageId)
      ) {
        return NextResponse.json(
          { error: 'No tenés permiso para crear reservas para este paquete.' },
          { status: 403 }
        );
      }
    }

    if (people > maxPeople) {
      return NextResponse.json({ error: `Máximo permitido por reserva: ${maxPeople}` }, { status: 400 });
    }
    if (!isEnabledDate(paquete, payload.date)) {
      return NextResponse.json({ error: 'La fecha seleccionada no está habilitada para este paquete.' }, { status: 400 });
    }

    const computedPricing = computeReservationPricing(paquete, payload.date, {
      people,
      peopleAdults,
      peopleMinors,
      depositPercentAdults,
      depositPercentMinors,
    });
    const pickupPoint = typeof payload.pickupPoint === 'string' ? payload.pickupPoint.trim() : '';
    const pickupPointTimeRaw =
      typeof payload.pickupPointTime === 'string' ? payload.pickupPointTime.trim() : '';
    const resolvedPickupPointTime = pickupPoint
      ? resolvePickupPointTime(paquete, pickupPoint, pickupPointTimeRaw || null)
      : null;
    const roomSelection = normalizeRoomSelection((payload as any).roomSelection);
    const roomType = roomSelection.length
      ? deriveLegacyRoomTypeFromSelection(roomSelection)
      : typeof payload.roomType === 'string' ? payload.roomType : null;
    const roomSelectionMetrics = roomSelection.length
      ? {
          selectionKey: roomSelection.map((item) => `${item.roomType}:${item.quantity}`).join('|'),
          totalRooms: roomSelection.reduce((sum, item) => sum + item.quantity, 0),
          totalCapacity: people,
          people,
          generatedAt: Timestamp.now(),
        }
      : null;
    if (!isPackageRoomTypeAvailable(paquete, roomType as any)) {
      return NextResponse.json(
        { error: 'La habitación seleccionada no está disponible para este paquete.' },
        { status: 400 }
      );
    }
    const currency = (computedPricing.currency ?? 'ars').toLowerCase() as 'ars' | 'brl' | 'usd';
    const unitAmount = computedPricing.unitAmount;
    if (computedPricing.pricingMode === 'percent' && computedPricing.baseUnitAmount < 1) {
      return NextResponse.json({ error: 'Falta precio base para calcular porcentaje.' }, { status: 400 });
    }
    if (!Number.isFinite(unitAmount) || unitAmount < 1 || computedPricing.subtotalAmount < 1) {
      return NextResponse.json({ error: 'Este paquete no tiene configurado un valor de reserva válido.' }, { status: 400 });
    }
    const amountTotal = computedPricing.subtotalAmount;

    const baseCapacity = payload.date !== 'sin-fecha' ? getBaseCapacity(paquete, payload.date) : 0;
    if (!allowOverbook && payload.date !== 'sin-fecha' && (payload.status ?? 'reserved') !== 'cancelled') {
      const available = await getStockDisponible(paquete.id, payload.date, baseCapacity);
      if (people > available) {
        return NextResponse.json(
          { error: `No hay cupo suficiente para esa fecha. Disponible: ${available}.` },
          { status: 400 }
        );
      }
    }

    const selectedSeats = Array.isArray(payload.selectedSeats)
      ? Array.from(new Set(payload.selectedSeats.map((s) => String(s).trim()).filter(Boolean)))
      : [];
    const seatsEnabled = departureConfig.seatsEnabled;
    const seatLayoutId = departureConfig.seatLayoutId ?? '';
    if (seatsEnabled) {
      if (!seatLayoutId) {
        return NextResponse.json({ error: 'La salida requiere butacas, pero no tiene plantilla asignada.' }, { status: 400 });
      }
      if (selectedSeats.length !== people) {
        return NextResponse.json({ error: 'Debés seleccionar una butaca por pasajero.' }, { status: 400 });
      }
    }

    let seatLayoutTemplateForExtras: SeatLayoutTemplate | null = null;
    if (seatLayoutId && selectedSeats.length > 0) {
      const templateSnap = await getDoc(doc(db, 'seatLayouts', seatLayoutId));
      if (!templateSnap.exists()) {
        return NextResponse.json({ error: 'Plantilla de micro no encontrada.' }, { status: 400 });
      }
      seatLayoutTemplateForExtras = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
    }
    const selectedExtras = resolveReservationExtraSelections({
      paquete,
      pickupPoint: pickupPoint || null,
      selectedSeats,
      seatLayoutTemplate: seatLayoutTemplateForExtras,
    });
    const repriced = computeReservationPricing(paquete, payload.date, {
      people,
      peopleAdults,
      peopleMinors,
      depositPercentAdults,
      depositPercentMinors,
      roomType,
      selectedExtras,
    });
    const pricedSelectedExtras = withSinglePassengerSurcharge({
      selectedExtras,
      baseSubtotalAmount: repriced.baseSubtotalAmount,
      people,
    });

    let referredBy = null;
    try {
      referredBy = await resolveReservationReferralAssignment({
        packageId: paquete.id,
        amountTotal: repriced.subtotalAmount,
        commissionBaseAmount: getReservationOfficialBaseAmount({
          pricingBaseUnitAmount: repriced.baseUnitAmount,
          people,
          baseSubtotalAmount: repriced.baseSubtotalAmount,
          amountTotal: repriced.subtotalAmount,
          extrasTotalAmount: repriced.extrasTotalAmount,
        }),
        extrasExcludedAmount: repriced.extrasTotalAmount,
        people,
        status: payload.status ?? 'reserved',
        vendorId: effectiveVendorId,
        referralCode: payload.referralCode,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'No se pudo asignar el referido.' },
        { status: 400 }
      );
    }

    const now = Timestamp.now();
    const status = payload.status ?? 'reserved';
    const reservaRef = doc(collection(db, COLLECTION));
    const stockRef = payload.date !== 'sin-fecha' ? doc(db, 'stockMovimientos', `admin_${reservaRef.id}`) : null;

    try {
      await runTransaction(db, async (tx) => {
        const reservationCodeAllocation = await prepareNextReservationCodeInTransaction(tx);
        let pendingStockCreate: Record<string, any> | null = null;
        let pendingSeatReservationWrite:
          | {
              ref: ReturnType<typeof doc>;
              data: Record<string, any>;
              initialize: boolean;
            }
          | null = null;

        if (stockRef && status !== 'cancelled') {
          const stockSnap = await tx.get(stockRef);
          if (!stockSnap.exists()) {
            pendingStockCreate = {
              packageId: paquete.id,
              date: payload.date,
              type: 'reserva',
              quantity: -people,
              author:
                creatorAuth.email ??
                (creatorAuth.kind === 'vendor' ? creatorAuth.vendor.email : 'admin'),
              referenceId: reservaRef.id,
              note: payload.statusNote ?? `Reserva manual creada (${status})${allowOverbook ? ' · OVERBOOK' : ''}`,
              baseCapacityAtThatTime: baseCapacity,
              amountTotal: repriced.subtotalAmount,
              currency,
              createdAt: now,
            };
          }
        }

        if (seatsEnabled && seatLayoutId && payload.date !== 'sin-fecha') {
          const templateSnap = await tx.get(doc(db, 'seatLayouts', seatLayoutId));
          if (!templateSnap.exists()) {
            throw new Error('Plantilla de micro no encontrada.');
          }
          const template = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
          const baseSeats = buildBaseSeatReservationSeats(template);
          const departureId = getSeatDepartureId(paquete.id, payload.date);
          const seatResRef = doc(db, 'seatReservations', departureId);
          const seatResSnap = await tx.get(seatResRef);
          const seatResData: any = seatResSnap.exists() ? seatResSnap.data() : null;
          const currentLayoutId = seatResData ? String(seatResData?.seatLayoutId ?? '') : '';
          const seatsMap: Record<string, any> =
            seatResSnap.exists() && currentLayoutId === seatLayoutId
              ? { ...(seatResData?.seats ?? {}) }
              : { ...baseSeats };

          const seatIds = seatIdsFromLabels(template, selectedSeats);
          if (seatIds.length !== selectedSeats.length) throw new Error('Una o más butacas no existen en la plantilla.');

          for (const seatId of seatIds) {
            const current = seatsMap[seatId] ?? baseSeats[seatId];
            if (!current) throw new Error('Una o más butacas no existen en la plantilla.');
            const s = String(current.status ?? 'available') as SeatStatus;
            if (s !== 'available') throw new Error('Una o más butacas no están disponibles.');
          }

          const seatTargetStatus: SeatStatus = status === 'completed' ? 'paid' : 'reserved';
          for (const seatId of seatIds) {
            seatsMap[seatId] = {
              status: seatTargetStatus,
              holdId: null,
              cartId: null,
              cartItemId: null,
              orderId: null,
              reservationId: reservaRef.id,
              expiresAt: null,
              blockedBy: null,
              updatedAt: now,
            };
          }
          pendingSeatReservationWrite = {
            ref: seatResRef,
            initialize: !seatResSnap.exists() || currentLayoutId !== seatLayoutId,
            data: {
              packageId: paquete.id,
              date: payload.date,
              seatLayoutId,
              seats: seatsMap,
              ...(seatResSnap.exists() && currentLayoutId === seatLayoutId ? {} : { createdAt: now }),
              updatedAt: now,
            },
          };
        }

        const attachments =
          payload.attachments?.map((attachment) => ({
            id: randomUUID(),
            name: attachment.name,
            type: attachment.type,
            url: attachment.url,
            uploadedBy: attachment.uploadedBy ?? 'admin',
            key: attachment.key,
            createdAt: now,
          })) ?? [];

        const reservationCode = reservationCodeAllocation.reservationCode;
        const customerEmail = payload.customerEmail.trim() || null;
        const customerEmailLower = normalizeEmail(customerEmail);
        const fullName = payload.customerName || `${payload.customerFirstName} ${payload.customerLastName}`.trim();
        const customerNameLower = fullName.trim().toLowerCase() || null;
        const customerPhoneNormalized = normalizeDigits(payload.customerPhone);
        const customerDocumentNormalized = normalizeDigits(payload.customerDocument);

        reservationCodeAllocation.commit();
        if (pendingStockCreate && stockRef) {
          tx.set(stockRef, pendingStockCreate);
        }
        if (pendingSeatReservationWrite) {
          tx.set(pendingSeatReservationWrite.ref, pendingSeatReservationWrite.data, { merge: true });
        }

        tx.set(reservaRef, {
          packageId: paquete.id,
          packageSlug: paquete.slug,
          packageTitle: paquete.titulo,
          experienceId: paquete.id,
          experienceSlug: paquete.slug,
          experienceTitle: paquete.titulo,
          date: payload.date,
          people,
          peopleAdults,
          peopleMinors,
          seatLayoutId: seatsEnabled ? seatLayoutId : null,
          selectedSeats: seatsEnabled ? (selectedSeats.length ? selectedSeats : null) : null,
          pricingMode: computedPricing.pricingMode,
          pricingBaseUnitAmount: repriced.baseUnitAmount,
          unitAmountAdults: repriced.unitAmountAdults,
          unitAmountMinors: repriced.unitAmountMinors,
          depositPercentAdults: repriced.depositPercentAdults,
          depositPercentMinors: repriced.depositPercentMinors,
          baseSubtotalAmount: repriced.baseSubtotalAmount,
          extrasTotalAmount: repriced.extrasTotalAmount,
          pickupPoint: pickupPoint || null,
          pickupPointTime: resolvedPickupPointTime,
          roomType,
          roomSelection: roomSelection.length ? roomSelection : null,
          roomSelectionMetrics,
          selectedExtras: pricedSelectedExtras.length ? pricedSelectedExtras : null,
          amountTotal: repriced.subtotalAmount,
          currency,
          paymentMethod: 'admin',
          customerEmail,
          customerEmailLower,
          customerName: fullName,
          customerNameLower,
          customerFirstName: payload.customerFirstName,
          customerLastName: payload.customerLastName,
          customerPhone: payload.customerPhone ?? null,
          customerPhoneNormalized,
          customerCountry: payload.customerCountry ?? null,
          customerDocument: payload.customerDocument ?? null,
          customerDocumentNormalized,
          customerBirthDate: payload.customerBirthDate ?? null,
          customerComments: payload.customerComments ?? null,
          passengerDetails: payload.passengerDetails ?? [],
          reservationCode,
          attachments: attachments.length ? attachments : [],
          status,
          createdByAdmin: creatorAuth.kind === 'admin',
          pricingSnapshot: buildReservationPricingSnapshot({
            unitAmount: repriced.subtotalAmount > 0 && people > 0 ? Math.round(repriced.subtotalAmount / people) : unitAmount,
            people,
            amountTotal: repriced.subtotalAmount,
            baseSubtotalAmount: repriced.baseSubtotalAmount,
            extrasTotalAmount: repriced.extrasTotalAmount,
            currency,
            paymentMethod: 'admin',
          }),
          capacitySnapshot: {
            date: payload.date,
            baseCapacity,
            maxPeoplePerBooking: departureConfig.maxPeople,
            hasSpecificDates: Boolean(paquete.salidas?.length),
            enabled: departureConfig.enabled,
          },
          experienceSnapshot: {
            id: paquete.id,
            slug: paquete.slug,
            title: paquete.titulo,
          },
          packageSnapshot: {
            id: paquete.id,
            slug: paquete.slug,
            title: paquete.titulo,
          },
          statusHistory: [
            {
              status,
              actor: 'admin',
              note: payload.statusNote ?? 'Reserva creada',
              createdAt: now,
            },
          ],
          paidAt: null,
          voucherSent: false,
          voucherSentAt: null,
          emailDelivery: buildDefaultEmailDelivery(),
          createdAt: now,
          updatedAt: now,
          ...(referredBy ? { referredBy } : {}),
        });
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'No se pudo guardar la reserva', detail: getErrorMessage(error) },
        { status: 400 }
      );
    }

    return NextResponse.json({ id: reservaRef.id });
  } catch (error) {
    console.error('[admin/reservas] Error guardando reserva manual:', error);
    return NextResponse.json(
      { error: 'No se pudo guardar la reserva', detail: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  let adminUser;
  try {
    adminUser = await requireAuth(request);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, 'Autenticación inválida') },
      { status: 401 }
    );
  }

  let payload: z.infer<typeof adminUpdateSchema>;
  try {
    payload = adminUpdateSchema.parse(await request.json());
  } catch (error) {
    console.error('[admin/reservas] Error parseando PATCH:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors.map((item) => item.message).join(', ') },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const reservation = await getReservaById(payload.reservationId);
  if (!reservation) {
    return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
  }

  try {
    if (payload.status && payload.status !== reservation.status) {
      // Validación de cupo si se reactiva una cancelada.
      if (reservation.status === 'cancelled' && payload.status !== 'cancelled' && reservation.date !== 'sin-fecha') {
        const paquete = await getPaqueteById(reservation.packageId ?? reservation.experienceId);
        const baseCapacity = getBaseCapacity(paquete, reservation.date);
        const available = await getStockDisponible(reservation.packageId ?? reservation.experienceId, reservation.date, baseCapacity);
        if (reservation.people > available) {
          return NextResponse.json(
            { error: `No hay cupo suficiente para reactivar. Disponible: ${available}.` },
            { status: 400 }
          );
        }
      }

      const hasSeats = Array.isArray((reservation as any).selectedSeats) && (reservation as any).selectedSeats.length > 0;
      const seatLayoutId = (reservation as any).seatLayoutId ? String((reservation as any).seatLayoutId) : '';
      const shouldTouchSeats = hasSeats && seatLayoutId && reservation.date && reservation.date !== 'sin-fecha';
      if (shouldTouchSeats) {
        const paquete = await getPaqueteById(reservation.packageId ?? reservation.experienceId);
        const seatsEnabled = paquete ? resolveDepartureConfig(paquete, reservation.date).seatsEnabled : false;
        if (seatsEnabled) {
          const selectedSeatLabels = (reservation as any).selectedSeats.map((s: any) => String(s));
          const nextSeatStatus: SeatStatus = payload.status === 'completed' ? 'paid' : payload.status === 'cancelled' ? 'available' : 'reserved';
          const seatDepartureId = getSeatDepartureId(String(reservation.packageId ?? reservation.experienceId), reservation.date);
          const seatResRef = doc(db, 'seatReservations', seatDepartureId);
          const templateRef = doc(db, 'seatLayouts', seatLayoutId);
          try {
            await runTransaction(db, async (tx) => {
              const templateSnap = await tx.get(templateRef);
              if (!templateSnap.exists()) throw new Error('Plantilla de micro no encontrada.');
              const template = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
              const seatIds = seatIdsFromLabels(template, selectedSeatLabels);
              if (seatIds.length !== selectedSeatLabels.length) throw new Error('Una o más butacas no existen en la plantilla.');

              const seatResSnap = await tx.get(seatResRef);
              if (!seatResSnap.exists()) throw new Error('No se encontró el mapa de butacas para esta salida.');
              const seatResData: any = seatResSnap.data();
              const seatsMap: Record<string, any> = { ...(seatResData?.seats ?? {}) };

              if (payload.status !== 'cancelled') {
                for (const seatId of seatIds) {
                  const seat = seatsMap[seatId];
                  if (!seat) throw new Error('Una o más butacas no existen en la salida.');
                  const s = String(seat.status ?? 'available') as SeatStatus;
                  if (s === 'available') continue;
                  if (String(seat.reservationId ?? '') === reservation.id) continue;
                  throw new Error('Una o más butacas ya no están disponibles.');
                }
              }

              for (const seatId of seatIds) {
                const seat = seatsMap[seatId];
                if (!seat) continue;
                if (payload.status === 'cancelled') {
                  if (String(seat.reservationId ?? '') !== reservation.id) continue;
                  seatsMap[seatId] = { status: 'available', holdId: null, cartId: null, cartItemId: null, orderId: null, reservationId: null, expiresAt: null, blockedBy: null, updatedAt: Timestamp.now() };
                } else {
                  seatsMap[seatId] = { status: nextSeatStatus, holdId: null, cartId: null, cartItemId: null, orderId: (reservation as any).orderId ?? null, reservationId: reservation.id, expiresAt: null, blockedBy: null, updatedAt: Timestamp.now() };
                }
              }

              tx.set(seatResRef, { seats: seatsMap, updatedAt: Timestamp.now() }, { merge: true });
            });
          } catch (error) {
            return NextResponse.json(
              { error: getErrorMessage(error, 'No se pudo actualizar butacas') },
              { status: 400 }
            );
          }
        }
      }

      if (payload.status === 'cancelled') {
        const paquete = await getPaqueteById(reservation.packageId ?? reservation.experienceId);
        const baseCapacity = getBaseCapacity(paquete, reservation.date);
        await registrarMovimientoStock({
          packageId: reservation.packageId ?? reservation.experienceId,
          date: reservation.date,
          type: 'entrada',
          quantity: reservation.people,
          author: adminUser?.email ?? 'admin',
          referenceId: reservation.id,
          note: payload.note ?? 'Cancelación de reserva',
          baseCapacityAtThatTime: baseCapacity,
          amountTotal: reservation.amountTotal ?? 0,
          currency: reservation.currency,
        });
      } else if (reservation.status === 'cancelled') {
        const paquete = await getPaqueteById(reservation.packageId ?? reservation.experienceId);
        const baseCapacity = getBaseCapacity(paquete, reservation.date);
        await registrarMovimientoStock({
          packageId: reservation.packageId ?? reservation.experienceId,
          date: reservation.date,
          type: 'reserva',
          quantity: -reservation.people,
          author: adminUser?.email ?? 'admin',
          referenceId: reservation.id,
          note: payload.note ?? 'Reserva reactivada',
          baseCapacityAtThatTime: baseCapacity,
          amountTotal: reservation.amountTotal ?? 0,
          currency: reservation.currency,
        });
      }
      await updateReservaStatus(payload.reservationId, payload.status, {
        note: payload.note,
      });
      if (payload.status === 'completed' || payload.status === 'cancelled') {
        const payoutStatus = nextPayoutStatusForReservationStatus(payload.status);
        await updateDoc(doc(db, COLLECTION, payload.reservationId), {
          'referredBy.payoutStatus': payoutStatus,
          updatedAt: Timestamp.now(),
        }).catch(() => null);
      }
    }
    if (payload.date && payload.date !== reservation.date) {
      const paquete = await getPaqueteById(reservation.packageId ?? reservation.experienceId);
      if (!paquete) {
        return NextResponse.json({ error: 'Paquete no encontrado' }, { status: 404 });
      }
      if (!isEnabledDate(paquete, payload.date)) {
        return NextResponse.json({ error: 'La nueva fecha no está habilitada para este paquete.' }, { status: 400 });
      }
      const baseCapacityNew = payload.date !== 'sin-fecha' ? getBaseCapacity(paquete, payload.date) : 0;
      const baseCapacityOld = reservation.date !== 'sin-fecha' ? getBaseCapacity(paquete, reservation.date) : 0;

      // Si la reserva está activa, mover cupo: liberar fecha vieja y reservar fecha nueva.
      if (reservation.status !== 'cancelled' && reservation.date !== 'sin-fecha' && payload.date !== 'sin-fecha') {
        const availableNew = await getStockDisponible(reservation.packageId ?? reservation.experienceId, payload.date, baseCapacityNew);
        if (reservation.people > availableNew) {
          return NextResponse.json(
            { error: `No hay cupo suficiente en la nueva fecha. Disponible: ${availableNew}.` },
            { status: 400 }
          );
        }
        await registrarMovimientoStock({
          packageId: reservation.packageId ?? reservation.experienceId,
          date: reservation.date,
          type: 'entrada',
          quantity: reservation.people,
          author: adminUser?.email ?? 'admin',
          referenceId: reservation.id,
          note: payload.note ?? `Reprogramación: libera ${reservation.date}`,
          baseCapacityAtThatTime: baseCapacityOld,
          amountTotal: reservation.amountTotal ?? 0,
          currency: reservation.currency,
        });
        await registrarMovimientoStock({
          packageId: reservation.packageId ?? reservation.experienceId,
          date: payload.date,
          type: 'reserva',
          quantity: -reservation.people,
          author: adminUser?.email ?? 'admin',
          referenceId: reservation.id,
          note: payload.note ?? `Reprogramación: reserva ${payload.date}`,
          baseCapacityAtThatTime: baseCapacityNew,
          amountTotal: reservation.amountTotal ?? 0,
          currency: reservation.currency,
        });
      }

      const historyEntry = {
        status: reservation.status,
        actor: 'admin' as const,
        note: payload.note ?? `Reprogramada a ${payload.date}`,
        createdAt: Timestamp.now(),
      };
      await updateDoc(doc(db, COLLECTION, payload.reservationId), {
        date: payload.date,
        updatedAt: Timestamp.now(),
        statusHistory: arrayUnion(historyEntry),
        capacitySnapshot: {
          date: payload.date,
          baseCapacity: baseCapacityNew,
          maxPeoplePerBooking: typeof paquete.bookingConfig?.maxPeoplePerBooking === 'number' ? paquete.bookingConfig.maxPeoplePerBooking : null,
          hasSpecificDates: Boolean(paquete.bookingConfig?.hasSpecificDates),
          enabled: paquete.bookingConfig?.enabled !== false,
        },
      });

      const paidAt = (reservation as any).paidAt;
      const voucherAlreadySent = Boolean((reservation as any).voucherSent);
      const customerEmail = String((reservation as any).customerEmail ?? '').trim();
      if (payload.date === 'sin-fecha') {
        await updateDoc(doc(db, COLLECTION, payload.reservationId), {
          voucherScheduledAt: null,
          updatedAt: Timestamp.now(),
        }).catch(() => null);
      } else if (paidAt && !voucherAlreadySent && customerEmail) {
        const now = Timestamp.now();
        const pickupPointTime = (reservation as any).pickupPointTime ? String((reservation as any).pickupPointTime).trim() : null;
        const nextAttemptAt = computeVoucherNextAttemptAt({ date: payload.date, pickupPointTime, now });
        const existingJobId = (reservation as any).emailDelivery?.customerVoucher?.jobId;
        const jobId = existingJobId ? String(existingJobId) : `${payload.reservationId}_cliente_voucher`;
        await enqueueReservationEmailJob({
          reservationId: payload.reservationId,
          type: 'cliente_voucher_48hs',
          nextAttemptAt,
          jobId,
        });
        await updateDoc(doc(db, COLLECTION, payload.reservationId), {
          voucherScheduledAt: nextAttemptAt,
          voucherSent: false,
          voucherSentAt: null,
          updatedAt: now,
        }).catch(() => null);
      }
    }

    if (payload.roomType || (payload as any).roomSelection) {
      const roomSelection = normalizeRoomSelection((payload as any).roomSelection);
      const roomType = roomSelection.length
        ? deriveLegacyRoomTypeFromSelection(roomSelection)
        : payload.roomType ?? null;
      await updateDoc(doc(db, COLLECTION, payload.reservationId), {
        roomType,
        roomSelection: roomSelection.length ? roomSelection : null,
        updatedAt: Timestamp.now(),
      });
    }

    // Actualización de datos del cliente y operativos (edición completa)
    {
      const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const updates: Record<string, any> = {};

      if (typeof payload.customerFirstName === 'string') updates.customerFirstName = payload.customerFirstName.trim();
      if (typeof payload.customerLastName === 'string') updates.customerLastName = payload.customerLastName.trim();

      if (typeof payload.customerEmail === 'string') {
        const email = payload.customerEmail.trim().toLowerCase();
        if (email && !EMAIL_REGEX.test(email)) {
          return NextResponse.json({ error: 'Email inválido.' }, { status: 400 });
        }
        updates.customerEmail = email;
      }
      if (typeof payload.customerPhone === 'string') updates.customerPhone = payload.customerPhone.trim();
      if (typeof payload.customerCountry === 'string') updates.customerCountry = payload.customerCountry.trim();
      if (typeof payload.customerDocument === 'string') updates.customerDocument = payload.customerDocument.trim();
      if (payload.customerBirthDate !== undefined) {
        updates.customerBirthDate = typeof payload.customerBirthDate === 'string' ? payload.customerBirthDate.trim() : '';
      }
      if (typeof payload.customerComments === 'string') updates.customerComments = payload.customerComments.trim();

      if (typeof payload.pickupPoint === 'string') updates.pickupPoint = payload.pickupPoint.trim();
      if (payload.pickupPointTime !== undefined) {
        updates.pickupPointTime = payload.pickupPointTime
          ? String(payload.pickupPointTime).trim()
          : null;
      }

      if (Array.isArray(payload.selectedSeats)) updates.selectedSeats = payload.selectedSeats;
      if (typeof payload.seatType === 'string') {
        const seatTypeVal = payload.seatType.trim().slice(0, 80);
        if (seatTypeVal) updates.seatType = seatTypeVal;
        else updates.seatType = null;
      }
      if (Array.isArray(payload.passengerDetails)) updates.passengerDetails = payload.passengerDetails;

      let nextPeople = reservation.people;
      let nextAdults = (reservation as any).peopleAdults ?? null;
      let nextMinors = (reservation as any).peopleMinors ?? null;
      if (typeof payload.people === 'number') {
        nextPeople = Math.max(1, Math.min(50, Math.floor(payload.people)));
      }
      if (typeof payload.peopleAdults === 'number' || typeof payload.peopleMinors === 'number') {
        const a = typeof payload.peopleAdults === 'number' ? payload.peopleAdults : nextAdults ?? 0;
        const m = typeof payload.peopleMinors === 'number' ? payload.peopleMinors : nextMinors ?? 0;
        nextAdults = a;
        nextMinors = m;
        const derivedPeople = Math.max(1, a + m);
        if (typeof payload.people !== 'number') nextPeople = derivedPeople;
        if (nextPeople > 50 || nextPeople < 1) {
          return NextResponse.json({ error: 'Cantidad de pasajeros inválida.' }, { status: 400 });
        }
        updates.peopleAdults = nextAdults;
        updates.peopleMinors = nextMinors;
        updates.people = nextPeople;
      } else if (typeof payload.people === 'number') {
        if (nextPeople > 50 || nextPeople < 1) {
          return NextResponse.json({ error: 'Cantidad de pasajeros inválida.' }, { status: 400 });
        }
        // When only `people` is sent (no adults/minors breakdown), assume all adults
        nextAdults = nextPeople;
        nextMinors = 0;
        updates.people = nextPeople;
        updates.peopleAdults = nextAdults;
        updates.peopleMinors = nextMinors;
      }

      // Recompute pricing extras when people count or seats change
      const peopleChanged = typeof payload.people === 'number' && nextPeople !== reservation.people;
      const seatsPayload = Array.isArray(payload.selectedSeats);
      if (peopleChanged || seatsPayload) {
        const paquete = await getPaqueteById(reservation.packageId ?? reservation.experienceId);
        if (paquete) {
          const date = payload.date ?? reservation.date;
          const departureConfig = resolveDepartureConfig(paquete, date);
          const seatsEnabled = Boolean(departureConfig.seatsEnabled && departureConfig.seatLayoutId);
          const selectedSeatsForExtras = seatsPayload
            ? payload.selectedSeats
            : Array.isArray((reservation as any).selectedSeats)
              ? (reservation as any).selectedSeats.map((s: any) => String(s))
              : [];
          let seatLayoutTemplateForExtras: SeatLayoutTemplate | null = null;
          if (seatsEnabled && departureConfig.seatLayoutId && selectedSeatsForExtras.length > 0) {
            const templateSnap = await getDoc(doc(db, 'seatLayouts', departureConfig.seatLayoutId));
            if (templateSnap.exists()) {
              seatLayoutTemplateForExtras = { id: templateSnap.id, ...(templateSnap.data() as any) } as SeatLayoutTemplate;
            }
          }
          const pickupPointForExtras =
            typeof payload.pickupPoint === 'string'
              ? payload.pickupPoint.trim()
              : String((reservation as any).pickupPoint ?? '').trim();
          const resolvedExtras = resolveReservationExtraSelections({
            paquete,
            pickupPoint: pickupPointForExtras || null,
            selectedSeats: selectedSeatsForExtras,
            seatLayoutTemplate: seatLayoutTemplateForExtras,
          });
          const roomSelection = normalizeRoomSelection((payload as any).roomSelection);
          const roomTypeForPricing = roomSelection.length
            ? deriveLegacyRoomTypeFromSelection(roomSelection)
            : (payload as any).roomType ?? (reservation as any).roomType ?? null;
          const repriced = computeReservationPricing(paquete, date, {
            people: nextPeople,
            peopleAdults: nextAdults,
            peopleMinors: nextMinors,
            roomType: roomTypeForPricing,
            selectedExtras: resolvedExtras,
          });
          const pricedSelectedExtras = withSinglePassengerSurcharge({
            selectedExtras: resolvedExtras,
            baseSubtotalAmount: repriced.baseSubtotalAmount,
            people: nextPeople,
          });
          updates.baseSubtotalAmount = repriced.baseSubtotalAmount;
          updates.extrasTotalAmount = repriced.extrasTotalAmount;
          updates.selectedExtras = pricedSelectedExtras.length ? pricedSelectedExtras : null;
          updates.amountTotal = repriced.subtotalAmount;
          updates.pricingBaseUnitAmount = repriced.baseUnitAmount;
          updates.unitAmountAdults = repriced.unitAmountAdults;
          updates.unitAmountMinors = repriced.unitAmountMinors;
        }
      }

      if (updates.customerFirstName || updates.customerLastName) {
        const firstName = updates.customerFirstName ?? reservation.customerFirstName ?? '';
        const lastName = updates.customerLastName ?? reservation.customerLastName ?? '';
        updates.customerName = [firstName, lastName].filter(Boolean).join(' ').trim();
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = Timestamp.now();
        await updateDoc(doc(db, COLLECTION, payload.reservationId), updates);
      }
    }

    if (payload.attachments?.length) {
      await addReservaAttachments(payload.reservationId, payload.attachments);
    }
    if (payload.removeAttachments?.length) {
      await removeReservaAttachmentsById(
        payload.reservationId,
        payload.removeAttachments.map((item) => item.id)
      );
    }

    if (payload.clearReferredBy) {
      await updateDoc(doc(db, COLLECTION, payload.reservationId), {
        referredBy: null,
        updatedAt: Timestamp.now(),
      });
    } else if (payload.vendorId || payload.referralCode) {
      let referredBy = null;
      try {
        referredBy = await resolveReservationReferralAssignment({
          packageId: String(reservation.packageId ?? reservation.experienceId ?? ''),
          amountTotal: reservation.amountTotal ?? 0,
          commissionBaseAmount: getReservationOfficialBaseAmount({
            pricingBaseUnitAmount: (reservation as any).pricingBaseUnitAmount,
            people: reservation.people,
            baseSubtotalAmount: (reservation as any).baseSubtotalAmount,
            amountTotal: reservation.amountTotal,
            extrasTotalAmount: (reservation as any).extrasTotalAmount,
          }),
          extrasExcludedAmount: getReservationExtrasAmount((reservation as any).extrasTotalAmount),
          people: reservation.people ?? 0,
          status: payload.status ?? reservation.status,
          vendorId: payload.vendorId,
          referralCode: payload.referralCode,
          existingPayoutStatus: (reservation as any).referredBy?.payoutStatus,
        });
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'No se pudo asignar el referido.' },
          { status: 400 }
        );
      }

      if (referredBy) {
        await updateDoc(doc(db, COLLECTION, payload.reservationId), {
          referredBy,
          updatedAt: Timestamp.now(),
        });
      }
    }

    if (payload.addPaymentEvent) {
      const now = Timestamp.now();
      const movement = payload.addPaymentEvent;
      const paymentRef = doc(collection(db, COLLECTION, payload.reservationId, 'payments'), `manual_${randomUUID()}`);
      const occurredAt = movement.occurredAt
        ? Timestamp.fromDate(new Date(movement.occurredAt))
        : now;

      const normalizedAttachments = Array.isArray(movement.attachments)
        ? movement.attachments
            .filter((a) => a && typeof a.url === 'string' && a.url.trim())
            .map((a) => ({
              id: `att_${randomUUID()}`,
              url: a.url.trim(),
              key: typeof a.key === 'string' && a.key.trim() ? a.key.trim() : null,
              name: String(a.name ?? 'Comprobante').slice(0, 200),
              type: String(a.type ?? 'application/octet-stream').slice(0, 80),
              uploadedBy: typeof a.uploadedBy === 'string' && a.uploadedBy.trim() ? a.uploadedBy.trim() : (adminUser?.email ?? 'admin'),
              createdAt: now,
            }))
        : undefined;

      await setDoc(paymentRef, {
        method: normalizePaymentMovementMethod(movement.method, movement.movementType),
        movementType: movement.movementType,
        source: 'manual',
        status: normalizePaymentMovementStatus(movement.movementType),
        amount: movement.amount,
        currency: String(movement.currency || reservation.currency || 'ars').toLowerCase(),
        message: movement.message,
        reference: movement.reference?.trim() || null,
        recordedBy: adminUser?.email ?? 'admin',
        occurredAt,
        createdAt: now,
        updatedAt: now,
        ...(normalizedAttachments && normalizedAttachments.length > 0 ? { attachments: normalizedAttachments } : {}),
      });

      await updateDoc(doc(db, COLLECTION, payload.reservationId), {
        updatedAt: now,
        statusHistory: arrayUnion({
          status: reservation.status,
          actor: 'admin',
          note: `Movimiento financiero registrado: ${movement.message}`,
          createdAt: now,
        }),
      }).catch(() => null);
    }

    if (payload.editPaymentEvent) {
      const now = Timestamp.now();
      const { paymentId, movement } = payload.editPaymentEvent;
      const paymentRef = doc(db, COLLECTION, payload.reservationId, 'payments', paymentId);
      const paymentSnapshot = await getDoc(paymentRef);
      if (!paymentSnapshot.exists()) {
        return NextResponse.json({ error: 'El movimiento ya no existe.' }, { status: 404 });
      }
      const existingPayment = paymentSnapshot.data();
      if (existingPayment.source !== 'manual') {
        return NextResponse.json({ error: 'Los movimientos automáticos no se pueden editar.' }, { status: 400 });
      }

      const actor = adminUser?.email ?? 'admin';
      const previous = {
        movementType: existingPayment.movementType ?? 'payment',
        amount: Number(existingPayment.amount ?? 0),
        currency: String(existingPayment.currency ?? reservation.currency ?? 'ars'),
        method: String(existingPayment.method ?? ''),
        reference: existingPayment.reference ?? null,
        message: existingPayment.message ?? null,
      };
      const next = {
        movementType: movement.movementType,
        amount: movement.amount,
        currency: String(movement.currency || reservation.currency || 'ars').toLowerCase(),
        method: normalizePaymentMovementMethod(movement.method, movement.movementType),
        reference: movement.reference?.trim() || null,
        message: movement.message,
      };

      await updateDoc(paymentRef, {
        ...next,
        status: normalizePaymentMovementStatus(movement.movementType),
        updatedAt: now,
        updatedBy: actor,
        auditTrail: arrayUnion({ action: 'edited', actor, createdAt: now, previous }),
      });
      await updateDoc(doc(db, COLLECTION, payload.reservationId), {
        updatedAt: now,
        paymentAuditTrail: arrayUnion({
          action: 'edited',
          paymentId,
          actor,
          createdAt: now,
          summary: `Movimiento financiero editado: ${next.message}`,
        }),
      });
    }

    if (payload.deletePaymentEvent) {
      const now = Timestamp.now();
      const { paymentId } = payload.deletePaymentEvent;
      const paymentRef = doc(db, COLLECTION, payload.reservationId, 'payments', paymentId);
      const paymentSnapshot = await getDoc(paymentRef);
      if (!paymentSnapshot.exists()) {
        return NextResponse.json({ error: 'El movimiento ya no existe.' }, { status: 404 });
      }
      const existingPayment = paymentSnapshot.data();
      if (existingPayment.source !== 'manual') {
        return NextResponse.json({ error: 'Los movimientos automáticos no se pueden eliminar.' }, { status: 400 });
      }

      const actor = adminUser?.email ?? 'admin';
      await deleteDoc(paymentRef);
      await updateDoc(doc(db, COLLECTION, payload.reservationId), {
        updatedAt: now,
        paymentAuditTrail: arrayUnion({
          action: 'deleted',
          paymentId,
          actor,
          createdAt: now,
          summary: `Movimiento financiero eliminado: ${String(existingPayment.message ?? 'Sin detalle')}`,
          previous: {
            movementType: existingPayment.movementType ?? 'payment',
            amount: Number(existingPayment.amount ?? 0),
            currency: String(existingPayment.currency ?? reservation.currency ?? 'ars'),
            method: String(existingPayment.method ?? ''),
            reference: existingPayment.reference ?? null,
            message: existingPayment.message ?? null,
          },
        }),
      });
    }

    if (payload.enqueueCustomerVoucherEmail) {
      try {
        await sendReservationVoucherNow(payload.reservationId);
      } catch (error) {
        console.error('[admin/reservas] Error enviando voucher manual:', error);
        return NextResponse.json({ error: 'No se pudo enviar el voucher ahora.' }, { status: 400 });
      }
    }

    if (payload.enqueueAdminNotificationEmail) {
      await enqueueReservationEmailJob({
        reservationId: payload.reservationId,
        type: 'admin_aviso',
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[admin/reservas] Error actualizando reserva:', error);
    return NextResponse.json({ error: 'No se pudo actualizar la reserva' }, { status: 500 });
  }
}
