import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBenefitDiscount, calculateCouponDiscount, evaluateBenefits, type BenefitForEvaluation, type CouponForEvaluation } from '../lib/community/engine.ts';
import { distributeCommunityDiscount } from '../lib/community/pricing.ts';

const welcome: BenefitForEvaluation = {
  id: 'welcome', nombre: 'Bienvenida', tipo: 'bienvenida', activo: true,
  tipoDescuento: 'porcentaje', valorDescuento: 15, usosMaximos: 100, usosActuales: 2,
};

test('beneficio de bienvenida aplica solo a quien todavía no compró', () => {
  assert.equal(calculateBenefitDiscount({ benefit: welcome, user: { totalCompras: 0 }, usedByUser: 0, subtotalCents: 100_000, currency: 'ARS' })?.montoDescuento, 15_000);
  assert.equal(calculateBenefitDiscount({ benefit: welcome, user: { totalCompras: 1 }, usedByUser: 0, subtotalCents: 100_000, currency: 'ARS' }), null);
});

test('beneficio respeta vigencia, límite global y límite por usuario', () => {
  const full = { ...welcome, usosMaximos: 2 };
  assert.equal(calculateBenefitDiscount({ benefit: full, user: { totalCompras: 0 }, usedByUser: 0, subtotalCents: 100_000, currency: 'ARS' }), null);
  assert.equal(calculateBenefitDiscount({ benefit: { ...welcome, usosPorUsuario: 1 }, user: { totalCompras: 0 }, usedByUser: 1, subtotalCents: 100_000, currency: 'ARS' }), null);
  assert.equal(calculateBenefitDiscount({ benefit: { ...welcome, fechaFin: new Date('2020-01-01') }, user: { totalCompras: 0 }, usedByUser: 0, subtotalCents: 100_000, currency: 'ARS' }), null);
});

test('descuento fijo se limita al subtotal y solo se usa en ARS', () => {
  const fixed = { ...welcome, tipo: 'temporal', tipoDescuento: 'monto_fijo' as const, valorDescuento: 5_000 };
  assert.equal(calculateBenefitDiscount({ benefit: fixed, user: { totalCompras: 0 }, usedByUser: 0, subtotalCents: 3_000, currency: 'ARS' })?.montoDescuento, 3_000);
  assert.equal(calculateBenefitDiscount({ benefit: fixed, user: { totalCompras: 0 }, usedByUser: 0, subtotalCents: 10_000, currency: 'USD' }), null);
});

test('el motor ordena por prioridad y apila hasta el máximo indicado', () => {
  const benefits = [
    { ...welcome, id: 'lower', tipo: 'temporal', prioridad: 1 },
    { ...welcome, id: 'higher', tipo: 'temporal', prioridad: 5, valorDescuento: 10 },
  ];
  const result = evaluateBenefits({ benefits, user: { totalCompras: 0 }, usedByBenefit: {}, subtotalCents: 10_000, currency: 'ARS', maxBenefits: 1 });
  assert.deepEqual(result.descuentos.map(item => item.id), ['higher']);
  assert.equal(result.descuentoTotal, 1_000);
  assert.equal(result.montoFinal, 9_000);
});

test('evalúa todas las condiciones configuradas con AND', () => {
  const conditional: BenefitForEvaluation = {
    ...welcome,
    tipo: 'personalizado',
    condiciones: [
      { campo: 'totalCompras', operador: '>=', valor: 2 },
      { campo: 'tier', operador: 'in', valor: ['oro', 'platino'] },
    ],
  };
  assert.equal(calculateBenefitDiscount({ benefit: conditional, user: { totalCompras: 2, tier: 'oro' }, usedByUser: 0, subtotalCents: 10_000, currency: 'ARS' })?.montoDescuento, 1_500);
  assert.equal(calculateBenefitDiscount({ benefit: conditional, user: { totalCompras: 2, tier: 'plata' }, usedByUser: 0, subtotalCents: 10_000, currency: 'ARS' }), null);
});

test('condición de primera compra se deriva del historial del usuario', () => {
  const conditional: BenefitForEvaluation = { ...welcome, tipo: 'personalizado', condiciones: [{ campo: 'primeraCompra', operador: '==', valor: true }] };
  assert.ok(calculateBenefitDiscount({ benefit: conditional, user: { totalCompras: 0 }, usedByUser: 0, subtotalCents: 10_000, currency: 'ARS' }));
  assert.equal(calculateBenefitDiscount({ benefit: conditional, user: { totalCompras: 1 }, usedByUser: 0, subtotalCents: 10_000, currency: 'ARS' }), null);
});

test('valida cupón porcentual y limita el descuento al subtotal', () => {
  const result = calculateCouponDiscount({
    coupon: { id: 'SAVE', codigo: 'SAVE', activo: true, tipoDescuento: 'porcentaje', valor: 20, usosTotales: 10, usosActuales: 1, usosPorUsuario: 1 },
    user: { totalCompras: 0 }, usedByUser: 0, subtotalCents: 1_000, currency: 'ARS',
  });
  assert.equal(result.valido, true);
  if (result.valido) assert.equal(result.descuento.montoDescuento, 200);
});

test('rechaza cupón agotado, repetido, con mínimo no alcanzado o fijo fuera de ARS', () => {
  const base: CouponForEvaluation = { id: 'SAVE', codigo: 'SAVE', activo: true, tipoDescuento: 'monto_fijo', valor: 500, usosTotales: 1, usosActuales: 0, usosPorUsuario: 1 };
  const evalCoupon = (coupon: CouponForEvaluation, usedByUser = 0, currency = 'ARS', subtotalCents = 1_000) => calculateCouponDiscount({ coupon, user: { totalCompras: 0 }, usedByUser, currency, subtotalCents });
  assert.deepEqual(evalCoupon({ ...base, usosActuales: 1 }), { valido: false, motivo: 'agotado' });
  assert.deepEqual(evalCoupon(base, 1), { valido: false, motivo: 'limite_personal' });
  assert.deepEqual(evalCoupon({ ...base, montoMinimoCompra: 2_000 }), { valido: false, motivo: 'compra_minima' });
  assert.deepEqual(evalCoupon(base, 0, 'USD'), { valido: false, motivo: 'moneda_no_admitida' });
});

test('distribuye el descuento por paquete sin tocar extras y conserva cada centavo', () => {
  const items = [
    { baseSubtotalAmount: 1_001, extrasTotalAmount: 100, subtotalAmount: 1_101 },
    { baseSubtotalAmount: 2_000, extrasTotalAmount: 300, subtotalAmount: 2_300 },
  ];
  const result = distributeCommunityDiscount(items, 1_000);
  assert.equal(result.reduce((sum, item) => sum + item.communityDiscountAmount, 0), 1_000);
  assert.equal(result.reduce((sum, item) => sum + item.subtotalAmount, 0), 2_401);
  assert.deepEqual(result.map((item) => item.extrasTotalAmount), [100, 300]);
});
