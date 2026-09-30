'use client';

import { useMemo, useState } from 'react';
import type { Control, FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import Link from 'next/link';
import {
  AlertTriangle,
  BedDouble,
  Bus,
  ChevronDown,
  ChevronUp,
  Compass,
  Globe2,
  ImagePlus,
  Loader2,
  MapPin,
  Package2,
  Plus,
  Shield,
  Sparkles,
  Ticket,
  Trash2,
  UtensilsCrossed,
  WalletCards,
} from 'lucide-react';
import RichTextEditor from '@/components/admin/RichTextEditor';
import ImageUploader from '@/components/admin/ImageUploader';
import EditableList from '@/components/admin/EditableList';
import DragDropOrderManager from '@/components/admin/DragDropOrderManager';
import PackageReservationsPanel from '@/components/admin/PackageReservationsPanel';
import PackageAvailabilityStudio from '@/components/admin/PackageAvailabilityStudio';
import RoomTypeCatalogEditor from '@/components/admin/RoomTypeCatalogEditor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormattedAmountInput } from '@/components/ui/formatted-amount-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Categoria, PickupPointItem, ReservationPricingConfig, ReservationRoomType, RoomTypeDefinition, Salida } from '@/types';
import {
  CANCELLATION_POLICY_OPTIONS,
  DEFAULT_CONDICIONES,
  TIPO_OPTIONS,
  TRANSPORTE_OPTIONS,
  type CondicionItem,
  type ItineraryItem,
  type PackageAdminFormData,
} from '@/lib/packages/admin-form';

type Props = {
  mode: 'create' | 'edit';
  categorias: Categoria[];
  register: UseFormRegister<PackageAdminFormData>;
  control: Control<PackageAdminFormData>;
  watch: UseFormWatch<PackageAdminFormData>;
  setValue: UseFormSetValue<PackageAdminFormData>;
  errors: FieldErrors<PackageAdminFormData>;
  includeItems: string[];
  onIncludeItemsChange: (items: string[]) => void;
  selectedTransportes: string[];
  onSelectedTransportesChange: (items: string[]) => void;
  tagItems: string[];
  onTagItemsChange: (items: string[]) => void;
  noIncludeItems: string[];
  onNoIncludeItemsChange: (items: string[]) => void;
  extrasOpcionales: string[];
  onExtrasOpcionalesChange: (items: string[]) => void;
  condicionesItems: CondicionItem[];
  onCondicionesItemsChange: (items: CondicionItem[]) => void;
  itineraryItems: ItineraryItem[];
  onItineraryItemsChange: (items: ItineraryItem[]) => void;
  salidas: Salida[];
  onSalidasChange: (salidas: Salida[]) => void;
  pickupPoints: PickupPointItem[];
  onPickupPointsChange: (items: PickupPointItem[]) => void;
  seatSelectionEnabled: boolean;
  onSeatSelectionEnabledChange: (value: boolean) => void;
  seatLayoutId: string;
  onSeatLayoutIdChange: (value: string) => void;
  transportCompany: string;
  onTransportCompanyChange: (value: string) => void;
  transportOrigin: string;
  onTransportOriginChange: (value: string) => void;
  transportDestination: string;
  onTransportDestinationChange: (value: string) => void;
  fechaVencimiento: string;
  onFechaVencimientoChange: (value: string) => void;
  reservationPricing: ReservationPricingConfig | null;
  onReservationPricingChange: (value: ReservationPricingConfig | null) => void;
  roomTypes: ReservationRoomType[];
  onRoomTypesChange: (value: ReservationRoomType[]) => void;
  roomTypeOptions: RoomTypeDefinition[];
  onRoomTypeOptionsChange: (value: RoomTypeDefinition[]) => void;
  imagenTarjetaPreview: string[];
  onImagenTarjetaChange: (images: string[]) => void;
  imagenPortadaPreview: string[];
  onImagenPortadaChange: (images: string[]) => void;
  galeriaPreview: string[];
  onGaleriaChange: (images: string[]) => void;
  destacadosCount: number;
  selectedDestacadoPosition?: number | null;
  onSelectedDestacadoPositionChange?: (value: number | null) => void;
  wasDestacado?: boolean;
  currentId?: string;
  loading: boolean;
  title: string;
  subtitle: string;
  submitLabel: string;
  submittingLabel: string;
};

const INCLUDED_SERVICE_PRESETS = [
  { value: 'Alojamiento', label: 'Alojamiento', icon: BedDouble },
  { value: 'Comidas', label: 'Comidas', icon: UtensilsCrossed },
  { value: 'Transporte', label: 'Transporte', icon: Bus },
  { value: 'Excursiones', label: 'Excursiones', icon: Compass },
  { value: 'Guía', label: 'Guía', icon: MapPin },
  { value: 'Seguro', label: 'Seguro', icon: Shield },
  { value: 'Entradas a parques', label: 'Entradas', icon: Ticket },
  { value: 'Otros', label: 'Otros', icon: Package2 },
] as const;

function formatSectionDate(value?: string) {
  if (!value) return '—';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function SectionCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-[#EDF2F7] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#F2F5F8] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-[13px] font-bold tracking-[-0.01em] text-[#0F172A]">{title}</h2>
          {description ? <p className="mt-1 text-[11px] text-[#94A3B8]">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-red-500">{message}</p>;
}

function ToggleCard({
  active,
  onToggle,
  label,
  icon: Icon,
}: {
  active: boolean;
  onToggle: () => void;
  label: string;
  icon: typeof BedDouble;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex min-h-[74px] flex-col items-center justify-center gap-1.5 rounded-[12px] border px-2 py-3 text-center transition-all',
        active
          ? 'border-[#8EDCEB] bg-[#F0FDFF] text-[#0E7490] shadow-[0_10px_24px_rgba(14,165,233,0.10)]'
          : 'border-[#E5ECF4] bg-white text-[#475569] hover:border-[#CFE0EF] hover:bg-[#FAFCFE]'
      )}
    >
      <Icon className={cn('h-4 w-4', active ? 'text-[#0EA5C6]' : 'text-[#94A3B8]')} />
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}

function ItineraryEditor({
  items,
  onChange,
}: {
  items: ItineraryItem[];
  onChange: (items: ItineraryItem[]) => void;
}) {
  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D9E2EC] bg-[#FBFDFF] px-4 py-10 text-center">
          <div className="text-sm font-semibold text-[#0F172A]">Aún no hay itinerario</div>
          <div className="mt-1 text-xs text-[#94A3B8]">Agregá los días y actividades que harán único este paquete.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={`itinerary-${index}`} className="rounded-2xl border border-[#E5ECF4] bg-[#FCFDFE] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-3">
                  <div>
                    <Label className="text-[12px] font-semibold text-[#64748B]">Título del día</Label>
                    <Input
                      value={item.titulo}
                      onChange={(e) => {
                        const next = [...items];
                        next[index] = { ...next[index], titulo: e.target.value };
                        onChange(next);
                      }}
                      placeholder={`Día ${index + 1}`}
                      className="mt-1.5 h-11 rounded-2xl border-[#E2E8F0]"
                    />
                  </div>
                  <div>
                    <Label className="text-[12px] font-semibold text-[#64748B]">Descripción</Label>
                    <Textarea
                      value={item.descripcion}
                      onChange={(e) => {
                        const next = [...items];
                        next[index] = { ...next[index], descripcion: e.target.value };
                        onChange(next);
                      }}
                      placeholder="Detalle del día, actividad o servicio incluido."
                      className="mt-1.5 min-h-[96px] rounded-2xl border-[#E2E8F0]"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (index === 0) return;
                      const next = [...items];
                      const tmp = next[index - 1];
                      next[index - 1] = next[index];
                      next[index] = tmp;
                      onChange(next);
                    }}
                    disabled={index === 0}
                    className="rounded-xl border-[#E2E8F0]"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (index === items.length - 1) return;
                      const next = [...items];
                      const tmp = next[index + 1];
                      next[index + 1] = next[index];
                      next[index] = tmp;
                      onChange(next);
                    }}
                    disabled={index === items.length - 1}
                    className="rounded-xl border-[#E2E8F0]"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
                    className="rounded-xl border-[#F4D7DE] text-[#BE123C] hover:bg-[#FFF1F4]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...items, { titulo: '', descripcion: '' }])}
        className="h-10 rounded-2xl border-[#E2E8F0] bg-white"
      >
        <Plus className="mr-2 h-4 w-4" />
        Agregar día
      </Button>
    </div>
  );
}

export default function PackageForm(props: Props) {
  const {
    mode,
    categorias,
    register,
    control,
    watch,
    setValue,
    errors,
    includeItems,
    onIncludeItemsChange,
    selectedTransportes,
    onSelectedTransportesChange,
    tagItems,
    onTagItemsChange,
    noIncludeItems,
    onNoIncludeItemsChange,
    extrasOpcionales,
    onExtrasOpcionalesChange,
    condicionesItems,
    onCondicionesItemsChange,
    itineraryItems,
    onItineraryItemsChange,
    salidas,
    onSalidasChange,
    pickupPoints,
    onPickupPointsChange,
    seatSelectionEnabled,
    onSeatSelectionEnabledChange,
    seatLayoutId,
    onSeatLayoutIdChange,
    transportCompany,
    onTransportCompanyChange,
    transportOrigin,
    onTransportOriginChange,
    transportDestination,
    onTransportDestinationChange,
    fechaVencimiento,
    onFechaVencimientoChange,
    reservationPricing,
    onReservationPricingChange,
    roomTypes,
    onRoomTypesChange,
    roomTypeOptions,
    onRoomTypeOptionsChange,
    imagenTarjetaPreview,
    onImagenTarjetaChange,
    imagenPortadaPreview,
    onImagenPortadaChange,
    galeriaPreview,
    onGaleriaChange,
    destacadosCount,
    selectedDestacadoPosition,
    onSelectedDestacadoPositionChange,
    wasDestacado = false,
    currentId,
    loading,
    title,
    subtitle,
    submitLabel,
    submittingLabel,
  } = props;

  const visible = watch('visible');
  const destacado = watch('destacado');
  const ctaWhatsApp = watch('ctaWhatsApp');
  const mostrarDesde = watch('mostrarDesde');
  const descripcionCorta = watch('descripcionCorta');
  const categoriaIds = watch('categoriaIds');
  const tipos = watch('tipos');
  const titulo = watch('titulo');
  const capacidadMaxima = watch('capacidadMaxima');
  const primaryCategoryId = categoriaIds?.[0] ?? '';
  const primaryTipo = tipos?.[0] ?? 'individual';
  const sortedSalidas = useMemo(
    () => [...salidas].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))),
    [salidas]
  );
  const firstDeparture = sortedSalidas[0]?.fecha ?? '';
  const lastReturn = sortedSalidas.reduce((latest, salida) => {
    const next = String((salida as any)?.fechaVuelta ?? salida.fecha ?? '');
    return next && next > latest ? next : latest;
  }, '');
  const [descriptionTab, setDescriptionTab] = useState<'short' | 'full'>('short');
  const [showAdvancedBasics, setShowAdvancedBasics] = useState(false);
  const [showAvailabilityManager, setShowAvailabilityManager] = useState(false);
  const [showCustomIncluded, setShowCustomIncluded] = useState(false);
  const [showConditions, setShowConditions] = useState(false);
  const includedPresetSet = new Set(includeItems.map((item) => item.trim().toLowerCase()));
  const extraCategoryIds = (categoriaIds ?? []).slice(1);
  const extraTipos = (tipos ?? []).slice(1);

  const syncPrimaryCategory = (value: string) => {
    const rest = (categoriaIds ?? []).filter((id) => id !== value && id !== primaryCategoryId);
    setValue('categoriaIds', value ? [value, ...rest] : rest, { shouldValidate: true });
  };

  const toggleExtraCategory = (value: string, checked: boolean) => {
    const current = categoriaIds ?? [];
    const without = current.filter((id) => id !== value);
    setValue('categoriaIds', checked ? [...without, value] : without, { shouldValidate: true });
  };

  const syncPrimaryTipo = (value: PackageAdminFormData['tipos'][number]) => {
    const rest = (tipos ?? []).filter((item) => item !== value && item !== primaryTipo);
    setValue('tipos', [value, ...rest] as PackageAdminFormData['tipos'], { shouldValidate: true });
  };

  const toggleExtraTipo = (value: PackageAdminFormData['tipos'][number], checked: boolean) => {
    const current = tipos ?? [];
    const without = current.filter((item) => item !== value);
    setValue('tipos', (checked ? [...without, value] : without) as PackageAdminFormData['tipos'], {
      shouldValidate: true,
    });
  };

  return (
    <div className="mx-auto space-y-5 pb-12">
      <div className="flex flex-col gap-4 rounded-[20px] border border-[#E9EEF4] bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">{title}</h1>
          <p className="mt-1 text-[12px] text-[#94A3B8]">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', visible ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
            {visible ? 'Activo' : 'Desactivado'}
          </span>
        </div>
      </div>

      <div className="space-y-4 rounded-[20px] border border-[#E9EEF4] bg-white p-4 sm:p-5">
        <SectionCard
          title="Información básica"
          description="Datos principales del paquete que se mostrarán en la ficha y ayudarán a organizar la venta."
        >
          <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="space-y-4">
              <div className="rounded-[14px] border border-[#EDF2F7] bg-white p-4">
                <div className="mb-3">
                  <div className="text-[12px] font-semibold text-[#0F172A]">Imagen destacada</div>
                  <p className="mt-1 text-[11px] text-[#94A3B8]">Arrastrá una imagen o hacé clic para subirla.</p>
                </div>
                <ImageUploader
                  images={imagenTarjetaPreview}
                  onImagesChange={onImagenTarjetaChange}
                  maxImages={1}
                  description="Recomendado 1200x800 px · PNG, JPG o WebP"
                  variant="compact"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-[#64748B]">Fecha de salida</Label>
                  <div className="flex h-10 items-center rounded-[10px] border border-[#E5EAF0] bg-[#FAFCFE] px-3 text-[12px] font-medium text-[#0F172A]">
                    {formatSectionDate(firstDeparture)}
                  </div>
                  <p className="text-[11px] text-[#94A3B8]">Se actualiza según las fechas cargadas.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-[#64748B]">Fecha de regreso</Label>
                  <div className="flex h-10 items-center rounded-[10px] border border-[#E5EAF0] bg-[#FAFCFE] px-3 text-[12px] font-medium text-[#0F172A]">
                    {formatSectionDate(lastReturn)}
                  </div>
                  <p className="text-[11px] text-[#94A3B8]">Toma la última vuelta configurada.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="titulo" className="text-[12px] font-semibold text-[#64748B]">
                    Nombre del paquete <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-[11px] text-[#94A3B8]">{titulo?.length || 0}/100</span>
                </div>
                <Input
                  id="titulo"
                  {...register('titulo')}
                  placeholder="Ej: Bariloche en invierno"
                  className="h-10 rounded-[10px] border-[#E5EAF0]"
                />
                <FieldError message={errors.titulo?.message} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="duracion" className="text-[12px] font-semibold text-[#64748B]">
                  Duración <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="duracion"
                  {...register('duracion')}
                  placeholder="Ej: 5 días / 4 noches"
                  className="h-11 rounded-2xl border-[#E2E8F0]"
                />
                <FieldError message={errors.duracion?.message} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-[#64748B]">
                  Tipo de viaje <span className="text-red-500">*</span>
                </Label>
                <Select value={primaryTipo} onValueChange={(value) => syncPrimaryTipo(value as PackageAdminFormData['tipos'][number])}>
                  <SelectTrigger className="h-10 rounded-[10px] border-[#E5EAF0]">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errors.tipos?.message as string | undefined} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-[#64748B]">
                  Categoría principal <span className="text-red-500">*</span>
                </Label>
                <Select value={primaryCategoryId} onValueChange={syncPrimaryCategory}>
                  <SelectTrigger className="h-10 rounded-[10px] border-[#E5EAF0]">
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={errors.categoriaIds?.message as string | undefined} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="etiqueta" className="text-[12px] font-semibold text-[#64748B]">Etiqueta visual</Label>
                <Input
                  id="etiqueta"
                  {...register('etiqueta')}
                  placeholder="Ej: Premium"
                  className="h-10 rounded-[10px] border-[#E5EAF0]"
                />
                <FieldError message={errors.etiqueta?.message} />
              </div>

              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={() => setShowAdvancedBasics((current) => !current)}
                  className="inline-flex items-center rounded-[10px] border border-[#E5EAF0] px-3 py-2 text-[12px] font-semibold text-[#475569]"
                >
                  Opciones adicionales
                  <ChevronDown className={cn('ml-2 h-4 w-4 transition-transform', showAdvancedBasics ? 'rotate-180' : '')} />
                </button>
                {showAdvancedBasics ? (
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[14px] border border-[#EDF2F7] bg-[#FBFDFF] p-4">
                      <div className="text-[12px] font-semibold text-[#64748B]">Categorías adicionales</div>
                      <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                        {categorias.filter((cat) => cat.id !== primaryCategoryId).map((cat) => (
                          <label key={cat.id} className="flex items-center gap-2 rounded-xl px-1 py-1 text-sm text-[#334155]">
                            <Checkbox
                              checked={extraCategoryIds.includes(cat.id)}
                              onCheckedChange={(checked) => toggleExtraCategory(cat.id, checked === true)}
                            />
                            <span>{cat.nombre}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[14px] border border-[#EDF2F7] bg-[#FBFDFF] p-4">
                      <div className="text-[12px] font-semibold text-[#64748B]">Tipos adicionales</div>
                      <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                        {TIPO_OPTIONS.filter((item) => item.value !== primaryTipo).map((item) => (
                          <label key={item.value} className="flex items-center gap-2 rounded-xl px-1 py-1 text-sm text-[#334155]">
                            <Checkbox
                              checked={extraTipos.includes(item.value)}
                              onCheckedChange={(checked) =>
                                toggleExtraTipo(item.value as PackageAdminFormData['tipos'][number], checked === true)
                              }
                            />
                            <span>{item.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Descripción y detalles"
          description="Definí cómo se presenta el paquete, su resumen corto y el contenido editorial completo."
          action={
            <Button type="button" variant="outline" size="sm" className="rounded-xl border-[#D7E3EF]">
              <Sparkles className="mr-2 h-4 w-4" />
              Generar con IA
            </Button>
          }
        >
          <div className="space-y-5">
            <div className="inline-flex rounded-[10px] border border-[#E5EAF0] bg-[#F8FAFC] p-1">
              <button
                type="button"
                onClick={() => setDescriptionTab('short')}
                className={cn(
                  'rounded-[8px] px-4 py-2 text-[12px] font-semibold transition-colors',
                  descriptionTab === 'short' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'
                )}
              >
                Descripción corta
              </button>
              <button
                type="button"
                onClick={() => setDescriptionTab('full')}
                className={cn(
                  'rounded-[8px] px-4 py-2 text-[12px] font-semibold transition-colors',
                  descriptionTab === 'full' ? 'bg-white text-[#0F172A] shadow-sm' : 'text-[#64748B]'
                )}
              >
                Descripción completa
              </button>
            </div>

            {descriptionTab === 'short' ? (
              <div className="space-y-1.5">
                <Label htmlFor="descripcionCorta" className="text-[12px] font-semibold text-[#64748B]">
                  Descripción corta
                </Label>
                <Textarea
                  id="descripcionCorta"
                  {...register('descripcionCorta')}
                  placeholder="Describí brevemente lo que incluye este paquete..."
                  className="min-h-[140px] rounded-[10px] border-[#E5EAF0]"
                />
                <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
                  <span>Texto breve ideal para cards y resúmenes.</span>
                  <span>{descripcionCorta?.length || 0}/160</span>
                </div>
                <FieldError message={errors.descripcionCorta?.message} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-[#64748B]">
                  Descripción completa <span className="text-red-500">*</span>
                </Label>
                <Controller
                  name="descripcion"
                  control={control}
                  render={({ field }) => (
                    <RichTextEditor
                      content={field.value}
                      onChange={field.onChange}
                      placeholder="Describí la propuesta completa, diferenciales, servicios, recomendaciones y toda la experiencia."
                    />
                  )}
                />
                <FieldError message={errors.descripcion?.message} />
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Características destacadas"
          description="Agregá los mensajes clave que más venden este paquete."
          action={
            <Button type="button" variant="outline" size="sm" className="rounded-xl border-[#D7E3EF]">
              <Plus className="mr-2 h-4 w-4" />
              Agregar característica
            </Button>
          }
        >
          <div className="rounded-[12px] border border-[#EDF2F7] bg-[#FBFDFF] p-3">
            <EditableList
              items={tagItems}
              onItemsChange={onTagItemsChange}
              placeholder="Ej: Hoteles céntricos, salida acompañada, coordinador permanente"
              emptyMessage="Todavía no agregaste características destacadas"
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Itinerario"
          description="Detalle día por día de las actividades y servicios incluidos."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl border-[#D7E3EF]"
              onClick={() => onItineraryItemsChange([...itineraryItems, { titulo: '', descripcion: '' }])}
            >
              <Plus className="mr-2 h-4 w-4" />
              Agregar día
            </Button>
          }
        >
          <ItineraryEditor items={itineraryItems} onChange={onItineraryItemsChange} />
        </SectionCard>

        <SectionCard
          title="Transporte y elección de butacas"
          description="Configurá el transporte principal del paquete y la lógica de fechas, salida y butacas."
        >
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-[#64748B]">Tipo de transporte</Label>
                <Select
                  value={selectedTransportes[0] || ''}
                  onValueChange={(value) => onSelectedTransportesChange(value ? [value, ...selectedTransportes.filter((item) => item !== value)] : [])}
                >
                  <SelectTrigger className="h-10 rounded-[10px] border-[#E5EAF0]">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSPORTE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-[#64748B]">Empresa de transporte</Label>
                <Input
                  value={transportCompany}
                  onChange={(e) => onTransportCompanyChange(e.target.value)}
                  placeholder="Nombre de la empresa"
                  className="h-10 rounded-[10px] border-[#E5EAF0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-[#64748B]">Origen</Label>
                <Input
                  value={transportOrigin}
                  onChange={(e) => onTransportOriginChange(e.target.value)}
                  placeholder="Ciudad de origen"
                  className="h-10 rounded-[10px] border-[#E5EAF0]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-[#64748B]">Destino</Label>
                <Input
                  value={transportDestination}
                  onChange={(e) => onTransportDestinationChange(e.target.value)}
                  placeholder="Ciudad de destino"
                  className="h-10 rounded-[10px] border-[#E5EAF0]"
                />
              </div>
            </div>

            <RoomTypeCatalogEditor
              selectedIds={roomTypes}
              onSelectedIdsChange={onRoomTypesChange}
              selectedOptions={roomTypeOptions}
              onSelectedOptionsChange={onRoomTypeOptionsChange}
            />

            <div className="flex items-center justify-between rounded-[12px] border border-[#EDF2F7] bg-[#FBFDFF] px-4 py-3">
              <div>
                <div className="text-[12px] font-semibold text-[#0F172A]">Incluir transporte y butacas</div>
                <div className="mt-1 text-[11px] text-[#94A3B8]">Abrí el administrador avanzado para configurar salidas, mapas y cupos.</div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={seatSelectionEnabled} onCheckedChange={onSeatSelectionEnabledChange} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-[10px] border-[#D7E3EF]"
                  onClick={() => setShowAvailabilityManager((current) => !current)}
                >
                  {showAvailabilityManager ? 'Ocultar detalle' : 'Administrar'}
                </Button>
              </div>
            </div>

            {showAvailabilityManager ? (
              <PackageAvailabilityStudio
                salidas={salidas}
                onSalidasChange={onSalidasChange}
                pickupPoints={pickupPoints}
                onPickupPointsChange={onPickupPointsChange}
                seatSelectionEnabled={seatSelectionEnabled}
                onSeatSelectionEnabledChange={onSeatSelectionEnabledChange}
                seatLayoutId={seatLayoutId}
                onSeatLayoutIdChange={onSeatLayoutIdChange}
                fechaVencimiento={fechaVencimiento}
                onFechaVencimientoChange={onFechaVencimientoChange}
                reservationPricing={reservationPricing}
                onReservationPricingChange={onReservationPricingChange}
              />
            ) : (
              <div className="rounded-[12px] border border-[#EDF2F7] bg-white p-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[12px] font-semibold text-[#64748B]">Configuración de butacas</Label>
                    <div className="flex h-10 items-center rounded-[10px] border border-[#E5EAF0] bg-[#FAFCFE] px-3 text-[12px] font-medium text-[#0F172A]">
                      {seatSelectionEnabled ? 'Mapa activo' : 'Sin selección'}
                    </div>
                    <p className="text-[11px] text-[#94A3B8]">{seatLayoutId ? `Mapa ${seatLayoutId}` : 'Elegí el mapa desde el administrador.'}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[12px] font-semibold text-[#64748B]">Vista previa del mapa</Label>
                    <div className="flex h-10 items-center rounded-[10px] border border-[#E5EAF0] bg-[#FAFCFE] px-3 text-[12px] font-medium text-[#0F172A]">
                      {salidas.length > 0 ? `${salidas.length} fecha(s) configurada(s)` : 'Sin salidas configuradas'}
                    </div>
                    <p className="text-[11px] text-[#94A3B8]">La gestión detallada se realiza en el panel avanzado.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Servicios incluidos"
          description="Seleccioná todo lo que está incluido en el paquete."
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
              {INCLUDED_SERVICE_PRESETS.map((service) => (
                <ToggleCard
                  key={service.value}
                  active={includedPresetSet.has(service.value.toLowerCase())}
                  onToggle={() => {
                    const exists = includeItems.some((item) => item.trim().toLowerCase() === service.value.toLowerCase());
                    onIncludeItemsChange(
                      exists
                        ? includeItems.filter((item) => item.trim().toLowerCase() !== service.value.toLowerCase())
                        : [...includeItems, service.value]
                    );
                  }}
                  label={service.label}
                  icon={service.icon}
                />
              ))}
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowCustomIncluded((current) => !current)}
                className="inline-flex items-center rounded-[10px] border border-[#E5EAF0] px-3 py-2 text-[12px] font-semibold text-[#475569]"
              >
                Servicios personalizados
                <ChevronDown className={cn('ml-2 h-4 w-4 transition-transform', showCustomIncluded ? 'rotate-180' : '')} />
              </button>
              {showCustomIncluded ? (
                <div className="mt-3 rounded-[12px] border border-[#EDF2F7] bg-[#FBFDFF] p-3">
                  <EditableList
                    items={includeItems}
                    onItemsChange={onIncludeItemsChange}
                    placeholder="Agregá un servicio incluido personalizado"
                    emptyMessage="Todavía no hay servicios cargados"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Extras opcionales"
          description="Cargá agregados, upgrades o servicios adicionales que el cliente puede contratar."
          action={
            <Button type="button" variant="outline" size="sm" className="rounded-xl border-[#D7E3EF]">
              <Plus className="mr-2 h-4 w-4" />
              Agregar extra
            </Button>
          }
        >
          <div className="rounded-[12px] border border-dashed border-[#DDE6EE] bg-[#FBFDFF] px-4 py-4">
            <EditableList
              items={extrasOpcionales}
              onItemsChange={onExtrasOpcionalesChange}
              placeholder="Ej: excursión premium, upgrade de habitación, cena show"
              emptyMessage="Todavía no agregaste extras opcionales"
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Precios y disponibilidad"
          description="Definí los valores base y límites operativos del paquete."
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1.5 xl:col-span-2">
              <Label className="text-[12px] font-semibold text-[#64748B]">
                Precio por persona <span className="text-red-500">*</span>
              </Label>
              <Controller
                name="precio"
                control={control}
                render={({ field }) => (
                  <FormattedAmountInput
                    value={Number(field.value) || 0}
                    onChange={field.onChange}
                    placeholder="0"
                    className="h-10 rounded-[10px] border-[#E5EAF0]"
                  />
                )}
              />
              <FieldError message={errors.precio?.message} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-[#64748B]">Moneda</Label>
              <div className="flex h-10 items-center rounded-[10px] border border-[#E5EAF0] bg-[#FAFCFE] px-3 text-sm font-semibold text-[#0F172A]">
                ARS - Peso argentino
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-[#64748B]">Cantidad mínima de pasajeros</Label>
              <Input type="number" min={0} {...register('minPassengers', { valueAsNumber: true })} className="h-10 rounded-[10px] border-[#E5EAF0]" />
              <FieldError message={errors.minPassengers?.message} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-[#64748B]">Cantidad máxima de pasajeros</Label>
              <Input type="number" min={0} {...register('maxPassengers', { valueAsNumber: true })} className="h-10 rounded-[10px] border-[#E5EAF0]" />
              <FieldError message={errors.maxPassengers?.message} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-semibold text-[#64748B]">Lugares disponibles</Label>
              <Input type="number" min={0} {...register('capacidadMaxima', { valueAsNumber: true })} className="h-10 rounded-[10px] border-[#E5EAF0]" />
              <p className="text-[11px] text-[#94A3B8]">
                {capacidadMaxima && capacidadMaxima > 0 ? `${capacidadMaxima} lugares configurados a nivel paquete.` : 'Podés dejarlo en 0 si lo manejás por salida.'}
              </p>
              <FieldError message={errors.capacidadMaxima?.message} />
            </div>

            <div className="space-y-1.5 xl:col-span-2">
              <Label className="text-[12px] font-semibold text-[#64748B]">Gastos administrativos por persona</Label>
              <Controller
                name="gastosAdministrativos"
                control={control}
                render={({ field }) => (
                  <FormattedAmountInput
                    value={Number(field.value) || 0}
                    onChange={field.onChange}
                    placeholder="0"
                    className="h-10 rounded-[10px] border-[#E5EAF0]"
                  />
                )}
              />
              <p className="text-[11px] text-[#94A3B8]">
                Se multiplican automáticamente por la cantidad de pasajeros en reservas manuales y automáticas.
              </p>
              <FieldError message={errors.gastosAdministrativos?.message} />
            </div>

            <div className="space-y-1.5 xl:col-span-3">
              <Label className="text-[12px] font-semibold text-[#64748B]">Mostrar precio “desde” en la tarjeta</Label>
              <div className="flex min-h-[40px] items-center justify-between rounded-[10px] border border-[#E5EAF0] bg-[#FBFDFF] px-3">
                <div className="text-sm text-[#475569]">Si está activo, el card del paquete mostrará “Desde $...”</div>
                <Switch checked={mostrarDesde} onCheckedChange={(checked) => setValue('mostrarDesde', checked)} />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Imágenes y galería"
          description="Mostrá lo mejor del paquete con imágenes de portada y apoyo visual."
        >
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
              <div className="rounded-[14px] border border-[#EDF2F7] bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                  <ImagePlus className="h-4 w-4 text-[#0EA5C6]" />
                  Subir imágenes
                </div>
                <ImageUploader
                  images={imagenPortadaPreview}
                  onImagesChange={onImagenPortadaChange}
                  maxImages={1}
                  label="Imagen de portada *"
                  description="Arrastrá una imagen o hacé clic para seleccionar"
                  variant="compact"
                />
              </div>

              <div className="rounded-[14px] border border-[#EDF2F7] bg-white p-4">
                <div className="mb-3 text-sm font-semibold text-[#0F172A]">Vista previa de la galería</div>
                <ImageUploader
                  images={galeriaPreview}
                  onImagesChange={onGaleriaChange}
                  maxImages={8}
                  label="Galería"
                  description="Imágenes adicionales del paquete"
                  variant="compact"
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Información adicional"
          description="Definí reglas complementarias, requisitos y observaciones del paquete."
        >
          <div className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-[260px_1fr_1fr]">
              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-[#64748B]">Política de cancelación</Label>
                <Controller
                  name="cancellationPolicy"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value || 'moderada'} onValueChange={field.onChange}>
                      <SelectTrigger className="h-10 rounded-[10px] border-[#E5EAF0]">
                        <SelectValue placeholder="Seleccionar política" />
                      </SelectTrigger>
                      <SelectContent>
                        {CANCELLATION_POLICY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError message={errors.cancellationPolicy?.message} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-[#64748B]">Requisitos de viaje</Label>
                <Textarea
                  {...register('travelRequirements')}
                  placeholder="Ej: DNI vigente, edad mínima, documentación adicional."
                  className="min-h-[120px] rounded-[10px] border-[#E5EAF0]"
                />
                <FieldError message={errors.travelRequirements?.message} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-[#64748B]">Observaciones</Label>
                <Textarea
                  {...register('adminNotes')}
                  placeholder="Información operativa o aclaraciones importantes."
                  className="min-h-[120px] rounded-[10px] border-[#E5EAF0]"
                />
                <FieldError message={errors.adminNotes?.message} />
              </div>
            </div>

            <div className="rounded-[12px] border border-[#EDF2F7] bg-[#FBFDFF] p-4">
              <button
                type="button"
                onClick={() => setShowConditions((current) => !current)}
                className="flex w-full items-center justify-between"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                  <WalletCards className="h-4 w-4 text-[#0EA5C6]" />
                  Condiciones del paquete
                </div>
                <ChevronDown className={cn('h-4 w-4 text-[#64748B] transition-transform', showConditions ? 'rotate-180' : '')} />
              </button>
              {showConditions ? <div className="mt-4 space-y-4">
                <div className="grid gap-3">
                  {condicionesItems.map((item, index) => (
                    <div key={`condicion-${index}`} className="rounded-[12px] border border-[#E5ECF4] bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-3">
                          <div>
                            <Label className="text-[12px] font-semibold text-[#64748B]">Título</Label>
                            <Input
                              value={item.titulo}
                              onChange={(e) => {
                                const next = [...condicionesItems];
                                next[index] = { ...next[index], titulo: e.target.value };
                                onCondicionesItemsChange(next);
                              }}
                              className="mt-1.5 h-10 rounded-[10px] border-[#E5EAF0]"
                            />
                          </div>
                          <div>
                            <Label className="text-[12px] font-semibold text-[#64748B]">Texto</Label>
                            <Textarea
                              value={item.texto}
                              onChange={(e) => {
                                const next = [...condicionesItems];
                                next[index] = { ...next[index], texto: e.target.value };
                                onCondicionesItemsChange(next);
                              }}
                              className="mt-1.5 min-h-[96px] rounded-[10px] border-[#E5EAF0]"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              if (index === 0) return;
                              const next = [...condicionesItems];
                              const tmp = next[index - 1];
                              next[index - 1] = next[index];
                              next[index] = tmp;
                              onCondicionesItemsChange(next);
                            }}
                            disabled={index === 0}
                            className="rounded-xl border-[#E2E8F0]"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              if (index === condicionesItems.length - 1) return;
                              const next = [...condicionesItems];
                              const tmp = next[index + 1];
                              next[index + 1] = next[index];
                              next[index] = tmp;
                              onCondicionesItemsChange(next);
                            }}
                            disabled={index === condicionesItems.length - 1}
                            className="rounded-xl border-[#E2E8F0]"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => onCondicionesItemsChange(condicionesItems.filter((_, itemIndex) => itemIndex !== index))}
                            className="rounded-xl border-[#F4D7DE] text-[#BE123C] hover:bg-[#FFF1F4]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    onCondicionesItemsChange([...condicionesItems, { ...DEFAULT_CONDICIONES[0], titulo: '', texto: '' }])
                  }
                  className="rounded-[10px] border-[#E2E8F0]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar condición
                </Button>
              </div> : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Estado del paquete"
          description="Controlá si el paquete está activo o desactivado en el sitio."
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[12px] text-[#94A3B8]">
                {visible ? 'El paquete está activo y se muestra en el sitio.' : 'El paquete está desactivado y no se muestra en el sitio.'}
              </div>
              <div className={cn('rounded-full px-3 py-1 text-[11px] font-bold', visible ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                {visible ? 'Activo' : 'Desactivado'}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-[12px] border border-[#E5ECF4] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#0F172A]">Activo</div>
                  </div>
                  <Switch checked={visible} onCheckedChange={(checked) => setValue('visible', checked)} />
                </div>
              </div>

              <div className="rounded-[12px] border border-[#E5ECF4] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#0F172A]">Destacado</div>
                  </div>
                  <Switch checked={destacado} onCheckedChange={(checked) => setValue('destacado', checked)} />
                </div>
                {destacadosCount >= 9 && destacado && (mode === 'create' || !wasDestacado) ? (
                  <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Ya hay {destacadosCount} paquetes destacados. Solo se verán los primeros 9.</span>
                  </div>
                ) : null}
              </div>

              <div className="rounded-[12px] border border-[#E5ECF4] bg-white px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#0F172A]">CTA WhatsApp</div>
                  </div>
                  <Switch checked={ctaWhatsApp} onCheckedChange={(checked) => setValue('ctaWhatsApp', checked)} />
                </div>
              </div>
            </div>

            {destacado ? (
              <div className="rounded-[12px] border border-[#E5ECF4] bg-[#FBFDFF] p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                  <Globe2 className="h-4 w-4 text-[#0EA5C6]" />
                  Orden del destacado
                </div>
                {mode === 'create' ? (
                  titulo && titulo.length >= 5 ? (
                    <DragDropOrderManager
                      collectionName="paquetes"
                      currentId={undefined}
                      newItemName={titulo}
                      onPositionChange={onSelectedDestacadoPositionChange}
                      maxItems={9}
                      onlyDestacados
                      hideSaveButton
                    />
                  ) : (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      Ingresá un nombre válido para gestionar la posición del paquete destacado.
                    </div>
                  )
                ) : (
                  <DragDropOrderManager collectionName="paquetes" currentId={currentId} maxItems={9} onlyDestacados />
                )}
              </div>
            ) : null}

            {mode === 'edit' && currentId ? <PackageReservationsPanel packageId={currentId} /> : null}
          </div>
        </SectionCard>

        <div className="flex flex-col gap-3 border-t border-[#EEF2F6] pt-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" asChild className="rounded-xl border-[#D7E3EF]">
          <Link href="/admin/paquetes">
              Cancelar
          </Link>
        </Button>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              className="min-w-[200px] rounded-xl bg-[#0EA5C6] text-white shadow-[0_12px_28px_rgba(14,165,198,0.24)] hover:bg-[#0891B2]"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {submittingLabel}
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
