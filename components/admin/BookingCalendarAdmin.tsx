'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import type { BookingDate } from '@/components/landing-reserva/types';

const WEEK_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayIso(): string {
  return toIso(new Date());
}

function getDaysInMonth(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = (first.getDay() + 6) % 7;
  const days: (Date | null)[] = Array(start).fill(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

type Props = {
  dates: BookingDate[];
  defaultCapacity: number;
  onAddDate: (date: string, capacity: number) => void;
  onRemoveDate: (date: string) => void;
  onAddRange: (from: string, to: string, capacity: number) => void;
  minDate?: string;
};

export default function BookingCalendarAdmin({
  dates,
  defaultCapacity,
  onAddDate,
  onRemoveDate,
  onAddRange,
  minDate = todayIso(),
}: Props) {
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [rangeCapacity, setRangeCapacity] = useState(defaultCapacity);

  const datesSet = useMemo(() => new Set(dates.map((d) => d.date)), [dates]);

  const { monthLabel, days } = useMemo(() => {
    const y = viewMonth.getFullYear();
    const m = viewMonth.getMonth();
    return {
      monthLabel: viewMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
      days: getDaysInMonth(y, m),
    };
  }, [viewMonth]);

  const isPast = (iso: string) => iso < minDate;
  const isInList = (iso: string) => datesSet.has(iso);
  const isInRange = (iso: string) => {
    if (!rangeFrom || !rangeTo) return false;
    return iso >= rangeFrom && iso <= rangeTo;
  };

  /** Calendario: primer clic = Desde, segundo clic = Hasta. Tercer clic reinicia y pone nuevo Desde. */
  const handleDayClick = (day: Date) => {
    const iso = toIso(day);
    if (isPast(iso)) return;
    if (!rangeFrom) {
      setRangeFrom(iso);
      setRangeTo('');
      return;
    }
    if (!rangeTo) {
      if (iso < rangeFrom) {
        setRangeTo(rangeFrom);
        setRangeFrom(iso);
      } else {
        setRangeTo(iso);
      }
      return;
    }
    setRangeFrom(iso);
    setRangeTo('');
  };

  const handleAddRange = () => {
    const from = rangeFrom.trim();
    const to = rangeTo.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return;
    }
    if (from > to) {
      return;
    }
    const capacity = Math.max(1, Math.min(999, rangeCapacity));
    onAddRange(from, to, capacity);
    setRangeFrom('');
    setRangeTo('');
    setRangeCapacity(defaultCapacity);
  };

  const rangeValid = /^\d{4}-\d{2}-\d{2}$/.test(rangeFrom.trim()) && /^\d{4}-\d{2}-\d{2}$/.test(rangeTo.trim()) && rangeFrom <= rangeTo;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <Label className="text-sm font-semibold text-gray-800">Calendario</Label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] text-center text-sm font-medium capitalize text-gray-700">{monthLabel}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
          {WEEK_DAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            if (!day) return <div key={`e-${i}`} />;
            const iso = toIso(day);
            const past = isPast(iso);
            const inList = isInList(iso);
            const isFrom = iso === rangeFrom;
            const isTo = iso === rangeTo;
            const inRange = isInRange(iso);
            const isRangeEnd = isFrom || isTo;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => handleDayClick(day)}
                disabled={past}
                className={`flex h-8 w-full items-center justify-center rounded-md text-sm font-medium transition ${
                  past
                    ? 'cursor-not-allowed bg-gray-100 text-gray-400'
                    : inList
                      ? 'bg-(--sherpa-green-water) text-gray-900 hover:opacity-90'
                      : isRangeEnd
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                        : inRange
                          ? 'bg-primary/20 text-primary font-semibold'
                          : 'bg-gray-100 text-gray-600 hover:bg-primary/15 hover:text-primary'
                }`}
                title={
                  past
                    ? 'Fecha pasada'
                    : isFrom
                      ? 'Desde (primer clic)'
                      : isTo
                        ? 'Hasta (segundo clic)'
                        : inList
                          ? 'Ya configurado'
                          : 'Clic para elegir Desde o Hasta'
                }
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Primer clic = Desde, segundo clic = Hasta. Luego usá &quot;Agregar rango&quot;. Verde agua = ya configurado.
        </p>
      </div>

      <div className="rounded-xl border-2 border-dashed border-primary/25 bg-primary/5 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Calendar className="h-4 w-4 text-primary" />
          Agregar rango (mismo cupo para todas las fechas)
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Desde</Label>
            <Input
              type="date"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              min={minDate}
              className="mt-1 h-9 w-36 scheme-light"
            />
          </div>
          <div>
            <Label className="text-xs">Hasta</Label>
            <Input
              type="date"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              min={rangeFrom || minDate}
              className="mt-1 h-9 w-36 scheme-light"
            />
          </div>
          <div>
            <Label className="text-xs">Cupos por día</Label>
            <Input
              type="number"
              min={1}
              max={999}
              value={rangeCapacity}
              onChange={(e) => setRangeCapacity(Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 1)))}
              className="mt-1 h-9 w-20"
            />
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleAddRange}
            disabled={!rangeValid}
            className="h-9"
          >
            Agregar rango
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Todas las fechas entre Desde y Hasta se agregan con el mismo cupo. Las que ya existían no se duplican.
        </p>
      </div>
    </div>
  );
}
