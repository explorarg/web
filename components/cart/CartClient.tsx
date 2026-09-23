'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { getReservationExtraTotalAmount } from '@/lib/packages/resolve-departure';
import { getSinglePassengerSurchargeSummary, isSinglePassengerSurchargeExtra } from '@/lib/packages/resolve-departure';
import PaqueteCard from '@/components/PaqueteCard';
import SinglePassengerSurchargeBreakdown from '@/components/pricing/SinglePassengerSurchargeBreakdown';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import SeatMap from '@/components/seats/SeatMap';
import {
  Bookmark,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  CreditCard,
  Headphones,
  Loader2,
  Minus,
  Pencil,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Users,
} from 'lucide-react';

type CartApiResponse = {
  cart: any;
  items: any[];
  ok?: boolean;
  invalid?: Array<{ itemId: string; reason: string }>;
};

function toMs(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }
  return 0;
}

function formatCurrency(amount: number, currency: string): string {
  const normalized = (currency || 'ars').toUpperCase();
  const locale = normalized === 'BRL' ? 'pt-BR' : normalized === 'USD' ? 'en-US' : 'es-AR';
  const symbol = normalized === 'USD' ? 'US$' : normalized === 'BRL' ? 'R$' : '$';
  const value = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format((amount || 0) / 100);
  return `${symbol} ${value} ${normalized}`;
}

function formatDateLabel(date: string): string {
  if (!date || date === 'sin-fecha') return 'A coordinar';
  try {
    return new Date(date + 'T12:00:00').toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return date;
  }
}

function getExtraTotalAmount(extra: any, people: number): number {
  return getReservationExtraTotalAmount(extra, people);
}

function CartSkeleton() {
  return (
    <div className="container mx-auto max-w-7xl px-4 py-10 md:px-6 lg:px-8">
      <div className="animate-pulse space-y-6">
        <div className="h-4 w-56 rounded-full bg-[#DCEBFA]" />
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#E4F0FB]" />
            <div className="space-y-3">
              <div className="h-8 w-64 rounded-xl bg-[#DCEBFA]" />
              <div className="h-4 w-96 max-w-[70vw] rounded-full bg-[#E4F0FB]" />
              <div className="h-3 w-44 rounded-full bg-[#E4F0FB]" />
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <div className="h-10 w-44 rounded-2xl bg-[#E4F0FB]" />
            <div className="h-10 w-40 rounded-2xl bg-[#E4F0FB]" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="h-16 rounded-2xl bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]" />
          <div className="h-16 rounded-2xl bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]" />
          <div className="h-16 rounded-2xl bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)]" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-3xl border border-[#DCEAF8] bg-white p-6">
              <div className="h-5 w-40 rounded-full bg-[#DCEBFA]" />
              <div className="mt-4 space-y-3">
                <div className="h-16 rounded-2xl bg-[#F5FAFF]" />
                <div className="h-16 rounded-2xl bg-[#F5FAFF]" />
              </div>
            </div>
            <div className="rounded-3xl border border-[#DCEAF8] bg-white p-6">
              <div className="h-5 w-52 rounded-full bg-[#DCEBFA]" />
              <div className="mt-4 h-28 rounded-2xl bg-[#F5FAFF]" />
            </div>
          </div>
          <div className="rounded-3xl border border-[#DCEAF8] bg-white p-6">
            <div className="h-5 w-44 rounded-full bg-[#DCEBFA]" />
            <div className="mt-4 space-y-3">
              <div className="h-4 w-28 rounded-full bg-[#E4F0FB]" />
              <div className="h-10 rounded-2xl bg-[#E4F0FB]" />
              <div className="h-10 rounded-2xl bg-[#E4F0FB]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CartClient() {
  const router = useRouter();
  const [data, setData] = useState<CartApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allPaquetes, setAllPaquetes] = useState<any[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [editTargetPeople, setEditTargetPeople] = useState<number | null>(null);
  const [editSeatLoading, setEditSeatLoading] = useState(false);
  const [editSeatData, setEditSeatData] = useState<any | null>(null);
  const [editSelectedSeatIds, setEditSelectedSeatIds] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editInitialSeatLabels, setEditInitialSeatLabels] = useState<string[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [termsSaving, setTermsSaving] = useState(false);
  const editSeatAbortRef = useRef<AbortController | null>(null);
  const editSeatSeqRef = useRef(0);
  const [deletingItemIds, setDeletingItemIds] = useState<string[]>([]);
  const [deleteStatus, setDeleteStatus] = useState<{ tone: 'loading' | 'success'; text: string } | null>(null);
  const deleteStatusTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (deleteStatusTimeoutRef.current) {
        window.clearTimeout(deleteStatusTimeoutRef.current);
      }
    };
  }, []);

  const fetchCart = async () => {
    setError(null);
    const res = await fetch('/api/cart', { cache: 'no-store' });
    if (!res.ok) throw new Error('No se pudo cargar el carrito.');
    const json = (await res.json()) as CartApiResponse;
    setData(json);
    setTermsAccepted(Boolean(json?.cart?.termsAccepted));
    if (json?.cart?.termsAccepted) {
      setTermsError(null);
    }
    return json;
  };

  const validateCart = async () => {
    const res = await fetch('/api/cart/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (!res.ok) return;
    const json = (await res.json()) as CartApiResponse;
    setData(json);
  };

  const loadEditSeatState = async (it: any, opts?: { silent?: boolean }) => {
    if (!it?.packageId || !it?.date) return null;
    const nextSeq = editSeatSeqRef.current + 1;
    editSeatSeqRef.current = nextSeq;
    editSeatAbortRef.current?.abort();
    const controller = new AbortController();
    editSeatAbortRef.current = controller;
    setEditSeatLoading(true);
    try {
      const res = await fetch(
        `/api/seats/state?packageId=${encodeURIComponent(String(it.packageId))}&date=${encodeURIComponent(String(it.date))}`,
        { cache: 'no-store', signal: controller.signal }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'No se pudo cargar el mapa de butacas.');
      }
      const json = await res.json();
      if (!json?.enabled) {
        throw new Error('Esta salida no tiene butacas configuradas.');
      }
      if (editSeatSeqRef.current !== nextSeq) return null;
      setEditSeatData(json);
      const holdId = String(it?.holdId ?? '');
      const freshSeats = Array.isArray(json?.seats) ? json.seats : [];
      const freshById = new Map<string, any>();
      for (const seat of freshSeats) freshById.set(String(seat.seatId), seat);
      setEditSelectedSeatIds((prev) => {
        if (!prev.length) return prev;
        return prev.filter((id) => {
          const seat = freshById.get(id);
          if (!seat) return false;
          const status = String(seat.status ?? '');
          if (status === 'available') return true;
          if (status === 'held' && holdId && String(seat.holdId ?? '') === holdId) return true;
          return false;
        });
      });
      return json;
    } catch (e) {
      if (controller.signal.aborted) return null;
      if (!opts?.silent) {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el mapa de butacas.');
      }
      setEditSeatData(null);
      return null;
    } finally {
      if (editSeatSeqRef.current === nextSeq) setEditSeatLoading(false);
    }
  };

  const openEditSeats = async (it: any) => {
    setError(null);
    setEditItem(it);
    setEditSeatData(null);
    setEditSelectedSeatIds([]);
    setEditInitialSeatLabels(Array.isArray(it?.selectedSeats) ? it.selectedSeats.map((s: any) => String(s)) : []);
    setEditOpen(true);
    void loadEditSeatState(it);
  };

  useEffect(() => {
    if (!editOpen) return;
    if (!editSeatData?.template || !Array.isArray(editSeatData?.template?.seats)) return;
    if (!editItem) return;
    const labelToId = new Map<string, string>();
    for (const s of editSeatData.template.seats) {
      if (s?.label && s?.seatId) labelToId.set(String(s.label), String(s.seatId));
    }
    
    // Al cargar, intentar matchear la etiqueta original (ignorando el sufijo de Fila/Col)
    const nextIds = editInitialSeatLabels.map((l) => {
      const raw = String(l).trim();
      const match = raw.match(/^([^(]+)\s\(/);
      const cleanLabel = match ? match[1].trim() : raw;
      return labelToId.get(cleanLabel) || '';
    }).filter(Boolean);
    
    setEditSelectedSeatIds(nextIds);
  }, [editOpen, editSeatData, editItem, editInitialSeatLabels]);

  useEffect(() => {
    if (!editOpen) return;
    if (!editItem?.packageId || !editItem?.date) return;
    const id = window.setInterval(() => {
      void loadEditSeatState(editItem, { silent: true });
    }, 12000);
    return () => window.clearInterval(id);
  }, [editOpen, editItem]);

  const saveEditSeats = async () => {
    if (!editItem?.id) return;
    if (!editSeatData?.enabled || !Array.isArray(editSeatData?.seats)) return;
    const seatLabelById = new Map<string, string>();
    for (const s of editSeatData.seats) {
      if (s?.seatId && s?.label) {
        // Formato con fila y columna
        const rowLetter = getSeatRowLabel(s.row);
        const colNum = s.col + 1;
        seatLabelById.set(String(s.seatId), `${s.label} (Fila ${rowLetter}, Col ${colNum})`);
      }
    }
    const selectedLabels = editSelectedSeatIds.map((id) => seatLabelById.get(id) || id).filter(Boolean);
    const targetPeople = editTargetPeople ?? Number(editItem.people ?? 0);
    if (selectedLabels.length !== targetPeople) {
      setError('Debés seleccionar una butaca por pasajero.');
      return;
    }
    setEditSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/cart/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: editItem.id, people: targetPeople, selectedSeats: selectedLabels }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'No se pudieron actualizar las butacas.');
      }
      await fetchCart();
      await validateCart();
      setEditOpen(false);
      setEditItem(null);
      setEditTargetPeople(null);
      setEditSeatData(null);
      setEditSelectedSeatIds([]);
      setEditInitialSeatLabels([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron actualizar las butacas.');
    } finally {
      setEditSaving(false);
    }
  };

  const fetchRelatedSource = async () => {
    try {
      const res = await fetch('/api/home', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      setAllPaquetes(Array.isArray(json?.paquetes) ? json.paquetes : []);
    } catch (err) {
      // silent
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCart()
      .then((json) => {
        if (!cancelled) {
          void fetchRelatedSource();
          return validateCart();
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error cargando carrito.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void validateCart();
    }, 15000);
    return () => window.clearInterval(id);
  }, []);

  const items = data?.items ?? [];
  const relatedPaquetes = useMemo(() => {
    if (!allPaquetes.length) return [];

    const inCartIds = new Set(items.map((it) => String(it?.packageId ?? '')));
    return allPaquetes
      .filter((p: any) => !inCartIds.has(String(p?.id ?? '')))
      .sort((a: any, b: any) => {
        const featuredDiff = Number(Boolean(b?.featured)) - Number(Boolean(a?.featured));
        if (featuredDiff !== 0) return featuredDiff;
        return String(a?.titulo ?? '').localeCompare(String(b?.titulo ?? ''), 'es');
      })
      .slice(0, 4);
  }, [allPaquetes, items]);

  const expiresAtMs = useMemo(() => {
    return toMs(data?.cart?.expiresAtMs ?? data?.cart?.expiresAt);
  }, [data?.cart?.expiresAtMs, data?.cart?.expiresAt]);

  const remainingMs = Math.max(0, expiresAtMs - now);
  const remainingLabel = useMemo(() => {
    if (!expiresAtMs) return '—';
    const s = Math.floor(remainingMs / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  }, [expiresAtMs, remainingMs]);
  const amountTotal = typeof data?.cart?.amountTotal === 'number'
    ? data?.cart?.amountTotal
    : items.reduce((sum, it) => sum + (typeof it.subtotalAmount === 'number' ? it.subtotalAmount : 0), 0);
  const currency = data?.cart?.currency ?? (items[0]?.currency ?? 'ars');
  const cartStatus = data?.cart?.status ?? 'active';
  const hasInvalid = Boolean(data?.invalid?.length) || items.some((it) => it.isInvalid);
  const canCheckout = cartStatus === 'active' && items.length > 0 && !hasInvalid && remainingMs > 0;
  const cartExtraSummary = useMemo(() => {
    const byLabel = new Map<string, { label: string; amount: number }>();
    let total = 0;
    for (const item of items) {
      const people = Math.max(1, Number(item?.people ?? 0) || 0);
      const extras = Array.isArray(item?.selectedExtras) ? item.selectedExtras : [];
      for (const extra of extras) {
        if (isSinglePassengerSurchargeExtra(extra)) continue;
        const label = String(extra?.label ?? '').trim();
        if (!label) continue;
        const amount = getExtraTotalAmount(extra, people);
        total += amount;
        const current = byLabel.get(label);
        if (current) {
          current.amount += amount;
        } else {
          byLabel.set(label, { label, amount });
        }
      }
    }
    return { total, items: Array.from(byLabel.values()) };
  }, [items]);
  const baseSubtotalAmount = Math.max(0, amountTotal - cartExtraSummary.total);
  const totalPeople = items.reduce((sum, it) => sum + Math.max(0, Number(it?.people ?? 0) || 0), 0);
  const pricePerPersonAmount = totalPeople > 0 ? Math.round(baseSubtotalAmount / totalPeople) : 0;
  const singlePassengerSurcharge = useMemo(
    () =>
      getSinglePassengerSurchargeSummary({
        people: totalPeople,
        baseSubtotalAmount,
        selectedExtras: items.flatMap((item) =>
          (Array.isArray(item?.selectedExtras) ? item.selectedExtras : []).filter((extra: any) =>
            isSinglePassengerSurchargeExtra(extra)
          )
        ),
      }),
    [baseSubtotalAmount, items, totalPeople]
  );

  const removeItem = async (itemId: string) => {
    if (!itemId || deletingItemIds.includes(itemId)) return;
    setError(null);
    if (deleteStatusTimeoutRef.current) {
      window.clearTimeout(deleteStatusTimeoutRef.current);
      deleteStatusTimeoutRef.current = null;
    }
    setDeletingItemIds((prev) => [...prev, itemId]);
    try {
      const res = await fetch('/api/cart/items', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d?.error || 'No se pudo eliminar el item.');
        return;
      }
      const refreshed = await fetchCart();
      await validateCart();
      if ((refreshed?.items?.length ?? 0) > 0) {
        setDeleteStatus({ tone: 'success', text: 'Item eliminado correctamente.' });
        deleteStatusTimeoutRef.current = window.setTimeout(() => {
          setDeleteStatus(null);
          deleteStatusTimeoutRef.current = null;
        }, 2500);
      } else {
        setDeleteStatus(null);
      }
    } finally {
      setDeletingItemIds((prev) => prev.filter((currentId) => currentId !== itemId));
    }
  };

  const resetCart = async () => {
    setError(null);
    const res = await fetch('/api/cart', { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || 'No se pudo reiniciar el carrito.');
      return;
    }
    setData(null);
    setLoading(true);
    try {
      await fetchCart();
      await validateCart();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando carrito.');
    } finally {
      setLoading(false);
    }
  };

  const updatePeople = async (it: any, nextPeople: number) => {
    if (!it?.id) return;
    setError(null);
    const res = await fetch('/api/cart/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: it.id, people: nextPeople }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || 'No se pudo actualizar la cantidad.');
      return;
    }
    await fetchCart();
    await validateCart();
  };

  const updatePeopleWithSeats = async (it: any, nextPeople: number, nextSeats: string[]) => {
    if (!it?.id) return;
    setError(null);
    const res = await fetch('/api/cart/items', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: it.id, people: nextPeople, selectedSeats: nextSeats }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || 'No se pudo actualizar el item.');
      return;
    }
    await fetchCart();
    await validateCart();
  };

  const duplicateItem = async (it: any) => {
    if (!it?.packageId) return;
    setError(null);
    const res = await fetch('/api/cart/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        packageId: it.packageId,
        slug: it.packageSlug,
        date: it.date || 'sin-fecha',
        people: Number(it.people ?? 1),
        peopleAdults: typeof it.peopleAdults === 'number' ? Number(it.peopleAdults) : undefined,
        peopleMinors: typeof it.peopleMinors === 'number' ? Number(it.peopleMinors) : undefined,
        pickupPoint: it.pickupPoint || undefined,
        pickupPointTime: it.pickupPointTime || undefined,
        roomType: it.roomType || undefined,
        selectedSeats: Array.isArray(it.selectedSeats) ? it.selectedSeats : undefined,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d?.error || 'No se pudo duplicar el item.');
      return;
    }
    await fetchCart();
    await validateCart();
  };

  const persistTermsAcceptance = async (accepted: boolean) => {
    setTermsSaving(true);
    try {
      const response = await fetch('/api/cart/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'No se pudo guardar la aceptación de términos.');
      }
      setTermsAccepted(accepted);
      if (accepted) setTermsError(null);
    } catch (e) {
      setTermsError(e instanceof Error ? e.message : 'No se pudo guardar la aceptación de términos.');
    } finally {
      setTermsSaving(false);
    }
  };

  const handleCheckoutClick = async () => {
    if (!termsAccepted) {
      setTermsError('Debés aceptar los términos y condiciones para continuar con la compra.');
      return;
    }
    router.push('/checkout?cart=1');
  };

  if (loading) {
    return <CartSkeleton />;
  }

  return (
    <div className="container mx-auto pt-[7rem] md:pt-[8rem] lg:pt-[8rem] px-4 py-6 sm:px-5 md:px-6 lg:px-8 lg:py-8">
      <div className="text-sm text-gray-500">
        <Link href="/" className="hover:text-[#2BB8BF]">Inicio</Link>
        <span className="mx-2">›</span>
        <span className="text-gray-700">Carrito de compras</span>
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAF6FF]">
            <ShoppingCart className="h-5 w-5 text-[#2BB8BF]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 md:text-3xl">Tu carrito</h1>
            <div className="mt-1 flex flex-col gap-1">
              {items.length > 0 ? (
                <>
                  {remainingMs > 0 && cartStatus !== 'expired' ? (
                    <p className="text-xs text-gray-500">
                      Tiempo restante: <span className="font-semibold text-gray-700">{remainingLabel}</span>
                    </p>
                  ) : (
                    <p className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Tiempo de reserva excedido
                    </p>
                  )}
                  {cartStatus !== 'active' && cartStatus !== 'expired' && remainingMs > 0 && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#2BB8BF]">
                      Estado: {cartStatus === 'checkout_started' ? 'Pago en proceso' : cartStatus}
                    </p>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
        {/* <div className="hidden md:flex items-center gap-2">
          <Button asChild variant="outline" className="rounded-2xl">
            <Link href="/paquetes">Seguir explorando</Link>
          </Button>
          <Button variant="outline" className="rounded-2xl" onClick={() => void resetCart()}>
            Reiniciar carrito
          </Button>
        </div> */}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FeaturePill icon={ShieldCheck} title="Reservas flexibles" subtitle="Cambios sin cargo hasta 30 días antes" />
        <FeaturePill icon={CreditCard} title="Paga en cuotas sin interés" subtitle="Con tarjetas seleccionadas" />
        <FeaturePill icon={Headphones} title="Atención 24/7" subtitle="Estamos con vos siempre" />
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {deleteStatus ? (
        <div
          className={cn(
            'mt-4 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm',
            'border border-emerald-200 bg-emerald-50 text-emerald-700'
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-semibold">{deleteStatus.text}</span>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {items.length === 0 ? (
            <div className="rounded-3xl border border-[#E4EDF6] bg-white p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F5FAFF] text-[#2BB8BF]">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <div className="mt-4 text-[19px] font-bold tracking-[-0.02em] text-[#112B49]">
                Tu carrito está vacío
              </div>
              <div className="mt-2 text-sm leading-relaxed text-[#8A98A8]">
                Agregá un paquete para continuar con tu reserva.
              </div>
              <Button
                asChild
                className="group mt-6 h-12 gap-2 rounded-full bg-[#2BB8BF] px-7 text-[15px] font-semibold text-white shadow-[0_10px_26px_rgba(43,184,191,0.32)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[#22A9B0] hover:shadow-[0_14px_32px_rgba(43,184,191,0.42)] active:scale-[0.98]"
              >
                <Link href="/paquetes">
                  Ver paquetes
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </div>
          ) : (
            items.map((it) => {
              const isDeleting = deletingItemIds.includes(String(it.id));
              const people = Number(it.people ?? 0) || 1;
              const img = String(it.packageImage || '') || '/images/placeholder-package.jpg';
              const destination = String(it.packageDestination || '') || '—';
              const duration = String(it.packageDuration || '') || '—';
              const unit = typeof it.unitAmount === 'number' ? it.unitAmount : 0;
              const adults = typeof it.peopleAdults === 'number' ? Math.max(0, Number(it.peopleAdults) || 0) : null;
              const minors = typeof it.peopleMinors === 'number' ? Math.max(0, Number(it.peopleMinors) || 0) : null;
              const unitAdults = typeof it.unitAmountAdults === 'number' ? Math.max(0, Number(it.unitAmountAdults) || 0) : unit;
              const unitMinors = typeof it.unitAmountMinors === 'number' ? Math.max(0, Number(it.unitAmountMinors) || 0) : unit;
              const showSplitPricing = Boolean(minors && minors > 0 && unitMinors !== unitAdults);
              const seats = Array.isArray(it.selectedSeats) ? it.selectedSeats.map((s: any) => String(s)) : [];
              const hasSeats = seats.length > 0;
              const extras = Array.isArray(it.selectedExtras)
                ? it.selectedExtras.filter((extra: any) => String(extra?.label ?? '').trim().length > 0)
                : [];
              const extraDetails = extras.map((extra: any) => ({
                ...extra,
                totalAmount: getExtraTotalAmount(extra, people),
              }));
              
              // El item es inválido si el backend lo dice O si el tiempo del carrito expiró
              const itemIsInvalid = it.isInvalid || remainingMs === 0;

              return (
                <div
                  key={it.id}
                  className={cn(
                    "relative overflow-hidden rounded-3xl border bg-white shadow-sm transition-all",
                    itemIsInvalid ? "border-red-100 bg-red-50/20" : "border-gray-200"
                  )}
                >
                  {isDeleting ? (
                    <div className="absolute inset-0 z-20 flex flex-col justify-between bg-white/92 px-5 py-5 backdrop-blur-[2px]">
                      <div className="space-y-3 animate-pulse">
                        <div className="h-5 w-40 rounded-full bg-[#DCEBFA]" />
                        <div className="h-4 w-56 rounded-full bg-[#E8F2FB]" />
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr]">
                          <div className="h-[140px] rounded-2xl bg-[#E8F2FB]" />
                          <div className="space-y-3">
                            <div className="h-4 w-3/4 rounded-full bg-[#DCEBFA]" />
                            <div className="h-4 w-1/2 rounded-full bg-[#E8F2FB]" />
                            <div className="h-4 w-2/3 rounded-full bg-[#E8F2FB]" />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-2xl border border-[#BFE7EA] bg-[#F2FCFD] px-4 py-3 text-sm text-[#0F6E74]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="font-semibold">Eliminando item del carrito...</span>
                      </div>
                    </div>
                  ) : null}
                  <div className="p-4 sm:p-5">
                    <div className={cn("flex flex-col gap-4 lg:flex-row lg:gap-5", itemIsInvalid && "opacity-40 grayscale pointer-events-none select-none")}>
                      <div className="relative h-[200px] w-full shrink-0 overflow-hidden rounded-2xl bg-gray-100 sm:h-[220px] lg:h-[140px] lg:w-[220px]">
                        <Image src={img} alt={String(it.packageTitle || 'Paquete')} fill className="object-cover" />
                        {it.packageIsFeatured ? (
                          <div className="absolute left-3 bottom-3 rounded-full bg-black/55 px-3 py-1 text-xs font-semibold text-white">
                            Más elegido
                          </div>
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0">
                            <div className="text-base font-extrabold text-gray-900 sm:text-lg break-words">{it.packageTitle}</div>
                            <div className="mt-1 text-sm text-gray-600">{destination}</div>

                            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-700">
                              <span className="inline-flex items-center gap-2 rounded-full bg-[#EAF6FF] px-3 py-1">
                                <Calendar className="h-4 w-4 text-[#2BB8BF]" />
                                <span className="font-semibold capitalize">{formatDateLabel(String(it.date || 'sin-fecha'))}</span>
                              </span>
                              <span className="inline-flex items-center gap-2 rounded-full bg-[#EAF6FF] px-3 py-1">
                                <Clock className="h-4 w-4 text-[#2BB8BF]" />
                                <span className="font-semibold">{duration}</span>
                              </span>
                              <span className="inline-flex items-center gap-2 rounded-full bg-[#EAF6FF] px-3 py-1">
                                <Users className="h-4 w-4 text-[#2BB8BF]" />
                                <span className="font-semibold">
                                  {people} {people === 1 ? 'pasajero' : 'pasajeros'}
                                  {minors !== null ? ` · ${minors} menores` : ''}
                                </span>
                              </span>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                                Salida confirmada
                              </span>
                              {remainingMs > 0 && remainingMs < 8 * 60 * 1000 ? (
                                <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                                  Quedan pocos lugares
                                </span>
                              ) : null}
                            </div>

                            {hasSeats ? (
                              <div className="mt-1 text-xs text-gray-500">
                                Butacas:{' '}
                                <span className="font-semibold text-gray-900">
                                  {seats
                                    .map((s: string) => {
                                      const match = s.match(/^([^(]+)\s\(Fila\s([^,]+),\sCol\s([^)]+)\)/);
                                      return match ? `${match[2]}${match[1]}` : s;
                                    })
                                    .join(', ')}
                                </span>
                              </div>
                            ) : null}
                            <div className="mt-1 text-xs text-gray-500">
                              Ascenso: <span className="font-semibold text-gray-900">{it.pickupPoint || 'Sin definir'}</span>
                              {it.pickupPointTime ? ` · ${it.pickupPointTime}` : ''}
                            </div>
                            
                          </div>

                          <div className="w-full shrink-0 xl:w-[260px]">
                            <div className="rounded-2xl border border-gray-200 bg-white p-4">
                              <div className="flex items-center justify-between">
                                <div className="text-xs text-gray-500">Pasajeros</div>
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="h-9 w-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center disabled:opacity-50"
                                    disabled={cartStatus !== 'active' || itemIsInvalid || people <= 1 || isDeleting}
                                    onClick={() => {
                                      const nextPeople = Math.max(1, people - 1);
                                      if (hasSeats) {
                                        void updatePeopleWithSeats(it, nextPeople, seats.slice(0, nextPeople));
                                      } else {
                                        void updatePeople(it, nextPeople);
                                      }
                                    }}
                                    aria-label="Menos"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </button>
                                  <div className="w-10 text-center text-sm font-extrabold text-gray-900">{people}</div>
                                  <button
                                    type="button"
                                    className="h-9 w-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center disabled:opacity-50"
                                    disabled={cartStatus !== 'active' || itemIsInvalid || people >= 50 || isDeleting}
                                    onClick={() => {
                                      const nextPeople = Math.min(50, people + 1);
                                      if (hasSeats) {
                                        setEditTargetPeople(nextPeople);
                                        void openEditSeats(it);
                                      } else {
                                        void updatePeople(it, nextPeople);
                                      }
                                    }}
                                    aria-label="Más"
                                  >
                                    <span className="text-xl leading-none">+</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {itemIsInvalid ? (
                      <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-red-50 p-4 border border-red-100">
                        <div className="flex items-center gap-3 text-red-700">
                          <Clock className="h-5 w-5" />
                          <span className="text-sm font-bold">Tiempo de reserva excedido, volvé a seleccionar este paquete.</span>
                        </div>
                        <button
                          type="button"
                          className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700 transition-colors disabled:cursor-wait disabled:opacity-70"
                          disabled={isDeleting}
                          onClick={() => void removeItem(it.id)}
                        >
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          {isDeleting ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
                            onClick={() => {
                              setEditTargetPeople(null);
                              if (hasSeats) void openEditSeats(it);
                            }}
                            disabled={!hasSeats || isDeleting}
                          >
                            <Pencil className="h-4 w-4" />
                            Editar detalles
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 text-red-600 hover:text-red-700 disabled:cursor-wait disabled:opacity-60"
                            disabled={isDeleting}
                            onClick={() => void removeItem(it.id)}
                          >
                            {isDeleting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            {isDeleting ? 'Eliminando...' : 'Eliminar'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-5">
              <div className="text-base font-semibold text-gray-900">Resumen de pago</div>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                {/* <div className="flex items-center justify-between">
                  <span>Precio por persona</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(pricePerPersonAmount, currency)}</span>
                </div> */}
                <div className="flex items-center justify-between">
                  <span>Subtotal ({totalPeople} pasajeros)</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(baseSubtotalAmount, currency)}</span>
                </div>
                {cartExtraSummary.items.map((extra) => (
                  <div key={extra.label} className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words">{extra.label}</span>
                    <span className="shrink-0 font-semibold text-gray-900">{formatCurrency(extra.amount, currency)}</span>
                  </div>
                ))}
                {singlePassengerSurcharge.applies ? (
                  <SinglePassengerSurchargeBreakdown
                    label={singlePassengerSurcharge.label}
                    amountLabel={formatCurrency(singlePassengerSurcharge.amount, currency)}
                  />
                ) : null}
                <div className="h-px bg-gray-200" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">Total a pagar</span>
                  <span className="text-lg font-extrabold text-[#2BB8BF]">{formatCurrency(amountTotal, currency)}</span>
                </div>
                <div className="text-xs text-gray-500">Podés pagar en cuotas sin interés</div>
              </div>

              <div className="mt-5 space-y-2">
                <div className="rounded-2xl border border-[#DCEAF8] bg-[#F8FCFF] p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="cart-terms-checkbox"
                      checked={termsAccepted}
                      disabled={termsSaving}
                      aria-required="true"
                      aria-invalid={termsError ? true : undefined}
                      aria-describedby={termsError ? 'cart-terms-error' : 'cart-terms-help'}
                      onCheckedChange={(checked) => {
                        const nextAccepted = checked === true;
                        void persistTermsAcceptance(nextAccepted);
                      }}
                      className="mt-0.5 h-5 w-5"
                    />
                    <div className="min-w-0">
                      <label
                        htmlFor="cart-terms-checkbox"
                        className="text-sm font-semibold leading-5 text-gray-900"
                      >
                        Acepto los{' '}
                        <Link
                          href="/terminos-condiciones"
                          className="text-[#14838A] underline underline-offset-2 hover:text-[#0F6E74]"
                        >
                          términos y condiciones
                        </Link>
                      </label>
                      <p id="cart-terms-help" className="mt-1 text-xs text-gray-600">
                        Es obligatorio aceptarlos antes de continuar al checkout.
                      </p>
                      {termsError ? (
                        <p id="cart-terms-error" className="mt-2 text-xs font-semibold text-red-600" role="alert">
                          {termsError}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
                <Button
                  className="group h-12 w-full gap-2 rounded-full bg-[#2BB8BF] text-[15px] font-semibold text-white shadow-[0_10px_26px_rgba(43,184,191,0.32)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[#22A9B0] hover:shadow-[0_14px_32px_rgba(43,184,191,0.42)] active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
                  disabled={!canCheckout || !termsAccepted || termsSaving}
                  onClick={() => void handleCheckoutClick()}
                >
                  Ir a pagar
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-12 w-full rounded-full border-[#D7E8F7] text-[15px] font-semibold text-[#112B49] transition-colors hover:border-[#2BB8BF] hover:bg-[#F4FCFC] hover:text-[#187AA6]"
                >
                  <Link href="/paquetes">Seguir explorando</Link>
                </Button>
              </div>

              <div className="mt-5 rounded-2xl border-0 bg-gradient-to-br from-emerald-50 to-white p-5 text-sm text-gray-700 shadow-sm ring-1 ring-emerald-100">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-emerald-200">
                    <ShieldCheck className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-gray-900">Compra 100% segura</div>
                    <div className="text-[11px] font-medium text-emerald-700">Tus datos están protegidos por SSL</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <img src="/images/mercado-pago-logo.png" alt="Mercado Pago" className="h-4" />
                  <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Visa_Inc._logo_%282021%E2%80%93present%29.svg/3840px-Visa_Inc._logo_%282021%E2%80%93present%29.svg.png" alt="Visa" className="h-2.5 opacity-80 grayscale hover:grayscale-0 transition-all" />
                  <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-4 opacity-80 grayscale hover:grayscale-0 transition-all" />
                </div>
              </div>

              <div className="mt-4 rounded-2xl border-0 bg-gradient-to-br from-blue-50 to-white p-5 text-sm text-gray-700 shadow-sm ring-1 ring-blue-100">
                <div className="font-bold text-gray-900 flex items-center gap-2">
                  <Headphones className="h-4 w-4 text-blue-600" />
                  ¿Necesitás ayuda?
                </div>
                <div className="mt-1 text-[11px] font-medium text-blue-700">Nuestro equipo está para acompañarte.</div>
                <div className="mt-4 space-y-2.5">
                  <a href="https://wa.me/541122533111" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between group">
                    <span className="text-xs font-bold text-gray-600 group-hover:text-emerald-600 transition-colors">WhatsApp</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700 uppercase tracking-wider">Disponible</span>
                  </a>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-600">Email</span>
                    <span className="text-[10px] font-bold text-blue-400">Responderemos pronto</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {relatedPaquetes.length > 0 ? (
        <>
          {/* <div className="mt-8 rounded-3xl border border-gray-200 bg-white shadow-sm p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-base font-semibold text-gray-900">Mejorá tu experiencia</div>
                <div className="text-sm text-gray-600">Agregá extras y viajá con total tranquilidad.</div>
              </div>
              <Link href="/paquetes" className="text-sm font-semibold text-[#2BB8BF] hover:underline">
                Ver todos los extras →
              </Link>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-4">
              {[
                { title: 'Seguro de viaje', price: '$ 14.000', subtitle: 'Cobertura médica y asistencia 24/7' },
                { title: 'Traslado aeropuerto', price: '$ 18.000', subtitle: 'Ida y vuelta asegurado' },
                { title: 'Excursión adicional', price: '$ 45.000', subtitle: 'Sumá una experiencia extra' },
                { title: 'Asientos preferenciales', price: '$ 9.000', subtitle: 'Elegí tu asiento preferido' },
              ].map((x) => (
                <div key={x.title} className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-sm font-semibold text-gray-900">{x.title}</div>
                  <div className="mt-1 text-xs text-gray-500">{x.subtitle}</div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-sm font-extrabold text-gray-900">{x.price}</div>
                    <Button type="button" variant="outline" className="h-9 rounded-2xl" disabled>
                      Agregar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div> */}

          <div className="mt-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-base font-semibold text-gray-900">También te puede interesar</div>
                <div className="text-sm text-gray-600">Sumá más destinos a tu aventura.</div>
              </div>
              <Link href="/paquetes" className="text-sm font-semibold text-[#2BB8BF] hover:underline">
                Ver más destinos →
              </Link>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {relatedPaquetes.map((p, idx) => (
                <PaqueteCard 
                  key={p.id} 
                  paquete={p} 
                  index={idx} 
                  disableAnimation={true}
                  fullWidth
                />
              ))}
            </div>
          </div>
        </>
      ) : null}

      <div className="mt-10 rounded-3xl bg-[#0B9FB3] px-4 py-5 text-white sm:px-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {[
            { title: 'Paga en cuotas sin interés', subtitle: 'Con tarjetas seleccionadas', icon: CreditCard },
            { title: 'Mejor precio garantizado', subtitle: 'Si encontrás uno mejor, te igualamos', icon: ShieldCheck },
            { title: 'Asistencia 24/7', subtitle: 'Estamos con vos siempre', icon: Headphones },
            { title: 'Viajes responsables', subtitle: 'Turismo sostenible', icon: Users },
          ].map((x) => {
            const Icon = x.icon;
            return (
              <div key={x.title} className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white/15 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-snug">{x.title}</div>
                  <div className="text-xs text-white/80 leading-snug">{x.subtitle}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) {
            setEditItem(null);
            setEditTargetPeople(null);
            setEditSeatData(null);
            setEditSelectedSeatIds([]);
            setEditInitialSeatLabels([]);
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl md:w-full md:max-w-5xl">
          <div className="flex max-h-[85vh] flex-col">
            <div className="border-b border-gray-200 px-6 py-4">
              <DialogHeader className="gap-1">
                <DialogTitle>Modificar butacas</DialogTitle>
                <div className="text-sm text-gray-500">
                  Elegidas: <span className="font-semibold text-gray-900">{editSelectedSeatIds.length}</span> /{' '}
                  {editTargetPeople ?? Number(editItem?.people ?? 0)}
                </div>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {editSeatLoading ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
                    Cargando mapa…
                  </div>
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 w-40 rounded bg-gray-200" />
                    <div className="h-[320px] w-full rounded-3xl bg-gray-100" />
                    <div className="h-4 w-56 rounded bg-gray-200" />
                  </div>
                </div>
              ) : editSeatData?.enabled ? (
                <SeatMap
                  template={editSeatData.template}
                  seats={editSeatData.seats}
                  selectedSeatIds={editSelectedSeatIds}
                  maxSelectable={editTargetPeople ?? Number(editItem?.people ?? 0)}
                  onChangeSelected={setEditSelectedSeatIds}
                />
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                  No hay mapa de butacas disponible.
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 bg-white px-6 py-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => void saveEditSeats()}
                  disabled={editSaving || editSelectedSeatIds.length !== (editTargetPeople ?? Number(editItem?.people ?? 0))}
                >
                  {editSaving ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
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

function FeaturePill({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: any;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 flex items-start gap-3">
      <div className="h-10 w-10 rounded-2xl bg-[#EAF6FF] flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-[#2BB8BF]" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">{subtitle}</div>
      </div>
    </div>
  );
}
