"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatIsoDateToArgentine } from "@/lib/utils/argentine-date";

type Props = {
  value: string;
  onChange: (value: string) => void;
  availableDates?: string[];
  disabled?: boolean;
  className?: string;
};

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getDaysInMonth(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = (first.getDay() + 6) % 7;
  const days: (Date | null)[] = Array(start).fill(null);
  for (let d = 1; d <= last.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

const WEEK_DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function ArgentineCalendarPicker({
  value,
  onChange,
  availableDates = [],
  disabled = false,
  className,
}: Props) {
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) {
      const [y, m] = value.split("-").map(Number);
      if (!Number.isNaN(y) && !Number.isNaN(m)) return new Date(y, m - 1, 1);
    }
    return new Date();
  });

  useEffect(() => {
    if (value) {
      const [y, m] = value.split("-").map(Number);
      if (!Number.isNaN(y) && !Number.isNaN(m)) {
        setViewMonth((prev) => {
          if (prev.getFullYear() === y && prev.getMonth() === m - 1) return prev;
          return new Date(y, m - 1, 1);
        });
      }
    }
  }, [value]);

  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);

  const { monthLabel, days } = useMemo(() => {
    const y = viewMonth.getFullYear();
    const m = viewMonth.getMonth();
    return {
      monthLabel: viewMonth.toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
      days: getDaysInMonth(y, m),
    };
  }, [viewMonth]);

  const todayIso = useMemo(() => toIso(new Date()), []);

  const handleDayClick = (iso: string) => {
    if (disabled) return;
    if (availableDates.length > 0 && !availableSet.has(iso)) return;
    onChange(value === iso ? "" : iso);
  };

  const clearSelection = () => {
    if (disabled) return;
    onChange("");
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {value ? formatIsoDateToArgentine(value) : "Seleccioná una fecha"}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {value ? (
              <button
                type="button"
                onClick={clearSelection}
                className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Limpiar fecha"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-gray-400">
          {WEEK_DAYS.map((d) => (
            <span key={d} className="py-1">
              {d}
            </span>
          ))}
        </div>

        <div className="mt-0.5 grid grid-cols-7 gap-0.5">
          {days.map((day, i) => {
            if (!day) return <div key={`e-${i}`} className="h-9 w-full" />;
            const iso = toIso(day);
            const isAvailable = availableDates.length === 0 || availableSet.has(iso);
            const isSelected = value === iso;
            const isToday = iso === todayIso;

            return (
              <button
                key={iso}
                type="button"
                disabled={disabled || !isAvailable}
                onClick={() => handleDayClick(iso)}
                className={cn(
                  "relative flex h-9 w-full items-center justify-center rounded-lg text-sm transition",
                  !isAvailable
                    ? "cursor-not-allowed text-gray-300"
                    : isSelected
                      ? "bg-[#16A34A] text-white shadow-[0_4px_12px_rgba(22,163,74,0.25)]"
                      : isToday
                        ? "border border-[#16A34A] text-[#16A34A] hover:bg-[#16A34A]/10"
                        : "text-gray-700 hover:bg-gray-100",
                  disabled && "opacity-50"
                )}
                title={
                  !isAvailable
                    ? "Sin fechas disponibles"
                    : isSelected
                      ? formatIsoDateToArgentine(iso)
                      : formatIsoDateToArgentine(iso)
                }
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-[#16A34A]" />
            Disponible
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm border border-[#16A34A]" />
            Hoy
          </span>
        </div>
      </div>
    </div>
  );
}
