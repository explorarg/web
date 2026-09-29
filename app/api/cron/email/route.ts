import { NextResponse } from 'next/server';
import { resend, getFromEmail, isResendConfigured } from '@/lib/resend';
import { db } from '@/lib/firebase';
import {
  Timestamp,
  collection,
  doc,
  getDocs,
  limit as firestoreLimit,
  orderBy as firestoreOrderBy,
  query,
  runTransaction,
  where,
  updateDoc,
} from 'firebase/firestore';
import { buildEmailDeliveryState, emailDeliveryPathForJobType, type VentaEmailJobType } from '@/lib/sales/email-jobs';

export const runtime = 'nodejs';

type EmailJobStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'dead';
type EmailJob = {
  type: VentaEmailJobType;
  status: EmailJobStatus;
  to: string;
  from: string | null;
  replyTo?: string | null;
  subject: string;
  html: string | null;
  text?: string | null;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: object;
  reservationId?: string;
};

const MAX_ATTEMPTS = 6;

function getCronSecret(): string | null {
  return process.env.CRON_SECRET ?? null;
}

function isAuthorized(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

function backoffSeconds(attempt: number): number {
  // 1m, 2m, 4m, 8m, ... max 60m
  const seconds = Math.min(60 * 60, Math.pow(2, Math.max(0, attempt)) * 60);
  return seconds;
}

function getFriendlyEmailError(type: VentaEmailJobType): string {
  if (type === 'cliente_voucher_48hs' || type === 'cliente_confirmacion') {
    return 'No se pudo enviar el voucher en este momento.';
  }
  if (type === 'cliente_confirmacion_compra') {
    return 'No se pudo enviar la confirmación en este momento.';
  }
  return 'No se pudo enviar el aviso interno en este momento.';
}

async function fetchPendingJobs(batchSize: number): Promise<{ id: string; data: EmailJob }[]> {
  const col = collection(db, 'emailJobs');
  const now = Timestamp.now();

  // Preferir query eficiente; fallback si faltan índices.
  try {
    const q = query(
      col,
      where('status', 'in', ['pending', 'failed']),
      where('nextAttemptAt', '<=', now),
      firestoreOrderBy('nextAttemptAt', 'asc'),
      firestoreLimit(batchSize)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, data: d.data() as EmailJob }));
  } catch {
    const q2 = query(col, where('status', 'in', ['pending', 'failed']), firestoreLimit(200));
    const snap = await getDocs(q2);
    const list = snap.docs
      .map((d) => ({ id: d.id, data: d.data() as EmailJob }))
      .filter(({ data }) => {
        const toMs = (v: unknown): number => {
          if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
            return (v as { toDate: () => Date }).toDate().getTime();
          }
          if (v && typeof v === 'object' && 'seconds' in v) return ((v as { seconds: number }).seconds ?? 0) * 1000;
          if (typeof v === 'string') return new Date(v).getTime();
          return 0;
        };
        return toMs(data.nextAttemptAt) <= Date.now();
      })
      .sort((a, b) => {
        const toMs = (v: unknown): number => {
          if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: () => Date }).toDate === 'function') {
            return (v as { toDate: () => Date }).toDate().getTime();
          }
          if (v && typeof v === 'object' && 'seconds' in v) return ((v as { seconds: number }).seconds ?? 0) * 1000;
          if (typeof v === 'string') return new Date(v).getTime();
          return 0;
        };
        return toMs(a.data.nextAttemptAt) - toMs(b.data.nextAttemptAt);
      })
      .slice(0, batchSize);
    return list;
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!isResendConfigured() || !resend) {
    return NextResponse.json({ error: 'Resend no configurado (falta RESEND_API_KEY)' }, { status: 500 });
  }

  const batchSize = 25;
  const jobs = await fetchPendingJobs(batchSize);
  if (jobs.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, sent: 0, failed: 0 });
  }

  let sent = 0;
  let failed = 0;
  const processedIds: string[] = [];

  for (const job of jobs) {
    const jobRef = doc(db, 'emailJobs', job.id);
    const outcome = await runTransaction(db, async (tx) => {
      const snap = await tx.get(jobRef);
      if (!snap.exists()) return 'skip';
      const data = snap.data() as EmailJob;
      const status = data.status;
      if (status !== 'pending' && status !== 'failed') return 'skip';

      // Dedupe global: si la reserva ya registra el email como enviado, no reenviar.
      if (data.reservationId) {
        const deliveryPath = emailDeliveryPathForJobType(data.type);
        const deliveryState = deliveryPath
          .split('.')
          .reduce<unknown>(
            (acc, key) =>
              acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
            (await tx.get(doc(db, 'reservas', data.reservationId))).data() as
              | Record<string, unknown>
              | undefined
          );
        const deliveryStatus = (deliveryState as { status?: string } | undefined)?.status;
        if (deliveryStatus === 'sent') {
          tx.update(jobRef, {
            status: 'sent',
            lastError: null,
            updatedAt: Timestamp.now(),
          });
          return 'already_sent';
        }
      }

      // Tope de intentos: los errores permanentes no deben reintentarse para siempre.
      if ((data.attempts ?? 0) >= MAX_ATTEMPTS) {
        tx.update(jobRef, {
          status: 'dead',
          lastError: data.lastError ?? 'Máximo de intentos alcanzado',
          updatedAt: Timestamp.now(),
        });
        return 'dead';
      }

      tx.update(jobRef, {
        status: 'sending',
        updatedAt: Timestamp.now(),
      });
      return 'lock';
    }).catch(() => 'skip');

    if (outcome !== 'lock') {
      if (outcome === 'already_sent') sent += 1;
      if (outcome === 'dead') failed += 1;
      continue;
    }

    processedIds.push(job.id);
    // Recalcular from/replyTo al enviar: los jobs viejos pueden tener datos de marca desactualizados.
    const from = getFromEmail();
    const storedReplyTo = String(job.data.replyTo ?? '').trim();
    const envSupport = String(process.env.SUPPORT_EMAIL ?? '').trim();
    const replyTo =
      envSupport ||
      (storedReplyTo && !/@resend\.dev$/i.test(storedReplyTo) ? storedReplyTo : undefined) ||
      undefined;

    try {
      if (!job.data.to || !job.data.subject || !job.data.html) {
        throw new Error('Job incompleto (to/subject/html)');
      }
      const { data, error } = await resend.emails.send({
        from,
        to: job.data.to,
        subject: job.data.subject,
        html: job.data.html,
        text: job.data.text ?? undefined,
        replyTo,
      });
      if (error) {
        throw new Error(typeof error === 'string' ? error : JSON.stringify(error));
      }
      await updateDoc(jobRef, {
        status: 'sent',
        attempts: (job.data.attempts ?? 0) + 1,
        lastError: null,
        sentAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      if (job.data.reservationId) {
        const reservationRef = doc(db, 'reservas', job.data.reservationId);
        const now = Timestamp.now();
        await updateDoc(reservationRef, {
          [emailDeliveryPathForJobType(job.data.type)]: buildEmailDeliveryState({
            status: 'sent',
            now,
            jobId: job.id,
            provider: 'resend',
            providerMessageId: data?.id ?? null,
          }),
          ...(job.data.type === 'cliente_voucher_48hs' || job.data.type === 'cliente_confirmacion'
            ? { voucherSent: true, voucherSentAt: now }
            : {}),
          updatedAt: now,
        }).catch(() => null);
      }
      sent += 1;
    } catch (err) {
      const attempt = (job.data.attempts ?? 0) + 1;
      const delay = backoffSeconds(attempt);
      const nextAttemptAt = Timestamp.fromDate(new Date(Date.now() + delay * 1000));
      await updateDoc(jobRef, {
        status: 'failed',
        attempts: attempt,
        lastError: err instanceof Error ? err.message : String(err),
        nextAttemptAt,
        updatedAt: Timestamp.now(),
      }).catch(() => null);
      if (job.data.reservationId) {
        const reservationRef = doc(db, 'reservas', job.data.reservationId);
        const now = Timestamp.now();
        await updateDoc(reservationRef, {
          [emailDeliveryPathForJobType(job.data.type)]: buildEmailDeliveryState({
            status: 'failed',
            now,
            jobId: job.id,
            provider: 'resend',
            error: getFriendlyEmailError(job.data.type),
          }),
          updatedAt: now,
        }).catch(() => null);
      }
      failed += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    processed: processedIds.length,
    sent,
    failed,
    ids: processedIds,
  });
}
