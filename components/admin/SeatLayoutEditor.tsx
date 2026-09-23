'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Armchair,
  Bath,
  BusFront,
  Check,
  ChevronRight,
  Copy,
  Eraser,
  Eye,
  FlipHorizontal2,
  GripVertical,
  LayoutGrid,
  Layers3,
  Lock,
  Minus,
  PencilRuler,
  Plus,
  Save,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { SeatCategoryCode, SeatLayoutSpecialCell, SeatLayoutTemplate } from '@/types';
import {
  SEAT_CATEGORY_CODES,
  SEAT_CATEGORY_DEFINITIONS,
  SEAT_CATEGORY_LABELS,
  getSeatCategoryPricingFromTemplate,
  isSeatCategoryCode,
} from '@/lib/seats/categories';

type Mode = 'seat' | 'empty' | 'wc' | 'stairs' | 'driver' | 'disabled' | 'blocked';
type CategoryBrush = SeatCategoryCode | 'clear';

type Props = {
  initial?: SeatLayoutTemplate | null;
};

type SelectedCell = {
  floor: number;
  row: number;
  col: number;
};

const BUS_TYPE_OPTIONS = [
  'Ómnibus de larga distancia',
  'Semicama',
  'Cama',
  'Doble piso',
  'Minibús',
] as const;

const TEMPLATE_PRESETS = [
  {
    id: 'semicama-44',
    label: 'Semicama 44',
    busType: 'Semicama',
    floors: 1,
    rows: 11,
    cols: 4,
    aisleCols: [2],
  },
  {
    id: 'cama-36',
    label: 'Cama 36',
    busType: 'Cama',
    floors: 1,
    rows: 9,
    cols: 4,
    aisleCols: [2],
  },
  {
    id: 'doble-piso-70',
    label: 'Doble piso 70',
    busType: 'Doble piso',
    floors: 2,
    rows: 10,
    cols: 4,
    aisleCols: [2],
  },
  {
    id: 'larga-distancia-58',
    label: 'Larga distancia 58',
    busType: 'Ómnibus de larga distancia',
    floors: 1,
    rows: 15,
    cols: 4,
    aisleCols: [2],
  },
  {
    id: 'minibus-19',
    label: 'Minibús 19',
    busType: 'Minibús',
    floors: 1,
    rows: 5,
    cols: 4,
    aisleCols: [2],
  },
] as const;

const TOOL_OPTIONS: Array<{
  id: Mode;
  label: string;
  Icon?: React.ComponentType<{ className?: string }>;
  accent: string;
  activeAccent: string;
}> = [
  { id: 'seat', label: 'Asiento', Icon: Armchair, accent: 'text-[#0F9CB8]', activeAccent: 'bg-[#0F9CB8]' },
  { id: 'empty', label: 'Vacío', Icon: LayoutGrid, accent: 'text-[#70839E]', activeAccent: 'bg-[#70839E]' },
  { id: 'wc', label: 'Baño', Icon: Bath, accent: 'text-[#4C8BFF]', activeAccent: 'bg-[#4C8BFF]' },
  { id: 'stairs', label: 'Escalera', Icon: GripVertical, accent: 'text-[#8B5CF6]', activeAccent: 'bg-[#8B5CF6]' },
  { id: 'driver', label: 'Chofer', Icon: UserRound, accent: 'text-[#F59E0B]', activeAccent: 'bg-[#F59E0B]' },
  { id: 'blocked', label: 'Bloqueado', Icon: Lock, accent: 'text-[#EF4444]', activeAccent: 'bg-[#EF4444]' },
  { id: 'disabled', label: 'Deshabilitado', Icon: X, accent: 'text-[#64748B]', activeAccent: 'bg-[#64748B]' },
];

function seatIdFor(floor: number, row: number, col: number) {
  return `F${floor}R${row}C${col}`;
}

function cellKey(floor: number, row: number, col: number) {
  return `${floor}:${row}:${col}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getRowLetter(index: number) {
  let current = index;
  let label = '';
  do {
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26) - 1;
  } while (current >= 0);
  return label;
}

function getColumnSide(col: number, cols: number, aisleCols: number[]) {
  const sorted = [...aisleCols].sort((a, b) => a - b);
  if (sorted.length > 0) {
    return col < sorted[0] ? 'Izquierda' : 'Derecha';
  }
  return col < Math.ceil(cols / 2) ? 'Izquierda' : 'Derecha';
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

function getSpecialLabel(type: SeatLayoutSpecialCell['type']) {
  if (type === 'driver') return 'Chofer';
  if (type === 'wc') return 'Baño';
  if (type === 'stairs') return 'Escalera';
  return 'Vacío';
}

function getSpecialBadgeClass(type: SeatLayoutSpecialCell['type']) {
  if (type === 'driver') return 'border-[#F8D7A5] bg-[#FFF8EC] text-[#CA7A03]';
  if (type === 'wc') return 'border-[#BFD6FF] bg-[#F5F9FF] text-[#336FF4]';
  if (type === 'stairs') return 'border-[#D8C9FF] bg-[#F8F5FF] text-[#8155F6]';
  return 'border-[#D6E1EC] bg-[#F8FBFE] text-[#70839E]';
}

function normalizeCategoryAmountInput(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.max(0, value)) : '';
}

function parseCell(value: string | null): SelectedCell | null {
  if (!value) return null;
  const [floor, row, col] = value.split(':').map((part) => Number(part));
  if ([floor, row, col].some((item) => Number.isNaN(item))) return null;
  return { floor, row, col };
}

function CounterField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[12px] font-semibold tracking-[-0.01em] text-[#607B9C]">{label}</div>
      <div className="flex h-11 items-center rounded-2xl border border-[#D8E7F5] bg-white shadow-[0_4px_12px_rgba(30,136,184,0.05)]">
        <button
          type="button"
          className="flex h-full w-11 items-center justify-center text-[#183A66] transition-colors hover:bg-[#F3FAFF]"
          onClick={() => onChange(clamp(value - 1, min, max))}
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center text-[15px] font-black tracking-[-0.02em] text-[#102C4E]">{value}</div>
        <button
          type="button"
          className="flex h-full w-11 items-center justify-center text-[#183A66] transition-colors hover:bg-[#F3FAFF]"
          onClick={() => onChange(clamp(value + 1, min, max))}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ToolButton({
  mode,
  active,
  onClick,
}: {
  mode: {
    label: string;
    Icon?: React.ComponentType<{ className?: string }>;
    accent: string;
    activeAccent: string;
  };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = mode.Icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-[12px] font-bold tracking-[-0.01em] transition-all',
        active
          ? `${mode.activeAccent} border-transparent text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]`
          : 'border-[#D8E7F5] bg-white text-[#12325D] hover:border-[#B7D1EA] hover:bg-[#F8FCFF]'
      )}
    >
      {Icon ? <Icon className={cn('h-4 w-4', active ? 'text-white' : mode.accent)} /> : null}
      <span>{mode.label}</span>
    </button>
  );
}

export default function SeatLayoutEditor({ initial }: Props) {
  const router = useRouter();
  const { user } = useAuth();

  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(initial?.name ?? '');
  const [busType, setBusType] = useState(initial?.busType ?? BUS_TYPE_OPTIONS[0]);
  const [status, setStatus] = useState<'draft' | 'published'>(initial?.status ?? 'published');
  const [presetId, setPresetId] = useState<string>('');
  const [floors, setFloors] = useState<number>(initial?.floors ?? 1);
  const [rows, setRows] = useState<number>(initial?.rows ?? 12);
  const [cols, setCols] = useState<number>(initial?.cols ?? 4);
  const [startNumber, setStartNumber] = useState<number>(initial?.startNumber ?? 1);
  const [autoNumbering, setAutoNumbering] = useState<boolean>(initial?.autoNumbering ?? true);
  const [showRowLabels, setShowRowLabels] = useState<boolean>(initial?.showRowLabels ?? true);
  const [notes, setNotes] = useState<string>(initial?.notes ?? '');
  const initialCategoryPricing = useMemo(() => getSeatCategoryPricingFromTemplate(initial ?? null), [initial]);
  const [categoryPricing, setCategoryPricing] = useState<Record<SeatCategoryCode, { amount: string }>>({
    cocheCama: { amount: normalizeCategoryAmountInput(initialCategoryPricing.cocheCama?.amount) },
    panoramicos: { amount: normalizeCategoryAmountInput(initialCategoryPricing.panoramicos?.amount) },
    cafeteras: { amount: normalizeCategoryAmountInput(initialCategoryPricing.cafeteras?.amount) },
  });
  const [mode, setMode] = useState<Mode>('seat');
  const [activeFloor, setActiveFloor] = useState(0);
  const [selectedCellKey, setSelectedCellKey] = useState<string | null>(null);
  const [movingCellKey, setMovingCellKey] = useState<string | null>(null);
  const [draggingCellKey, setDraggingCellKey] = useState<string | null>(null);
  const [dragOverCellKey, setDragOverCellKey] = useState<string | null>(null);
  const [categoryBrush, setCategoryBrush] = useState<CategoryBrush>('clear');

  const [aisleCols, setAisleCols] = useState<Set<number>>(() => new Set<number>(initial?.aisleCols ?? [2]));
  const [specialCells, setSpecialCells] = useState<Map<string, SeatLayoutSpecialCell>>(() => {
    const map = new Map<string, SeatLayoutSpecialCell>();
    for (const cell of initial?.specialCells ?? []) {
      map.set(cellKey(cell.floor, cell.row, cell.col), cell);
    }
    return map;
  });
  const [disabledSeatIds, setDisabledSeatIds] = useState<Set<string>>(
    () => new Set((initial?.seats ?? []).filter((seat) => seat.disabled).map((seat) => seat.seatId))
  );
  const [blockedSeatIds, setBlockedSeatIds] = useState<Set<string>>(
    () => new Set((initial?.seats ?? []).filter((seat) => seat.defaultBlocked).map((seat) => seat.seatId))
  );
  const [seatCategories, setSeatCategories] = useState<Map<string, SeatCategoryCode>>(
    () =>
      new Map(
        (initial?.seats ?? [])
          .filter((seat) => isSeatCategoryCode(seat.category))
          .map((seat) => [seat.seatId, seat.category as SeatCategoryCode])
      )
  );

  const safeFloors = clamp(Number.isFinite(floors) ? floors : 1, 1, 3);
  const safeRows = clamp(Number.isFinite(rows) ? rows : 12, 1, 80);
  const safeCols = clamp(Number.isFinite(cols) ? cols : 4, 1, 12);
  const safeStartNumber = clamp(Number.isFinite(startNumber) ? startNumber : 1, 1, 999);
  const initialLabelsByPosition = useMemo(
    () =>
      new Map(
        (initial?.seats ?? []).map((seat) => [cellKey(seat.floor, seat.row, seat.col), seat.label])
      ),
    [initial]
  );

  useEffect(() => {
    setActiveFloor((prev) => clamp(prev, 0, safeFloors - 1));
  }, [safeFloors]);

  useEffect(() => {
    const next = new Set<number>();
    for (const item of aisleCols) {
      if (item > 0 && item < safeCols) next.add(item);
    }
    if (next.size !== aisleCols.size) {
      setAisleCols(next);
    }
  }, [aisleCols, safeCols]);

  const derived = useMemo(() => {
    const seats: Array<{
      seatId: string;
      floor: number;
      row: number;
      col: number;
      label: string;
      category?: SeatCategoryCode | null;
      disabled?: boolean;
      defaultBlocked?: boolean;
    }> = [];
    const specials: SeatLayoutSpecialCell[] = [];

    for (const item of specialCells.values()) {
      if (item.floor < safeFloors && item.row < safeRows && item.col < safeCols) {
        specials.push(item);
      }
    }

    const specialKeys = new Set(specials.map((item) => cellKey(item.floor, item.row, item.col)));
    let seq = safeStartNumber;

    for (let floor = 0; floor < safeFloors; floor += 1) {
      for (let row = 0; row < safeRows; row += 1) {
        for (let col = 0; col < safeCols; col += 1) {
          const positionKey = cellKey(floor, row, col);
          if (specialKeys.has(positionKey)) continue;
          const seatId = seatIdFor(floor, row, col);
          const fallbackLabel = String(seq++);
          const label = autoNumbering ? fallbackLabel : initialLabelsByPosition.get(positionKey) ?? fallbackLabel;
          seats.push({
            seatId,
            floor,
            row,
            col,
            label,
            category: seatCategories.get(seatId) ?? null,
            disabled: disabledSeatIds.has(seatId) || undefined,
            defaultBlocked: blockedSeatIds.has(seatId) || undefined,
          });
        }
      }
    }

    return { seats, specials };
  }, [
    autoNumbering,
    disabledSeatIds,
    blockedSeatIds,
    initialLabelsByPosition,
    seatCategories,
    safeCols,
    safeFloors,
    safeRows,
    safeStartNumber,
    specialCells,
  ]);

  const seatsByCell = useMemo(() => {
    const map = new Map<string, (typeof derived.seats)[number]>();
    for (const seat of derived.seats) {
      map.set(cellKey(seat.floor, seat.row, seat.col), seat);
    }
    return map;
  }, [derived.seats]);

  const stats = useMemo(() => {
    let available = 0;
    let disabled = 0;
    let blocked = 0;
    for (const seat of derived.seats) {
      if (seat.defaultBlocked) blocked += 1;
      else if (seat.disabled) disabled += 1;
      else available += 1;
    }
    return {
      total: derived.seats.length,
      available,
      disabled,
      blocked,
      wc: derived.specials.filter((item) => item.type === 'wc').length,
      stairs: derived.specials.filter((item) => item.type === 'stairs').length,
      drivers: derived.specials.filter((item) => item.type === 'driver').length,
    };
  }, [derived]);

  const selectedCell = parseCell(selectedCellKey);
  const selectedSpecial = selectedCell ? specialCells.get(cellKey(selectedCell.floor, selectedCell.row, selectedCell.col)) ?? null : null;
  const selectedSeat = selectedCell ? seatsByCell.get(cellKey(selectedCell.floor, selectedCell.row, selectedCell.col)) ?? null : null;

  const activeFloorSpecials = useMemo(() => {
    return derived.specials.filter((item) => item.floor === activeFloor);
  }, [activeFloor, derived.specials]);

  const displayColumns = useMemo(() => getDisplayColumns(safeCols, Array.from(aisleCols)), [aisleCols, safeCols]);

  const previewSeatsByFloor = useMemo(() => {
    const map = new Map<number, Array<(typeof derived.seats)[number]>>();
    for (const seat of derived.seats) {
      if (!map.has(seat.floor)) map.set(seat.floor, []);
      map.get(seat.floor)!.push(seat);
    }
    for (const seats of map.values()) {
      seats.sort((a, b) => (a.row - b.row) || (a.col - b.col));
    }
    return map;
  }, [derived.seats]);

  const setCentralAisle = (enabled: boolean) => {
    if (!enabled) {
      setAisleCols(new Set());
      return;
    }
    const defaultAisle = clamp(Math.ceil(safeCols / 2), 1, Math.max(1, safeCols - 1));
    setAisleCols(new Set([defaultAisle]));
  };

  const toggleAislePosition = (position: number) => {
    setAisleCols((prev) => {
      const next = new Set(prev);
      if (next.has(position)) next.delete(position);
      else next.add(position);
      return next;
    });
  };

  const clearSeatState = (seatId: string) => {
    setDisabledSeatIds((prev) => {
      const next = new Set(prev);
      next.delete(seatId);
      return next;
    });
    setBlockedSeatIds((prev) => {
      const next = new Set(prev);
      next.delete(seatId);
      return next;
    });
  };

  const clearSeatCategory = (seatId: string) => {
    setSeatCategories((prev) => {
      const next = new Map(prev);
      next.delete(seatId);
      return next;
    });
  };

  const removeSpecial = (key: string) => {
    setSpecialCells((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  const placeSpecial = (floor: number, row: number, col: number, type: Extract<Mode, 'empty' | 'wc' | 'stairs' | 'driver'>) => {
    const key = cellKey(floor, row, col);
    const seatId = seatIdFor(floor, row, col);
    clearSeatState(seatId);
    clearSeatCategory(seatId);
    setSpecialCells((prev) => {
      const next = new Map(prev);
      next.set(key, { floor, row, col, type });
      return next;
    });
  };

  const moveSpecial = (from: string, to: string) => {
    if (from === to) {
      setMovingCellKey(null);
      return;
    }
    const source = specialCells.get(from);
    const target = parseCell(to);
    if (!source || !target) return;
    clearSeatState(seatIdFor(target.floor, target.row, target.col));
    setSpecialCells((prev) => {
      const next = new Map(prev);
      next.delete(from);
      next.set(to, { ...source, floor: target.floor, row: target.row, col: target.col });
      return next;
    });
    setSelectedCellKey(to);
    setMovingCellKey(null);
  };

  const handleCellClick = (floor: number, row: number, col: number) => {
    const key = cellKey(floor, row, col);
    const seatId = seatIdFor(floor, row, col);
    const special = specialCells.get(key);

    if (movingCellKey) {
      moveSpecial(movingCellKey, key);
      return;
    }

    setSelectedCellKey(key);

    if (mode === 'seat') {
      removeSpecial(key);
      clearSeatState(seatId);
      if (categoryBrush === 'clear') {
        clearSeatCategory(seatId);
      } else {
        setSeatCategories((prev) => new Map(prev).set(seatId, categoryBrush));
      }
      return;
    }

    if (mode === 'disabled') {
      if (special) return;
      setDisabledSeatIds((prev) => {
        const next = new Set(prev);
        if (next.has(seatId)) next.delete(seatId);
        else next.add(seatId);
        return next;
      });
      setBlockedSeatIds((prev) => {
        const next = new Set(prev);
        next.delete(seatId);
        return next;
      });
      return;
    }

    if (mode === 'blocked') {
      if (special) return;
      setBlockedSeatIds((prev) => {
        const next = new Set(prev);
        if (next.has(seatId)) next.delete(seatId);
        else next.add(seatId);
        return next;
      });
      setDisabledSeatIds((prev) => {
        const next = new Set(prev);
        next.delete(seatId);
        return next;
      });
      return;
    }

    if (special?.type === mode) {
      removeSpecial(key);
      return;
    }

    placeSpecial(floor, row, col, mode);
  };

  const clearFloorCustomizations = (floor: number) => {
    const floorPrefix = `F${floor}`;
    setSpecialCells((prev) => {
      const next = new Map(prev);
      for (const key of next.keys()) {
        if (key.startsWith(`${floor}:`)) next.delete(key);
      }
      return next;
    });
    setDisabledSeatIds((prev) => new Set([...prev].filter((seatId) => !seatId.startsWith(floorPrefix))));
    setBlockedSeatIds((prev) => new Set([...prev].filter((seatId) => !seatId.startsWith(floorPrefix))));
    setSeatCategories((prev) => new Map([...prev].filter(([seatId]) => !seatId.startsWith(floorPrefix))));
    if (selectedCellKey?.startsWith(`${floor}:`)) setSelectedCellKey(null);
  };

  const generateFloorBase = (floor: number) => {
    clearFloorCustomizations(floor);
    setSpecialCells((prev) => {
      const next = new Map(prev);
      if (floor === 0) {
        next.set(cellKey(floor, 0, 0), { floor, row: 0, col: 0, type: 'driver' });
      }
      if (safeCols > 1) {
        next.set(cellKey(floor, 0, safeCols - 1), { floor, row: 0, col: safeCols - 1, type: 'wc' });
      }
      if (safeFloors > 1) {
        if (floor === 0) {
          next.set(cellKey(floor, safeRows - 1, 0), { floor, row: safeRows - 1, col: 0, type: 'stairs' });
        } else {
          next.set(cellKey(floor, 0, 0), { floor, row: 0, col: 0, type: 'stairs' });
        }
      }
      return next;
    });
  };

  const generatePresetSpecialCells = (nextFloors: number, nextRows: number, nextCols: number) => {
    const map = new Map<string, SeatLayoutSpecialCell>();
    for (let floor = 0; floor < nextFloors; floor += 1) {
      if (floor === 0) {
        map.set(cellKey(floor, 0, 0), { floor, row: 0, col: 0, type: 'driver' });
      }
      if (nextCols > 1) {
        map.set(cellKey(floor, 0, nextCols - 1), { floor, row: 0, col: nextCols - 1, type: 'wc' });
      }
      if (nextFloors > 1) {
        if (floor === 0) {
          map.set(cellKey(floor, nextRows - 1, 0), { floor, row: nextRows - 1, col: 0, type: 'stairs' });
        } else {
          map.set(cellKey(floor, 0, 0), { floor, row: 0, col: 0, type: 'stairs' });
        }
      }
    }
    return map;
  };

  const applyPreset = (nextPresetId: string) => {
    const preset = TEMPLATE_PRESETS.find((item) => item.id === nextPresetId);
    if (!preset) return;

    setPresetId(nextPresetId);
    setBusType(preset.busType);
    setFloors(preset.floors);
    setRows(preset.rows);
    setCols(preset.cols);
    setAisleCols(new Set(preset.aisleCols));
    setSpecialCells(generatePresetSpecialCells(preset.floors, preset.rows, preset.cols));
    setDisabledSeatIds(new Set());
    setBlockedSeatIds(new Set());
    setSeatCategories(new Map());
    setActiveFloor(0);
    setSelectedCellKey(null);
    setMovingCellKey(null);
    toast.success(`Preset "${preset.label}" aplicado.`);
  };

  const duplicateFloorLayout = (sourceFloor: number, targetFloor: number) => {
    if (sourceFloor === targetFloor) {
      toast.error('Seleccioná un piso distinto para duplicar.');
      return;
    }

    const nextSpecials = new Map(specialCells);
    for (const key of [...nextSpecials.keys()]) {
      if (key.startsWith(`${targetFloor}:`)) nextSpecials.delete(key);
    }
    for (const cell of specialCells.values()) {
      if (cell.floor === sourceFloor) {
        nextSpecials.set(cellKey(targetFloor, cell.row, cell.col), {
          ...cell,
          floor: targetFloor,
        });
      }
    }
    setSpecialCells(nextSpecials);

    const targetPrefix = `F${targetFloor}`;
    const nextDisabled = new Set([...disabledSeatIds].filter((seatId) => !seatId.startsWith(targetPrefix)));
    const nextBlocked = new Set([...blockedSeatIds].filter((seatId) => !seatId.startsWith(targetPrefix)));
    const nextCategories = new Map([...seatCategories].filter(([seatId]) => !seatId.startsWith(targetPrefix)));

    for (let row = 0; row < safeRows; row += 1) {
      for (let col = 0; col < safeCols; col += 1) {
        const sourceSeatId = seatIdFor(sourceFloor, row, col);
        const targetSeatId = seatIdFor(targetFloor, row, col);
        if (disabledSeatIds.has(sourceSeatId)) nextDisabled.add(targetSeatId);
        if (blockedSeatIds.has(sourceSeatId)) nextBlocked.add(targetSeatId);
        const sourceCategory = seatCategories.get(sourceSeatId);
        if (sourceCategory) nextCategories.set(targetSeatId, sourceCategory);
      }
    }

    setDisabledSeatIds(nextDisabled);
    setBlockedSeatIds(nextBlocked);
    setSeatCategories(nextCategories);
    setActiveFloor(targetFloor);
    setSelectedCellKey(null);
    setMovingCellKey(null);
    toast.success(`Piso ${sourceFloor + 1} duplicado en piso ${targetFloor + 1}.`);
  };

  const mirrorFloorLayout = (floor: number) => {
    const mirroredSpecials = new Map(specialCells);
    for (const key of [...mirroredSpecials.keys()]) {
      if (key.startsWith(`${floor}:`)) mirroredSpecials.delete(key);
    }
    for (const cell of specialCells.values()) {
      if (cell.floor === floor) {
        const mirroredCol = safeCols - 1 - cell.col;
        mirroredSpecials.set(cellKey(floor, cell.row, mirroredCol), {
          ...cell,
          col: mirroredCol,
        });
      }
    }

    const floorPrefix = `F${floor}`;
    const nextDisabled = new Set([...disabledSeatIds].filter((seatId) => !seatId.startsWith(floorPrefix)));
    const nextBlocked = new Set([...blockedSeatIds].filter((seatId) => !seatId.startsWith(floorPrefix)));
    const nextCategories = new Map([...seatCategories].filter(([seatId]) => !seatId.startsWith(floorPrefix)));

    for (let row = 0; row < safeRows; row += 1) {
      for (let col = 0; col < safeCols; col += 1) {
        const sourceSeatId = seatIdFor(floor, row, col);
        const targetSeatId = seatIdFor(floor, row, safeCols - 1 - col);
        if (disabledSeatIds.has(sourceSeatId)) nextDisabled.add(targetSeatId);
        if (blockedSeatIds.has(sourceSeatId)) nextBlocked.add(targetSeatId);
        const sourceCategory = seatCategories.get(sourceSeatId);
        if (sourceCategory) nextCategories.set(targetSeatId, sourceCategory);
      }
    }

    setSpecialCells(mirroredSpecials);
    setDisabledSeatIds(nextDisabled);
    setBlockedSeatIds(nextBlocked);
    setSeatCategories(nextCategories);
    if (selectedCell?.floor === floor) {
      setSelectedCellKey(cellKey(floor, selectedCell.row, safeCols - 1 - selectedCell.col));
    }
    setMovingCellKey(null);
    toast.success(`Piso ${floor + 1} espejado correctamente.`);
  };

  const persist = async () => {
    if (!user) {
      toast.error('Autenticación inválida');
      return;
    }
    if (!name.trim() || !busType.trim()) {
      toast.error('Completa el nombre y el tipo de micro.');
      return;
    }
    if (derived.seats.length === 0) {
      toast.error('La plantilla necesita al menos una butaca disponible.');
      return;
    }

    setSaving(true);
    try {
      const token = await user.getIdToken();
      const payload = {
        name: name.trim(),
        busType: busType.trim(),
        status: 'published' as const,
        floors: safeFloors,
        rows: safeRows,
        cols: safeCols,
        aisleCols: Array.from(aisleCols).sort((a, b) => a - b),
        startNumber: safeStartNumber,
        autoNumbering,
        showRowLabels,
        seats: derived.seats,
        specialCells: derived.specials,
        categoryPricing: {
          cocheCama: { amount: Math.max(0, Number(categoryPricing.cocheCama.amount) || 0) },
          panoramicos: { amount: Math.max(0, Number(categoryPricing.panoramicos.amount) || 0) },
          cafeteras: { amount: Math.max(0, Number(categoryPricing.cafeteras.amount) || 0) },
        },
        amenities: {
          cocheCama: { amount: Math.max(0, Number(categoryPricing.cocheCama.amount) || 0) },
          panoramicos: { amount: Math.max(0, Number(categoryPricing.panoramicos.amount) || 0) },
          cafeteras: { amount: Math.max(0, Number(categoryPricing.cafeteras.amount) || 0) },
        },
        notes: notes.trim() || undefined,
      };

      let createdId = initial?.id ?? '';

      if (initial?.id) {
        const res = await fetch('/api/admin/seat-layouts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: initial.id, data: payload }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'No pudimos guardar la plantilla.');
        }
      } else {
        const res = await fetch('/api/admin/seat-layouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'No pudimos crear la plantilla.');
        }
        const data = await res.json().catch(() => ({}));
        createdId = String(data?.id ?? '');
      }

      setStatus('published');
      toast.success(initial?.id ? 'Plantilla actualizada' : 'Plantilla creada');
      router.push('/admin/plantillas-micro');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No pudimos guardar la plantilla.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-[#DCEAF7] bg-white px-6 py-6 shadow-[0_18px_50px_rgba(8,46,86,0.08)]">
        <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-[#7B90A9]">
          <Link href="/admin" className="transition-colors hover:text-[#12325D]">Admin</Link>
          <ChevronRight className="h-4 w-4" />
          <Link href="/admin/plantillas-micro" className="transition-colors hover:text-[#12325D]">Plantillas de butacas</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-bold text-[#2BB8BF]">{initial?.id ? 'Editar plantilla' : 'Crear plantilla'}</span>
        </div>

        <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ECFAFF] shadow-[inset_0_0_0_1px_rgba(14,165,184,0.08)]">
              <BusFront className="h-6 w-6 text-[#1593B4]" />
            </div>
            <div>
              <h1 className="text-[18px] font-black tracking-[-0.03em] text-[#112B49] md:text-[20px]">
                {initial?.id ? 'Editar plantilla de butacas' : 'Crear plantilla de butacas'}
              </h1>
              <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#6B84A3]">
                Configura pisos, filas y columnas, y diseñá un mapa de asientos visual con la misma lógica del front.
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-[#E3EDF7] bg-[#F9FCFF] px-3 py-2 text-[12px] font-semibold text-[#607B9C]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
            {initial?.id && status === 'draft' ? 'Se publicará al guardar' : 'Guardado definitivo'}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-[#DCEAF7] bg-white p-5 shadow-[0_18px_48px_rgba(8,46,86,0.08)]">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#ECFAFF]">
                <PencilRuler className="h-5 w-5 text-[#2BB8BF]" />
              </div>
              <div>
                <div className="text-[17px] font-black tracking-[-0.02em] text-[#112B49]">Configuración de plantilla</div>
                <div className="text-[12px] text-[#7B90A9]">Definí estructura, numeración y comportamiento visual.</div>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-[12px] font-bold text-[#607B9C]">Preset de micro</Label>
                <div className="flex gap-2">
                  <Select value={presetId} onValueChange={setPresetId}>
                    <SelectTrigger className="h-11 rounded-2xl border-[#D8E7F5] bg-white text-[14px] font-semibold text-[#112B49]">
                      <SelectValue placeholder="Aplicar preset rápido" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-[#D8E7F5]">
                      {TEMPLATE_PRESETS.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id} className="rounded-xl text-[13px] font-medium text-[#12325D]">
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-2xl border-[#D6E5F4] px-4 text-[#12325D]"
                    onClick={() => applyPreset(presetId)}
                    disabled={!presetId}
                  >
                    Aplicar
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[12px] font-bold text-[#607B9C]">Nombre de plantilla</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Flechabus - Semicama 82"
                  className="h-11 rounded-2xl border-[#D8E7F5] bg-white text-[14px] font-semibold text-[#112B49]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[12px] font-bold text-[#607B9C]">Tipo de micro</Label>
                <Select value={busType} onValueChange={setBusType}>
                  <SelectTrigger className="h-11 rounded-2xl border-[#D8E7F5] bg-white text-[14px] font-semibold text-[#112B49]">
                    <SelectValue placeholder="Seleccioná un tipo" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-[#D8E7F5]">
                    {BUS_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option} className="rounded-xl text-[13px] font-medium text-[#12325D]">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <CounterField label="Pisos" value={safeFloors} min={1} max={3} onChange={setFloors} />
                <CounterField label="Filas por piso" value={safeRows} min={1} max={80} onChange={setRows} />
                <CounterField label="Columnas" value={safeCols} min={1} max={12} onChange={setCols} />
              </div>

              <div className="space-y-2">
                <Label className="text-[12px] font-bold text-[#607B9C]">Inicio de numeración</Label>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={safeStartNumber}
                  onChange={(e) => setStartNumber(Number(e.target.value))}
                  className="h-11 rounded-2xl border-[#D8E7F5] bg-white text-[14px] font-semibold text-[#112B49]"
                />
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-[24px] border border-[#E3EEF8] bg-[#FBFDFF] p-4">
              <ToggleRow
                title="Pasillo central"
                description="Insertá uno o más pasillos visuales entre columnas."
                checked={aisleCols.size > 0}
                onCheckedChange={setCentralAisle}
              />

              {aisleCols.size > 0 ? (
                <div className="pl-12">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8AA0BA]">Ubicación del pasillo</div>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: Math.max(0, safeCols - 1) }, (_, index) => index + 1).map((position) => (
                      <button
                        key={`aisle-position-${position}`}
                        type="button"
                        onClick={() => toggleAislePosition(position)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors',
                          aisleCols.has(position)
                            ? 'border-[#0BAFCB] bg-[#E9FBFF] text-[#0E879A]'
                            : 'border-[#D6E5F4] bg-white text-[#65809F] hover:border-[#B2D2EA]'
                        )}
                      >
                        Entre {position} y {position + 1}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <ToggleRow
                title="Numeración automática"
                description="Renumera todas las butacas desde el número inicial."
                checked={autoNumbering}
                onCheckedChange={setAutoNumbering}
              />
              <ToggleRow
                title="Mostrar letras de filas"
                description="Usa letras laterales para identificar las filas del micro."
                checked={showRowLabels}
                onCheckedChange={setShowRowLabels}
              />
            </div>

            <div className="mt-5 space-y-3 rounded-[24px] border border-[#E3EEF8] bg-[#FBFDFF] p-4">
              <div>
                <Label className="text-[12px] font-bold text-[#607B9C]">Valores por categoría de butaca</Label>
                <p className="mt-1 text-[11px] text-[#8AA0BA]">
                  Valor base por butaca seleccionada. El sistema lo toma automáticamente en reservas manuales y checkout.
                </p>
              </div>
              {(SEAT_CATEGORY_CODES as SeatCategoryCode[]).map((key) => (
                <div
                  key={key}
                  className="grid grid-cols-1 gap-3 rounded-2xl border border-[#DCEAF8] bg-white p-3 sm:grid-cols-[1fr_150px]"
                >
                  <div className="flex items-center gap-3 text-[13px] font-semibold text-[#12325D]">
                    {SEAT_CATEGORY_LABELS[key]}
                  </div>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={categoryPricing[key].amount}
                    onChange={(event) =>
                      setCategoryPricing((current) => ({
                        ...current,
                        [key]: {
                          amount: event.target.value,
                        },
                      }))
                    }
                    placeholder="0"
                    className="h-11 rounded-2xl border-[#D8E7F5] bg-white text-[14px] font-semibold text-[#112B49]"
                  />
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2">
              <Label className="text-[12px] font-bold text-[#607B9C]">Notas internas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Agregá comentarios internos sobre esta plantilla."
                className="min-h-[112px] rounded-2xl border-[#D8E7F5] bg-[#FBFDFF] text-[13px] text-[#12325D]"
              />
              <div className="text-right text-[11px] text-[#8AA0BA]">{notes.length}/1000</div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-2xl border-[#D6E5F4] px-5 text-[#12325D]"
                onClick={() => router.push('/admin/plantillas-micro')}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="h-11 rounded-2xl bg-[#F6C000] px-5 font-bold text-[#4D3700] hover:bg-[#E9B500]"
                onClick={() => void persist()}
                disabled={saving}
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Guardando...' : 'Guardar plantilla'}
              </Button>
            </div>
          </section>
        </div>

        <section className="rounded-[28px] border border-[#DCEAF7] bg-white p-5 shadow-[0_18px_48px_rgba(8,46,86,0.08)]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[17px] font-black tracking-[-0.02em] text-[#112B49]">Mapa de butacas</div>
                <div className="text-[12px] text-[#7B90A9]">
                  Diseñá el micro visualmente, como si estuvieras configurando el mapa real del front.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {TOOL_OPTIONS.map((tool) => (
                  <ToolButton key={tool.id} mode={tool} active={mode === tool.id} onClick={() => setMode(tool.id)} />
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-[#E3EEF8] bg-[#FBFDFF] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-[14px] font-black tracking-[-0.02em] text-[#112B49]">Categorías de butaca</div>
                  <div className="text-[12px] text-[#7B90A9]">
                    Elegí una categoría y hacé clic sobre una butaca para aplicarla en el mapa.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(SEAT_CATEGORY_CODES as SeatCategoryCode[]).map((code) => (
                    <ToolButton
                      key={code}
                      mode={{
                        label: SEAT_CATEGORY_LABELS[code],
                        accent: SEAT_CATEGORY_DEFINITIONS[code].accent,
                        activeAccent: SEAT_CATEGORY_DEFINITIONS[code].activeAccent,
                      }}
                      active={categoryBrush === code}
                      onClick={() => {
                        setMode('seat');
                        setCategoryBrush(code);
                      }}
                    />
                  ))}
                  <ToolButton
                    mode={{
                      label: 'Quitar',
                      Icon: Eraser,
                      accent: 'text-[#64748B]',
                      activeAccent: 'bg-[#64748B]',
                    }}
                    active={categoryBrush === 'clear'}
                    onClick={() => {
                      setMode('seat');
                      setCategoryBrush('clear');
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border-[#D6E5F4] text-[#12325D]"
                onClick={() => generateFloorBase(activeFloor)}
              >
                <Sparkles className="mr-2 h-4 w-4 text-[#10A7C7]" />
                Generar base
              </Button>
              {safeFloors > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl border-[#D6E5F4] text-[#12325D]"
                  onClick={() => duplicateFloorLayout(activeFloor, activeFloor === 0 ? 1 : 0)}
                >
                  <Copy className="mr-2 h-4 w-4 text-[#607B9C]" />
                  Duplicar a piso {activeFloor === 0 ? 2 : 1}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border-[#D6E5F4] text-[#12325D]"
                onClick={() => mirrorFloorLayout(activeFloor)}
              >
                <FlipHorizontal2 className="mr-2 h-4 w-4 text-[#607B9C]" />
                Espejar piso
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border-[#D6E5F4] text-[#12325D]"
                onClick={() => {
                  setAutoNumbering(true);
                  toast.success('Numeración automática activada.');
                }}
              >
                <LayoutGrid className="mr-2 h-4 w-4 text-[#607B9C]" />
                Renumerar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border-[#D6E5F4] text-[#12325D]"
                onClick={() => clearFloorCustomizations(activeFloor)}
              >
                <Eraser className="mr-2 h-4 w-4 text-[#607B9C]" />
                Limpiar piso
              </Button>
              {movingCellKey ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-xl border-[#F4D4D9] bg-[#FFF6F8] text-[#C04D69]"
                  onClick={() => setMovingCellKey(null)}
                >
                  Cancelar movimiento
                </Button>
              ) : null}
            </div>

            <div className="border-b border-[#E4EEF7]">
              <div className="flex flex-wrap gap-6">
                {Array.from({ length: safeFloors }, (_, floor) => (
                  <button
                    key={`tab-floor-${floor}`}
                    type="button"
                    onClick={() => setActiveFloor(floor)}
                    className={cn(
                      'border-b-2 px-2 pb-3 text-[13px] font-black transition-colors',
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

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-[28px] border border-[#E3EDF7] bg-[linear-gradient(180deg,#FBFEFF_0%,#F4FAFF_100%)] px-4 py-5 sm:px-6">
                <div className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7C95AE]">
                  Frente del vehículo
                </div>
                <div className="mt-2 flex justify-center">
                  <svg width="320" height="30" viewBox="0 0 320 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 22C90 5 230 5 300 22" stroke="#BED8EE" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                </div>

                <div className="mt-3 overflow-x-auto pb-2">
                  <div className="mx-auto flex w-fit items-start gap-4">
                    {showRowLabels ? (
                      <div className="pt-[96px]">
                        <div className="space-y-2.5">
                          {Array.from({ length: safeRows }, (_, row) => (
                            <div
                              key={`row-label-${row}`}
                              className="flex h-12 w-6 items-center justify-center text-[12px] font-black text-[#1A93B7]"
                            >
                              {getRowLetter(row)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="relative rounded-[36px] border border-[#C8D7E6] bg-[linear-gradient(180deg,#E3E5E9_0%,#F7F9FC_20%,#E8EBEF_100%)] p-[8px] shadow-[0_18px_34px_rgba(15,23,42,0.14)]">
                      <div className="absolute inset-x-3 top-3 h-12 rounded-[999px] bg-[linear-gradient(180deg,#575C63_0%,#B8BEC6_100%)] opacity-20 blur-[1px]" />
                      <div className="relative rounded-[30px] border border-[#AEBCCB] bg-[linear-gradient(180deg,#ECEFF3_0%,#FFFFFF_18%,#F0F3F7_100%)] px-4 pb-4 pt-5">
                        <div className="mx-auto mb-4 flex h-[58px] w-[78%] items-center justify-center rounded-[999px] border border-[#AEBCCB] bg-[linear-gradient(180deg,#D3D7DD_0%,#F9FBFD_100%)] shadow-[inset_0_2px_6px_rgba(255,255,255,0.9)]">
                          <div className="grid w-[74%] grid-cols-2 gap-2">
                            <div className="h-5 rounded-full bg-[#C7CDD5]" />
                            <div className="h-5 rounded-full bg-[#C7CDD5]" />
                          </div>
                        </div>

                        <div className="space-y-2.5">
                          {Array.from({ length: safeRows }, (_, row) => (
                            <div
                              key={`floor-${activeFloor}-row-${row}`}
                              className="grid items-center gap-2.5"
                              style={{ gridTemplateColumns: displayColumns.map((item) => item.kind === 'aisle' ? '18px' : 'minmax(52px,1fr)').join(' ') }}
                            >
                              {displayColumns.map((column) => {
                                if (column.kind === 'aisle') {
                                  return (
                                    <div key={column.key} className="flex justify-center">
                                      <div className="h-12 w-[10px] rounded-full bg-[linear-gradient(180deg,#E5EDF6_0%,#D6E1EE_100%)]" />
                                    </div>
                                  );
                                }

                                const key = cellKey(activeFloor, row, column.col);
                                const seat = seatsByCell.get(key);
                                const special = specialCells.get(key);
                                const isSelected = selectedCellKey === key;
                                const isMoveTarget = movingCellKey ? movingCellKey !== key && dragOverCellKey === key : false;
                                const isMovingSource = movingCellKey === key;
                                const dragSource = draggingCellKey === key;

                                return (
                                  <SeatTemplateCell
                                    key={key}
                                    row={row}
                                    seat={seat}
                                    special={special}
                                    isSelected={isSelected}
                                    isMovingSource={isMovingSource}
                                    isMoveTarget={isMoveTarget}
                                    isDragSource={dragSource}
                                    onClick={() => handleCellClick(activeFloor, row, column.col)}
                                    onDragStart={() => {
                                      if (special) setDraggingCellKey(key);
                                    }}
                                    onDragEnd={() => {
                                      setDraggingCellKey(null);
                                      setDragOverCellKey(null);
                                    }}
                                    onDragOver={() => {
                                      if (draggingCellKey) setDragOverCellKey(key);
                                    }}
                                    onDrop={() => {
                                      if (draggingCellKey) moveSpecial(draggingCellKey, key);
                                      setDraggingCellKey(null);
                                      setDragOverCellKey(null);
                                    }}
                                  />
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-[#E3EDF7] bg-white p-4 shadow-[0_10px_30px_rgba(8,46,86,0.06)]">
                  <div className="flex items-center justify-between">
                    <div className="text-[14px] font-black tracking-[-0.02em] text-[#112B49]">Celda seleccionada</div>
                    {selectedCell ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCellKey(null);
                          setMovingCellKey(null);
                        }}
                        className="text-[#7E94AC] transition-colors hover:text-[#12325D]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  {selectedCell ? (
                    <div className="mt-4 space-y-3 text-[13px] text-[#5E7898]">
                      <InspectorRow label="Tipo">
                        <span className={cn(
                          'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold',
                          selectedSpecial
                            ? getSpecialBadgeClass(selectedSpecial.type)
                            : selectedSeat?.defaultBlocked
                              ? 'border-[#F4D4D9] bg-[#FFF6F8] text-[#D24A6A]'
                              : selectedSeat?.disabled
                                ? 'border-[#D8E2EC] bg-[#F6FAFD] text-[#6B819A]'
                                : 'border-[#BFE9F0] bg-[#ECFCFF] text-[#0D90A7]'
                        )}>
                          {selectedSpecial ? getSpecialLabel(selectedSpecial.type) : 'Asiento'}
                        </span>
                      </InspectorRow>
                      <InspectorRow label="Estado">
                        <span className="font-semibold text-[#12325D]">
                          {selectedSpecial
                            ? 'Elemento especial'
                            : selectedSeat?.defaultBlocked
                              ? 'Bloqueado'
                              : selectedSeat?.disabled
                                ? 'Deshabilitado'
                                : 'Disponible'}
                        </span>
                      </InspectorRow>
                      <InspectorRow label="Número">
                        <span className="font-semibold text-[#12325D]">{selectedSeat?.label ?? '—'}</span>
                      </InspectorRow>
                      <InspectorRow label="Fila">
                        <span className="font-semibold text-[#12325D]">{getRowLetter(selectedCell.row)}</span>
                      </InspectorRow>
                      <InspectorRow label="Columna">
                        <span className="font-semibold text-[#12325D]">{getColumnSide(selectedCell.col, safeCols, Array.from(aisleCols))}</span>
                      </InspectorRow>
                      <InspectorRow label="Piso">
                        <span className="font-semibold text-[#12325D]">Piso {selectedCell.floor + 1}</span>
                      </InspectorRow>
                      {!selectedSpecial ? (
                        <div className="space-y-2 rounded-2xl border border-[#E6EEF7] bg-[#FBFDFF] p-3">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8AA0BA]">Categoría aplicada</div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-[#12325D]">
                              {selectedSeat?.category ? SEAT_CATEGORY_LABELS[selectedSeat.category] : 'No asignada'}
                            </span>
                            {selectedSeat?.category ? (
                              <button
                                type="button"
                                onClick={() => clearSeatCategory(selectedSeat.seatId)}
                                className="text-[11px] font-semibold text-[#607B9C] transition-colors hover:text-[#12325D]"
                              >
                                Limpiar
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {selectedSpecial ? (
                        <div className="pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 w-full rounded-xl border-[#CFE0F0] text-[#12325D]"
                            onClick={() => setMovingCellKey(cellKey(selectedCell.floor, selectedCell.row, selectedCell.col))}
                          >
                            Mover elemento
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-[#D6E5F4] bg-[#FBFDFF] px-4 py-6 text-center text-[13px] text-[#7B90A9]">
                      Seleccioná una celda del micro para inspeccionarla o editarla.
                    </div>
                  )}
                </div>

                <div className="rounded-[24px] border border-[#E3EDF7] bg-white p-4 shadow-[0_10px_30px_rgba(8,46,86,0.06)]">
                  <div className="text-[14px] font-black tracking-[-0.02em] text-[#112B49]">Resumen del piso</div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <StatPill label="Butacas" value={String(derived.seats.filter((seat) => seat.floor === activeFloor).length)} accent="text-[#0E90A8]" />
                    <StatPill label="Especiales" value={String(activeFloorSpecials.length)} accent="text-[#7B61FF]" />
                    <StatPill label="Bloqueadas" value={String(derived.seats.filter((seat) => seat.floor === activeFloor && seat.defaultBlocked).length)} accent="text-[#D24A6A]" />
                    <StatPill label="Baños" value={String(activeFloorSpecials.filter((item) => item.type === 'wc').length)} accent="text-[#3C7EFF]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-[24px] border border-[#E4EEF7] bg-[#FBFDFF] p-4 sm:grid-cols-2 xl:grid-cols-6">
              <MiniStatCard label="Total butacas" value={String(stats.total)} helper="Disponibles para vender" accent="text-[#0E90A8]" />
              <MiniStatCard label="Operativas" value={String(stats.available)} helper="Butacas activas" accent="text-[#10B981]" />
              <MiniStatCard label="Deshabilitadas" value={String(stats.disabled)} helper="No comercializables" accent="text-[#64748B]" />
              <MiniStatCard label="Bloqueadas" value={String(stats.blocked)} helper="Restringidas por defecto" accent="text-[#EF476F]" />
              <MiniStatCard label="Baños" value={String(stats.wc)} helper="Reubicables" accent="text-[#4C8BFF]" />
              <MiniStatCard label="Escaleras / chofer" value={`${stats.stairs + stats.drivers}`} helper="Componentes especiales" accent="text-[#8B5CF6]" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-[#E7EFF7] bg-white px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-2xl bg-[#F1FAFF] text-[#2BB8BF]">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[13px] font-black tracking-[-0.01em] text-[#12325D]">{title}</div>
          <div className="text-[11px] leading-4 text-[#7B90A9]">{description}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SeatTemplateCell({
  row,
  seat,
  special,
  isSelected,
  isMovingSource,
  isMoveTarget,
  isDragSource,
  onClick,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  row: number;
  seat?: { label: string; category?: SeatCategoryCode | null; disabled?: boolean; defaultBlocked?: boolean } | null;
  special?: SeatLayoutSpecialCell | null;
  isSelected: boolean;
  isMovingSource: boolean;
  isMoveTarget: boolean;
  isDragSource: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
}) {
  const rowLabel = getRowLetter(row);
  const label = special ? getSpecialLabel(special.type) : seat?.label ?? '';
  const subtitle = special ? '' : rowLabel;
  const categoryDefinition = seat?.category ? SEAT_CATEGORY_DEFINITIONS[seat.category] : null;

  const classes = special
    ? special.type === 'driver'
      ? 'border-[#F7C768] bg-[linear-gradient(180deg,#FFF7E7_0%,#FFF0CF_100%)] text-[#C87B06]'
      : special.type === 'wc'
        ? 'border-[#AFC9FF] bg-[linear-gradient(180deg,#F7FAFF_0%,#EAF1FF_100%)] text-[#3B73F5]'
        : special.type === 'stairs'
          ? 'border-[#D7C7FF] bg-[linear-gradient(180deg,#FAF7FF_0%,#F1EBFF_100%)] text-[#855CF6]'
          : 'border-[#D5DFEA] bg-[linear-gradient(180deg,#FBFCFE_0%,#F3F6F9_100%)] text-[#70839E]'
    : seat?.defaultBlocked
      ? 'border-[#F4C2CC] bg-[linear-gradient(180deg,#FFF6F8_0%,#FFE8ED_100%)] text-[#D84667]'
      : seat?.disabled
        ? 'border-[#D8E1EB] bg-[linear-gradient(180deg,#F8FBFE_0%,#F1F5F9_100%)] text-[#7B8EA5]'
        : categoryDefinition
          ? `${categoryDefinition.surfaceClass} hover:brightness-[0.98]`
          : 'border-[#A6DDE7] bg-[linear-gradient(180deg,#FFFFFF_0%,#F3FEFF_100%)] text-[#128CAA] hover:border-[#0BAFCB]';

  return (
    <button
      type="button"
      draggable={Boolean(special)}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (!special) {
          event.preventDefault();
          onDragOver();
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
      className={cn(
        'relative flex h-12 min-w-[52px] items-center justify-center rounded-xl border text-center transition-all',
        classes,
        isSelected && 'ring-2 ring-[#0BAFCB] ring-offset-2 ring-offset-[#F6FBFF]',
        isMovingSource && 'scale-[0.98] ring-2 ring-[#F59E0B] ring-offset-2 ring-offset-[#F6FBFF]',
        isMoveTarget && 'ring-2 ring-[#8B5CF6] ring-offset-2 ring-offset-[#F6FBFF]',
        isDragSource && 'opacity-70'
      )}
    >
      <div className="flex flex-col items-center leading-none">
        <span className={cn('text-[11px] font-black tracking-[-0.02em]', special ? '' : 'text-[12px]')}>{label}</span>
        {!special && subtitle ? <span className="mt-0.5 text-[9px] font-semibold text-current/60">{subtitle}</span> : null}
      </div>
      {!special && categoryDefinition ? (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-white/75 px-1.5 py-0.5 text-[8px] font-black tracking-[0.08em] text-current">
          {categoryDefinition.shortLabel}
        </span>
      ) : null}
      {!special && !seat?.disabled && !seat?.defaultBlocked ? (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#0BAFCB]" />
      ) : null}
      {isSelected ? (
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-[0_4px_10px_rgba(8,46,86,0.16)]">
          <Check className="h-3 w-3 text-[#0BAFCB]" />
        </span>
      ) : null}
    </button>
  );
}

function InspectorRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8AA0BA]">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-[#E6EEF7] bg-[#FBFDFF] px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8AA0BA]">{label}</div>
      <div className={cn('mt-1 text-[18px] font-black tracking-[-0.03em]', accent)}>{value}</div>
    </div>
  );
}

function MiniStatCard({
  label,
  value,
  helper,
  accent,
}: {
  label: string;
  value: string;
  helper: string;
  accent: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#E4EEF7] bg-white px-4 py-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8AA0BA]">{label}</div>
      <div className={cn('mt-1 text-[24px] font-black tracking-[-0.04em]', accent)}>{value}</div>
      <div className="mt-1 text-[12px] text-[#7B90A9]">{helper}</div>
    </div>
  );
}

function PassengerSeatPreview({
  floor,
  cols,
  rows,
  aisleCols,
  seats,
  specialCells,
}: {
  floor: number;
  cols: number;
  rows: number;
  aisleCols: number[];
  seats: Array<{ floor: number; row: number; col: number; label: string; disabled?: boolean; defaultBlocked?: boolean }>;
  specialCells: SeatLayoutSpecialCell[];
}) {
  const displayColumns = getDisplayColumns(cols, aisleCols);
  const seatMap = useMemo(() => {
    const map = new Map<string, (typeof seats)[number]>();
    for (const seat of seats) {
      map.set(cellKey(seat.floor, seat.row, seat.col), seat);
    }
    return map;
  }, [seats]);
  const specialMap = useMemo(() => {
    const map = new Map<string, SeatLayoutSpecialCell>();
    for (const cell of specialCells) {
      map.set(cellKey(cell.floor, cell.row, cell.col), cell);
    }
    return map;
  }, [specialCells]);

  return (
    <div className="rounded-2xl border border-[#DCEAF8] bg-[#FCFEFF] p-4">
      <div className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7C95AE]">Piso {floor + 1} · Vista pasajero</div>
      <div className="mt-2 flex justify-center">
        <svg width="220" height="18" viewBox="0 0 220 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 14C50 4 170 4 212 14" stroke="#BFD8EE" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <div className="mt-3 overflow-x-auto">
        <div className="mx-auto w-fit space-y-2">
          {Array.from({ length: rows }, (_, row) => (
            <div
              key={`preview-passenger-row-${row}`}
              className="grid items-center gap-2"
              style={{ gridTemplateColumns: `20px ${displayColumns.map((item) => item.kind === 'aisle' ? '12px' : '40px').join(' ')}` }}
            >
              <div className="text-center text-[10px] font-bold text-[#7B90A9]">{getRowLetter(row)}</div>
              {displayColumns.map((column) => {
                if (column.kind === 'aisle') {
                  return <div key={column.key} className="mx-auto h-9 w-[7px] rounded-full bg-[#E0EAF4]" />;
                }
                const key = cellKey(floor, row, column.col);
                const seat = seatMap.get(key);
                const special = specialMap.get(key);
                const className = special
                  ? special.type === 'wc'
                    ? 'border-[#BFD6FF] bg-[#F4F8FF] text-[#3B73F5]'
                    : special.type === 'stairs'
                      ? 'border-[#D8C9FF] bg-[#F8F4FF] text-[#855CF6]'
                      : special.type === 'driver'
                        ? 'border-[#F8D7A5] bg-[#FFF8EC] text-[#CA7A03]'
                        : 'border-[#D6E1EC] bg-[#F8FBFE] text-[#70839E]'
                  : seat?.defaultBlocked
                    ? 'border-[#F4D4D9] bg-[#FFF6F8] text-[#D24A6A]'
                    : seat?.disabled
                      ? 'border-[#D8E1EB] bg-[#F6FAFD] text-[#7B8EA5]'
                      : 'border-[#D9E8F7] bg-white text-[#334E71]';
                const label = special ? (special.type === 'wc' ? 'B' : special.type === 'stairs' ? 'E' : special.type === 'driver' ? 'C' : '') : seat?.label ?? '';
                return (
                  <div
                    key={key}
                    className={cn('flex h-9 w-10 items-center justify-center rounded-xl border text-[10px] font-black', className)}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
