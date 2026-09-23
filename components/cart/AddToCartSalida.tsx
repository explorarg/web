'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SeatMap from '@/components/seats/SeatMap';
import { toast } from 'sonner';

type Props = {
  packageId: string;
  packageSlug: string;
  date: string;
  seatSelectionEnabled?: boolean;
  disabled?: boolean;
};

type SeatStateResponse =
  | { enabled: false; seatLayoutId?: string | null }
  | { enabled: true; seatLayoutId: string; template: any; seats: any[] };

export default function AddToCartSalida({ packageId, packageSlug, date, seatSelectionEnabled, disabled }: Props) {
  const router = useRouter();
  const [people, setPeople] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [seatData, setSeatData] = useState<SeatStateResponse | null>(null);
  const [seatLoading, setSeatLoading] = useState(false);
  const [seatSelectionRequired, setSeatSelectionRequired] = useState(Boolean(seatSelectionEnabled));
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const seatAbortRef = useRef<AbortController | null>(null);
  const seatSeqRef = useRef(0);

  const requiresSeats = seatSelectionRequired;

  useEffect(() => {
    setSelectedSeatIds((prev) => prev.slice(0, Math.max(0, people)));
  }, [people]);

  const seatLabelById = useMemo(() => {
    const map = new Map<string, string>();
    const enabled = seatData && (seatData as any).enabled;
    if (!enabled) return map;
    const seats = Array.isArray((seatData as any).seats) ? (seatData as any).seats : [];
    for (const s of seats) {
      if (s?.seatId && s?.label) map.set(String(s.seatId), String(s.label));
    }
    return map;
  }, [seatData]);

  const selectedSeatLabels = useMemo(() => {
    return selectedSeatIds.map((id) => seatLabelById.get(id) || id).filter(Boolean);
  }, [selectedSeatIds, seatLabelById]);

  const canAdd = useMemo(() => {
    if (!requiresSeats) return true;
    return selectedSeatIds.length === people && people > 0;
  }, [requiresSeats, selectedSeatIds.length, people]);

  useEffect(() => {
    setSeatSelectionRequired(Boolean(seatSelectionEnabled));
  }, [seatSelectionEnabled]);

  const loadSeatState = async (opts?: { silent?: boolean }) => {
    const nextSeq = seatSeqRef.current + 1;
    seatSeqRef.current = nextSeq;
    seatAbortRef.current?.abort();
    const controller = new AbortController();
    seatAbortRef.current = controller;
    if (!opts?.silent) setError(null);
    setSeatLoading(true);
    try {
      const res = await fetch(
        `/api/seats/state?packageId=${encodeURIComponent(packageId)}&date=${encodeURIComponent(date)}`,
        { cache: 'no-store', signal: controller.signal }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'No se pudo cargar el mapa de butacas.');
      }
      const json = (await res.json()) as SeatStateResponse;
      if (seatSeqRef.current !== nextSeq) return null;
      setSeatData(json);
      const enabled = json && (json as any).enabled === true;
      setSeatSelectionRequired(enabled);
      if (!enabled) {
        setSelectedSeatIds([]);
        return json;
      }
      const freshSeats = Array.isArray((json as any).seats) ? ((json as any).seats as any[]) : [];
      const freshById = new Map<string, any>();
      for (const seat of freshSeats) freshById.set(String(seat.seatId), seat);
      setSelectedSeatIds((prev) => {
        if (!prev.length) return prev;
        const next = prev.filter((id) => {
          const seat = freshById.get(id);
          return Boolean(seat) && String(seat.status ?? '') === 'available';
        });
        if (next.length !== prev.length) {
          toast.message('Actualizamos la disponibilidad', {
            description: 'Algunas butacas dejaron de estar disponibles y se removieron de tu selección.',
          });
        }
        return next;
      });
      return json;
    } catch (e) {
      if (controller.signal.aborted) return null;
      setError(e instanceof Error ? e.message : 'No se pudo cargar el mapa de butacas.');
      return null;
    } finally {
      if (seatSeqRef.current === nextSeq) setSeatLoading(false);
    }
  };

  useEffect(() => {
    if (!packageId || !date || date === 'sin-fecha') return;
    void loadSeatState();
  }, [packageId, date]);

  useEffect(() => {
    if (!dialogOpen) return;
    if (!requiresSeats) return;
    if (!packageId || !date || date === 'sin-fecha') return;
    const id = window.setInterval(() => {
      void loadSeatState({ silent: true });
    }, 9000);
    return () => window.clearInterval(id);
  }, [dialogOpen, requiresSeats, packageId, date]);

  const add = async () => {
    if (disabled) return;
    setError(null);
    setLoading(true);
    try {
      const latestSeatState = await loadSeatState();
      const seatsRequired = latestSeatState ? (latestSeatState as any).enabled === true : requiresSeats;
      if (seatsRequired && selectedSeatIds.length !== people) {
        setDialogOpen(true);
        return;
      }
      let referralCode: string | undefined = undefined;
      try {
        const url = new URL(window.location.href);
        const ref = url.searchParams.get('ref') || url.searchParams.get('referral') || url.searchParams.get('code');
        if (ref && ref.trim()) referralCode = ref.trim();
      } catch {
        // ignore
      }
      const res = await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: packageSlug,
          packageId,
          date,
          people,
          ...(seatsRequired ? { selectedSeats: selectedSeatLabels } : {}),
          ...(referralCode ? { referralCode } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'No se pudo agregar al carrito.');
      }
      router.push('/carrito');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar al carrito.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          max={50}
          value={people}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            setPeople(Number.isFinite(n) ? Math.min(50, Math.max(1, n)) : 1);
          }}
          className="h-9 w-20"
          disabled={disabled || loading}
        />
        {requiresSeats ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-9"
              disabled={disabled || loading}
              onClick={() => {
                setDialogOpen(true);
                void loadSeatState();
              }}
            >
              Elegir butacas
            </Button>
            <Button onClick={() => void add()} disabled={disabled || loading || !canAdd} className="h-9">
              Agregar
            </Button>
          </>
        ) : (
          <Button onClick={() => void add()} disabled={disabled || loading} className="h-9">
            Agregar
          </Button>
        )}
      </div>
      {requiresSeats && selectedSeatLabels.length > 0 && (
        <div className="text-xs text-gray-600">
          Butacas: <span className="font-semibold text-gray-900">{selectedSeatLabels.join(', ')}</span>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <Dialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl md:w-full md:max-w-4xl">
          <div className="flex max-h-[85vh] flex-col">
            <div className="border-b border-gray-200 px-6 py-4">
              <DialogHeader className="gap-1">
                <DialogTitle>Elegí tus butacas</DialogTitle>
                <div className="text-sm text-gray-500">
                  Seleccioná <span className="font-semibold text-gray-900">{people}</span> butaca{people === 1 ? '' : 's'} · Elegidas:{' '}
                  <span className="font-semibold text-gray-900">{selectedSeatIds.length}</span> / {people}
                </div>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {seatLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 w-40 rounded bg-gray-200" />
                  <div className="h-[320px] w-full rounded-3xl bg-gray-100" />
                  <div className="h-4 w-56 rounded bg-gray-200" />
                </div>
              ) : seatData && (seatData as any).enabled ? (
                <SeatMap
                  template={(seatData as any).template}
                  seats={(seatData as any).seats}
                  selectedSeatIds={selectedSeatIds}
                  maxSelectable={people}
                  onChangeSelected={setSelectedSeatIds}
                />
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  Esta salida no tiene butacas configuradas.
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 bg-white px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cerrar
                </Button>
                <Button type="button" disabled={selectedSeatIds.length !== people} onClick={() => setDialogOpen(false)}>
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
