export type BenefitCondition = {
  campo: string;
  operador: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'entre' | 'in';
  valor: unknown;
};

export type BenefitForEvaluation = {
  id: string;
  nombre: string;
  descripcion?: string;
  tipo: string;
  activo: boolean;
  prioridad?: number;
  fechaInicio?: Date | null;
  fechaFin?: Date | null;
  condiciones?: BenefitCondition[];
  config?: {
    tipoDescuento?: 'porcentaje' | 'monto_fijo';
    valorDescuento?: number;
    usosMaximos?: number | null;
    usosActuales?: number;
    usosPorUsuario?: number;
    categoriasAplicables?: string[];
    paquetesAplicables?: string[];
    noAcumulableCon?: string[];
  };
  tipoDescuento?: 'porcentaje' | 'monto_fijo';
  valorDescuento?: number;
  usosMaximos?: number | null;
  usosActuales?: number;
  usosPorUsuario?: number;
  noAcumulableCon?: string[];
};

export type BenefitUser = {
  totalCompras: number;
  totalGastado?: number;
  cantidadReservas?: number;
  cantidadReferidos?: number;
  diasDesdeRegistro?: number;
  tier?: string;
};

export type EvaluatedDiscount = {
  id: string;
  nombre: string;
  tipo: string;
  montoDescuento: number;
  montoOriginal: number;
  montoFinal: number;
};

export type CouponForEvaluation = {
  id: string;
  codigo: string;
  descripcion?: string;
  activo: boolean;
  tipoDescuento: 'porcentaje' | 'monto_fijo';
  valor: number;
  usosTotales?: number | null;
  usosActuales?: number;
  usosPorUsuario?: number;
  montoMinimoCompra?: number | null;
  fechaInicio?: Date | null;
  fechaFin?: Date | null;
  soloUsuariosNuevos?: boolean;
};

export type CouponEvaluation =
  | { valido: true; descuento: EvaluatedDiscount }
  | { valido: false; motivo: 'inactivo' | 'fuera_de_vigencia' | 'agotado' | 'limite_personal' | 'compra_minima' | 'solo_nuevos' | 'moneda_no_admitida' | 'monto_invalido' };

export function calculateCouponDiscount(input: {
  coupon: CouponForEvaluation;
  user: BenefitUser;
  usedByUser: number;
  subtotalCents: number;
  currency: string;
  now?: Date;
}): CouponEvaluation {
  const { coupon, user } = input;
  if (!coupon.activo) return { valido: false, motivo: 'inactivo' };
  const now = (input.now ?? new Date()).getTime();
  const startAt = dateFromUnknown(coupon.fechaInicio);
  const endAt = dateFromUnknown(coupon.fechaFin);
  if ((startAt !== null && now < startAt) || (endAt !== null && now > endAt)) return { valido: false, motivo: 'fuera_de_vigencia' };
  if (coupon.usosTotales != null && Number(coupon.usosActuales ?? 0) >= coupon.usosTotales) return { valido: false, motivo: 'agotado' };
  if (input.usedByUser >= Math.max(1, Number(coupon.usosPorUsuario ?? 1))) return { valido: false, motivo: 'limite_personal' };
  if (coupon.soloUsuariosNuevos && user.totalCompras > 0) return { valido: false, motivo: 'solo_nuevos' };
  const subtotal = Math.max(0, Math.floor(input.subtotalCents));
  if (subtotal < Number(coupon.montoMinimoCompra ?? 0)) return { valido: false, motivo: 'compra_minima' };
  if (coupon.tipoDescuento === 'monto_fijo' && input.currency.toUpperCase() !== 'ARS') return { valido: false, motivo: 'moneda_no_admitida' };
  const value = Number(coupon.valor);
  if (!Number.isFinite(value) || value <= 0 || (coupon.tipoDescuento === 'porcentaje' && value > 100)) return { valido: false, motivo: 'monto_invalido' };
  const amount = coupon.tipoDescuento === 'porcentaje' ? Math.round(subtotal * value / 100) : Math.min(subtotal, Math.round(value));
  if (amount < 1) return { valido: false, motivo: 'monto_invalido' };
  return {
    valido: true,
    descuento: {
      id: coupon.id,
      nombre: `Cupón ${coupon.codigo}`,
      tipo: 'cupon',
      montoOriginal: subtotal,
      montoDescuento: amount,
      montoFinal: subtotal - amount,
    },
  };
}

function conditionMatches(condition: BenefitCondition, user: BenefitUser): boolean {
  const actual = condition.campo === 'primeraCompra'
    ? user.totalCompras === 0
    : condition.campo === 'esSegundoPaquete'
      ? user.totalCompras === 1
      : (user as Record<string, unknown>)[condition.campo];
  const expected = condition.valor;
  switch (condition.operador) {
    case '==': return actual === expected;
    case '!=': return actual !== expected;
    case '>': return Number(actual) > Number(expected);
    case '<': return Number(actual) < Number(expected);
    case '>=': return Number(actual) >= Number(expected);
    case '<=': return Number(actual) <= Number(expected);
    case 'entre': return Array.isArray(expected) && Number(actual) >= Number(expected[0]) && Number(actual) <= Number(expected[1]);
    case 'in': return Array.isArray(expected) && expected.includes(actual);
    default: return false;
  }
}

function defaultConditionMatches(benefit: BenefitForEvaluation, user: BenefitUser): boolean {
  switch (benefit.tipo) {
    case 'bienvenida': return user.totalCompras === 0;
    case 'segunda_compra': return user.totalCompras === 1;
    default: return true;
  }
}

function dateFromUnknown(value: Date | null | undefined): number | null {
  if (!value) return null;
  const time = value.getTime();
  return Number.isFinite(time) ? time : null;
}

export function calculateBenefitDiscount(input: {
  benefit: BenefitForEvaluation;
  user: BenefitUser;
  usedByUser: number;
  subtotalCents: number;
  currency: string;
  now?: Date;
}): EvaluatedDiscount | null {
  const { benefit, user } = input;
  const config = benefit.config ?? benefit;
  const subtotal = Math.max(0, Math.floor(input.subtotalCents));
  const now = (input.now ?? new Date()).getTime();
  const startAt = dateFromUnknown(benefit.fechaInicio);
  const endAt = dateFromUnknown(benefit.fechaFin);
  const maxUses = config.usosMaximos;
  const usesPerUser = Math.max(1, Number(config.usosPorUsuario ?? 1));

  if (!benefit.activo || subtotal < 1 || (input.currency.toUpperCase() !== 'ARS' && config.tipoDescuento === 'monto_fijo')) return null;
  if (startAt !== null && now < startAt) return null;
  if (endAt !== null && now > endAt) return null;
  if (maxUses != null && Number(config.usosActuales ?? 0) >= maxUses) return null;
  if (input.usedByUser >= usesPerUser) return null;
  if (!defaultConditionMatches(benefit, user)) return null;
  if (benefit.condiciones?.length && !benefit.condiciones.every(condition => conditionMatches(condition, user))) return null;

  const value = Number(config.valorDescuento ?? 0);
  if (!Number.isFinite(value) || value <= 0) return null;
  const discount = config.tipoDescuento === 'porcentaje'
    ? Math.round(subtotal * Math.min(value, 100) / 100)
    : Math.min(subtotal, Math.round(value));
  if (discount < 1) return null;
  return {
    id: benefit.id,
    nombre: benefit.nombre,
    tipo: benefit.tipo,
    montoDescuento: discount,
    montoOriginal: subtotal,
    montoFinal: subtotal - discount,
  };
}

export function evaluateBenefits(input: {
  benefits: BenefitForEvaluation[];
  user: BenefitUser;
  usedByBenefit: Record<string, number>;
  subtotalCents: number;
  currency: string;
  maxBenefits?: number;
  now?: Date;
}): { descuentos: EvaluatedDiscount[]; descuentoTotal: number; montoFinal: number } {
  const candidates = input.benefits
    .map(benefit => calculateBenefitDiscount({
      benefit,
      user: input.user,
      usedByUser: input.usedByBenefit[benefit.id] ?? 0,
      subtotalCents: input.subtotalCents,
      currency: input.currency,
      now: input.now,
    }))
    .filter((discount): discount is EvaluatedDiscount => discount !== null)
    .sort((a, b) => {
      const aPriority = input.benefits.find(item => item.id === a.id)?.prioridad ?? 0;
      const bPriority = input.benefits.find(item => item.id === b.id)?.prioridad ?? 0;
      return bPriority - aPriority;
    });

  const chosen: EvaluatedDiscount[] = [];
  let remaining = Math.max(0, Math.floor(input.subtotalCents));
  for (const candidate of candidates) {
    if (chosen.length >= Math.max(1, input.maxBenefits ?? 1) || remaining < 1) break;
    const benefit = input.benefits.find(item => item.id === candidate.id);
    if (chosen.some(item => item.id === candidate.id ||
      benefit?.config?.noAcumulableCon?.includes(item.id) || benefit?.noAcumulableCon?.includes(item.id))) continue;
    const config = benefit?.config ?? benefit;
    const amount = config?.tipoDescuento === 'porcentaje'
      ? Math.round(remaining * Math.min(100, Number(config.valorDescuento ?? 0)) / 100)
      : Math.min(remaining, Math.round(Number(config?.valorDescuento ?? 0)));
    if (amount < 1) continue;
    chosen.push({ ...candidate, montoOriginal: remaining, montoDescuento: amount, montoFinal: remaining - amount });
    remaining -= amount;
  }
  return {
    descuentos: chosen,
    descuentoTotal: chosen.reduce((sum, item) => sum + item.montoDescuento, 0),
    montoFinal: remaining,
  };
}
