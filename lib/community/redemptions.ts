import { createHash } from 'node:crypto';
import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebaseAdmin';
import {
  calculateBenefitDiscount,
  calculateCouponDiscount,
  type BenefitForEvaluation,
  type BenefitUser,
  type CouponForEvaluation,
  type EvaluatedDiscount,
} from '@/lib/community/engine';

export type CommunityPromotionInput = {
  uid: string;
  couponCode?: string | null;
  subtotalCents: number;
  currency: string;
  expiresAt: Date;
  packages: Array<{ id: string; title: string; date: string; people: number }>;
};

export type CommunityPromotionQuote = {
  discount: EvaluatedDiscount | null;
  promotion: { kind: 'benefit' | 'coupon'; id: string; code?: string } | null;
  message?: string;
};

export class CommunityPromotionError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = 'CommunityPromotionError';
  }
}

function dateValue(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function userFromProfile(profile: Record<string, any>): BenefitUser {
  const registered = dateValue(profile.fechaRegistro);
  return {
    totalCompras: Math.max(0, Number(profile.totalCompras ?? 0)),
    totalGastado: Math.max(0, Number(profile.totalGastado ?? 0)),
    cantidadReservas: Math.max(0, Number(profile.cantidadReservas ?? 0)),
    cantidadReferidos: Math.max(0, Number(profile.cantidadReferidos ?? 0)),
    tier: String(profile.tier ?? 'bronce'),
    diasDesdeRegistro: Math.max(0, Math.floor((Date.now() - (registered?.getTime() ?? Date.now())) / 86_400_000)),
  };
}

function usageCounterId(uid: string, kind: string, promotionId: string) {
  return createHash('sha256').update(`${uid}:${kind}:${promotionId}`).digest('hex');
}

async function getLegacyUsageCount(db: FirebaseFirestore.Firestore, uid: string, kind: 'benefit' | 'coupon', id: string) {
  const field = kind === 'benefit' ? 'beneficioId' : 'cuponId';
  const snapshot = await db.collection('beneficiosUsados')
    .where('usuarioId', '==', uid)
    .limit(1000)
    .get();
  return snapshot.docs.filter((doc) => String(doc.data()[field] ?? '') === id).length;
}

/** Advisory quote only. The checkout repeats all checks transactionally before charging. */
export async function quoteCommunityPromotion(input: Omit<CommunityPromotionInput, 'expiresAt' | 'packages'> & { orderId?: string | null }): Promise<CommunityPromotionQuote> {
  const db = getAdminDb();
  if (!db) throw new Error('Firebase Admin no está disponible.');
  const uid = input.uid.trim();
  const currency = input.currency.toUpperCase();
  const normalizedCode = String(input.couponCode ?? '').trim().toUpperCase();
  if (normalizedCode && currency !== 'ARS') {
    throw new CommunityPromotionError('Los cupones solo se pueden aplicar a compras en ARS.', 'currency_not_supported');
  }
  if (!uid || currency !== 'ARS' || input.subtotalCents < 1) return { discount: null, promotion: null };
  const profileSnap = await db.collection('usuarios').doc(uid).get();
  if (!profileSnap.exists || profileSnap.data()?.activo === false) {
    throw new CommunityPromotionError('La cuenta de comunidad no está activa.', 'profile_inactive');
  }
  const user = userFromProfile(profileSnap.data() ?? {});
  const orderId = String(input.orderId ?? '').trim();
  if (orderId) {
    const redemptionRef = db.collection('communityRedemptions').doc(orderId);
    const redemptionSnap = await redemptionRef.get();
    const redemption = redemptionSnap.data();
    if (redemption?.status === 'reserved' && redemption.uid === uid) {
      const expiresAt = dateValue(redemption.expiresAt)?.getTime() ?? 0;
      if (expiresAt > 0 && expiresAt <= Date.now()) {
        await releaseCommunityRedemption(orderId, 'checkout_expired');
      } else {
        const matchesRequestedPromotion = redemption.kind === 'benefit'
          ? !normalizedCode
          : redemption.kind === 'coupon' && String(redemption.couponCode ?? '').toUpperCase() === normalizedCode;
        const samePrice = Number(redemption.originalAmountCents) === Math.floor(input.subtotalCents)
          && String(redemption.currency ?? '').toUpperCase() === currency;
        if (matchesRequestedPromotion && samePrice) {
          return {
            discount: redemption.discount as EvaluatedDiscount,
            promotion: {
              kind: redemption.kind,
              id: String(redemption.promotionId),
              ...(redemption.kind === 'coupon' ? { code: String(redemption.couponCode ?? normalizedCode) } : {}),
            },
          };
        }
      }
    }
  }
  if (normalizedCode) {
    const couponSnap = await db.collection('cupones').doc(normalizedCode).get();
    if (!couponSnap.exists) throw new CommunityPromotionError('No encontramos ese cupón.', 'coupon_not_found');
    const raw = couponSnap.data() ?? {};
    const id = couponSnap.id;
    const usageRef = db.collection('communityPromotionUsage').doc(usageCounterId(uid, 'coupon', id));
    const [usageSnap, legacyCount] = await Promise.all([
      usageRef.get(),
      getLegacyUsageCount(db, uid, 'coupon', id),
    ]);
    const usage = usageSnap.data() ?? {};
    const usedByUser = Math.max(Number(usage.usedCount ?? 0), legacyCount) + Number(usage.reservedCount ?? 0);
    const evaluation = calculateCouponDiscount({
      coupon: {
        id,
        codigo: String(raw.codigo ?? id),
        descripcion: String(raw.descripcion ?? ''),
        activo: Boolean(raw.activo),
        tipoDescuento: raw.tipoDescuento === 'monto_fijo' ? 'monto_fijo' : 'porcentaje',
        valor: Number(raw.valor ?? 0),
        usosTotales: raw.usosTotales == null ? null : Number(raw.usosTotales),
        usosActuales: Number(raw.usosActuales ?? 0) + Number(raw.usosReservados ?? 0),
        usosPorUsuario: Number(raw.usosPorUsuario ?? 1),
        montoMinimoCompra: raw.montoMinimoCompra == null ? null : Number(raw.montoMinimoCompra),
        fechaInicio: dateValue(raw.fechaInicio),
        fechaFin: dateValue(raw.fechaFin),
        soloUsuariosNuevos: Boolean(raw.soloUsuariosNuevos),
      },
      user,
      usedByUser,
      subtotalCents: input.subtotalCents,
      currency,
    });
    if (!evaluation.valido) throw new CommunityPromotionError(couponErrorMessage(evaluation.motivo), evaluation.motivo);
    return { discount: evaluation.descuento, promotion: { kind: 'coupon', id, code: normalizedCode } };
  }

  const [benefitSnap, usageSnap, historySnap] = await Promise.all([
    db.collection('beneficios').where('activo', '==', true).limit(200).get(),
    db.collection('communityPromotionUsage').where('uid', '==', uid).get(),
    db.collection('beneficiosUsados').where('usuarioId', '==', uid).get(),
  ]);
  const userUsage = new Map<string, { used: number; reserved: number }>();
  for (const doc of usageSnap.docs.filter((item) => item.data().kind === 'benefit')) userUsage.set(String(doc.data().promotionId ?? ''), {
    used: Number(doc.data().usedCount ?? 0),
    reserved: Number(doc.data().reservedCount ?? 0),
  });
  const legacyById: Record<string, number> = {};
  for (const doc of historySnap.docs) {
    const id = String(doc.data().beneficioId ?? '');
    if (id) legacyById[id] = (legacyById[id] ?? 0) + 1;
  }
  const benefits: BenefitForEvaluation[] = benefitSnap.docs.map((document) => {
    const raw = document.data();
    const config = raw.config ?? raw;
    return {
      ...raw,
      id: document.id,
      activo: Boolean(raw.activo),
      fechaInicio: dateValue(raw.fechaInicio),
      fechaFin: dateValue(raw.fechaFin),
      config: {
        ...config,
        usosActuales: Number(config.usosActuales ?? raw.usosActuales ?? 0) + Number(config.usosReservados ?? raw.usosReservados ?? 0),
      },
    } as BenefitForEvaluation;
  }).filter((benefit) => {
    const config = benefit.config ?? benefit;
    const max = config.usosMaximos;
    return max == null || Number(config.usosActuales ?? 0) < Number(max);
  });
  const usedByBenefit = Object.fromEntries(benefits.map((benefit) => {
    const usage = userUsage.get(benefit.id) ?? { used: 0, reserved: 0 };
    return [benefit.id, Math.max(usage.used, legacyById[benefit.id] ?? 0) + usage.reserved];
  }));
  const eligible = benefits
    .map((benefit) => calculateBenefitDiscount({
      benefit,
      user,
      usedByUser: usedByBenefit[benefit.id] ?? 0,
      subtotalCents: input.subtotalCents,
      currency,
    }))
    .filter((discount): discount is EvaluatedDiscount => Boolean(discount))
    .sort((a, b) => (benefits.find((item) => item.id === b.id)?.prioridad ?? 0) - (benefits.find((item) => item.id === a.id)?.prioridad ?? 0));
  const discount = eligible[0] ?? null;
  return { discount, promotion: discount ? { kind: 'benefit', id: discount.id } : null };
}

function couponErrorMessage(reason: string) {
  const messages: Record<string, string> = {
    inactivo: 'Este cupón no está activo.',
    fuera_de_vigencia: 'Este cupón está fuera de su período de vigencia.',
    agotado: 'Este cupón alcanzó su límite de usos.',
    limite_personal: 'Ya alcanzaste el límite de uso de este cupón.',
    compra_minima: 'El importe elegible no alcanza el mínimo requerido para este cupón.',
    solo_nuevos: 'Este cupón es válido solo para la primera compra.',
    moneda_no_admitida: 'Este cupón no es válido para la moneda de esta compra.',
    monto_invalido: 'Este cupón no tiene un descuento válido.',
  };
  return messages[reason] ?? 'No se pudo validar el cupón.';
}

function sourceConfig(kind: 'benefit' | 'coupon', raw: Record<string, any>) {
  if (kind === 'coupon') return raw;
  return { ...raw, ...(raw.config ?? {}) };
}

/** Atomically rechecks eligibility and reserves both the global and per-member usage. */
export async function reserveCommunityRedemption(input: CommunityPromotionInput & {
  orderId: string;
  promotion: { kind: 'benefit' | 'coupon'; id: string };
}) {
  const db = getAdminDb();
  if (!db) throw new Error('Firebase Admin no está disponible.');
  const { uid, orderId, promotion } = input;
  const redemptionRef = db.collection('communityRedemptions').doc(orderId);
  const sourceRef = db.collection(promotion.kind === 'benefit' ? 'beneficios' : 'cupones').doc(promotion.id);
  const usageRef = db.collection('communityPromotionUsage').doc(usageCounterId(uid, promotion.kind, promotion.id));
  const profileRef = db.collection('usuarios').doc(uid);
  const historyQuery = db.collection('beneficiosUsados')
    .where('usuarioId', '==', uid)
    .limit(1000);

  return db.runTransaction(async (transaction) => {
    const [redemptionSnap, sourceSnap, usageSnap, profileSnap, historySnap] = await Promise.all([
      transaction.get(redemptionRef), transaction.get(sourceRef), transaction.get(usageRef), transaction.get(profileRef), transaction.get(historyQuery),
    ]);
    const existing = redemptionSnap.data();
    if (existing?.status === 'reserved' && existing.uid === uid && existing.promotionId === promotion.id) {
      if (Number(existing.originalAmountCents) !== Math.floor(input.subtotalCents) || String(existing.currency ?? '') !== input.currency.toUpperCase()) {
        throw new CommunityPromotionError('El importe de esta reserva cambió; iniciá un nuevo checkout para recalcular el beneficio.', 'redemption_order_mismatch');
      }
      return { redemptionId: redemptionRef.id, discount: existing.discount as EvaluatedDiscount };
    }
    if (existing?.status === 'confirmed') throw new CommunityPromotionError('La promoción de esta compra ya fue redimida.', 'already_confirmed');
    if (!sourceSnap.exists || !profileSnap.exists) throw new CommunityPromotionError('La promoción o el perfil ya no están disponibles.', 'promotion_missing');
    const raw = sourceSnap.data() ?? {};
    const profile = profileSnap.data() ?? {};
    if (profile.activo === false) throw new CommunityPromotionError('La cuenta de comunidad no está activa.', 'profile_inactive');
    const config = sourceConfig(promotion.kind, raw);
    const active = Boolean(raw.activo);
    const startsAt = dateValue(raw.fechaInicio);
    const endsAt = dateValue(raw.fechaFin);
    const nowDate = new Date();
    if (!active || (startsAt && startsAt > nowDate) || (endsAt && endsAt < nowDate)) {
      throw new CommunityPromotionError('La promoción ya no está activa o vigente.', 'promotion_expired');
    }
    const actualUses = Number(raw.usosActuales ?? config.usosActuales ?? 0);
    const reservedUses = Number(raw.usosReservados ?? config.usosReservados ?? 0);
    const maxUses = promotion.kind === 'coupon' ? raw.usosTotales : (config.usosMaximos ?? raw.usosMaximos ?? null);
    if (maxUses != null && actualUses + reservedUses >= Number(maxUses)) {
      throw new CommunityPromotionError('La promoción alcanzó su límite de usos.', 'promotion_exhausted');
    }
    const usage = usageSnap.data() ?? {};
    const legacyField = promotion.kind === 'benefit' ? 'beneficioId' : 'cuponId';
    const historyCount = historySnap.docs.filter((document) => String(document.data()[legacyField] ?? '') === promotion.id).length;
    const usedByUser = Math.max(Number(usage.usedCount ?? 0), historyCount);
    const userReserved = Number(usage.reservedCount ?? 0);
    const usageLimit = Math.max(1, Number(promotion.kind === 'coupon' ? raw.usosPorUsuario : (config.usosPorUsuario ?? 1)));
    if (usedByUser + userReserved >= usageLimit) {
      throw new CommunityPromotionError('Ya alcanzaste el límite de uso de esta promoción.', 'user_limit');
    }
    let discount: EvaluatedDiscount | null = null;
    if (promotion.kind === 'coupon') {
      const result = calculateCouponDiscount({
        coupon: {
          id: promotion.id,
          codigo: String(raw.codigo ?? promotion.id),
          activo: active,
          tipoDescuento: raw.tipoDescuento === 'monto_fijo' ? 'monto_fijo' : 'porcentaje',
          valor: Number(raw.valor ?? 0),
          usosTotales: maxUses == null ? null : Number(maxUses),
          usosActuales: actualUses + reservedUses,
          usosPorUsuario: usageLimit,
          montoMinimoCompra: raw.montoMinimoCompra == null ? null : Number(raw.montoMinimoCompra),
          fechaInicio: startsAt,
          fechaFin: endsAt,
          soloUsuariosNuevos: Boolean(raw.soloUsuariosNuevos),
        },
        user: userFromProfile(profile),
        usedByUser: usedByUser + userReserved,
        subtotalCents: input.subtotalCents,
        currency: input.currency,
        now: nowDate,
      });
      if (!result.valido) throw new CommunityPromotionError(couponErrorMessage(result.motivo), result.motivo);
      discount = result.descuento;
    } else {
      discount = calculateBenefitDiscount({
        benefit: {
          ...raw,
          id: promotion.id,
          nombre: String(raw.nombre ?? 'Beneficio Explorarg'),
          activo: active,
          tipo: String(raw.tipo ?? 'personalizado'),
          prioridad: Number(raw.prioridad ?? 0),
          fechaInicio: startsAt,
          fechaFin: endsAt,
          config: {
            ...config,
            usosMaximos: maxUses == null ? null : Number(maxUses),
            usosActuales: actualUses + reservedUses,
          },
        } as BenefitForEvaluation,
        user: userFromProfile(profile),
        usedByUser: usedByUser + userReserved,
        subtotalCents: input.subtotalCents,
        currency: input.currency,
        now: nowDate,
      });
      if (!discount) throw new CommunityPromotionError('Ya no cumplís las condiciones de este beneficio.', 'benefit_not_eligible');
    }
    const common = {
      promotionId: promotion.id,
      uid,
      kind: promotion.kind,
      reservedCount: userReserved + 1,
      updatedAt: Timestamp.now(),
    };
    transaction.set(sourceRef, { usosReservados: reservedUses + 1, ultimaModificacion: Timestamp.now() }, { merge: true });
    transaction.set(usageRef, {
      ...common,
      usedCount: usedByUser,
      reservedCount: common.reservedCount,
    }, { merge: true });
    transaction.set(redemptionRef, {
      uid,
      orderId,
      kind: promotion.kind,
      promotionId: promotion.id,
      couponCode: promotion.kind === 'coupon' ? String(raw.codigo ?? promotion.id) : null,
      promotionName: promotion.kind === 'coupon' ? `Cupón ${String(raw.codigo ?? promotion.id)}` : String(raw.nombre ?? discount.nombre),
      discount,
      originalAmountCents: input.subtotalCents,
      finalAmountCents: input.subtotalCents - discount.montoDescuento,
      currency: input.currency.toUpperCase(),
      packages: input.packages,
      status: 'reserved',
      expiresAt: Timestamp.fromDate(input.expiresAt),
      createdAt: existing?.createdAt ?? Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return { redemptionId: redemptionRef.id, discount };
  });
}

export async function releaseCommunityRedemption(orderId: string, reason: string) {
  const db = getAdminDb();
  if (!db) return false;
  const redemptionRef = db.collection('communityRedemptions').doc(orderId);
  return db.runTransaction(async (transaction) => {
    const redemptionSnap = await transaction.get(redemptionRef);
    if (!redemptionSnap.exists || redemptionSnap.data()?.status !== 'reserved') return false;
    const redemption = redemptionSnap.data()!;
    const sourceRef = db.collection(redemption.kind === 'benefit' ? 'beneficios' : 'cupones').doc(String(redemption.promotionId));
    const usageRef = db.collection('communityPromotionUsage').doc(usageCounterId(String(redemption.uid), String(redemption.kind), String(redemption.promotionId)));
    const [sourceSnap, usageSnap] = await Promise.all([transaction.get(sourceRef), transaction.get(usageRef)]);
    const reserved = Number(sourceSnap.data()?.usosReservados ?? 0);
    const usage = usageSnap.data() ?? {};
    if (sourceSnap.exists) transaction.update(sourceRef, { usosReservados: Math.max(0, reserved - 1), ultimaModificacion: Timestamp.now() });
    if (usageSnap.exists) transaction.update(usageRef, { reservedCount: Math.max(0, Number(usage.reservedCount ?? 0) - 1), updatedAt: Timestamp.now() });
    transaction.update(redemptionRef, { status: 'released', releaseReason: reason, releasedAt: Timestamp.now(), updatedAt: Timestamp.now() });
    return true;
  });
}

export async function confirmCommunityRedemption(orderId: string, paymentId: string, reservationIds: string[] = []) {
  const db = getAdminDb();
  if (!db) throw new Error('Firebase Admin no está disponible.');
  const redemptionRef = db.collection('communityRedemptions').doc(orderId);
  return db.runTransaction(async (transaction) => {
    const redemptionSnap = await transaction.get(redemptionRef);
    if (!redemptionSnap.exists) return false;
    const redemption = redemptionSnap.data()!;
    const wasReserved = redemption.status === 'reserved';
    if (!wasReserved && redemption.status !== 'released') return false;
    const sourceRef = db.collection(redemption.kind === 'benefit' ? 'beneficios' : 'cupones').doc(String(redemption.promotionId));
    const usageRef = db.collection('communityPromotionUsage').doc(usageCounterId(String(redemption.uid), String(redemption.kind), String(redemption.promotionId)));
    const historyRef = db.collection('beneficiosUsados').doc(redemptionRef.id);
    const [sourceSnap, usageSnap, historySnap] = await Promise.all([
      transaction.get(sourceRef), transaction.get(usageRef), transaction.get(historyRef),
    ]);
    const sourceData = sourceSnap.data() ?? {};
    const usage = usageSnap.data() ?? {};
    if (sourceSnap.exists) transaction.update(sourceRef, {
      usosActuales: Number(sourceData.usosActuales ?? 0) + 1,
      ...(wasReserved ? { usosReservados: Math.max(0, Number(sourceData.usosReservados ?? 0) - 1) } : {}),
      ultimaModificacion: Timestamp.now(),
    });
    if (usageSnap.exists) transaction.update(usageRef, {
      usedCount: Number(usage.usedCount ?? 0) + 1,
      ...(wasReserved ? { reservedCount: Math.max(0, Number(usage.reservedCount ?? 0) - 1) } : {}),
      updatedAt: Timestamp.now(),
    });
    if (!historySnap.exists) transaction.create(historyRef, {
      usuarioId: redemption.uid,
      tipo: redemption.kind === 'benefit' ? 'beneficio' : 'cupon',
      ...(redemption.kind === 'benefit' ? { beneficioId: redemption.promotionId } : { cuponId: redemption.promotionId }),
      nombre: redemption.promotionName,
      codigo: redemption.couponCode ?? null,
      pedidoId: orderId,
      reservaIds: reservationIds,
      paquetes: redemption.packages ?? [],
      montoOriginal: redemption.originalAmountCents,
      montoDescuento: redemption.discount?.montoDescuento ?? 0,
      montoFinal: redemption.finalAmountCents,
      moneda: redemption.currency,
      detalle: redemption.promotionName,
      fechaUso: Timestamp.now(),
    });
    transaction.update(redemptionRef, {
      status: 'confirmed',
      paymentId: String(paymentId),
      reservationIds,
      confirmedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return true;
  });
}

export async function releaseExpiredCommunityRedemptions(now = new Date(), limit = 200) {
  const db = getAdminDb();
  if (!db) return { scanned: 0, released: 0 };
  let candidates: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  try {
    const expired = await db.collection('communityRedemptions')
      .where('status', '==', 'reserved')
      .where('expiresAt', '<=', Timestamp.fromDate(now))
      .limit(limit)
      .get();
    candidates = expired.docs;
  } catch {
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    const scanLimit = Math.max(limit, 1000);
    for (let page = 0; page < 10 && candidates.length < limit; page += 1) {
      const baseQuery = db.collection('communityRedemptions').where('status', '==', 'reserved').orderBy(FieldPath.documentId()).limit(scanLimit);
      const snapshot: FirebaseFirestore.QuerySnapshot = await (cursor ? baseQuery.startAfter(cursor) : baseQuery).get();
      if (snapshot.empty) break;
      cursor = snapshot.docs[snapshot.docs.length - 1];
      candidates.push(...snapshot.docs.filter((doc) => {
        const expiresAt = dateValue(doc.data().expiresAt)?.getTime() ?? 0;
        return expiresAt > 0 && expiresAt <= now.getTime();
      }).slice(0, limit - candidates.length));
      if (snapshot.size < scanLimit) break;
    }
  }
  let released = 0;
  for (const redemption of candidates) {
    if (await releaseCommunityRedemption(redemption.id, 'checkout_expired')) released += 1;
  }
  return { scanned: candidates.length, released };
}

export async function extendCommunityRedemption(orderId: string, expiresAt: Date) {
  const db = getAdminDb();
  if (!db) return false;
  const redemptionRef = db.collection('communityRedemptions').doc(orderId);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(redemptionRef);
    if (!snapshot.exists || snapshot.data()?.status !== 'reserved') return false;
    transaction.update(redemptionRef, { expiresAt: Timestamp.fromDate(expiresAt), updatedAt: Timestamp.now() });
    return true;
  });
}
