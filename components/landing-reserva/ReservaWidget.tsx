'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Button } from '@/components/ui/button';
import type { Experience, BookingPublicData, BookingCurrency } from './types';
import { fadeDown, fadeLeft, fadeRight, fadeUp, staggerFast } from './animations';

function formatReservationPrice(amount: number, currency: BookingCurrency): string {
  const c = (currency || 'ars').toLowerCase();
  if (c === 'ars') return `$ ${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
  if (c === 'brl') return `R$ ${amount.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
  if (c === 'usd') return `USD ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return amount.toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

type ReservaWidgetProps = {
  experienceId: Experience['id'];
  experienceSlug: string;
  /** Si se pasa, el widget usa estos datos (fechas, cupos, máx personas, textos). Si no, fallback a props individuales. */
  bookingData?: BookingPublicData | null;
  maxPeople?: number;
  selectedDate: Date | null;
  onDateChange: (date: Date) => void;
  people: number;
  onPeopleChange: (value: number) => void;
  calendarIntro?: string;
  reservationMicrocopy?: string;
};

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const formatDateIso = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export default function ReservaWidget({
  experienceId,
  experienceSlug,
  bookingData,
  maxPeople = 10,
  selectedDate,
  onDateChange,
  people,
  onPeopleChange,
  calendarIntro,
  reservationMicrocopy,
}: ReservaWidgetProps) {
  const router = useRouter();
  const sectionRef = useRef<HTMLElement | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const leftY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const rightY = useTransform(scrollYProgress, [0, 1], [-30, 30]);

  const effectiveMaxPeople = bookingData?.maxPeoplePerBooking ?? maxPeople ?? 50;
  const hasMaxLimit = bookingData?.maxPeoplePerBooking != null || maxPeople != null;
  const effectiveCalendarIntro = bookingData?.subtitle1 ?? calendarIntro ?? 'Elegí tu fecha y reservá en segundos.';
  const effectiveReservationMicrocopy = bookingData?.subtitle2 ?? reservationMicrocopy ?? 'Pago seguro. Te acompañamos en todo el proceso.';
  const blockTitle = (bookingData?.title?.trim() || 'Reserva').trim() || 'Reserva';
  const hasSpecificDates = bookingData?.hasSpecificDates ?? true;
  const depositAmount = typeof bookingData?.depositAmount === 'number' ? bookingData.depositAmount : 0;
  const currency = bookingData?.currency ?? 'ars';
  const totalPrice = depositAmount * people;
  const bookingDates = bookingData?.dates;

  const availableDatesMap = useMemo(() => {
    if (!hasSpecificDates || !bookingDates?.length) return null;
    const map = new Map<string, number>();
    for (const d of bookingDates) {
      if (d.enabled && d.available > 0) map.set(d.date, d.available);
    }
    return map;
  }, [hasSpecificDates, bookingDates]);

  const isDateSelectable = (day: Date) => {
    if (!hasSpecificDates) return false;
    const iso = formatDateIso(day);
    return availableDatesMap?.has(iso) ?? false;
  };

  const { monthLabel, days } = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const startOffset = (monthStart.getDay() + 6) % 7;
    const totalSlots = startOffset + monthEnd.getDate();

    const monthLabel = currentMonth.toLocaleDateString('es-AR', {
      month: 'long',
      year: 'numeric',
    });

    const days = Array.from({ length: totalSlots }, (_, index) => {
      const dayNumber = index - startOffset + 1;
      if (dayNumber <= 0) return null;
      return new Date(year, month, dayNumber);
    });

    return { monthLabel, days };
  }, [currentMonth]);

  const handleCheckout = () => {
    if (hasSpecificDates && !selectedDate) {
      setError('Seleccioná una fecha para continuar.');
      return;
    }
    setError(null);

    const proceed = async () => {
      if (hasSpecificDates && selectedDate) {
        const iso = formatDateIso(selectedDate);
        try {
          const res = await fetch(`/api/experiencias/${encodeURIComponent(experienceSlug)}/availability?date=${encodeURIComponent(iso)}&people=${encodeURIComponent(String(people))}`);
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setError(data?.error || 'Error verificando disponibilidad.');
            return;
          }
          const data = await res.json();
          if (!data.ok) {
            setError(`No hay cupo suficiente para esa fecha. Disponible: ${data.available ?? 0}.`);
            return;
          }
        } catch (err) {
          setError('No se pudo verificar disponibilidad. Intentá de nuevo.');
          return;
        }
      }

      const params = new URLSearchParams({
        slug: experienceSlug,
        people: String(people),
      });
      if (hasSpecificDates && selectedDate) {
        params.set('date', formatDateIso(selectedDate));
      } else {
        params.set('date', 'sin-fecha');
      }
      try {
        const url = new URL(window.location.href);
        const ref = url.searchParams.get('ref') || url.searchParams.get('referral') || url.searchParams.get('code');
        if (ref && ref.trim()) params.set('ref', ref.trim());
      } catch {
        // ignore
      }
      router.push(`/checkout?${params.toString()}`);
    };

    void proceed();
  };

  const dateLabel = selectedDate ? formatDateLabel(selectedDate) : (hasSpecificDates ? 'Elegí una fecha' : 'Sin fechas específicas');
  const canCheckout = hasSpecificDates ? !!selectedDate && isDateSelectable(selectedDate) : true;

  const handleAddToCart = async () => {
    if (hasSpecificDates && !selectedDate) {
      setError('Seleccioná una fecha para continuar.');
      return;
    }
    if (hasSpecificDates && selectedDate && !isDateSelectable(selectedDate)) {
      setError('Seleccioná una fecha habilitada con cupos para continuar.');
      return;
    }
    setError(null);
    setIsAddingToCart(true);
    try {
      const payload: any = {
        slug: experienceSlug,
        people,
        date: hasSpecificDates && selectedDate ? formatDateIso(selectedDate) : 'sin-fecha',
      };
      try {
        const url = new URL(window.location.href);
        const ref = url.searchParams.get('ref') || url.searchParams.get('referral') || url.searchParams.get('code');
        if (ref && ref.trim()) payload.referralCode = ref.trim();
      } catch {
        // ignore
      }
      const res = await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'No se pudo agregar al carrito.');
      }
      router.push('/carrito');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar al carrito.');
    } finally {
      setIsAddingToCart(false);
    }
  };

  return (
    <section
      ref={sectionRef}
      id="reserva"
      className="relative scroll-mt-24 overflow-hidden bg-cream"
    >
      <motion.div
        className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-120px' }}
        variants={staggerFast}
      >
        <motion.div className="sherpa-title-chip mb-8 inline-flex items-center gap-2 px-4 py-2 text-black md:sticky md:top-6 z-10" variants={fadeDown}>
          <span className="h-2 w-2 rounded-full bg-success" />
          <span className="text-base font-semibold text-black">{blockTitle}</span>
          <span className="h-px w-6 bg-primary/50" />
        </motion.div>
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.div
            className="sherpa-card p-6"
            variants={fadeLeft}
            style={{ y: leftY }}
          >
            <motion.div className="flex items-center justify-between" variants={fadeDown}>
              <div>
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  Paso 1
                </span>
                <h3 className="mt-2 text-xl font-semibold text-black">Elegí tu fecha</h3>
              </div>
              <div className="flex items-center gap-2">
                <motion.button
                  type="button"
                  onClick={() =>
                    setCurrentMonth(
                      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
                    )
                  }
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-black/70 hover:bg-gray-100"
                  whileHover={{ y: -1, scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  ←
                </motion.button>
                <motion.button
                  type="button"
                  onClick={() =>
                    setCurrentMonth(
                      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
                    )
                  }
                  className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-black/70 hover:bg-gray-100"
                  whileHover={{ y: -1, scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  →
                </motion.button>
              </div>
            </motion.div>
            <motion.p className="mt-2 text-sm text-black/60" variants={fadeUp}>
              {effectiveCalendarIntro}
            </motion.p>
            {selectedDate && hasSpecificDates && (
              <motion.p className="mt-2 text-sm font-semibold text-success-strong" variants={fadeUp}>
                Fecha elegida: {dateLabel}
              </motion.p>
            )}
            {!hasSpecificDates && (
              <motion.p className="mt-2 text-sm font-semibold text-black/70" variants={fadeUp}>
                Sin fechas específicas — coordinamos la fecha después.
              </motion.p>
            )}

            {hasSpecificDates ? (
              <>
                <motion.p className="mt-3 text-sm font-semibold text-black/70 capitalize" variants={fadeUp}>
                  {monthLabel}
                </motion.p>
                <motion.div
                  className="mt-4 grid grid-cols-7 gap-2 text-center text-xs text-black/50"
                  variants={fadeUp}
                >
                  {WEEK_DAYS.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </motion.div>
                <motion.div className="mt-2 grid grid-cols-7 gap-2" variants={fadeUp}>
                  {days.map((day, index) => {
                    if (!day) {
                      return <div key={`empty-${index}`} />;
                    }
                    const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
                    const selectable = isDateSelectable(day);
                    const iso = formatDateIso(day);
                    const dateInfo = bookingData?.dates?.find((dd) => dd.date === iso);
                    const availableForDay = typeof dateInfo?.available === 'number' ? dateInfo.available : undefined;

                    return (
                      <motion.button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => selectable && onDateChange(day)}
                        disabled={!selectable}
                        className={`h-10 rounded-lg text-sm font-semibold transition ${
                          !selectable
                            ? 'bg-gray-100 text-black/40 cursor-not-allowed'
                            : isSelected
                              ? 'bg-success text-white shadow-sm'
                              : 'bg-[#6DE6B3]/30 text-gray-900 hover:bg-[#6DE6B3]/50 hover:shadow-sm border border-[#6DE6B3]/50'
                        }`}
                        whileHover={selectable ? { y: -1, scale: 1.04 } : undefined}
                        whileTap={selectable ? { scale: 0.97 } : undefined}
                        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                      >
                        <div className="flex flex-col items-center">
                          <span>{day.getDate()}</span>
                          {typeof availableForDay === 'number' ? (
                            <span
                              className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                availableForDay <= 2 ? 'bg-red-100 text-red-700' : availableForDay <= 5 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {availableForDay > 0 ? `${availableForDay} cupo${availableForDay > 1 ? 's' : ''}` : 'Agotado'}
                            </span>
                          ) : null}
                        </div>
                      </motion.button>
                    );
                  })}
                </motion.div>
              </>
            ) : null}
          </motion.div>

          <motion.div
            className="sherpa-card flex flex-col items-center justify-between gap-6 p-6 text-center"
            variants={fadeRight}
            style={{ y: rightY }}
          >
            <motion.div className="w-full flex flex-col items-center text-center" variants={staggerFast}>
              <span className="inline-flex items-center rounded-full bg-secondary/15 px-2 py-0.5 text-xs font-semibold text-success-strong">
                Paso 2
              </span>
              <h3 className="mt-2 text-xl font-semibold text-black">Tu reserva</h3>
              <motion.div className="mt-8 flex w-full flex-col items-center space-y-4 text-center sm:mt-[60px]" variants={staggerFast}>
                <motion.div variants={fadeUp}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
                    Fecha seleccionada
                  </p>
                  <p className="mt-1 text-base font-semibold text-black">
                    {dateLabel}
                  </p>
                </motion.div>

                <motion.div variants={fadeUp}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
                    Personas
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-3">
                    <motion.button
                      type="button"
                      onClick={() => onPeopleChange(Math.max(1, people - 1))}
                      className="h-9 w-9 rounded-full border border-gray-200 text-lg text-primary hover:bg-gray-100"
                      whileHover={{ y: -1, scale: 1.06 }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                    >
                      -
                    </motion.button>
                    <span className="text-lg font-semibold text-black">{people}</span>
                    <motion.button
                      type="button"
                        onClick={() => {
                          const iso = selectedDate ? formatDateIso(selectedDate) : null;
                          const dateInfo = iso ? bookingData?.dates?.find((dd) => dd.date === iso) : null;
                          const availableForSelected = typeof dateInfo?.available === 'number' ? dateInfo.available : undefined;
                          const maxAllowed = Math.min(effectiveMaxPeople, availableForSelected ?? effectiveMaxPeople);
                          onPeopleChange(Math.min(maxAllowed, people + 1));
                        }}
                      className="h-9 w-9 rounded-full border border-gray-200 text-lg text-primary hover:bg-gray-100"
                      whileHover={{ y: -1, scale: 1.06 }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                    >
                      +
                    </motion.button>
                  </div>
                  {selectedDate && bookingData?.dates && (() => {
                    const iso = selectedDate ? formatDateIso(selectedDate) : null;
                    const dateInfo = iso ? bookingData?.dates?.find((dd) => dd.date === iso) : null;
                    const availableForSelected = typeof dateInfo?.available === 'number' ? dateInfo.available : undefined;
                    if (typeof availableForSelected === 'number') {
                      return (
                        <div className="mt-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${availableForSelected <= 2 ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary'}`}>
                            Quedan {availableForSelected} cupo{availableForSelected !== 1 ? 's' : ''}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {hasMaxLimit && (
                    <span className="mt-2 inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      Máximo {effectiveMaxPeople} personas
                    </span>
                  )}
                </motion.div>

                <motion.div variants={fadeUp} className="mt-4 w-full rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
                    Precio de reserva
                  </p>
                  <p className="mt-1 text-xl font-bold text-primary">
                    {totalPrice > 0
                      ? formatReservationPrice(totalPrice, currency)
                      : 'Consultar'}
                  </p>
                  {totalPrice > 0 && people > 1 && (
                    <p className="mt-0.5 text-xs text-black/50">
                      {formatReservationPrice(depositAmount, currency)} por persona
                    </p>
                  )}
                </motion.div>
              </motion.div>
            </motion.div>

            <motion.div className="w-full space-y-3" variants={fadeUp}>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleAddToCart()}
                disabled={!canCheckout || isAddingToCart}
                className="h-11 w-full rounded-full text-base font-semibold"
              >
                Agregar al carrito
              </Button>
              <Button
                type="button"
                variant="success"
                onClick={handleCheckout}
                disabled={!canCheckout}
                className="h-11 w-full rounded-full text-base font-semibold"
              >
                Continuar al pago
              </Button>
              <p className="text-xs text-gray-500">
                {!canCheckout && hasSpecificDates
                  ? 'Seleccioná una fecha habilitada con cupos para continuar.'
                  : effectiveReservationMicrocopy}
              </p>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
