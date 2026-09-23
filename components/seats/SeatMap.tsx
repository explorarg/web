'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SEAT_CATEGORY_CODES,
  SEAT_CATEGORY_DEFINITIONS,
  getSeatCategoryLabel,
  getSeatCategoryPricingFromTemplate,
  isSeatCategoryCode,
} from '@/lib/seats/categories';
import type { DepartureSeat, SeatCategoryCode, SeatLayoutSpecialCell, SeatLayoutTemplate, SeatStatus } from '@/types';

type Props = {
  template: SeatLayoutTemplate;
  seats: DepartureSeat[];
  selectedSeatIds?: string[];
  maxSelectable?: number;
  onChangeSelected?: (next: string[]) => void;
  onSeatClick?: (seat: DepartureSeat) => void;
  compact?: boolean;
  activeFloor?: number;
  onActiveFloorChange?: (floor: number) => void;
  onSeatPreviewChange?: (seat: DepartureSeat | null) => void;
};

function getRowLetter(index: number) {
  let current = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);
  return label;
}

function getDisplayColumns(cols: number, aisleCols: number[]) {
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

function specialCellLabel(cell: SeatLayoutSpecialCell, compact?: boolean) {
  if (cell.label && cell.label.trim()) return cell.label.trim();
  if (cell.type === 'driver') return compact ? 'C' : 'Chofer';
  if (cell.type === 'wc') return compact ? 'B' : 'Baño';
  if (cell.type === 'stairs') return compact ? 'E' : 'Esc';
  return '';
}

function getSeatCategoryDefinition(seat: DepartureSeat) {
  if (!seat.category || !isSeatCategoryCode(seat.category)) return null;
  return SEAT_CATEGORY_DEFINITIONS[seat.category];
}

function seatStatusTone(status: SeatStatus) {
  if (status === 'held') return 'border-[#A6DDE7] bg-[#F0FDFF] text-[#117C93]';
  if (status === 'reserved') return 'border-[#F4C77A] bg-[#FFF3DB] text-[#9A6B11]';
  if (status === 'paid') return 'border-[#2E7D5F] bg-[#1E6B4F] text-white';
  if (status === 'blocked') return 'border-[#F2C7D3] bg-[#FFF4F7] text-[#C24162]';
  if (status === 'disabled') return 'border-[#E0E8EF] bg-[#F6FAFD] text-[#7B8EA5] opacity-60';
  return 'border-[#E0E8EF] bg-[#F6FAFD] text-[#7B8EA5]';
}

function getSeatClasses(seat: DepartureSeat, selected: boolean) {
  const categoryDef = getSeatCategoryDefinition(seat);

  if (selected) {
    if (categoryDef) {
      return cn(
        categoryDef.surfaceClass,
        'ring-2 ring-[#0EA5A4] ring-offset-1 shadow-[0_10px_18px_rgba(14,165,164,0.24)]'
      );
    }
    return 'border-[#0EA5A4] bg-[#0EA5A4] text-white shadow-[0_10px_18px_rgba(14,165,164,0.24)]';
  }

  if (seat.status === 'available') {
    if (categoryDef) {
      return cn(categoryDef.surfaceClass, 'hover:brightness-[0.98]');
    }
    return 'border-[#D9E8F7] bg-white text-[#334E71] hover:border-[#0EA5A4] hover:bg-[#F4FEFD]';
  }

  return cn(seatStatusTone(seat.status), categoryDef && 'opacity-80');
}

function translateSeatStatus(status: SeatStatus): string {
  switch (status) {
    case 'available':
      return 'Disponible';
    case 'held':
      return 'En hold';
    case 'reserved':
      return 'Reservada';
    case 'paid':
      return 'Pagada / Ocupada';
    case 'blocked':
      return 'Bloqueada';
    case 'disabled':
      return 'Deshabilitada';
    default:
      return String(status);
  }
}

function getSeatTitle(seat: DepartureSeat) {
  const categoryLabel =
    seat.category && isSeatCategoryCode(seat.category) ? getSeatCategoryLabel(seat.category) : 'Estándar';
  return `Butaca ${seat.label} · ${categoryLabel} · ${translateSeatStatus(seat.status)}`;
}

function formatCategoryPrice(amount: number) {
  if (amount <= 0) return null;
  return `+ $${amount.toLocaleString('es-AR')}`;
}

function specialTone(type: SeatLayoutSpecialCell['type']) {
  if (type === 'driver') return 'border-[#F8D7A5] bg-[#FFF8EC] text-[#CA7A03]';
  if (type === 'wc') return 'border-[#BFD6FF] bg-[#F4F8FF] text-[#336FF4]';
  if (type === 'stairs') return 'border-[#D8C9FF] bg-[#F8F5FF] text-[#8155F6]';
  return 'border-[#D6E1EC] bg-[#F8FBFE] text-[#70839E]';
}

export default function SeatMap({
  template,
  seats,
  selectedSeatIds,
  maxSelectable,
  onChangeSelected,
  onSeatClick,
  compact,
  activeFloor: controlledActiveFloor,
  onActiveFloorChange,
  onSeatPreviewChange,
}: Props) {
  const selected = selectedSeatIds ?? [];
  const [internalActiveFloor, setInternalActiveFloor] = useState(0);

  const seatByPos = useMemo(() => {
    const map = new Map<string, DepartureSeat>();
    for (const seat of seats) {
      map.set(`${seat.floor}:${seat.row}:${seat.col}`, seat);
    }
    return map;
  }, [seats]);

  const specialByPos = useMemo(() => {
    const map = new Map<string, SeatLayoutSpecialCell>();
    for (const cell of template.specialCells ?? []) {
      map.set(`${cell.floor}:${cell.row}:${cell.col}`, cell);
    }
    return map;
  }, [template.specialCells]);

  const cols = Math.max(1, Number(template.cols ?? 1));
  const rows = Math.max(1, Number(template.rows ?? 1));
  const floors = Math.max(1, Number(template.floors ?? 1));
  const displayColumns = useMemo(() => getDisplayColumns(cols, template.aisleCols ?? []), [cols, template.aisleCols]);
  const showRowLabels = template.showRowLabels !== false;
  const activeFloor = Math.max(0, Math.min(controlledActiveFloor ?? internalActiveFloor, floors - 1));

  useEffect(() => {
    if (controlledActiveFloor == null) {
      setInternalActiveFloor((prev) => Math.max(0, Math.min(prev, floors - 1)));
    } else if (controlledActiveFloor !== activeFloor) {
      onActiveFloorChange?.(activeFloor);
    }
  }, [activeFloor, controlledActiveFloor, floors, onActiveFloorChange]);

  const setFloor = (floor: number) => {
    if (controlledActiveFloor == null) {
      setInternalActiveFloor(floor);
    }
    onActiveFloorChange?.(floor);
  };

  const handleToggle = (seat: DepartureSeat) => {
    onSeatPreviewChange?.(seat);
    if (onSeatClick) {
      onSeatClick(seat);
      return;
    }
    if (!onChangeSelected) return;
    if (seat.status !== 'available' && !selected.includes(seat.seatId)) return;

    const exists = selected.includes(seat.seatId);
    const next = exists
      ? selected.filter((id) => id !== seat.seatId)
      : [...selected, seat.seatId];

    const limited = typeof maxSelectable === 'number' ? next.slice(0, Math.max(0, maxSelectable)) : next;
    onChangeSelected(limited);
  };

  const activeSelectedSeat = useMemo(() => {
    const activeSeats = seats.filter((seat) => seat.floor === activeFloor && selected.includes(seat.seatId));
    return activeSeats.at(-1) ?? null;
  }, [activeFloor, seats, selected]);

  const usedCategories = useMemo(() => {
    const set = new Set<SeatCategoryCode>();
    for (const seat of seats) {
      if (seat.category && isSeatCategoryCode(seat.category)) {
        set.add(seat.category);
      }
    }
    return SEAT_CATEGORY_CODES.filter((code) => set.has(code));
  }, [seats]);

  const categoryPricing = useMemo(() => getSeatCategoryPricingFromTemplate(template), [template]);

  useEffect(() => {
    if (onSeatPreviewChange) {
      onSeatPreviewChange(activeSelectedSeat);
    }
  }, [activeSelectedSeat, onSeatPreviewChange]);

  return (
    <div className="space-y-4">
      {floors > 1 ? (
        <div className="border-b border-[#E4EEF7]">
          <div className="flex flex-wrap gap-6">
            {Array.from({ length: floors }, (_, floor) => (
              <button
                key={`seatmap-floor-${floor}`}
                type="button"
                onClick={() => setFloor(floor)}
                className={cn(
                  'border-b-2 px-1 pb-3 text-[13px] font-black transition-colors',
                  activeFloor === floor
                    ? 'border-[#08A7C7] text-[#118CA7]'
                    : 'border-transparent text-[#8398B0] hover:text-[#12325D]'
                )}
              >
                Piso {floor + 1}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[26px] border border-[#DCEAF8] bg-[linear-gradient(180deg,#FCFEFF_0%,#F4FAFF_100%)] p-4 sm:p-5">
        <div className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7C95AE]">
          Frente
        </div>
        <div className="mt-2 flex justify-center">
          <svg width={compact ? '220' : '280'} height="22" viewBox="0 0 280 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 18C60 6 220 6 270 18" stroke="#BFD8EE" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <div className="mt-4 overflow-x-auto pb-1">
          <div className="mx-auto flex w-fit items-start gap-3">
            {showRowLabels ? (
              <div className={cn(compact ? 'pt-[70px]' : 'pt-[84px]')}>
                <div className={cn(compact ? 'space-y-1.5' : 'space-y-2')}>
                  {Array.from({ length: rows }, (_, row) => (
                    <div
                      key={`row-label-${activeFloor}-${row}`}
                      className={cn(
                        'flex items-center justify-center text-center font-black text-[#1A93B7]',
                        compact ? 'h-8 w-5 text-[10px]' : 'h-10 w-6 text-[11px]'
                      )}
                    >
                      {getRowLetter(row)}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="relative rounded-[30px] border border-[#D5E3F0] bg-white p-[10px] shadow-[0_14px_30px_rgba(18,89,150,0.08)]">
              <div className="absolute inset-x-4 top-3 h-10 rounded-full bg-[linear-gradient(180deg,rgba(168,182,198,0.55)_0%,rgba(255,255,255,0.12)_100%)]" />
              <div className="relative rounded-[24px] border border-[#DCE8F4] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FBFF_100%)] px-3 pb-3 pt-4">
                <div className="mx-auto mb-4 h-8 w-[76%] rounded-full border border-[#C8D6E4] bg-[linear-gradient(180deg,#E5EAF0_0%,#FAFCFE_100%)]" />

                <div className={cn(compact ? 'space-y-1.5' : 'space-y-2')}>
                  {Array.from({ length: rows }, (_, row) => (
                    <div
                      key={`floor-${activeFloor}-row-${row}`}
                      className={cn('grid items-center', compact ? 'gap-1.5' : 'gap-2')}
                      style={{
                        gridTemplateColumns: displayColumns
                          .map((item) => (item.kind === 'aisle' ? (compact ? '10px' : '14px') : compact ? '32px' : '40px'))
                          .join(' '),
                      }}
                    >
                      {displayColumns.map((item) => {
                        if (item.kind === 'aisle') {
                          return (
                            <div key={item.key} className="flex justify-center">
                              <div className={cn('rounded-full bg-[#E0EAF4]', compact ? 'h-8 w-[6px]' : 'h-10 w-[8px]')} />
                            </div>
                          );
                        }

                        const key = `${activeFloor}:${row}:${item.col}`;
                        const special = specialByPos.get(key);
                        if (special) {
                          return (
                            <div
                              key={key}
                              className={cn(
                                'flex items-center justify-center rounded-xl border text-center font-black tracking-[-0.02em]',
                                compact ? 'h-8 w-8 text-[9px]' : 'h-10 w-10 text-[10px]',
                                specialTone(special.type)
                              )}
                              title={specialCellLabel(special)}
                            >
                              {specialCellLabel(special, compact)}
                            </div>
                          );
                        }

                        const seat = seatByPos.get(key);
                        if (!seat) {
                          return (
                            <div
                              key={key}
                              className={cn(compact ? 'h-8 w-8' : 'h-10 w-10')}
                            />
                          );
                        }

                        const isSelected = selected.includes(seat.seatId);
                        const disabled = !onSeatClick && !onChangeSelected;
                        const categoryDef = getSeatCategoryDefinition(seat);

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleToggle(seat)}
                            disabled={disabled}
                            className={cn(
                              'relative flex items-center justify-center rounded-xl border font-black tracking-[-0.02em] transition-all duration-200 will-change-transform',
                              compact ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-[11px]',
                              getSeatClasses(seat, isSelected),
                              disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:-translate-y-0.5 hover:scale-[1.03] active:translate-y-0 active:scale-[0.98]'
                            )}
                            title={getSeatTitle(seat)}
                            aria-label={getSeatTitle(seat)}
                          >
                            {categoryDef ? (
                              <span
                                className={cn(
                                  'absolute left-0.5 top-0.5 rounded-full bg-white/80 font-black leading-none text-current shadow-[0_1px_4px_rgba(15,66,116,0.12)]',
                                  compact ? 'px-0.5 py-px text-[6px] tracking-[0.06em]' : 'px-1 py-0.5 text-[7px] tracking-[0.08em]'
                                )}
                              >
                                {categoryDef.shortLabel}
                              </span>
                            ) : null}
                            <span>{seat.label}</span>
                            {isSelected ? (
                              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-[0_4px_10px_rgba(8,46,86,0.16)]">
                                <Check className="h-3 w-3 text-[#0EA5A4]" />
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {usedCategories.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {usedCategories.map((code) => {
              const def = SEAT_CATEGORY_DEFINITIONS[code];
              const price = categoryPricing[code]?.amount ?? 0;
              const priceLabel = formatCategoryPrice(price);
              return (
                <div key={code} className="flex items-center gap-1.5 text-[12px] text-[#5E7898]">
                  <span
                    className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-md border text-[7px] font-black tracking-[0.06em]',
                      def.surfaceClass
                    )}
                  >
                    {def.shortLabel}
                  </span>
                  <span className="font-medium text-[#334E71]">{def.label}</span>
                  {priceLabel ? <span className="text-[#8FA3BA]">{priceLabel}</span> : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#E4EEF7] pt-3">
          <LegendItem label="Disponible" className="border-[#D9E8F7] bg-[#F6FAFD] text-[#7B8EA5]" />
          <LegendItem label="Tu selección" className="border-[#0EA5A4] bg-[#0EA5A4] text-white" ring />
          <LegendItem label="En proceso" className="border-[#F2D089] bg-[#FFF8EA] text-[#B7791F]" />
          <LegendItem label="Reservada" className="border-[#F4C77A] bg-[#FFF3DB] text-[#9A6B11]" />
          <LegendItem label="Pagada" className="border-[#2E7D5F] bg-[#1E6B4F] text-white" />
          <LegendItem label="Bloqueada" className="border-[#F2C7D3] bg-[#FFF4F7] text-[#C24162]" />
          <LegendItem label="No disponible" className="border-[#E0E8EF] bg-[#F6FAFD] text-[#7B8EA5]" />
        </div> */}
      </div>

      {typeof maxSelectable === 'number' ? (
        <div className="text-right text-[13px] text-[#607B9C]">
          Seleccionadas <span className="font-semibold text-[#12325D]">{selected.length}</span> de {maxSelectable}
        </div>
      ) : null}
    </div>
  );
}

function LegendItem({
  label,
  className,
  ring,
}: {
  label: string;
  className: string;
  ring?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[12px] text-[#5E7898]">
      <span
        className={cn(
          'h-3.5 w-3.5 rounded border shadow-[inset_0_0_0_1px_rgba(255,255,255,0.45)]',
          className,
          ring && 'ring-2 ring-[#0EA5A4] ring-offset-1'
        )}
      />
      <span>{label}</span>
    </div>
  );
}
