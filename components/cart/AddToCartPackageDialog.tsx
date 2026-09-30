'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SeatMap from '@/components/seats/SeatMap';
import { ArrowLeft, Calendar, Check, ChevronRight, Info, Lock, Mail, MapPin, Minus, Plus, ShoppingCart, Users, X, Zap } from 'lucide-react';
import type { DepartureSeat, Paquete, ReservationRoomType } from '@/types';
import {
  computeReservationPricing,
  getReservationExtraTotalAmount,
  getSinglePassengerSurchargeSummary,
  getOperationalDepartureDates,
  isSinglePassengerSurchargeExtra,
  resolveDepartureConfig,
  resolveReservationExtraSelections,
} from '@/lib/packages/resolve-departure';
import { getSeatCategoryLabel, getSeatCategoryPricingFromTemplate, isSeatCategoryCode } from '@/lib/seats/categories';
import { getSeatCategoryExtraSummaries, getSeatCategoryTotalAmount, getSeatTypeLabel } from '@/lib/reservas/seat-category-extras';
import SinglePassengerSurchargeBreakdown from '@/components/pricing/SinglePassengerSurchargeBreakdown';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { getPackageRoomTypes, getPackageRoomTypeLabel, getPackageRoomTypeOptions } from '@/lib/reservas/room-types';

function formatAmountCents(amountCents: number, currency: string): string {
  const normalized = String(currency || 'ARS').toUpperCase();
  const locale = normalized === 'BRL' ? 'pt-BR' : normalized === 'USD' ? 'en-US' : 'es-AR';
  const amount = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: normalized,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format((amountCents || 0) / 100);
  return `${amount} ${normalized}`;
}

type SeatStateResponse =
  | { enabled: false; seatLayoutId?: string | null }
  | { enabled: true; seatLayoutId: string; template: any; seats: any[] };

export default function AddToCartPackageDialog({
  paquete,
  initialAdults,
  initialMinors,
  triggerClassName,
}: {
  paquete: Paquete;
  initialAdults?: number;
  initialMinors?: number;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [adults, setAdults] = useState(initialAdults ?? 1);
  const [minors, setMinors] = useState(initialMinors ?? 0);
  const [pickupPoint, setPickupPoint] = useState<string>('');
  const [roomType, setRoomType] = useState<ReservationRoomType | ''>('');
  const availableDates = useMemo(() => {
    return getOperationalDepartureDates(paquete);
  }, [paquete]);
  const [date, setDate] = useState<string>('sin-fecha');
  const [dateOffset, setDateOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seatData, setSeatData] = useState<SeatStateResponse | null>(null);
  const [seatLoading, setSeatLoading] = useState(false);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [seatActiveFloor, setSeatActiveFloor] = useState(0);
  const [activeSeatPreview, setActiveSeatPreview] = useState<DepartureSeat | null>(null);
  const seatCacheRef = useRef<Map<string, SeatStateResponse>>(new Map());
  const seatPendingRef = useRef<Map<string, Promise<SeatStateResponse>>>(new Map());
  const seatAbortRef = useRef<AbortController | null>(null);
  const seatSeqRef = useRef(0);
  const pickupPointTimes = useMemo(() => {
    const raw = resolveDepartureConfig(paquete, date).pickupPointsConfig;
    const map = new Map<string, string>();
    if (Array.isArray(raw)) {
      raw.forEach((item: any) => {
        const label = String(item?.label ?? '').trim();
        const time = String(item?.time ?? '').trim();
        if (label) map.set(label, time);
      });
    }
    return map;
  }, [paquete]);

  const pickupPoints: string[] = useMemo((): string[] => {
    return resolveDepartureConfig(paquete, date).pickupPointsConfig.map((p) => String(p?.label ?? '').trim()).filter(Boolean);
  }, [paquete, date]);

  useEffect(() => {
    if (!open) return;
    if (!pickupPoints.length) return;
    if (!pickupPoint || !pickupPoints.includes(pickupPoint)) {
      setPickupPoint(pickupPoints[0]);
    }
  }, [open, pickupPoint, pickupPoints]);

  // Track mobile screen size
  useEffect(() => {
    const updateIsMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    updateIsMobile();
    window.addEventListener('resize', updateIsMobile);
    return () => window.removeEventListener('resize', updateIsMobile);
  }, []);

  const peopleTotal = Math.max(0, (Number(adults) || 0) + (Number(minors) || 0));
  const visibleDateCount = isMobile ? 2 : 4;
  const resolvedDeparture = useMemo(() => resolveDepartureConfig(paquete, date), [paquete, date]);
  const availableRoomTypes = useMemo(() => getPackageRoomTypes(paquete), [paquete]);
  const availableRoomTypeOptions = useMemo(() => getPackageRoomTypeOptions(paquete), [paquete]);
  const requiresRoomType = !resolvedDeparture.isFullDay && availableRoomTypes.length > 0;
  const requiresSeats = useMemo(() => {
    return resolvedDeparture.seatsEnabled;
  }, [resolvedDeparture.seatsEnabled]);
  const selectedExtras = useMemo(
    () =>
      resolveReservationExtraSelections({
        paquete,
        pickupPoint,
        selectedSeats: selectedSeatIds,
        seatLayoutTemplate: seatData && (seatData as any).enabled ? (seatData as any).template : null,
      }),
    [paquete, pickupPoint, seatData, selectedSeatIds]
  );
  const selectedExtraDetails = useMemo(
    () =>
      selectedExtras
        .filter((extra) => String(extra?.label ?? '').trim().length > 0)
        .map((extra) => ({
          ...extra,
          totalAmount: getReservationExtraTotalAmount(extra, peopleTotal),
        })),
    [peopleTotal, selectedExtras]
  );
  const seatCategoryExtraDetails = useMemo(
    () => getSeatCategoryExtraSummaries(selectedExtras),
    [selectedExtras]
  );
  const seatCategoryTotalAmount = useMemo(
    () => getSeatCategoryTotalAmount(selectedExtras),
    [selectedExtras]
  );
  const seatTypeLabel = useMemo(
    () => getSeatTypeLabel(selectedExtras, selectedSeatIds.length),
    [selectedExtras, selectedSeatIds.length]
  );
  const pricing = useMemo(() => {
    return computeReservationPricing(paquete, date, {
      peopleAdults: Math.max(0, Number(adults) || 0),
      peopleMinors: Math.max(0, Number(minors) || 0),
      selectedExtras,
    });
  }, [paquete, date, adults, minors, selectedExtras]);
  const effectiveCurrency = pricing.displayCurrency || resolvedDeparture.displayCurrency || paquete.moneda || 'ARS';
  const singlePassengerSurcharge = useMemo(
    () =>
      getSinglePassengerSurchargeSummary({
        people: peopleTotal,
        baseSubtotalAmount: pricing.baseSubtotalAmount,
      }),
    [peopleTotal, pricing.baseSubtotalAmount]
  );

  useEffect(() => {
    setSelectedSeatIds((prev) => prev.slice(0, Math.max(0, peopleTotal)));
  }, [peopleTotal]);

  const seatLabelById = useMemo(() => {
    const map = new Map<string, string>();
    const enabled = seatData && (seatData as any).enabled;
    if (!enabled) return map;
    const seats = Array.isArray((seatData as any).seats) ? (seatData as any).seats : [];
    for (const s of seats) {
      if (s?.seatId && s?.label) {
        // Guardar etiqueta completa con fila y columna
        const rowLetter = getSeatRowLabel(s.row);
        const colNum = s.col + 1;
        map.set(String(s.seatId), `${s.label} (Fila ${rowLetter}, Col ${colNum})`);
      }
    }
    return map;
  }, [seatData]);

  const selectedSeatLabels = useMemo(() => {
    return selectedSeatIds.map((id) => seatLabelById.get(id) || id).filter(Boolean);
  }, [selectedSeatIds, seatLabelById]);

  const seatById = useMemo(() => {
    const map = new Map<string, DepartureSeat>();
    const enabled = seatData && (seatData as any).enabled;
    if (!enabled) return map;
    const seats = Array.isArray((seatData as any).seats) ? ((seatData as any).seats as DepartureSeat[]) : [];
    for (const seat of seats) map.set(seat.seatId, seat);
    return map;
  }, [seatData]);

  const selectedSeatDetails = useMemo(() => {
    return selectedSeatIds.map((id) => seatById.get(id)).filter(Boolean) as DepartureSeat[];
  }, [seatById, selectedSeatIds]);

  const effectiveSeatPreview = useMemo(() => {
    if (activeSeatPreview && seatById.has(activeSeatPreview.seatId)) return seatById.get(activeSeatPreview.seatId) ?? null;
    const selectedOnActiveFloor = selectedSeatDetails.filter((seat) => seat.floor === seatActiveFloor);
    if (selectedOnActiveFloor.length > 0) return selectedOnActiveFloor[selectedOnActiveFloor.length - 1];
    return selectedSeatDetails[0] ?? null;
  }, [activeSeatPreview, seatActiveFloor, seatById, selectedSeatDetails]);
  const activeSeatCategoryPrice = useMemo(() => {
    const category = effectiveSeatPreview?.category;
    if (!category || !isSeatCategoryCode(category)) return 0;
    return Math.max(
      0,
      Number(getSeatCategoryPricingFromTemplate(seatData && (seatData as any).enabled ? (seatData as any).template : null)?.[category]?.amount || 0)
    );
  }, [effectiveSeatPreview?.category, seatData]);

  const canSubmit = useMemo(() => {
    if (peopleTotal < 1) return false;
    if (requiresRoomType && !availableRoomTypes.includes(roomType as ReservationRoomType)) return false;
    if (requiresSeats) return selectedSeatIds.length === peopleTotal;
    return true;
  }, [availableRoomTypes, peopleTotal, requiresRoomType, requiresSeats, roomType, selectedSeatIds.length]);

  const fetchSeatState = async (d: string, opts?: { force?: boolean; signal?: AbortSignal }): Promise<SeatStateResponse> => {
    if (opts?.force) {
      const res = await fetch(
        `/api/seats/state?packageId=${encodeURIComponent(paquete.id)}&date=${encodeURIComponent(d)}`,
        { cache: 'no-store', signal: opts.signal }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'No se pudo cargar el mapa de butacas.');
      }
      const json = (await res.json()) as SeatStateResponse;
      seatCacheRef.current.set(d, json);
      return json;
    }
    const cached = seatCacheRef.current.get(d);
    if (cached) return cached;
    const pending = seatPendingRef.current.get(d);
    if (pending) return pending;
    const request = (async () => {
      const res = await fetch(
        `/api/seats/state?packageId=${encodeURIComponent(paquete.id)}&date=${encodeURIComponent(d)}`,
        { cache: 'no-store', signal: opts?.signal }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'No se pudo cargar el mapa de butacas.');
      }
      const json = (await res.json()) as SeatStateResponse;
      seatCacheRef.current.set(d, json);
      return json;
    })();
    seatPendingRef.current.set(d, request);
    try {
      return await request;
    } finally {
      seatPendingRef.current.delete(d);
    }
  };

  const prefetchSeatState = (d: string) => {
    if (!requiresSeats) return;
    if (!d || d === 'sin-fecha') return;
    if (seatCacheRef.current.has(d) || seatPendingRef.current.has(d)) return;
    void fetchSeatState(d).catch(() => {
      // noop
    });
  };

  const loadSeatState = async (d: string, opts?: { silent?: boolean; force?: boolean }) => {
    const nextSeq = seatSeqRef.current + 1;
    seatSeqRef.current = nextSeq;
    seatAbortRef.current?.abort();
    const controller = new AbortController();
    seatAbortRef.current = controller;
    if (!opts?.silent) {
      setSeatLoading(true);
      setError(null);
    } else {
      setSeatLoading(true);
    }
    try {
      const cached = seatCacheRef.current.get(d);
      if (cached) setSeatData(cached);
      const json = await fetchSeatState(d, { force: Boolean(opts?.force), signal: controller.signal });
      if (seatSeqRef.current !== nextSeq) return;
      setSeatData(json);
      if (json && (json as any).enabled === false) {
        setSelectedSeatIds([]);
        setActiveSeatPreview(null);
        return;
      }
      const enabled = json && (json as any).enabled === true;
      if (enabled) {
        const freshSeats = Array.isArray((json as any).seats) ? ((json as any).seats as DepartureSeat[]) : [];
        const freshById = new Map<string, DepartureSeat>();
        for (const seat of freshSeats) freshById.set(String(seat.seatId), seat);
        setSelectedSeatIds((prev) => {
          if (!prev.length) return prev;
          const next = prev.filter((id) => {
            const seat = freshById.get(id);
            return Boolean(seat) && String((seat as any).status ?? '') === 'available';
          });
          if (next.length !== prev.length) {
            toast.message('Actualizamos la disponibilidad', {
              description: 'Algunas butacas dejaron de estar disponibles y se removieron de tu selección.',
            });
          }
          return next;
        });
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : 'No se pudo cargar el mapa de butacas.');
    } finally {
      if (seatSeqRef.current === nextSeq) setSeatLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (!requiresSeats) {
      setSeatData(null);
      setSelectedSeatIds([]);
      setActiveSeatPreview(null);
      return;
    }
    void loadSeatState(date, { force: true });
  }, [open, date, requiresSeats]);

  useEffect(() => {
    if (!open || !requiresSeats) return;
    if (!date || date === 'sin-fecha') return;
    const id = window.setInterval(() => {
      void loadSeatState(date, { silent: true, force: true });
    }, 9000);
    return () => window.clearInterval(id);
  }, [open, requiresSeats, date]);

  useEffect(() => {
    const enabled = seatData && (seatData as any).enabled;
    if (!enabled) {
      setSeatActiveFloor(0);
      setActiveSeatPreview(null);
      return;
    }
    const floors = Math.max(1, Number((seatData as any).template?.floors ?? 1));
    setSeatActiveFloor((prev) => Math.max(0, Math.min(prev, floors - 1)));
    setActiveSeatPreview((prev) => (prev && seatById.has(prev.seatId) ? (seatById.get(prev.seatId) ?? null) : null));
  }, [seatById, seatData]);

  useEffect(() => {
    if (!open || !requiresSeats) return;
    const visible = availableDates.slice(dateOffset, dateOffset + 4);
    for (const d of visible) {
      prefetchSeatState(d);
    }
  }, [open, requiresSeats, availableDates, dateOffset]);

  const addToCart = async () => {
    setError(null);
    setLoading(true);
    try {
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
          packageId: paquete.id,
          slug: paquete.slug,
          date,
          peopleAdults: Math.max(0, Number(adults) || 0),
          peopleMinors: Math.max(0, Number(minors) || 0),
          ...(pickupPoint ? { pickupPoint } : {}),
          ...(pickupPoint ? { pickupPointTime: pickupPointTimes.get(pickupPoint) || null } : {}),
          ...(requiresRoomType ? { roomType, roomSelection: [{ roomType, quantity: 1 }] } : {}),
          ...(requiresSeats ? { selectedSeats: selectedSeatLabels } : {}),
          ...(referralCode ? { referralCode } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'No se pudo agregar al carrito.');
      }
      setOpen(false);
      router.push('/carrito');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo agregar al carrito.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          const next = availableDates.length > 0 ? availableDates[0] : 'sin-fecha';
          setDate(next);
          setDateOffset(0);
          setAdults(Math.max(1, Number(initialAdults ?? 1) || 1));
          setMinors(Math.max(0, Number(initialMinors ?? 0) || 0));
          setRoomType('');
          setOpen(true);
        }}
        onMouseEnter={() => {
          const next = availableDates.length > 0 ? availableDates[0] : 'sin-fecha';
          prefetchSeatState(next);
        }}
        onFocus={() => {
          const next = availableDates.length > 0 ? availableDates[0] : 'sin-fecha';
          prefetchSeatState(next);
        }}
        className={triggerClassName ?? "h-10 w-full justify-between"}
      >
        <span>Reservar</span>
        <ShoppingCart className="h-4 w-4" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setError(null);
        }}
      >
        <DialogContent
          className="!flex !h-[calc(100dvh-0.75rem)] !max-h-[calc(100dvh-0.75rem)] !flex-col !gap-0 !w-[calc(100vw-0.75rem)] sm:!h-[min(90dvh,54rem)] sm:!max-h-[calc(100dvh-2rem)] sm:!w-[calc(100vw-2rem)] !max-w-none sm:!max-w-[72rem] bg-[#FCFEFF] p-0 overflow-hidden rounded-[20px] sm:rounded-[26px] border border-[#DCEBF7] shadow-[0_24px_80px_rgba(8,46,86,0.18)]"
          showCloseButton={false}
        >
          <div className="shrink-0 border-b border-[#E4EEF7] bg-white px-3.5 py-2.5 pt-[max(0.65rem,env(safe-area-inset-top))] sm:px-6 sm:py-3.5">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#ECFAFF] sm:h-10 sm:w-10">
                <Calendar className="h-4 w-4 text-[#2BB8BF] sm:h-5 sm:w-5" />
              </div>
              <DialogHeader className="min-w-0 flex-1 gap-1 text-left">
                <DialogTitle className="max-w-full pr-2 text-[17px] font-extrabold leading-[1.1] tracking-[-0.01em] text-slate-800 sm:pr-0 sm:text-[20px]">
                  {String(paquete?.titulo ?? '').trim()}

                </DialogTitle>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFAFF] px-2.5 py-1 text-[9px] font-bold text-[#0A7FA0] sm:text-[10px]">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2BB8BF] text-[9px] text-white">1</span>
                    Fecha y pasajeros
                  </span>
                  <ChevronRight className="h-3 w-3 text-[#A9BED4]" />
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold sm:text-[11px]',
                      requiresSeats && selectedSeatIds.length === peopleTotal && peopleTotal > 0
                        ? 'bg-[#EAFBF3] text-[#117A4B]'
                        : 'bg-[#F1F6FB] text-[#5B7292]'
                    )}
                  >
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#8FA7C0] text-[9px] text-white">2</span>
                    {requiresSeats ? `Butacas ${selectedSeatIds.length}/${Math.max(1, peopleTotal)}` : 'Confirmación'}
                  </span>
                </div>
              </DialogHeader>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D8E8F5] bg-white transition-colors hover:bg-[#F3FAFF] sm:h-10 sm:w-10"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4 text-[#12325D] sm:h-5 sm:w-5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 sm:px-5 sm:py-4 xl:px-6 bg-[linear-gradient(180deg,#FAFDFF_0%,#F3FAFF_100%)]">
            <div className="grid min-w-0 items-start gap-3 sm:gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:gap-5">
              {/* Left Column */}
              <div className="min-w-0 space-y-3 sm:space-y-4">
                <div className="rounded-2xl border border-[#DCEBF7] bg-white/95 p-3.5 shadow-[0_12px_34px_rgba(18,89,150,0.07)] sm:rounded-3xl sm:p-4 xl:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[14px] font-black leading-tight tracking-[-0.01em] text-slate-800 sm:text-[15px]">1. Elegí tu fecha de salida</div>
                    {availableDates.length > visibleDateCount ? (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDateOffset((v) => Math.max(0, v - visibleDateCount))}
                          disabled={dateOffset <= 0}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#D7E7F6] bg-white transition-colors hover:bg-[#F3FAFF] disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Fechas anteriores"
                        ><ArrowLeft className="h-3.5 w-3.5 text-[#264B79]" /></button>
                        <button
                          type="button"
                          onClick={() => setDateOffset((v) => Math.min(Math.max(0, availableDates.length - visibleDateCount), v + visibleDateCount))}
                          disabled={availableDates.length <= dateOffset + visibleDateCount}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#D7E7F6] bg-white transition-colors hover:bg-[#F3FAFF] disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Más fechas"
                        ><ChevronRight className="h-3.5 w-3.5 text-[#264B79]" /></button>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {availableDates.slice(dateOffset, dateOffset + visibleDateCount).map((d) => {
                      const active = d === date;
                      const dt = new Date(`${d}T00:00:00`);
                      const ok = !Number.isNaN(dt.getTime());
                      const day = ok ? dt.getDate() : d;
                      const month = ok ? dt.toLocaleDateString('es-AR', { month: 'short' }) : '';
                      const weekday = ok ? dt.toLocaleDateString('es-AR', { weekday: 'short' }) : '';
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setDate(d);
                            setSelectedSeatIds([]);
                            prefetchSeatState(d);
                          }}
                          onMouseEnter={() => prefetchSeatState(d)}
                          aria-pressed={active}
                          className={cn(
                            'flex min-h-[54px] min-w-0 w-full items-center gap-2 rounded-xl border px-2 py-1.5 text-left transition-colors sm:min-h-[58px] sm:gap-2.5 sm:px-2.5',
                            active
                              ? 'border-[#0BAFCB] bg-[#EAFBFE] text-[#087C98] shadow-[0_3px_10px_rgba(0,154,188,0.10)] ring-1 ring-[#0BAFCB]/15'
                              : 'border-[#E1EAF3] bg-white text-[#0A2A53] hover:border-[#A6C6E6] hover:bg-[#F8FCFF]'
                          )}
                        >
                          <span className={cn('flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg text-[15px] font-extrabold leading-none sm:h-10 sm:w-10 sm:text-base', active ? 'bg-[#12AFCB] text-white' : 'bg-[#F1F6FA] text-[#173B62]')}>
                            {String(day).padStart(2, '0')}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-bold capitalize leading-tight sm:text-xs">{weekday}</span>
                            <span className={cn('mt-0.5 block truncate text-[10px] font-medium capitalize leading-tight sm:text-[11px]', active ? 'text-[#16859D]' : 'text-[#7890A9]')}>{month}</span>
                          </span>
                          {active ? <Check className="mr-0.5 h-3.5 w-3.5 shrink-0 text-[#0B9BB8]" aria-hidden /> : null}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-[#F5FAFD] px-3 py-2.5 sm:mt-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#2BB8BF] shadow-sm ring-1 ring-[#E6F0F6]"><Calendar className="h-4 w-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-[10px] font-medium text-[#7188A1]">Salida seleccionada</span>
                      <span className="block truncate text-[12px] font-extrabold capitalize leading-tight text-[#072852] sm:text-[13px]">{date === 'sin-fecha' ? 'A coordinar' : formatDateLong(date)}</span>
                    </span>
                  </div>

                  <div className="mt-3 border-t border-[#E9F1F9] pt-3 sm:mt-4 sm:pt-4">

                    {pickupPoints.length > 0 ? (
                      <div className="mt-3 grid gap-2.5 md:grid-cols-2">
                        <div className="min-w-0 space-y-1">
                          <Label className="text-xs font-semibold text-[#607B9C]">Salida seleccionada</Label>
                          <Select value={pickupPoint} onValueChange={setPickupPoint} disabled={loading}>
                            <SelectTrigger className="h-10 w-full min-w-0 rounded-2xl border-[#D7E7F6] bg-white text-[13px] font-bold text-[#06214A]">
                              <SelectValue placeholder="Seleccionar salida" className="truncate" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-[#D7E7F6]">
                              {pickupPoints.map((p: string) => (
                                <SelectItem key={p} value={p} className="text-[13px] font-medium text-[#06214A]">
                                  {p}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="min-w-0 space-y-1">
                          <Label className="text-xs font-semibold text-[#607B9C]">Horario de salida</Label>
                          <div className="flex h-10 min-w-0 items-center rounded-2xl border border-[#D7E7F6] bg-white px-4 text-[13px] font-bold text-[#06214A]">
                            <span className="truncate">{pickupPointTimes.get(pickupPoint) || 'Horario a confirmar'}</span>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-[#607B9C]">Adultos</Label>
                        <div className="flex items-center gap-1 rounded-2xl border border-[#D7E7F6] bg-white p-1">
                          <button
                            type="button"
                            onClick={() => setAdults(Math.max(1, adults - 1))}
                            disabled={loading}
                            className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
                          >
                            <Minus className="h-4 w-4 text-slate-600" />
                          </button>
                          <input
                            type="number"
                            value={adults === 0 ? '' : adults}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                              setAdults(isNaN(val) ? 0 : Math.min(50, val));
                            }}
                            disabled={loading}
                            className="h-8 w-full border-none bg-transparent p-0 text-center text-[13px] font-bold text-[#06214A] focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => setAdults(Math.min(50, adults + 1))}
                            disabled={loading}
                            className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
                          >
                            <Plus className="h-4 w-4 text-slate-600" />
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-semibold text-[#607B9C]">Menores</Label>
                        <div className="flex items-center gap-1 rounded-2xl border border-[#D7E7F6] bg-white p-1">
                          <button
                            type="button"
                            onClick={() => setMinors(Math.max(0, minors - 1))}
                            disabled={loading}
                            className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
                          >
                            <Minus className="h-4 w-4 text-slate-600" />
                          </button>
                          <input
                            type="number"
                            value={minors === 0 ? '' : minors}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                              setMinors(isNaN(val) ? 0 : Math.min(50, val));
                            }}
                            disabled={loading}
                            className="h-8 w-full border-none bg-transparent p-0 text-center text-[13px] font-bold text-[#06214A] focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => setMinors(Math.min(50, minors + 1))}
                            disabled={loading}
                            className="flex h-8 w-8 items-center justify-center rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50"
                          >
                            <Plus className="h-4 w-4 text-slate-600" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {requiresRoomType ? (
                      <div className="mt-4 min-w-0 space-y-1">
                        <Label className="text-xs font-semibold text-[#607B9C]">Tipo de habitación</Label>
                        <Select value={roomType || undefined} onValueChange={(value) => setRoomType(value as ReservationRoomType)} disabled={loading}>
                          <SelectTrigger className="h-10 w-full min-w-0 rounded-2xl border-[#D7E7F6] bg-white text-[13px] font-bold text-[#06214A]">
                            <SelectValue placeholder="Seleccionar habitación" />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border-[#D7E7F6]">
                            {availableRoomTypeOptions.map((option) => (
                              <SelectItem key={option.id} value={option.id} className="text-[13px] font-medium text-[#06214A]">
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="min-w-0 rounded-2xl border border-[#DCEBF7] bg-white p-3 shadow-[0_12px_34px_rgba(18,89,150,0.07)] sm:rounded-3xl sm:p-4">
                  <div className="text-[14px] sm:text-[15px] leading-[1.1] font-black tracking-[-0.01em] text-slate-800">Resumen de tu reserva</div>
                  <div className="mt-3 sm:mt-4">
                    <div>
                      <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.12em] text-[#6A85A6]">
                        Datos elegidos
                      </div>
                      <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3 min-w-0">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-[#2BB8BF]" />
                          <div>
                            <div className="text-[11px] sm:text-[12px] text-[#5E7898]">Fecha de salida</div>
                            <div className="text-[12px] sm:text-[13px] leading-[1.25] font-black tracking-[-0.005em] text-[#06214A]">
                              {date === 'sin-fecha' ? 'A coordinar' : formatDateLong(date)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 sm:gap-3">
                          <Check className="h-4 w-4 sm:h-5 sm:w-5 text-[#2BB8BF]" />
                          <div className="min-w-0">
                            <div className="text-[11px] sm:text-[12px] text-[#5E7898]">Butacas seleccionadas</div>
                            <div className="text-[12px] sm:text-[13px] leading-[1.25] font-black tracking-[-0.005em] text-[#06214A]">
                              {requiresSeats ? (
                                selectedSeatDetails.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {selectedSeatDetails.map((s, idx) => (
                                      <span key={s.seatId}>
                                        {getSeatRowLabel(s.row)}{s.label}
                                        {idx < selectedSeatDetails.length - 1 ? ', ' : ''}
                                      </span>
                                    ))}
                                  </div>
                                ) : '—'
                              ) : '—'}
                            </div>
                            {seatTypeLabel ? (
                              <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-[#5E7898]">
                                Tipo de butaca: <span className="font-semibold text-[#06214A]">{seatTypeLabel}</span>
                                {seatCategoryTotalAmount > 0 ? (
                                  <>
                                    {' '}
                                    · Plus total{' '}
                                    <span className="font-semibold text-[#06214A]">
                                      {formatAmountCents(seatCategoryTotalAmount, effectiveCurrency)}
                                    </span>
                                  </>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-start gap-2 sm:gap-3">
                          <Users className="h-4 w-4 sm:h-5 sm:w-5 text-[#2BB8BF]" />
                          <div>
                            <div className="text-[11px] sm:text-[12px] text-[#5E7898]">Pasajeros</div>
                            <div className="text-[12px] sm:text-[13px] leading-[1.25] font-black tracking-[-0.005em] text-[#06214A]">
                              {adults} adultos{minors > 0 ? `, ${minors} menores` : ''}
                            </div>
                          </div>
                        </div>
                        {requiresRoomType ? (
                          <div className="flex items-start gap-2 sm:gap-3">
                            <Check className="h-4 w-4 sm:h-5 sm:w-5 text-[#2BB8BF]" />
                            <div>
                              <div className="text-[11px] sm:text-[12px] text-[#5E7898]">Habitación</div>
                              <div className="text-[12px] sm:text-[13px] font-black text-[#06214A]">
                                {roomType ? getPackageRoomTypeLabel(paquete, roomType) : 'Sin seleccionar'}
                              </div>
                            </div>
                          </div>
                        ) : null}
                        <div className="flex items-start gap-2 sm:gap-3">
                          <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-[#2BB8BF]" />
                          <div className="min-w-0">
                            <div className="text-[11px] sm:text-[12px] text-[#5E7898]">Salida</div>
                            <div className="break-words text-[12px] sm:text-[13px] leading-[1.25] font-black tracking-[-0.005em] text-[#06214A]">
                              {pickupPoint || 'Sin ascenso definido'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-[#E9F1F9] pt-4">
                      <div className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.12em] text-[#6A85A6]">
                        Resumen de pago
                      </div>
                      <div className="mt-3 space-y-2 text-[12px] text-[#5E7898] sm:text-[13px]">
                        {pricing.peopleMinors && pricing.peopleMinors > 0 && pricing.unitAmountMinors !== pricing.unitAmountAdults ? (
                          <div className="flex items-start justify-between gap-3">
                            <span>Precio menor</span>
                            <span className="shrink-0 font-semibold text-[#06214A]">
                              {formatAmountCents(pricing.unitAmountMinors, effectiveCurrency)}
                            </span>
                          </div>
                        ) : null}
                        <div className="flex items-start justify-between gap-3">
                          <span>
                            Subtotal
                            <span className="text-[#9CAFC4]"> · {peopleTotal} {peopleTotal === 1 ? 'pasajero' : 'pasajeros'}</span>
                          </span>
                          <span className="shrink-0 font-semibold text-[#06214A]">
                            {formatAmountCents(pricing.baseSubtotalAmount, effectiveCurrency)}
                          </span>
                        </div>
                        {selectedExtraDetails
                          .filter((extra) => !isSinglePassengerSurchargeExtra(extra))
                          .map((extra) => (
                            <div
                              key={`summary-${extra.code}-${extra.label}`}
                              className="flex items-start justify-between gap-3"
                            >
                              <span className="min-w-0 break-words">{extra.label}</span>
                              <span className="shrink-0 font-semibold text-[#06214A]">
                                {formatAmountCents(extra.totalAmount, effectiveCurrency)}
                              </span>
                            </div>
                          ))}
                        {singlePassengerSurcharge.applies ? (
                          <SinglePassengerSurchargeBreakdown
                            label={singlePassengerSurcharge.label}
                            amountLabel={formatAmountCents(singlePassengerSurcharge.amount, effectiveCurrency)}
                            tone="teal"
                          />
                        ) : null}

                        <div className="flex items-baseline justify-between gap-3 border-t border-[#E9F1F9] pt-3">
                          <span className="text-[13px] font-semibold text-[#072852] sm:text-[14px]">
                            Total a pagar
                          </span>
                          <span className="shrink-0 text-[18px] font-black leading-none tracking-[-0.01em] text-[#0798BA] sm:text-[20px]">
                            {formatAmountCents(pricing.subtotalAmount, effectiveCurrency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 lg:sticky lg:top-0">
                <div className="min-w-0 rounded-2xl border border-[#DCEBF7] bg-white p-3 shadow-[0_12px_34px_rgba(18,89,150,0.07)] sm:rounded-3xl sm:p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[14px] sm:text-[16px] leading-[1.1] font-black tracking-[-0.01em] text-slate-800">2. Elegí tus butacas</div>
                      <div className="mt-1 flex items-center gap-2 text-[11px] sm:text-xs text-[#5E7898]">
                        <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        Seleccioná hasta {Math.max(1, peopleTotal)} butacas por reserva
                      </div>
                    </div>
                    {requiresSeats ? (
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-3 py-1 text-[11px] font-bold',
                          selectedSeatIds.length === peopleTotal && peopleTotal > 0
                            ? 'bg-[#EAFBF3] text-[#117A4B]'
                            : 'bg-[#F1F6FB] text-[#5B7292]'
                        )}
                      >
                        {selectedSeatIds.length}/{Math.max(1, peopleTotal)}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 sm:mt-4">
                    {requiresSeats ? (
                      seatData && (seatData as any).enabled ? (
                        <>
                          <SeatMap
                            template={(seatData as any).template}
                            seats={(seatData as any).seats}
                            selectedSeatIds={selectedSeatIds}
                            maxSelectable={Math.max(1, peopleTotal)}
                            compact={isMobile}
                            onChangeSelected={setSelectedSeatIds}
                            activeFloor={seatActiveFloor}
                            onActiveFloorChange={setSeatActiveFloor}
                            onSeatPreviewChange={setActiveSeatPreview}
                          />
                          {seatLoading ? <div className="mt-2 text-[11px] sm:text-xs text-[#5E7898]">Actualizando disponibilidad...</div> : null}
                        </>
                      ) : seatLoading ? (
                        <SeatGridSkeleton
                          template={(seatData as any)?.template}
                          seats={(seatData as any)?.seats}
                          hintPassengers={Math.max(1, peopleTotal)}
                        />
                      ) : (
                        <div className="text-sm text-gray-600">No hay butacas configuradas.</div>
                      )
                    ) : (
                      <div className="text-sm text-gray-600">Este paquete no requiere butacas.</div>
                    )}
                  </div>

                  {requiresSeats && seatData && (seatData as any).enabled ? (
                    <div className="mt-3 rounded-2xl border border-[#DCEBF7] bg-[#F8FBFE] px-3 py-2.5 sm:mt-4 sm:px-4 sm:py-3">
                      {effectiveSeatPreview ? (
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[12px] text-[#5E7898] sm:text-[13px]">
                          <span className="font-black tracking-[-0.01em] text-[#072852]">
                            Butaca {effectiveSeatPreview.label}
                          </span>
                          <span className="text-[#B7C6D8]">·</span>
                          <span>
                            Piso {effectiveSeatPreview.floor + 1}, fila {getSeatRowLabel(effectiveSeatPreview.row)},
                            columna {effectiveSeatPreview.col + 1}
                          </span>
                          <span className="text-[#B7C6D8]">·</span>
                          <span className="font-semibold text-[#0A7FA0]">
                            {effectiveSeatPreview.category && isSeatCategoryCode(effectiveSeatPreview.category)
                              ? getSeatCategoryLabel(effectiveSeatPreview.category)
                              : 'Estándar'}
                            {activeSeatCategoryPrice > 0
                              ? ` · ${formatAmountCents(Math.round(activeSeatCategoryPrice * 100), effectiveCurrency)}`
                              : ''}
                          </span>
                        </div>
                      ) : (
                        <div className="text-[12px] text-[#5E7898] sm:text-[13px]">
                          Tocá una butaca para ver su ubicación y precio.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                {error ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-red-700">
                    {error}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-[#E4EEF7] bg-white px-3.5 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.65rem)] sm:px-6 sm:py-3.5">
            <div className="flex flex-row items-center justify-between gap-2 sm:gap-5">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D7E7F6] bg-white text-[#2BB8BF] transition-colors hover:bg-[#F3FAFF] hover:text-[#0D7098] sm:h-10 sm:w-10"
                  onClick={() => setOpen(false)}
                  aria-label="Volver"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Volver</span>
                </button>

                <div className="min-w-0">
                  <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#6A85A6] sm:text-[10px] sm:tracking-[0.12em]">
                    Total a pagar
                  </div>
                  <div className="whitespace-nowrap text-[16px] font-black leading-none tracking-[-0.01em] text-[#0798BA] sm:text-[18px]">
                    {formatAmountCents(pricing.subtotalAmount, effectiveCurrency)}
                  </div>
                </div>
              </div>

              <div className="hidden xl:flex items-center gap-5 text-xs text-[#5E7898]">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Pago seguro
                </div>
                <div className="h-4 w-px bg-gray-200" />
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Reserva inmediata
                </div>
                <div className="h-4 w-px bg-gray-200" />
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Confirmación por email
                </div>
              </div>

              <Button
                type="button"
                onClick={() => void addToCart()}
                disabled={loading || !canSubmit}
                className="h-11 min-w-0 flex-1 shrink-0 gap-1.5 rounded-full bg-[#2BB8BF] px-3 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(43,184,191,0.25)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[#22A9B0] hover:shadow-[0_14px_32px_rgba(43,184,191,0.42)] active:scale-[0.98] disabled:opacity-50 disabled:shadow-none sm:h-12 sm:flex-none sm:gap-2 sm:px-7 sm:text-[15px]"
              >
                {loading ? 'Agregando...' : 'Continuar reserva'}
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatDateLong(value: string) {
  const dt = new Date(`${value}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function getSeatRowLabel(index: number) {
  let current = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);
  return label;
}

function getSeatDisplayColumns(cols: number, aisleCols: number[]) {
  const sorted = [...aisleCols]
    .filter((value) => value > 0 && value < cols)
    .sort((a, b) => a - b);

  const result: Array<{ kind: 'cell'; col: number } | { kind: 'aisle'; key: string }> = [];
  for (let col = 0; col < cols; col += 1) {
    result.push({ kind: 'cell', col });
    if (sorted.includes(col + 1)) {
      result.push({ kind: 'aisle', key: `aisle-${col}` });
    }
  }
  return result;
}

function SeatGridSkeleton({
  template,
  seats,
  hintPassengers,
}: {
  template?: any;
  seats?: any[];
  hintPassengers: number;
}) {
  const floors = Math.max(
    1,
    Number(template?.floors ?? 0) ||
    (Array.isArray(seats) && seats.length ? Math.max(...seats.map((seat: any) => Number(seat?.floor ?? 0))) + 1 : 1)
  );
  const rows = Math.max(4, Number(template?.rows ?? 0) || Math.min(10, Math.max(4, hintPassengers + 2)));
  const cols = Math.max(3, Number(template?.cols ?? 0) || Math.min(6, Math.max(3, hintPassengers + 1)));
  const displayColumns = getSeatDisplayColumns(cols, Array.isArray(template?.aisleCols) ? template.aisleCols : [2]);

  return (
    <div className="rounded-[26px] border border-[#DCEAF8] bg-[linear-gradient(180deg,#FCFEFF_0%,#F4FAFF_100%)] p-4 sm:p-5 animate-pulse">
      {floors > 1 ? (
        <div className="border-b border-[#E4EEF7]">
          <div className="flex gap-6 pb-3">
            {Array.from({ length: floors }, (_, floor) => (
              <div
                key={`skeleton-floor-tab-${floor}`}
                className={cn('h-4 rounded-full', floor === 0 ? 'w-16 bg-[#BFE6EE]' : 'w-14 bg-[#E2EDF8]')}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 text-center">
        <div className="mx-auto h-3 w-36 rounded-full bg-[#D9E8F7]" />
        <div className="mt-2 flex justify-center">
          <div className="h-[18px] w-[240px] rounded-full bg-[#E8F2FB]" />
        </div>
      </div>
      <div className="mt-4 overflow-x-auto pb-1">
        <div className="mx-auto flex w-fit items-start gap-3">
          <div className="pt-[46px]">
            <div className="space-y-2">
              {Array.from({ length: rows }, (_, rowIndex) => (
                <div key={`skeleton-row-label-${rowIndex}`} className="flex h-10 w-6 items-center justify-center">
                  <div className="h-3 w-4 rounded-full bg-[#E2EDF8]" />
                </div>
              ))}
            </div>
          </div>

          <div className="relative rounded-[30px] border border-[#D5E3F0] bg-white p-[10px] shadow-[0_14px_30px_rgba(18,89,150,0.08)]">
            <div className="absolute inset-x-4 top-3 h-10 rounded-full bg-[linear-gradient(180deg,rgba(226,237,248,0.92)_0%,rgba(255,255,255,0.55)_100%)]" />
            <div className="relative rounded-[24px] border border-[#DCE8F4] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FBFF_100%)] px-3 pb-3 pt-4">
              <div className="mx-auto mb-4 h-8 w-[76%] rounded-full border border-[#E1EBF6] bg-[#EDF4FB]" />
              <div className="space-y-2">
                {Array.from({ length: rows }, (_, rowIndex) => (
                  <div
                    key={`skeleton-layout-row-${rowIndex}`}
                    className="grid items-center gap-2"
                    style={{
                      gridTemplateColumns: displayColumns.map((item) => (item.kind === 'aisle' ? '14px' : '40px')).join(' '),
                    }}
                  >
                    {displayColumns.map((item, idx) =>
                      item.kind === 'aisle' ? (
                        <div key={`skeleton-aisle-${rowIndex}-${idx}`} className="flex justify-center">
                          <div className="h-10 w-[8px] rounded-full bg-[#E0EAF4]" />
                        </div>
                      ) : (
                        <div
                          key={`skeleton-seat-${rowIndex}-${item.col}`}
                          className="h-10 w-10 rounded-xl border border-[#E6F0FA] bg-white"
                        />
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
