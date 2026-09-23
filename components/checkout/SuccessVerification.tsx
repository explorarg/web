'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Loader2, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type VerifyResponse = {
  ok: true;
  sessionId: string;
  paymentStatus: string;
  reservaExists: boolean;
  reservaStatus: string | null;
  emailJobs: { cliente: string; admin: string };
};

export default function SuccessVerification({
  sessionId,
  debug = false,
}: {
  sessionId: string;
  debug?: boolean;
}) {
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const attemptRef = useRef(0);
  const finalizeTriedRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);

  const shouldPoll = useMemo(() => {
    if (!sessionId) return false;
    if (error) return false;
    if (!data) return true;
    const emailsReady = data.emailJobs.cliente !== 'missing' && data.emailJobs.admin !== 'missing';
    return data.paymentStatus === 'paid' && (!data.reservaExists || !emailsReady);
  }, [sessionId, data, error]);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;

    const clearPollTimer = () => {
      if (pollTimerRef.current) {
        window.clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const verifyOnce = async (): Promise<VerifyResponse | null> => {
      try {
        const res = await fetch(`/api/checkout/verify?sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? 'No se pudo verificar');
        }
        const payload = (await res.json()) as VerifyResponse;
        if (!active) return null;
        setData(payload);
        setError(null);
        return payload;
      } catch (e) {
        if (!active) return null;
        setError(e instanceof Error ? e.message : 'No se pudo verificar');
        return null;
      }
    };

    const finalizeIfNeeded = async (payload: VerifyResponse | null) => {
      if (!payload) return;
      const needsFinalize =
        payload.paymentStatus === 'paid' &&
        (!payload.reservaExists || payload.emailJobs.cliente === 'missing' || payload.emailJobs.admin === 'missing');
      if (!needsFinalize) return;
      if (finalizeTriedRef.current) return;
      finalizeTriedRef.current = true;
      setFinalizing(true);
      try {
        const res = await fetch('/api/checkout/finalize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? 'No se pudo finalizar');
        }
        const next = (await res.json()) as VerifyResponse;
        if (!active) return;
        setData(next);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'No se pudo finalizar');
      } finally {
        if (!active) return;
        setFinalizing(false);
      }
    };

    const fetchFirestoreStatus = async (): Promise<VerifyResponse | null> => {
      try {
        const res = await fetch(`/api/checkout/status?sessionId=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
        if (!res.ok) return null;
        const payload = (await res.json()) as VerifyResponse;
        if (!active) return null;
        // Mantener paymentStatus anterior si ya lo tenemos
        setData((prev) => {
          if (!prev) return payload;
          return { ...payload, paymentStatus: prev.paymentStatus };
        });
        return payload;
      } catch {
        return null;
      }
    };

    const schedulePoll = async (delayMs: number) => {
      clearPollTimer();
      pollTimerRef.current = window.setTimeout(async () => {
        if (!active) return;
        attemptRef.current += 1;

        // Stop hard after ~60s (backoff incluido)
        if (attemptRef.current >= 20) {
          clearPollTimer();
          return;
        }

        const current = await fetchFirestoreStatus();
        const paid = (data?.paymentStatus ?? 'unknown') === 'paid';
        const emailsReady =
          (current?.emailJobs.cliente ?? data?.emailJobs.cliente) !== 'missing' &&
          (current?.emailJobs.admin ?? data?.emailJobs.admin) !== 'missing';
        const reservaOk = Boolean(current?.reservaExists ?? data?.reservaExists);

        if (paid && reservaOk && emailsReady) {
          clearPollTimer();
          return;
        }

        const nextDelay = Math.min(10_000, Math.round(delayMs * 1.6));
        await schedulePoll(nextDelay);
      }, delayMs);
    };

    (async () => {
      attemptRef.current = 0;
      clearPollTimer();

      const payload = await verifyOnce();
      await finalizeIfNeeded(payload);

      // Primera lectura Firestore para refrescar (rápido) reserva/emails
      await fetchFirestoreStatus();

      if (active && shouldPoll) {
        await schedulePoll(1200); // backoff
      }
    })();

    return () => {
      active = false;
      clearPollTimer();
    };
  }, [sessionId, shouldPoll, data?.paymentStatus, data?.reservaExists, data?.emailJobs.cliente, data?.emailJobs.admin, error]);

  if (error) {
    return (
      <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">
        No pudimos confirmar tu reserva automáticamente. Si en unos minutos no recibís el email, escribinos por WhatsApp y lo resolvemos.
        {debug ? <span className="block pt-2 text-xs text-red-700/80">Detalle técnico: {error}</span> : null}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-gray-100 bg-white p-3 text-sm text-gray-700">
        <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        Verificando el estado del pago...
      </div>
    );
  }

  const paid = data.paymentStatus === 'paid';
  const isReservaReady = Boolean(data.reservaExists);
  const clienteRaw = (data.emailJobs.cliente || 'missing').toLowerCase();
  const isClienteEmailQueued = clienteRaw !== 'missing';

  type Pill = {
    label: string;
    icon: React.ReactNode;
    badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive';
  };

  const getEmailPill = (raw: string): Pill => {
    const s = (raw || 'unknown').toLowerCase();
    if (s === 'sent') {
      return {
        label: 'enviado',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        badgeVariant: 'default',
      };
    }
    if (s === 'sending') {
      return {
        label: 'enviando',
        icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
        badgeVariant: 'secondary',
      };
    }
    if (s === 'pending') {
      return {
        label: 'en cola',
        icon: <Clock className="h-3.5 w-3.5" />,
        badgeVariant: 'outline',
      };
    }
    if (s === 'failed') {
      return {
        label: 'reintentando',
        icon: <RotateCcw className="h-3.5 w-3.5" />,
        badgeVariant: 'destructive',
      };
    }
    if (s === 'missing') {
      return {
        label: 'pendiente',
        icon: <Clock className="h-3.5 w-3.5" />,
        badgeVariant: 'outline',
      };
    }
    return {
      label: 'desconocido',
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      badgeVariant: 'outline',
    };
  };

  const emailCliente = getEmailPill(data.emailJobs.cliente);
  const emailAdmin = getEmailPill(data.emailJobs.admin);

  if (!debug) {
    const Step = ({
      ok,
      loading,
      label,
    }: {
      ok: boolean;
      loading?: boolean;
      label: string;
    }) => {
      if (ok) {
        return (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span>{label}</span>
          </div>
        );
      }
      return (
        <div className="flex items-center gap-2 text-sm text-gray-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : <Clock className="h-4 w-4 text-gray-400" />}
          <span>{label}</span>
        </div>
      );
    };

    return (
      <div className="mt-4 rounded-xl border border-gray-100 bg-white p-4">
        <p className="text-sm font-medium text-gray-900">Estamos confirmando tu reserva</p>
        <p className="mt-1 text-sm text-gray-600">
          Puede tardar unos segundos. Si no recibís el email en unos minutos, escribinos por WhatsApp.
        </p>

        <div className="mt-3 space-y-2">
          <Step ok={paid} loading={!paid} label={paid ? 'Pago confirmado' : 'Confirmando pago'} />
          <Step ok={isReservaReady} loading={paid && !isReservaReady} label={isReservaReady ? 'Reserva registrada' : 'Registrando reserva'} />
          <Step
            ok={isClienteEmailQueued}
            loading={paid && isReservaReady && !isClienteEmailQueued}
            label={isClienteEmailQueued ? 'Confirmación por email en camino' : 'Preparando confirmación por email'}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2 rounded-lg border border-gray-100 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
        <span className="font-medium">Verificación automática</span>
        <Badge variant={paid ? 'default' : 'outline'} className="capitalize">
          {paid ? 'Pago OK' : data.paymentStatus}
        </Badge>
        <Badge variant={data.reservaExists ? 'secondary' : 'outline'} className="capitalize">
          {data.reservaExists ? `Reserva: ${data.reservaStatus ?? 'registrada'}` : finalizing ? 'Finalizando reserva...' : 'Registrando reserva...'}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span className="text-gray-500">Emails</span>
        <Badge variant={emailCliente.badgeVariant} className="gap-1 capitalize">
          {emailCliente.icon}
          Cliente: {emailCliente.label}
        </Badge>
        <Badge variant={emailAdmin.badgeVariant} className="gap-1 capitalize">
          {emailAdmin.icon}
          Admin: {emailAdmin.label}
        </Badge>
      </div>
      {paid && !isReservaReady && (
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
          Tu pago está confirmado. Estamos registrando la reserva y preparando los emails (puede tardar unos segundos).
        </div>
      )}
    </div>
  );
}

