'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import {
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Pencil,
  Plus,
  Route,
  Save,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FormattedAmountInput } from '@/components/ui/formatted-amount-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { PickupPointItem, ReservationPricingConfig, Salida, SeatLayoutTemplate } from '@/types';

type TemplateOption = Pick<SeatLayoutTemplate, 'id' | 'name' | 'busType' | 'floors' | 'rows' | 'cols' | 'seats' | 'specialCells' | 'aisleCols'>;

type Props = {
  salidas: Salida[];
  onSalidasChange: (salidas: Salida[]) => void;
  pickupPoints: PickupPointItem[];
  onPickupPointsChange: (items: PickupPointItem[]) => void;
  seatSelectionEnabled: boolean;
  onSeatSelectionEnabledChange: (value: boolean) => void;
  seatLayoutId: string;
  onSeatLayoutIdChange: (value: string) => void;
  fechaVencimiento: string;
  onFechaVencimientoChange: (value: string) => void;
  reservationPricing: ReservationPricingConfig | null;
  onReservationPricingChange: (value: ReservationPricingConfig | null) => void;
};

type SalidaDraft = {
  fecha: string;
  fechaVuelta: string;
  ciudadSalida: string;
  precio: number;
  moneda: 'ARS';
  cupo?: number;
  observaciones: string;
  seatSelectionEnabled: boolean;
  seatLayoutId: string;
};

const EMPTY_DRAFT: SalidaDraft = {
  fecha: '',
  fechaVuelta: '',
  ciudadSalida: '',
  precio: 0,
  moneda: 'ARS',
  cupo: undefined,
  observaciones: '',
  seatSelectionEnabled: false,
  seatLayoutId: '',
};

function formatShortDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value || 'Sin fecha';
  return parsed.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatLongDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value || 'Sin fecha';
  return parsed.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatArDateValue(value: string) {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function parseArDateValue(value: string): string | null {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : trimmed;
  }
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, dayRaw, monthRaw, yearRaw] = match;
  const day = Number(dayRaw);
  const month = Number(monthRaw);
  const year = Number(yearRaw);
  if (!day || !month || !year || month > 12 || day > 31) return null;
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return iso;
}

function ArgentineDateInput({
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(formatArDateValue(value));

  useEffect(() => {
    setDraft(formatArDateValue(value));
  }, [value]);

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        const parsed = parseArDateValue(next);
        if (parsed !== null) {
          onChange(parsed);
        }
      }}
      onBlur={() => {
        const parsed = parseArDateValue(draft);
        if (parsed === null) {
          setDraft(formatArDateValue(value));
          return;
        }
        setDraft(formatArDateValue(parsed));
        onChange(parsed);
      }}
      placeholder={placeholder}
      className={className}
    />
  );
}

function makeSalidaId() {
  return `salida-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function seatCapacityFromTemplate(template?: TemplateOption | null) {
  if (!template) return null;
  return (template.seats ?? []).filter((seat) => !seat.disabled && !seat.defaultBlocked).length;
}

function sanitizeSalida(id: string, draft: SalidaDraft): Salida {
  const fecha = draft.fecha.trim();
  const fechaVuelta = draft.fechaVuelta.trim() || fecha;
  return {
    id,
    fecha,
    fechaVuelta,
    ciudadSalida: '',
    precio: Number(draft.precio) || 0,
    moneda: 'ARS',
    observaciones: draft.observaciones.trim() || '',
    ...(draft.cupo && draft.cupo > 0 ? { cupo: Number(draft.cupo) } : {}),
    seatSelectionEnabled: Boolean(draft.seatSelectionEnabled),
    seatLayoutId: draft.seatSelectionEnabled ? draft.seatLayoutId.trim() : '',
  };
}

function draftFromSalida(salida: Salida, packageSeatsEnabled: boolean, packageLayoutId: string): SalidaDraft {
  const fecha = salida.fecha ?? '';
  return {
    fecha,
    fechaVuelta: salida.fechaVuelta ?? fecha,
    ciudadSalida: '',
    precio: Number(salida.precio) || 0,
    moneda: 'ARS',
    cupo: salida.cupo,
    observaciones: salida.observaciones ?? '',
    seatSelectionEnabled: salida.seatSelectionEnabled ?? packageSeatsEnabled,
    seatLayoutId: salida.seatLayoutId ?? packageLayoutId ?? '',
  };
}

function SummaryPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'teal' | 'amber' | 'violet' | 'slate';
}) {
  const accentClass =
    accent === 'teal'
      ? 'text-[#0B9FB6]'
      : accent === 'amber'
        ? 'text-[#C87A00]'
        : accent === 'violet'
          ? 'text-[#7B57F2]'
          : 'text-[#12325D]';

  return (
    <div className="rounded-[10px] bg-[#F6F9FC] px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#7B93AE]">{label}</div>
      <div className={cn('mt-1 text-[12px] font-semibold tracking-[-0.01em]', accentClass)}>{value}</div>
    </div>
  );
}

export default function PackageAvailabilityStudio({
  salidas,
  onSalidasChange,
  pickupPoints,
  onPickupPointsChange,
  seatSelectionEnabled,
  onSeatSelectionEnabledChange,
  seatLayoutId,
  onSeatLayoutIdChange,
  fechaVencimiento,
  onFechaVencimientoChange,
  reservationPricing,
  onReservationPricingChange,
}: Props) {
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(salidas.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showSeatOverrides, setShowSeatOverrides] = useState(false);
  const [draft, setDraft] = useState<SalidaDraft>({
    ...EMPTY_DRAFT,
    seatSelectionEnabled,
    seatLayoutId,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingTemplates(true);
      try {
        const ref = collection(db, 'seatLayouts');
        const q = query(ref, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const items = snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as TemplateOption))
          .filter((item) => Boolean(item.id) && Boolean(item.name));
        if (!cancelled) setTemplates(items);
      } catch {
        if (!cancelled) setTemplates([]);
      } finally {
        if (!cancelled) setLoadingTemplates(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (editingId) return;
    setDraft((prev) => ({
      ...prev,
      seatSelectionEnabled,
      seatLayoutId: seatSelectionEnabled ? (prev.seatLayoutId || seatLayoutId) : '',
    }));
  }, [editingId, seatLayoutId, seatSelectionEnabled]);

  const packageTemplate = useMemo(
    () => templates.find((template) => template.id === seatLayoutId) ?? null,
    [seatLayoutId, templates]
  );
  const packageSeatCapacity = seatCapacityFromTemplate(packageTemplate);

  const sortedSalidas = useMemo(
    () => [...salidas].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()),
    [salidas]
  );

  const draftTemplate = useMemo(
    () => templates.find((template) => template.id === draft.seatLayoutId) ?? null,
    [draft.seatLayoutId, templates]
  );
  const draftSeatCapacity = seatCapacityFromTemplate(draftTemplate);

  const totalConfiguredCapacity = useMemo(() => {
    return sortedSalidas.reduce((acc, salida) => acc + Math.max(0, Number(salida.cupo ?? 0) || 0), 0);
  }, [sortedSalidas]);

  const totalSellableSeats = useMemo(() => {
    return sortedSalidas.reduce((acc, salida) => {
      if (!salida.seatSelectionEnabled || !salida.seatLayoutId) return acc;
      const template = templates.find((item) => item.id === salida.seatLayoutId);
      return acc + (seatCapacityFromTemplate(template) ?? 0);
    }, 0);
  }, [sortedSalidas, templates]);

  const resetComposer = () => {
    setDraft({
      ...EMPTY_DRAFT,
      seatSelectionEnabled,
      seatLayoutId: seatSelectionEnabled ? seatLayoutId : '',
    });
    setEditingId(null);
    setShowSeatOverrides(false);
  };

  const startNewSalida = () => {
    resetComposer();
    setIsComposerOpen(true);
  };

  const startEditSalida = (salida: Salida) => {
    setDraft(draftFromSalida(salida, seatSelectionEnabled, seatLayoutId));
    setEditingId(salida.id);
    setIsComposerOpen(true);
    const needsOverride =
      Boolean(salida.seatSelectionEnabled) !== Boolean(seatSelectionEnabled) ||
      (Boolean(salida.seatSelectionEnabled) &&
        Boolean(seatSelectionEnabled) &&
        Boolean(salida.seatLayoutId) &&
        String(salida.seatLayoutId) !== String(seatLayoutId));
    setShowSeatOverrides(needsOverride);
  };

  const duplicateSalida = (salida: Salida) => {
    const copy = {
      ...salida,
      id: makeSalidaId(),
      fecha: '',
      fechaVuelta: '',
    };
    onSalidasChange([...salidas, copy]);
    toast.success('Fecha duplicada. Solo falta definir la nueva fecha.');
  };

  const deleteSalida = (id: string) => {
    const confirmed = confirm('¿Eliminar esta fecha del paquete?');
    if (!confirmed) return;
    onSalidasChange(salidas.filter((salida) => salida.id !== id));
    if (editingId === id) resetComposer();
    toast.success('Fecha eliminada.');
  };

  const syncDraftWithPackageTemplate = () => {
    if (!seatSelectionEnabled || !seatLayoutId) {
      toast.error('Primero activá los asientos y elegí un mapa para el paquete.');
      return;
    }
    setDraft((prev) => ({
      ...prev,
      seatSelectionEnabled: true,
      seatLayoutId,
      ...(packageSeatCapacity && (!prev.cupo || prev.cupo <= 0) ? { cupo: packageSeatCapacity } : {}),
    }));
  };

  const saveSalida = () => {
    if (!draft.fecha) {
      toast.error('La fecha necesita un valor válido.');
      return;
    }
    if ((Number(draft.precio) || 0) <= 0) {
      toast.error('La fecha necesita un precio válido.');
      return;
    }
    if (draft.seatSelectionEnabled && !draft.seatLayoutId) {
      toast.error('Seleccioná un mapa de asientos para habilitar asientos.');
      return;
    }

    const nextSalida = sanitizeSalida(editingId ?? makeSalidaId(), draft);
    const next = editingId
      ? salidas.map((salida) => (salida.id === editingId ? nextSalida : salida))
      : [...salidas, nextSalida];

    onSalidasChange(next);
    resetComposer();
    setIsComposerOpen(false);
    toast.success(editingId ? 'Fecha actualizada.' : 'Fecha agregada al paquete.');
  };

  return (
    <div className="space-y-5">
      <div className="border-b border-[#E7EDF4] pb-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[13px] font-bold tracking-[-0.01em] text-[#0A2545]">Fechas</div>
            <div className="mt-1 text-[12px] text-[#6883A0]">Organizá cupos, vigencia y salidas del paquete desde una cabecera más limpia.</div>
          </div>
          <Button type="button" onClick={startNewSalida} className="h-10 rounded-[10px] bg-[#0E9EB6] px-4 text-white hover:bg-[#0C8CA1]">
            <Plus className="mr-2 h-4 w-4" />
            Nueva fecha
          </Button>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          <SummaryPill label="Fechas activas" value={String(sortedSalidas.length)} accent="teal" />
          <SummaryPill label="Cupo total" value={totalConfiguredCapacity > 0 ? String(totalConfiguredCapacity) : 'Sin límite'} accent="amber" />
          <SummaryPill label="Vencimiento" value={fechaVencimiento ? formatShortDate(fechaVencimiento) : 'Sin fecha'} accent="slate" />
        </div>
      </div>

      <div className={isComposerOpen ? 'flex flex-col gap-4' : 'hidden'}>
        <div className="space-y-4">
          <div className="">
            <div>
              <div className="text-[13px] font-bold tracking-[-0.01em] text-[#0A2545]">Reserva y vigencia</div>
              <div className="mt-1 text-[12px] text-[#6883A0]">Organizá la vigencia y la forma de cobro con una estructura más clara y rápida de editar.</div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[12px] bg-[#F7FAFC] p-4">
                <div className="text-[12px] font-semibold text-[#12325D]">Vigencia</div>
                <div className="mt-3 space-y-3">
                  <div>
                    <Label className="text-[12px] font-semibold text-[#607B9C]">Disponible hasta (opcional)</Label>
                    <ArgentineDateInput
                      value={fechaVencimiento}
                      onChange={onFechaVencimientoChange}
                      className="mt-2 h-10 rounded-[10px] border-[#D8E3EE] bg-white"
                    />
                    <div className="mt-2 text-[11px] text-[#6B86A4]">
                      {fechaVencimiento
                        ? `Disponible hasta el ${formatShortDate(fechaVencimiento)}`
                        : 'Dejalo vacío si el paquete no necesita fecha límite de venta.'}
                    </div>
                  </div>

                  <div className="rounded-[10px] bg-white px-3 py-2.5 text-[11px] leading-5 text-[#607B9C]">
                    La vigencia aplica a todas las fechas cargadas del paquete.
                  </div>
                </div>
              </div>

              <div className="rounded-[12px] bg-[#F7FAFC] p-4">
                <div className="text-[12px] font-semibold text-[#12325D]">Reserva</div>
                <div className="mt-3 space-y-3">
                  <div>
                    <Label className="text-[12px] font-semibold text-[#607B9C]">Cómo querés cobrarla</Label>
                    <Select
                      value={reservationPricing?.mode ?? 'auto'}
                      onValueChange={(value) => {
                        if (value === 'auto') {
                          onReservationPricingChange(null);
                          return;
                        }
                        if (value === 'fixed') {
                          onReservationPricingChange({
                            mode: 'fixed',
                            fixedUnitAmount: reservationPricing?.fixedUnitAmount ?? null,
                            allowCustomPercent: false,
                            single: null,
                            group: null,
                          });
                          return;
                        }
                        onReservationPricingChange({
                          mode: 'percent',
                          fixedUnitAmount: null,
                          allowCustomPercent: Boolean(reservationPricing?.allowCustomPercent),
                          single: reservationPricing?.single ?? { adultPercent: 40, minorPercent: null },
                          group: reservationPricing?.group ?? { adultPercent: 30, minorPercent: null },
                        });
                      }}
                    >
                      <SelectTrigger type="button" className="mt-2 h-10 rounded-[10px] border-[#D8E3EE] bg-white text-[#12325D]">
                        <SelectValue placeholder="Seleccioná una opción" />
                      </SelectTrigger>
                      <SelectContent className="rounded-[10px] border-[#D8E3EE]">
                        <SelectItem value="auto" className="rounded-[8px]">
                          Igual al precio de la fecha
                        </SelectItem>
                        <SelectItem value="fixed" className="rounded-[8px]">
                          Un valor fijo por persona
                        </SelectItem>
                        <SelectItem value="percent" className="rounded-[8px]">
                          Un porcentaje del precio
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(reservationPricing?.mode ?? 'auto') === 'auto' ? (
                    <div className="rounded-[10px] bg-white px-3 py-2.5 text-[12px] leading-5 text-[#607B9C]">
                      La reserva toma automáticamente el mismo valor que tenga cargado la fecha.
                    </div>
                  ) : null}

                  {reservationPricing?.mode === 'fixed' ? (
                    <div className="grid gap-3 rounded-[10px] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                      <div className="space-y-1">
                        <Label className="text-[12px] font-semibold text-[#607B9C]">Valor de la reserva</Label>
                        <FormattedAmountInput
                          value={Number(reservationPricing.fixedUnitAmount ?? 0) || 0}
                          onChange={(value) =>
                            onReservationPricingChange({
                              ...reservationPricing,
                              fixedUnitAmount: Math.max(0, Number(value) || 0),
                            })
                          }
                          className="mt-2 h-10 rounded-[10px] border-[#D8E3EE]"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[12px] font-semibold text-[#607B9C]">Moneda</Label>
                        <div className="mt-2 flex h-10 items-center rounded-[10px] border border-[#D8E3EE] bg-white px-3 text-[12px] font-semibold text-[#12325D]">
                          ARS
                        </div>
                      </div>
                      <div className="sm:col-span-2 text-[11px] text-[#6B86A4]">Se cobra por persona y queda guardado en pesos argentinos.</div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {reservationPricing?.mode === 'percent' ? (
              <div className="mt-4 rounded-[12px] bg-[#F7FAFC] p-4">
                <div className="text-[12px] font-semibold text-[#12325D]">Reglas por porcentaje</div>
                <div className="mt-1 text-[11px] text-[#6B86A4]">El porcentaje se calcula siempre sobre el precio base de la fecha.</div>

                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  <div className="space-y-2 rounded-[10px] bg-white p-3">
                    <div className="text-[12px] font-semibold text-[#607B9C]">Si compra 1 persona</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-[#607B9C]">Adulto (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={Number(reservationPricing.single?.adultPercent ?? 0) || 0}
                          onChange={(e) =>
                            onReservationPricingChange({
                              ...reservationPricing,
                              single: {
                                adultPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                                minorPercent: reservationPricing.single?.minorPercent ?? null,
                              },
                            })
                          }
                          className="h-10 rounded-[10px] border-[#D8E3EE]"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-[#607B9C]">Menor (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={Number(reservationPricing.single?.minorPercent ?? '') as any}
                          onChange={(e) =>
                            onReservationPricingChange({
                              ...reservationPricing,
                              single: {
                                adultPercent: Number(reservationPricing.single?.adultPercent ?? 0) || 0,
                                minorPercent: e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                              },
                            })
                          }
                          placeholder="Opcional"
                          className="h-10 rounded-[10px] border-[#D8E3EE]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-[10px] bg-white p-3">
                    <div className="text-[12px] font-semibold text-[#607B9C]">Si compra 2 o más</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-[#607B9C]">Adulto (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={Number(reservationPricing.group?.adultPercent ?? 0) || 0}
                          onChange={(e) =>
                            onReservationPricingChange({
                              ...reservationPricing,
                              group: {
                                adultPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                                minorPercent: reservationPricing.group?.minorPercent ?? null,
                              },
                            })
                          }
                          className="h-10 rounded-[10px] border-[#D8E3EE]"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-[#607B9C]">Menor (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={Number(reservationPricing.group?.minorPercent ?? '') as any}
                          onChange={(e) =>
                            onReservationPricingChange({
                              ...reservationPricing,
                              group: {
                                adultPercent: Number(reservationPricing.group?.adultPercent ?? 0) || 0,
                                minorPercent: e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                              },
                            })
                          }
                          placeholder="Opcional"
                          className="h-10 rounded-[10px] border-[#D8E3EE]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-start justify-between gap-4 rounded-[10px] bg-white px-3 py-3">
                  <div className="space-y-1">
                    <div className="text-[12px] font-semibold text-[#607B9C]">Editar en reservas manuales</div>
                    <div className="text-[11px] text-[#6883A0]">Si lo activás, estos porcentajes se pueden cambiar al cargar una reserva manual.</div>
                  </div>
                  <Switch
                    checked={Boolean(reservationPricing.allowCustomPercent)}
                    onCheckedChange={(next) => onReservationPricingChange({ ...reservationPricing, allowCustomPercent: Boolean(next) })}
                  />
                </div>

                <div className="mt-3 text-[11px] text-[#6B86A4]">Si dejás “Menor” vacío, se usa el mismo porcentaje que en “Adulto”.</div>
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="">
              <div>
                <div className="text-[13px] font-bold tracking-[-0.01em] text-[#0A2545]">Puntos de salida</div>
                <div className="mt-1 text-[12px] text-[#6883A0]">Cargá los lugares y horarios que querés mostrar al pasajero.</div>
              </div>

              <div className="mt-4 space-y-3">
                {pickupPoints.length > 0 ? (
                  <div className="rounded-[12px] bg-[#F7FAFC]">
                    {pickupPoints.map((point, index) => (
                      <div
                        key={`pickup-point-${index}`}
                        className={cn(
                          'grid grid-cols-1 gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_180px_140px_40px]',
                          index > 0 ? 'border-t border-[#E3EAF2]' : ''
                        )}
                      >
                        <Input
                          value={point.label}
                          onChange={(e) => {
                            const next = [...pickupPoints];
                            next[index] = { ...next[index], label: e.target.value };
                            onPickupPointsChange(next);
                          }}
                          placeholder="Ej: Retiro"
                          className="h-10 rounded-[10px] border-[#D8E3EE] bg-white"
                        />
                        <div className="space-y-2 rounded-[10px] border border-[#E2E9F0] bg-white px-2 py-1.5">
                          <label className="flex items-center gap-2 text-[11px] font-semibold text-[#607B9C]">
                            <input
                              type="checkbox"
                              checked={!point.time}
                              onChange={(e) => {
                                const next = [...pickupPoints];
                                next[index] = { ...next[index], time: e.target.checked ? '' : '09:00' };
                                onPickupPointsChange(next);
                              }}
                              className="h-4 w-4 rounded border-[#BFD3E7]"
                            />
                            Horario a confirmar
                          </label>
                          <Input
                            type="time"
                            value={point.time || ''}
                            onChange={(e) => {
                              const next = [...pickupPoints];
                              next[index] = { ...next[index], time: e.target.value };
                              onPickupPointsChange(next);
                            }}
                            disabled={!point.time}
                            className="h-10 rounded-[10px] border-[#D8E3EE] disabled:bg-[#F7FAFD] disabled:text-[#9BB0C9]"
                          />
                        </div>
                        <div className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-[10px] border border-[#E2E9F0] bg-white px-2 py-1.5">
                          <label className="flex items-center gap-2 text-[11px] font-semibold text-[#607B9C]">
                            <input
                              type="checkbox"
                              checked={Boolean(point.hasExtra)}
                              onChange={(e) => {
                                const next = [...pickupPoints];
                                next[index] = {
                                  ...next[index],
                                  hasExtra: e.target.checked,
                                  extraAmount: e.target.checked ? Number(next[index]?.extraAmount ?? 0) : 0,
                                };
                                onPickupPointsChange(next);
                              }}
                              className="h-4 w-4 rounded border-[#BFD3E7]"
                            />
                            Valor
                          </label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={point.hasExtra ? String(point.extraAmount ?? 0) : ''}
                            onChange={(e) => {
                              const next = [...pickupPoints];
                              next[index] = {
                                ...next[index],
                                hasExtra: true,
                                extraAmount: Math.max(0, Number(e.target.value) || 0),
                              };
                              onPickupPointsChange(next);
                            }}
                            placeholder="0"
                            disabled={!point.hasExtra}
                            className="h-9 rounded-[8px] border-[#D8E3EE] bg-white"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 rounded-[10px] border-[#D8E3EE] text-[#12325D]"
                          onClick={() => onPickupPointsChange(pickupPoints.filter((_, idx) => idx !== index))}
                          aria-label="Eliminar punto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[12px] border border-dashed border-[#D8E7F5] bg-[#FBFEFF] px-4 py-4 text-[12px] text-[#6883A0]">
                    Todavía no cargaste ningún punto de salida.
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-[10px] border-[#D8E3EE] text-[#12325D]"
                  onClick={() => onPickupPointsChange([...pickupPoints, { label: '', time: '', hasExtra: false, extraAmount: 0 }])}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar punto
                </Button>

                <div className="text-xs text-[#6B86A4]">Podés cargar una hora exacta o dejar el punto con horario a confirmar.</div>
              </div>
            </div>

            <div className="">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[13px] font-bold tracking-[-0.01em] text-[#0A2545]">Asientos</div>
                  <div className="mt-1 text-[12px] text-[#6883A0]">Configurá una única referencia de mapa para todas las fechas del paquete.</div>
                </div>
                <Switch checked={seatSelectionEnabled} onCheckedChange={onSeatSelectionEnabledChange} />
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <Label className="text-[12px] font-semibold text-[#607B9C]">
                    Mapa de asientos del paquete{seatSelectionEnabled ? <span className="text-red-500"> *</span> : null}
                  </Label>
                  <Select value={seatLayoutId || ''} onValueChange={onSeatLayoutIdChange} disabled={!seatSelectionEnabled}>
                    <SelectTrigger type="button" className="mt-2 h-10 rounded-[10px] border-[#D8E3EE] bg-white text-[#12325D]">
                      <SelectValue placeholder={loadingTemplates ? 'Cargando opciones...' : 'Seleccioná un mapa'} />
                    </SelectTrigger>
                    <SelectContent className="rounded-[10px] border-[#D8E3EE]">
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id} className="rounded-[8px]">
                          {template.name} {template.busType ? `(${template.busType})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-[10px] bg-[#F7FAFC] px-3 py-2.5 text-[12px] leading-5 text-[#607B9C]">
                  {seatSelectionEnabled
                    ? packageTemplate
                      ? `${packageTemplate.name}${packageTemplate.busType ? ` · ${packageTemplate.busType}` : ''}${packageSeatCapacity ? ` · ${packageSeatCapacity} asientos estimados` : ''}`
                      : 'Elegí un mapa para usarlo como referencia general del paquete.'
                    : 'Los asientos quedan desactivados para el paquete y sus fechas.'}
                </div>
              </div>
            </div>
          </div>

          <div className="">
            <div className="text-[13px] font-bold tracking-[-0.01em] text-[#0A2545]">
              {editingId ? 'Editar fecha' : 'Nueva fecha'}
            </div>
            <div className="mt-1 text-[12px] text-[#6883A0]">Cargá la salida con una estructura más compacta y fácil de escanear.</div>

            <div className="mt-4 space-y-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div>
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
                    <div>
                      <Label className="text-[12px] font-semibold text-[#607B9C]">
                        Fecha de salida <span className="text-red-500">*</span>
                      </Label>
                      <ArgentineDateInput
                        value={draft.fecha}
                        onChange={(value) => setDraft((prev) => ({ ...prev, fecha: value, fechaVuelta: value || prev.fechaVuelta }))}
                        className="mt-2 h-10 rounded-[10px] border-[#D8E3EE]"
                      />
                      <div className="mt-2 text-[11px] text-[#6B86A4]">
                        {draft.fecha ? `Fecha programada para el ${formatShortDate(draft.fecha)}.` : 'Ingresá la fecha en formato argentino.'}
                      </div>
                    </div>
                    <div>
                      <Label className="text-[12px] font-semibold text-[#607B9C]">Moneda</Label>
                      <div className="mt-2 flex h-10 items-center rounded-[10px] border border-[#D8E3EE] bg-[#F8FBFE] px-3 text-[12px] font-semibold text-[#12325D]">
                        ARS
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
                    <div>
                      <Label className="text-[12px] font-semibold text-[#607B9C]">
                        Precio base <span className="text-red-500">*</span>
                      </Label>
                      <div className="mt-2">
                        <FormattedAmountInput
                          value={draft.precio}
                          onChange={(value) => setDraft((prev) => ({ ...prev, precio: value }))}
                          placeholder="0"
                          className="h-10 rounded-[10px] border-[#D8E3EE]"
                        />
                      </div>
                      <div className="mt-2 text-[11px] text-[#6B86A4]">Este es el valor base de esa fecha.</div>
                    </div>

                    <div>
                      <Label className="text-[12px] font-semibold text-[#607B9C]">Cupo máximo (opcional)</Label>
                      <Input
                        type="number"
                        value={draft.cupo || ''}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setDraft((prev) => ({
                            ...prev,
                            cupo: Number.isFinite(value) && value > 0 ? value : undefined,
                          }));
                        }}
                        placeholder={draftSeatCapacity ? `Sugerido: ${draftSeatCapacity}` : 'Dejar vacío = sin límite'}
                        className="mt-2 h-10 rounded-[10px] border-[#D8E3EE]"
                      />
                      <div className="mt-2 text-[11px] text-[#6B86A4]">
                        Sólo completalo si querés poner un límite.
                        {draftSeatCapacity && draft.cupo && draft.cupo > draftSeatCapacity ? (
                          <span className="block text-[#C87A00]">Aviso: el cupo es mayor que los asientos del mapa.</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-[12px] bg-[#F7FAFC] p-4">
                  <Label className="text-[12px] font-semibold text-[#607B9C]">Nota interna (opcional)</Label>
                  <Textarea
                    value={draft.observaciones}
                    onChange={(e) => setDraft((prev) => ({ ...prev, observaciones: e.target.value }))}
                    placeholder="Ej: micro cama ejecutivo, ascenso principal en Retiro, salida nocturna"
                    className="mt-2 min-h-[112px] rounded-[10px] border-[#D8E3EE] bg-white"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[12px] bg-[#F7FAFC] p-4">
                  {!seatSelectionEnabled && !showSeatOverrides ? (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[12px] font-semibold text-[#12325D]">Asientos para esta fecha</div>
                        <p className="mt-1 text-[11px] text-[#6883A0]">Podés activarlos si esta salida necesita elección de asiento.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-[10px] border-[#D8E3EE] text-[#12325D]"
                        onClick={() => setShowSeatOverrides(true)}
                      >
                        Ver opciones
                      </Button>
                    </div>
                  ) : null}

                  {seatSelectionEnabled && !showSeatOverrides ? (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-[12px] font-semibold text-[#12325D]">Asientos para esta fecha</div>
                        <p className="mt-1 text-[11px] text-[#6883A0]">Esta fecha usa el mismo mapa del paquete. Cambialo sólo si hace falta.</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-[10px] border-[#D8E3EE] text-[#12325D]"
                        onClick={() => setShowSeatOverrides(true)}
                      >
                        Ajustar para esta fecha
                      </Button>
                    </div>
                  ) : null}

                  {showSeatOverrides ? (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[12px] font-semibold text-[#12325D]">Asientos para esta fecha</div>
                          <p className="mt-1 text-[11px] text-[#6883A0]">Definí si esta salida usa el mapa general del paquete o uno específico.</p>
                        </div>
                        <Switch
                          checked={draft.seatSelectionEnabled}
                          onCheckedChange={(checked) =>
                            setDraft((prev) => ({
                              ...prev,
                              seatSelectionEnabled: checked,
                              seatLayoutId: checked ? (prev.seatLayoutId || seatLayoutId) : '',
                            }))
                          }
                        />
                      </div>

                      <div className="mt-4 space-y-3">
                        <div>
                          <Label className="text-[12px] font-semibold text-[#607B9C]">
                            Mapa de asientos de esta salida{draft.seatSelectionEnabled ? <span className="text-red-500"> *</span> : null}
                          </Label>
                          <Select
                            value={draft.seatLayoutId || ''}
                            onValueChange={(value) => setDraft((prev) => ({ ...prev, seatLayoutId: value }))}
                            disabled={!draft.seatSelectionEnabled}
                          >
                            <SelectTrigger type="button" className="mt-2 h-10 rounded-[10px] border-[#D8E3EE] bg-white">
                              <SelectValue placeholder={loadingTemplates ? 'Cargando opciones...' : 'Seleccioná un mapa'} />
                            </SelectTrigger>
                            <SelectContent className="rounded-[10px] border-[#D8E3EE]">
                              {templates.map((template) => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name} {template.busType ? `(${template.busType})` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="rounded-[10px] bg-white px-3 py-2.5 text-[11px] text-[#607B9C]">
                          {draft.seatSelectionEnabled
                            ? draftTemplate
                              ? `${draftTemplate.name}${draftTemplate.busType ? ` · ${draftTemplate.busType}` : ''}${draftSeatCapacity ? ` · ${draftSeatCapacity} asientos estimados` : ''}`
                              : 'Seleccioná un mapa para esta salida.'
                            : 'La salida no va a permitir selección de asientos.'}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-[10px] border-[#D8E3EE] text-[#12325D]"
                            onClick={() => {
                              syncDraftWithPackageTemplate();
                              setShowSeatOverrides(false);
                            }}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            Usar el mapa del paquete
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-10 rounded-[10px] border-[#D8E3EE] text-[#12325D]"
                            onClick={() => setShowSeatOverrides(false)}
                          >
                            Listo
                          </Button>
                          {draftSeatCapacity ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-10 rounded-[10px] border-[#D8E3EE] text-[#12325D]"
                              onClick={() => setDraft((prev) => ({ ...prev, cupo: draftSeatCapacity ?? prev.cupo }))}
                            >
                              <Users className="mr-2 h-4 w-4" />
                              Usar cupo sugerido ({draftSeatCapacity})
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={saveSalida}
                  className="h-10 rounded-[10px] bg-[#F6C000] px-4 text-black hover:bg-[#E9B400]"
                >
                  {editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                  {editingId ? 'Guardar fecha' : 'Agregar fecha'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-[10px] border-[#D8E3EE] text-[#12325D]"
                  onClick={() => {
                    resetComposer();
                    setIsComposerOpen(false);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[13px] font-bold tracking-[-0.01em] text-[#0A2545]">
            Fechas cargadas <span className="text-red-500">*</span>
          </div>
          <div className="mt-1 text-[12px] text-[#6883A0]">Revisá lo que ya cargaste: fecha, precio y cupo.</div>
        </div>
        <div className="text-[12px] font-medium text-[#607B9C]">
          {sortedSalidas.length > 0 ? `${sortedSalidas.length} fecha${sortedSalidas.length === 1 ? '' : 's'} cargada${sortedSalidas.length === 1 ? '' : 's'}` : 'Todavía no hay fechas'}
        </div>
      </div>

      {sortedSalidas.length === 0 ? (
        <div className="mt-4 rounded-[14px] border border-dashed border-[#D8E7F5] bg-[#FBFEFF] px-5 py-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ECFAFF]">
            <Route className="h-5 w-5 text-[#0E9EB6]" />
          </div>
          <div className="mt-4 text-[13px] font-bold tracking-[-0.01em] text-[#12325D]">Todavía no cargaste ninguna fecha</div>
          <div className="mt-2 text-[12px] text-[#6883A0]">Creá la primera para dejar este paquete listo para vender.</div>
          <Button type="button" onClick={startNewSalida} className="mt-5 h-10 rounded-[10px] bg-[#0E9EB6] px-4 text-white hover:bg-[#0C8CA1]">
            <Plus className="mr-2 h-4 w-4" />
            Crear primera fecha
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {sortedSalidas.map((salida, index) => {
            const salidaTemplate = templates.find((template) => template.id === salida.seatLayoutId) ?? null;
            const salidaSeatCapacity = seatCapacityFromTemplate(salidaTemplate);
            return (
              <div key={salida.id} className="rounded-[14px] border border-[#E6EDF4] bg-white p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-[#D9ECF4] bg-[#EFFBFF] px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#0B99B1]">
                        Fecha {index + 1}
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <SummaryPill label="Fecha de salida" value={formatLongDate(salida.fecha)} accent="teal" />
                      <SummaryPill label="Precio base" value={`${Number(salida.precio || 0).toLocaleString('es-AR')} ARS`} accent="amber" />
                      <SummaryPill
                        label="Cupo"
                        value={salida.cupo && salida.cupo > 0 ? String(salida.cupo) : salidaSeatCapacity ? `${salidaSeatCapacity} sugerido` : 'Sin límite'}
                        accent="violet"
                      />
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm text-[#607B9C]">
                      <div className="inline-flex items-center gap-2 rounded-[10px] bg-[#F7FAFC] px-3 py-2">
                        <Clock3 className="h-4 w-4 text-[#7B57F2]" />
                        {salida.seatSelectionEnabled
                          ? salidaTemplate
                            ? `${salidaTemplate.name}${salidaTemplate.busType ? ` · ${salidaTemplate.busType}` : ''}${salidaSeatCapacity ? ` · ${salidaSeatCapacity} asientos` : ''}`
                            : 'Con butacas · mapa sin definir'
                          : 'Sin butacas'}
                      </div>
                      {salida.observaciones ? (
                        <div className="inline-flex items-center gap-2 rounded-[10px] bg-[#F7FAFC] px-3 py-2">
                          <Check className="h-4 w-4 text-[#0B99B1]" />
                          {salida.observaciones}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button type="button" variant="outline" className="h-10 rounded-[10px] border-[#D8E7F5] text-[#12325D]" onClick={() => startEditSalida(salida)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <Button type="button" variant="outline" className="h-10 rounded-[10px] border-[#D8E7F5] text-[#12325D]" onClick={() => duplicateSalida(salida)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicar
                    </Button>
                    <Button type="button" variant="outline" className="h-10 rounded-[10px] border-[#F3D9DE] text-[#C24162] hover:bg-[#FFF5F7]" onClick={() => deleteSalida(salida.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
