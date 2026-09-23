import * as z from 'zod';
import type { Categoria, PickupPointItem, ReservationPricingConfig, ReservationRoomType, RoomTypeDefinition, Salida } from '@/types';
import { normalizePackageCategoryIds } from '@/lib/packages/category-utils';

export { normalizePackageCategoryIds } from '@/lib/packages/category-utils';

export const TIPO_OPTIONS = [
  { value: 'individual', label: 'Individual' },
  { value: 'grupal', label: 'Grupal' },
  { value: 'a-medida', label: 'A Medida' },
  { value: 'internacional', label: 'Internacional' },
  { value: 'educativo', label: 'Educativo' },
  { value: 'eventos', label: 'Eventos' },
  { value: 'recitales', label: 'Recitales' },
  { value: 'oferta', label: 'Oferta' },
] as const;

export const TRANSPORTE_OPTIONS = [
  { value: 'bus', label: 'Bus' },
  { value: 'avion', label: 'Avion' },
  { value: 'barco', label: 'Barco' },
] as const;

export const DEFAULT_CONDICIONES = [
  { titulo: 'Reserva', texto: 'Sena del 40% para asegurar tu lugar.' },
  { titulo: 'Pagos', texto: 'Consulta nuestras cuotas y medios de pago disponibles.' },
  { titulo: 'Confirmacion', texto: 'Salida sujeta a la conformacion del grupo minimo.' },
  { titulo: 'Flexibilidad', texto: 'Excursiones condicionadas por clima o imprevistos.' },
  { titulo: 'Seguridad', texto: 'Recomendamos contratar asistencia al viajero.' },
  { titulo: 'Gastos extra', texto: 'No incluye comidas en ruta, bebidas ni opcionales.' },
  { titulo: 'Ingresos', texto: 'No incluye tickets a parques nacionales ni museos.' },
] as const;

export type CondicionItem = { titulo: string; texto: string };
export type ItineraryItem = { titulo: string; descripcion: string };

export const CANCELLATION_POLICY_OPTIONS = [
  { value: 'flexible', label: 'Flexible' },
  { value: 'moderada', label: 'Moderada' },
  { value: 'estricta', label: 'Estricta' },
  { value: 'personalizada', label: 'Personalizada' },
] as const;

export const packageAdminFormSchema = z.object({
  titulo: z.string().min(5, 'El titulo debe tener al menos 5 caracteres').max(100, 'El titulo no puede exceder 100 caracteres').transform((val) => val.trim()),
  descripcion: z.string().min(20, 'La descripcion debe tener al menos 20 caracteres').max(5000, 'La descripcion no puede exceder 5000 caracteres').transform((val) => val.trim()),
  descripcionCorta: z.string().max(160, 'La descripcion corta no puede exceder 160 caracteres').optional().or(z.literal('')).transform((val) => val?.trim() || ''),
  etiqueta: z.string().max(40, 'La etiqueta no puede exceder 40 caracteres').optional().or(z.literal('')).transform((val) => val?.trim() || ''),
  categoriaIds: z.array(z.string()).min(1, 'Debes seleccionar al menos una categoria'),
  tipos: z.array(z.enum(['individual', 'grupal', 'a-medida', 'internacional', 'educativo', 'eventos', 'recitales', 'oferta'])).min(1, 'Debes seleccionar al menos un tipo'),
  precio: z.number().min(0, 'El precio debe ser mayor o igual a 0').max(999999999, 'El precio es demasiado alto').transform((val) => Number(val) || 0),
  gastosAdministrativos: z.number().min(0, 'Los gastos administrativos deben ser mayor o igual a 0').max(999999999, 'Los gastos administrativos son demasiado altos').optional().transform((val) => (typeof val === 'number' ? Number(val) || 0 : 0)),
  moneda: z.enum(['USD', 'ARS', 'EUR']),
  mostrarDesde: z.boolean().transform((val) => Boolean(val)),
  duracion: z.string().min(1, 'La duracion es requerida').max(50, 'La duracion no puede exceder 50 caracteres').transform((val) => val.trim()),
  capacidadMaxima: z.number().min(0, 'La capacidad máxima debe ser mayor o igual a 0').max(999999, 'La capacidad máxima es demasiado alta').optional().transform((val) => (typeof val === 'number' ? Number(val) || 0 : 0)),
  minPassengers: z.number().min(0, 'La cantidad mínima debe ser mayor o igual a 0').max(999999, 'La cantidad mínima es demasiado alta').optional().transform((val) => (typeof val === 'number' ? Number(val) || 0 : 0)),
  maxPassengers: z.number().min(0, 'La cantidad máxima debe ser mayor o igual a 0').max(999999, 'La cantidad máxima es demasiado alta').optional().transform((val) => (typeof val === 'number' ? Number(val) || 0 : 0)),
  cancellationPolicy: z.string().max(40, 'La política es demasiado larga').optional().or(z.literal('')).transform((val) => val?.trim() || ''),
  travelRequirements: z.string().max(2000, 'Los requisitos no pueden exceder 2000 caracteres').optional().or(z.literal('')).transform((val) => val?.trim() || ''),
  adminNotes: z.string().max(2000, 'Las observaciones no pueden exceder 2000 caracteres').optional().or(z.literal('')).transform((val) => val?.trim() || ''),
  transportCompany: z.string().max(120, 'La empresa es demasiado larga').optional().or(z.literal('')).transform((val) => val?.trim() || ''),
  transportOrigin: z.string().max(120, 'El origen es demasiado largo').optional().or(z.literal('')).transform((val) => val?.trim() || ''),
  transportDestination: z.string().max(120, 'El destino es demasiado largo').optional().or(z.literal('')).transform((val) => val?.trim() || ''),
  incluye: z.string().optional().default(''),
  visible: z.boolean().transform((val) => Boolean(val)),
  destacado: z.boolean().transform((val) => Boolean(val)),
  ctaWhatsApp: z.boolean().transform((val) => Boolean(val)),
});

export type PackageAdminFormData = z.infer<typeof packageAdminFormSchema>;

export const packageAdminDefaultValues: PackageAdminFormData = {
  visible: true,
  destacado: true,
  ctaWhatsApp: true,
  mostrarDesde: true,
  tipos: ['individual'],
  categoriaIds: [],
  moneda: 'ARS',
  incluye: '',
  descripcionCorta: '',
  etiqueta: '',
  precio: 0,
  gastosAdministrativos: 0,
  capacidadMaxima: 0,
  minPassengers: 1,
  maxPassengers: 40,
  cancellationPolicy: 'moderada',
  travelRequirements: '',
  adminNotes: '',
  transportCompany: '',
  transportOrigin: '',
  transportDestination: '',
  titulo: '',
  descripcion: '',
  duracion: '',
};

export function dataURLtoFile(dataUrl: string, filename: string): File {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

export function hasValidPackageSalida(salidas: Salida[]): boolean {
  return salidas.some((salida) => Boolean(salida?.fecha?.trim()));
}

export function getInvalidPackageSalidasSummary(salidas: Salida[]): {
  invalidCount: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let invalidCount = 0;

  salidas.forEach((salida, index) => {
    const fecha = String((salida as any)?.fecha ?? '').trim();
    const fechaVuelta = String((salida as any)?.fechaVuelta ?? '').trim() || fecha;
    const precio = Number((salida as any)?.precio ?? 0);

    let reason = '';
    if (!fecha) {
      reason = 'Falta la fecha de salida';
    } else if (fechaVuelta < fecha) {
      reason = 'Vuelta anterior a ida';
    } else if (!Number.isFinite(precio) || precio <= 0) {
      reason = 'Precio inválido';
    }

    if (reason) {
      invalidCount += 1;
      reasons.push(`Salida ${index + 1}: ${reason}`);
    }
  });

  return { invalidCount, reasons };
}

export function sanitizePackageSalidas(salidas: Salida[]): Salida[] {
  return salidas.map((salida) => {
    const fecha = String((salida as any)?.fecha ?? '').trim();
    const sanitizedSalida: Partial<Salida> = {
      ...salida,
      fecha,
      fechaVuelta: String((salida as any)?.fechaVuelta ?? '').trim() || fecha,
      ciudadSalida: String((salida as any)?.ciudadSalida ?? '').trim(),
      precio: Number((salida as any)?.precio ?? 0) || 0,
      observaciones: String((salida as any)?.observaciones ?? '').trim(),
    };

    const cupo = Number((salida as any)?.cupo ?? 0);
    if (Number.isFinite(cupo) && cupo > 0) {
      sanitizedSalida.cupo = cupo;
    }

    return sanitizedSalida as Salida;
  });
}

export function getPackagePrimaryCategoryData(categorias: Categoria[], categoriaIds: string[]) {
  const normalizedCategoriaIds = normalizePackageCategoryIds(categoriaIds);
  const primaryCategoriaId = normalizedCategoriaIds[0] ?? '';
  const categoriaSeleccionada = categorias.find((categoria) => categoria.id === primaryCategoriaId);
  return {
    normalizedCategoriaIds,
    primaryCategoriaId,
    nombreCategoria: categoriaSeleccionada?.nombre || 'Destino',
  };
}

export function buildPackageAdminPayload(args: {
  data: PackageAdminFormData;
  categorias: Categoria[];
  includeItems: string[];
  selectedTransportes: string[];
  tagItems: string[];
  noIncludeItems: string[];
  extrasOpcionales?: string[];
  condicionesItems: CondicionItem[];
  itineraryItems?: ItineraryItem[];
  salidas: Salida[];
  pickupPoints: PickupPointItem[];
  seatSelectionEnabled: boolean;
  seatLayoutId: string;
  transportCompany?: string;
  transportOrigin?: string;
  transportDestination?: string;
  fechaVencimiento: string;
  reservationPricing?: ReservationPricingConfig | null;
  roomTypes?: ReservationRoomType[];
  roomTypeOptions?: RoomTypeDefinition[];
  imageData: {
    imagenPrincipal: string;
    imagenPrincipalKey?: string | null;
    imagenTarjeta: string;
    imagenTarjetaKey?: string | null;
    imagenPortada: string;
    imagenPortadaKey?: string | null;
    galeria: string[];
    galeriaKeys?: string[];
  };
  extra?: Record<string, unknown>;
}) {
  const {
    data,
    categorias,
    includeItems,
    selectedTransportes,
    tagItems,
    noIncludeItems,
    extrasOpcionales,
    condicionesItems,
    itineraryItems,
    salidas,
    pickupPoints,
    seatSelectionEnabled,
    seatLayoutId,
    transportCompany,
    transportOrigin,
    transportDestination,
    fechaVencimiento,
    imageData,
    extra,
  } = args;

  const { normalizedCategoriaIds, primaryCategoriaId, nombreCategoria } = getPackagePrimaryCategoryData(categorias, data.categoriaIds);
  const primaryTipo = data.tipos[0];

  return {
    titulo: data.titulo.trim(),
    descripcion: data.descripcion.trim(),
    descripcionCorta: data.descripcionCorta?.trim() || '',
    etiqueta: data.etiqueta?.trim() || '',
    destino: nombreCategoria,
    categoriaId: primaryCategoriaId,
    categoriaIds: normalizedCategoriaIds,
    tipo: primaryTipo,
    tipos: data.tipos,
    precio: Number(data.precio) || 0,
    gastosAdministrativos: Number(data.gastosAdministrativos) > 0 ? Number(data.gastosAdministrativos) : 0,
    moneda: 'ARS',
    mostrarDesde: Boolean(data.mostrarDesde),
    duracion: data.duracion.trim(),
    incluye: includeItems.map((item) => item.trim()).filter(Boolean),
    tiposTransporte: selectedTransportes,
    tags: tagItems.map((item) => item.trim()).filter(Boolean),
    noIncluye: noIncludeItems.map((item) => item.trim()).filter(Boolean),
    extrasOpcionales: (extrasOpcionales ?? []).map((item) => item.trim()).filter(Boolean),
    condiciones: condicionesItems
      .map((item) => ({
        titulo: item.titulo.trim(),
        texto: item.texto.trim(),
      }))
      .filter((item) => item.titulo.length > 0 && item.texto.length > 0),
    itinerario: (itineraryItems ?? [])
      .map((item) => ({
        titulo: item.titulo.trim(),
        descripcion: item.descripcion.trim(),
      }))
      .filter((item) => item.titulo.length > 0 || item.descripcion.length > 0),
    salidas: sanitizePackageSalidas(salidas),
    pickupPointsConfig: pickupPoints
      .map((item) => ({
        label: String(item?.label ?? '').trim(),
        time: String(item?.time ?? '').trim(),
        hasExtra: Boolean(item?.hasExtra),
        extraAmount: Boolean(item?.hasExtra) ? Math.max(0, Number(item?.extraAmount ?? 0) || 0) : 0,
      }))
      .filter((item) => item.label.length > 0),
    pickupPoints: pickupPoints.map((item) => String(item?.label ?? '').trim()).filter(Boolean),
    seatSelectionEnabled: Boolean(seatSelectionEnabled),
    seatLayoutId: seatSelectionEnabled ? (seatLayoutId.trim() || null) : null,
    transportCompany: transportCompany?.trim() || data.transportCompany?.trim() || '',
    transportOrigin: transportOrigin?.trim() || data.transportOrigin?.trim() || '',
    transportDestination: transportDestination?.trim() || data.transportDestination?.trim() || '',
    fechaVencimiento: fechaVencimiento.trim() || '',
    reservationPricing: args.reservationPricing ?? null,
    roomTypes: Array.from(new Set(args.roomTypes ?? [])),
    roomTypeOptions: (args.roomTypeOptions ?? []).filter((option) => (args.roomTypes ?? []).includes(option.id)),
    capacidadMaxima: Number(data.capacidadMaxima) > 0 ? Number(data.capacidadMaxima) : 0,
    minPassengers: Number(data.minPassengers) > 0 ? Number(data.minPassengers) : 0,
    maxPassengers: Number(data.maxPassengers) > 0 ? Number(data.maxPassengers) : 0,
    cancellationPolicy: data.cancellationPolicy?.trim() || '',
    travelRequirements: data.travelRequirements?.trim() || '',
    adminNotes: data.adminNotes?.trim() || '',
    imagenPrincipal: imageData.imagenPrincipal,
    imagenPrincipalKey: imageData.imagenPrincipalKey ?? null,
    imagenTarjeta: imageData.imagenTarjeta,
    imagenTarjetaKey: imageData.imagenTarjetaKey ?? null,
    imagenPortada: imageData.imagenPortada,
    imagenPortadaKey: imageData.imagenPortadaKey ?? null,
    galeria: imageData.galeria,
    galeriaKeys: imageData.galeriaKeys ?? [],
    visible: Boolean(data.visible),
    destacado: Boolean(data.destacado),
    ctaWhatsApp: Boolean(data.ctaWhatsApp),
    ...(extra ?? {}),
  };
}
