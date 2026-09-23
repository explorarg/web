'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, Loader2, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type ApiResponse =
  | { ok: true; order: any }
  | { error: string };

function labelForStatus(statusRaw: unknown, initialPaymentApproved: boolean): string {
  const s = String(statusRaw ?? '');
  if (initialPaymentApproved && (s === '' || s === 'created' || s === 'checkout_started' || s === 'pending')) {
    return 'pago aprobado';
  }
  if (s === 'paid') return 'pagada';
  if (s === 'pending') return 'pendiente';
  if (s === 'cancelled') return 'cancelada';
  if (s === 'failed') return 'fallida';
  if (s === 'needs_review') return 'requiere revisión';
  if (s === 'checkout_started') return 'procesando';
  if (s === 'expired') return 'vencida';
  return 'creada';
}

function badgeVariantForStatus(statusRaw: unknown, initialPaymentApproved: boolean): 'default' | 'secondary' | 'outline' | 'destructive' {
  const s = String(statusRaw ?? '');
  if (initialPaymentApproved && (s === '' || s === 'created' || s === 'checkout_started' || s === 'pending')) {
    return 'default';
  }
  if (s === 'paid') return 'default';
  if (s === 'pending' || s === 'checkout_started') return 'secondary';
  if (s === 'failed' || s === 'cancelled' || s === 'needs_review') return 'destructive';
  return 'outline';
}

export default function OrderVerification({
  orderId,
  paymentId = '',
  initialPaymentApproved = false,
}: {
  orderId: string;
  paymentId?: string;
  initialPaymentApproved?: boolean;
}) {
  const [order, setOrder] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const attemptRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const reconcileAttemptedRef = useRef(false);

  useEffect(() => {
    let active = true;

    const clear = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const fetchOnce = async (): Promise<string> => {
      try {
        setLoading(true);
        const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: 'no-store' });
        const body = (await res.json().catch(() => null)) as ApiResponse | null;
        if (!active) return 'inactive';
        if (!res.ok) {
          setError((body as any)?.error ?? 'No se pudo obtener el estado');
          setLoading(false);
          return 'error';
        }
        if ((body as any)?.ok) {
          const nextOrder = (body as any).order;
          setOrder(nextOrder);
          setError(null);
          setLoading(false);
          return String(nextOrder?.status ?? '');
        } else {
          setError((body as any)?.error ?? 'No se pudo obtener el estado');
        }
        setLoading(false);
        return 'error';
      } catch (e) {
        if (!active) return 'inactive';
        setError(e instanceof Error ? e.message : 'No se pudo obtener el estado');
        setLoading(false);
        return 'error';
      }
    };

    const reconcileIfNeeded = async (status: string) => {
      if (!initialPaymentApproved) return status;
      if (reconcileAttemptedRef.current) return status;
      if (status === 'paid' || status === 'failed' || status === 'cancelled' || status === 'needs_review') {
        return status;
      }
      reconcileAttemptedRef.current = true;
      try {
        await fetch('/api/orders/reconcile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, paymentId: paymentId || undefined }),
        });
      } catch {
        // no-op: el polling normal seguirá reflejando el estado persistido
      }
      return await fetchOnce();
    };

    const schedule = async (delayMs: number) => {
      clear();
      timerRef.current = window.setTimeout(async () => {
        if (!active) return;
        attemptRef.current += 1;
        if (attemptRef.current > 20) return;
        const fetchedStatus = await fetchOnce();
        const s = await reconcileIfNeeded(fetchedStatus);
        if (s === 'paid' || s === 'failed' || s === 'cancelled' || s === 'needs_review') return;
        await schedule(Math.min(10_000, Math.round(delayMs * 1.6)));
      }, delayMs);
    };

    (async () => {
      attemptRef.current = 0;
      const fetchedStatus = await fetchOnce();
      const s = await reconcileIfNeeded(fetchedStatus);
      if (s === 'paid' || s === 'failed' || s === 'cancelled' || s === 'needs_review') return;
      await schedule(1200);
    })();

    return () => {
      active = false;
      clear();
    };
  }, [initialPaymentApproved, orderId, paymentId]);

  if (error) {
    return (
      <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
        No pudimos confirmar el estado automáticamente. Si en unos minutos no recibís el email, escribinos por WhatsApp.
      </div>
    );
  }

  if (loading && !order) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-gray-100 bg-white p-3 text-sm text-gray-700">
        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        Verificando el estado del pago...
      </div>
    );
  }

  const status = labelForStatus(order?.status, initialPaymentApproved);
  const badgeVariant = badgeVariantForStatus(order?.status, initialPaymentApproved);
  const icon =
    status === 'pagada' || status === 'pago aprobado'
      ? <CheckCircle2 className="h-4 w-4 text-success" />
      : status === 'pendiente' || status === 'procesando'
      ? <Clock className="h-4 w-4 text-gray-500" />
      : <RotateCcw className="h-4 w-4 text-red-600" />;

  return (
    <div className="mt-4 rounded-lg border border-gray-100 bg-white p-3 text-sm text-gray-700">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">Estado:</span>
          <Badge variant={badgeVariant} className="capitalize">
            {status}
          </Badge>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : null}
      </div>
    </div>
  );
}
