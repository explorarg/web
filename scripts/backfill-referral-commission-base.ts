import { getAdminDb } from '../lib/firebaseAdmin';
import { getReservationExtrasAmount, getReservationOfficialBaseAmount } from '../lib/reservas/pricing';

async function main() {
  const adminDb = getAdminDb();
  if (!adminDb) {
    throw new Error('Firebase Admin no está configurado. Configurá FIREBASE_SERVICE_ACCOUNT o las credenciales admin.');
  }

  const snapshot = await adminDb.collection('reservas').get();
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let batch = adminDb.batch();
  let batchOps = 0;

  for (const doc of snapshot.docs) {
    scanned += 1;
    const data = doc.data() as Record<string, any>;
    const referredBy = data?.referredBy;
    if (!referredBy || typeof referredBy !== 'object') {
      skipped += 1;
      continue;
    }

    const commissionBaseAmount = getReservationOfficialBaseAmount({
      pricingBaseUnitAmount: data.pricingBaseUnitAmount,
      people: data.people,
      baseSubtotalAmount: data.baseSubtotalAmount,
      amountTotal: data.amountTotal,
      extrasTotalAmount: data.extrasTotalAmount,
    });
    const extrasExcludedAmount = getReservationExtrasAmount(data.extrasTotalAmount);

    const commissionType = String(referredBy.commissionType ?? '').trim();
    const commissionValue = Number(referredBy.commissionValue ?? 0);
    const nextCommissionAmount =
      commissionType === 'percent'
        ? Math.round(commissionBaseAmount * ((Number.isFinite(commissionValue) ? commissionValue : 0) / 100))
        : Math.round((Number.isFinite(commissionValue) ? commissionValue : 0) * 100);

    const currentCommissionAmount =
      typeof referredBy.commissionAmount === 'number' && Number.isFinite(referredBy.commissionAmount)
        ? Math.round(referredBy.commissionAmount)
        : null;
    const currentCommissionBaseAmount =
      typeof referredBy.commissionBaseAmount === 'number' && Number.isFinite(referredBy.commissionBaseAmount)
        ? Math.round(referredBy.commissionBaseAmount)
        : null;
    const currentExtrasExcludedAmount =
      typeof referredBy.extrasExcludedAmount === 'number' && Number.isFinite(referredBy.extrasExcludedAmount)
        ? Math.round(referredBy.extrasExcludedAmount)
        : null;

    const needsUpdate =
      currentCommissionAmount !== nextCommissionAmount ||
      currentCommissionBaseAmount !== commissionBaseAmount ||
      currentExtrasExcludedAmount !== extrasExcludedAmount;

    if (!needsUpdate) {
      skipped += 1;
      continue;
    }

    batch.update(doc.ref, {
      referredBy: {
        ...referredBy,
        commissionAmount: nextCommissionAmount,
        commissionBaseAmount,
        extrasExcludedAmount,
      },
      updatedAt: new Date(),
    });
    batchOps += 1;
    updated += 1;

    if (batchOps >= 400) {
      await batch.commit();
      batch = adminDb.batch();
      batchOps = 0;
    }
  }

  if (batchOps > 0) {
    await batch.commit();
  }

  console.log(
    JSON.stringify(
      {
        scanned,
        updated,
        skipped,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('[backfill-referral-commission-base] Error:', error);
  process.exit(1);
});
