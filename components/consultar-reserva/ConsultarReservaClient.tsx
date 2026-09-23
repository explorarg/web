'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CONTACT_INFO } from '@/lib/constants';
import { Loader2 } from 'lucide-react';

type PublicReservation = {
  code: string;
  customerMasked: { name: string };
  packageTitle: string;
  departureDate: string;
  people: number;
  pickupPoint: string | null;
  pickupPointTime: string | null;
  amountTotal: number;
  currency: string;
  publicState?: { tone: 'success' | 'pending' | 'warning' | 'error'; title: string; description: string };
};

function formatCurrency(amount: number, currency: string) {
  const value = (amount || 0) / 100;
  const c = String(currency || 'ARS').toUpperCase();
  if (c === 'ARS') return `$${value.toLocaleString('es-AR')}`;
  if (c === 'BRL') return `R$ ${value.toLocaleString('pt-BR')}`;
  return `${value.toFixed(2)} ${c}`;
}

function formatDateLabel(date: string) {
  if (!date || date === 'sin-fecha') return 'Fecha por coordinar';
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

export default function ConsultarReservaClient({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [email, setEmail] = useState('');
  const [document, setDocument] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reservation, setReservation] = useState<PublicReservation | null>(null);
  const requestSeqRef = useRef(0);
  const autoLoadedCodeRef = useRef('');
  const hasAutomaticCode = initialCode.trim().length > 0;
  const showManualLookupCard = !hasAutomaticCode || (!loading && !reservation);

  const canSubmit = useMemo(() => {
    return code.trim().length > 0 && !loading;
  }, [code, loading]);

  const submit = async (options?: { nextCode?: string }) => {
    const nextCode = String(options?.nextCode ?? code).trim();
    if (!nextCode) {
      setError('Ingresá un código de reserva para consultar.');
      setReservation(null);
      return;
    }
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setError(null);
    setReservation(null);
    setLoading(true);
    try {
      const res = await fetch('/api/reservas/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          code: nextCode,
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(document.trim() ? { document: document.trim() } : {}),
        }),
      });
      const json = await res.json().catch(() => null);
      if (requestSeqRef.current !== requestSeq) return;
      if (!json?.ok) {
        setError(json?.error || 'No pudimos verificar la reserva. Revisá los datos e intentá de nuevo.');
        return;
      }
      setReservation(json.reservation as PublicReservation);
    } catch {
      if (requestSeqRef.current !== requestSeq) return;
      setError('No pudimos verificar la reserva. Revisá los datos e intentá de nuevo.');
    } finally {
      if (requestSeqRef.current === requestSeq) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const nextCode = initialCode.trim();
    if (!nextCode) return;
    if (autoLoadedCodeRef.current === nextCode) return;
    autoLoadedCodeRef.current = nextCode;
    setCode(nextCode);
    void submit({ nextCode });
  }, [initialCode]);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <Navbar variant="homeMockup" reserveSpace />

      <main className="container mx-auto max-w-3xl px-4 py-10">
        {/* <div className="mb-6 space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Consultar reserva</h1>
          <p className="text-sm text-gray-600">
            Ingresá tu código de reserva.
          </p>
        </div> */}

        {showManualLookupCard ? (
          <Card className="bg-white/90 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900">Datos de consulta</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
              <div className="space-y-1">
                <Label>Código o número de reserva</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej: 000001" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label>Email (opcional)</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tuemail@mail.com" />
                </div>
                <div className="space-y-1">
                  <Label>DNI (opcional)</Label>
                  <Input value={document} onChange={(e) => setDocument(e.target.value)} placeholder="Solo números" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setCode('');
                    setEmail('');
                    setDocument('');
                    setReservation(null);
                    setError(null);
                    autoLoadedCodeRef.current = '';
                  }}
                  disabled={loading}
                >
                  Limpiar
                </Button>
                <Button type="submit" disabled={!canSubmit}>
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Buscando...
                    </span>
                  ) : (
                    'Consultar'
                  )}
                </Button>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
              </form>
            </CardContent>
          </Card>
        ) : null}

        {loading ? (
          <Card className="mt-6 bg-white/95 shadow-2xl">
            <CardContent className="flex items-center gap-3 py-6 text-sm text-gray-700">
              <Loader2 className="h-5 w-5 animate-spin text-[#0B6E4F]" />
              <div>
                <div className="font-semibold text-gray-900">Buscando tu reserva</div>
                <div className="text-gray-600">Estamos cargando los datos asociados al código ingresado.</div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {reservation ? (
          <Card className="mt-6 bg-white/90 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-gray-900">Tu reserva</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const msg = reservation.publicState ?? {
                  tone: 'pending' as const,
                  title: 'Estado en proceso',
                  description: 'Estamos verificando tu operación. Si necesitás ayuda, contactanos.',
                };
                const tone =
                  msg.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : msg.tone === 'warning'
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : msg.tone === 'error'
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-gray-200 bg-gray-50 text-gray-700';
                return (
                  <div className={`rounded-lg border px-4 py-3 text-sm ${tone}`}>
                    <div className="font-semibold">Reserva encontrada</div>
                    <div className="mt-1">Mostramos los datos de tu reserva.</div>
                  </div>
                );
              })()}

              <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 md:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Reserva</div>
                  <div className="mt-1 font-mono font-semibold text-gray-900">{reservation.code}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Cliente</div>
                  <div className="mt-1 font-semibold text-gray-900">{reservation.customerMasked.name}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Paquete</div>
                  <div className="mt-1 font-semibold text-gray-900">{reservation.packageTitle}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Salida</div>
                  <div className="mt-1 font-semibold text-gray-900">{formatDateLabel(reservation.departureDate)}</div>
                  <div className="text-xs text-gray-600">{reservation.people} pasajero(s)</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Total</div>
                  <div className="mt-1 font-semibold text-gray-900">{formatCurrency(reservation.amountTotal, reservation.currency)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Ascenso</div>
                  <div className="mt-1 font-semibold text-gray-900">
                    {reservation.pickupPoint || '—'}
                  </div>
                  <div className="text-xs text-gray-600">{reservation.pickupPointTime || 'Horario a confirmar'}</div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Aviso anti-estafas</div>
                <div className="mt-2">
                  Explorarg no solicita pagos fuera de los canales oficiales. Ante dudas, contactanos por WhatsApp o email.
                </div>
                <div className="mt-2 text-sm text-gray-900">
                  Contacto oficial: <span className="font-semibold">{CONTACT_INFO.email}</span> ·{' '}
                  <span className="font-semibold">{CONTACT_INFO.telefono}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </main>

      <HomeFooter />
    </div>
  );
}
