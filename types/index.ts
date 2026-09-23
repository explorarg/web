import { Timestamp } from 'firebase/firestore';
import type { FaqItem as LandingFaqItem } from '@/components/landing-reserva/types';

export type { Experience, Testimonial } from '@/components/landing-reserva/types';
export type FaqItem = LandingFaqItem;

export interface Categoria {
  id: string;
  nombre: string;
  slug: string;
  descripcion: string;
  orden: number;
  destacada: boolean;
  activa: boolean;
  imagen?: string;
  imagenKey?: string;
  fechaCreacion: Timestamp | Date;
}

export interface Salida {
  id: string;
  fecha: string; // YYYY-MM-DD (fecha de ida)
  fechaVuelta?: string; // YYYY-MM-DD (fecha de vuelta)
  ciudadSalida: string;
  precio: number;
  moneda: 'USD' | 'ARS' | 'EUR';
  cupo?: number;
  observaciones?: string;
  seatSelectionEnabled?: boolean;
  seatLayoutId?: string;
}

export type PickupPointItem = {
  label: string;
  time: string;
  hasExtra?: boolean;
  extraAmount?: number;
};

export type ReservationRoomType = string;

export type RoomTypeDefinition = {
  id: string;
  label: string;
  description: string;
  isFullDay?: boolean;
  active?: boolean;
  order?: number;
};

export type ReservationRoomSelection = {
  roomType: ReservationRoomType;
  quantity: number;
};

export type ReservationRoomSelectionMetrics = {
  selectionKey: string;
  totalRooms: number;
  totalCapacity: number;
  people: number;
  generatedAt?: Timestamp | Date | object | null;
};

export type SeatCategoryCode = 'cocheCama' | 'panoramicos' | 'cafeteras';

export type ReservationExtraCode = SeatCategoryCode | 'pickupPoint' | 'administrativeFee' | 'singlePassengerSurcharge';

export type ReservationExtraSelection = {
  code: ReservationExtraCode;
  label: string;
  amount: number;
  quantity?: number | null;
  categoryCode?: SeatCategoryCode | null;
  source?: 'seatCategory' | 'seatLayout' | 'pickupPoint' | string | null;
  scope?: 'per_person' | 'per_booking' | 'per_selected_seat' | string | null;
};

export type SeatCategoryPricingConfig = {
  amount?: number;
};

export type SeatLayoutCategoryPricing = {
  cocheCama?: SeatCategoryPricingConfig;
  panoramicos?: SeatCategoryPricingConfig;
  cafeteras?: SeatCategoryPricingConfig;
};

export type SeatLayoutAmenityConfig = SeatCategoryPricingConfig;
export type SeatLayoutAmenities = SeatLayoutCategoryPricing;

export type ReservationTravelerDetails = {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  document: string;
  country?: string;
  travelerType?: 'adult' | 'minor' | null;
};

export type ReservationPricingMode = 'fixed' | 'percent';

export type ReservationPricingConfig = {
  mode: ReservationPricingMode;
  fixedUnitAmount?: number | null;
  single?: { adultPercent: number; minorPercent?: number | null } | null;
  group?: { adultPercent: number; minorPercent?: number | null } | null;
  allowCustomPercent?: boolean | null;
};

export interface TicketPack {
  id: string;
  titulo: string;
  descripcion: string;
  moneda: 'USD' | 'ARS' | 'EUR';
  valor: number;
  imagenUrl?: string;
}

export interface PaqueteCondicion {
  titulo: string;
  texto: string;
}

// FaqItem is re-exported from landing-reserva/types
export interface PaqueteBookingConfig {
  enabled: boolean;
  title: string;
  subtitle1: string;
  subtitle2: string;
  hasSpecificDates: boolean;
  dates?: Array<{
    date: string;
    capacity: number;
    enabled: boolean;
    price?: number;
    seatSelectionEnabled?: boolean;
    seatLayoutId?: string;
  }>;
  maxPeoplePerBooking?: number;
  currency: 'ars' | 'usd' | 'brl';
  depositAmount: number;
  paymentMethods: {
    mercadoPago: boolean;
  };
  referralCommission?: {
    type: 'percent' | 'fixed';
    value: number;
    currency: 'ars' | 'brl' | 'usd';
  };
}

export interface Testimonio {
  nombre: string;
  comentario: string;
  rol?: string;
}

export interface Paquete {
  id: string;
  titulo: string;
  slug: string;
  descripcion: string;
  descripcionCorta?: string;
  descripcionLarga?: string;
  subtitulo?: string;
  etiqueta?: string;
  tags?: string[];
  eventoLugar?: string;
  eventoFecha?: string; // YYYY-MM-DD
  destino?: string;
  categoriaId?: string;
  categoriaIds?: string[];
  tipo: 'individual' | 'grupal' | 'a-medida' | 'internacional' | 'educativo' | 'eventos' | 'recitales' | 'oferta';
  tipos?: Array<'individual' | 'grupal' | 'a-medida' | 'internacional' | 'educativo' | 'eventos' | 'recitales' | 'oferta'>;
  precio: number;
  gastosAdministrativos?: number;
  moneda: 'USD' | 'ARS' | 'EUR';
  
  // Para landing pages
  imagenCard?: string;
  imagenes?: string[];
  capacidadMaxima?: number;
  faqs?: FaqItem[];
  testimonios?: Testimonio[];
  
  // Booking
  bookingConfig?: PaqueteBookingConfig;
  reservationPricing?: ReservationPricingConfig;
  roomTypes?: ReservationRoomType[];
  roomTypeOptions?: RoomTypeDefinition[];
  seatSelectionEnabled?: boolean;
  seatLayoutId?: string;
  pickupPoints?: string[];
  pickupPointsConfig?: PickupPointItem[];
  transportCompany?: string;
  transportOrigin?: string;
  transportDestination?: string;
  fechaVencimiento?: string;
  mostrarDesde: boolean;
  duracion: string;
  incluye: string[];
  tiposTransporte?: string[];
  noIncluye: string[];
  extrasOpcionales?: string[];
  itinerario?: Array<{
    titulo: string;
    descripcion: string;
  }>;
  cancellationPolicy?: string;
  travelRequirements?: string;
  adminNotes?: string;
  minPassengers?: number;
  maxPassengers?: number;
  salidas: Salida[];
  imagenPrincipal: string;
  imagenPrincipalKey?: string;
  imagenTarjeta?: string;
  imagenTarjetaKey?: string;
  imagenPortada?: string;
  imagenPortadaKey?: string;
  galeria: string[];
  galeriaKeys?: string[];
  tickets?: TicketPack[];
  condiciones?: PaqueteCondicion[];
  visible: boolean;
  destacado: boolean;
  fechaCreacion: Timestamp | Date;
  orden: number;
  ctaWhatsApp: boolean;
}

export type CartStatus = 'active' | 'checkout_started' | 'paid' | 'expired' | 'cancelled';
export type CartCurrency = 'ars' | 'brl' | 'usd';

export interface Cart {
  id: string;
  status: CartStatus;
  currency: CartCurrency;
  expiresAt: Timestamp | Date;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  referral?: { code: string } | null;
  orderId?: string | null;
  checkoutIntentId?: string | null;
  mercadoPagoPreferenceId?: string | null;
  mercadoPagoPaymentId?: string | null;
}

export interface CartItem {
  id: string;
  cartId: string;
  packageId: string;
  packageSlug: string;
  packageTitle: string;
  date: string;
  people: number;
  peopleAdults?: number | null;
  peopleMinors?: number | null;
  pickupPoint?: string | null;
  pickupPointTime?: string | null;
  roomType?: ReservationRoomType | null;
  roomSelection?: ReservationRoomSelection[] | null;
  roomSelectionMetrics?: ReservationRoomSelectionMetrics | null;
  selectedExtras?: ReservationExtraSelection[] | null;
  unitAmount: number;
  pricingMode?: ReservationPricingMode | null;
  pricingBaseUnitAmount?: number | null;
  unitAmountAdults?: number | null;
  unitAmountMinors?: number | null;
  depositPercentAdults?: number | null;
  depositPercentMinors?: number | null;
  baseSubtotalAmount?: number | null;
  extrasTotalAmount?: number | null;
  subtotalAmount: number;
  currency: CartCurrency;
  holdId: string;
  expiresAt: Timestamp | Date;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  referralCode?: string | null;
  seatLayoutId?: string | null;
  selectedSeats?: string[] | null;
}

export type ReservationHoldStatus = 'active' | 'released' | 'consumed' | 'expired';

export interface ReservationHold {
  id: string;
  cartId: string;
  cartItemId: string;
  packageId: string;
  date: string;
  people: number;
  peopleAdults?: number | null;
  peopleMinors?: number | null;
  pickupPoint?: string | null;
  pickupPointTime?: string | null;
  roomType?: ReservationRoomType | null;
  roomSelection?: ReservationRoomSelection[] | null;
  roomSelectionMetrics?: ReservationRoomSelectionMetrics | null;
  selectedExtras?: ReservationExtraSelection[] | null;
  pricingMode?: ReservationPricingMode | null;
  pricingBaseUnitAmount?: number | null;
  unitAmountAdults?: number | null;
  unitAmountMinors?: number | null;
  depositPercentAdults?: number | null;
  depositPercentMinors?: number | null;
  baseSubtotalAmount?: number | null;
  extrasTotalAmount?: number | null;
  status: ReservationHoldStatus;
  expiresAt: Timestamp | Date;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  consumedAt?: Timestamp | Date | null;
  releasedAt?: Timestamp | Date | null;
  seatLayoutId?: string | null;
  selectedSeats?: string[] | null;
}

export type OrderStatus =
  | 'created'
  | 'checkout_started'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'needs_review';

export type OrderPaymentStatus = 'created' | 'pending' | 'approved' | 'rejected' | 'failed' | 'unknown';

export interface OrderItemSnapshot {
  cartItemId: string;
  holdId: string;
  packageId: string;
  packageSlug: string;
  packageTitle: string;
  date: string;
  people: number;
  peopleAdults?: number | null;
  peopleMinors?: number | null;
  pickupPoint?: string | null;
  pickupPointTime?: string | null;
  roomType?: ReservationRoomType | null;
  roomSelection?: ReservationRoomSelection[] | null;
  roomSelectionMetrics?: ReservationRoomSelectionMetrics | null;
  selectedExtras?: ReservationExtraSelection[] | null;
  unitAmount: number;
  pricingMode?: ReservationPricingMode | null;
  pricingBaseUnitAmount?: number | null;
  unitAmountAdults?: number | null;
  unitAmountMinors?: number | null;
  depositPercentAdults?: number | null;
  depositPercentMinors?: number | null;
  baseSubtotalAmount?: number | null;
  extrasTotalAmount?: number | null;
  subtotalAmount: number;
  currency: CartCurrency;
  referralCode?: string | null;
  image?: string | null;
  seatLayoutId?: string | null;
  selectedSeats?: string[] | null;
}

export type SeatStatus = 'available' | 'held' | 'reserved' | 'paid' | 'blocked' | 'disabled';

export type SeatSpecialCellType = 'wc' | 'stairs' | 'driver' | 'empty';

export interface SeatLayoutSpecialCell {
  floor: number;
  row: number;
  col: number;
  type: SeatSpecialCellType;
  label?: string;
}

export interface SeatLayoutSeat {
  seatId: string;
  label: string;
  floor: number;
  row: number;
  col: number;
  category?: SeatCategoryCode | null;
  disabled?: boolean;
  defaultBlocked?: boolean;
}

export interface SeatLayoutTemplate {
  id: string;
  name: string;
  busType: string;
  status?: 'draft' | 'published';
  floors: number;
  rows: number;
  cols: number;
  aisleCols?: number[];
  startNumber?: number;
  autoNumbering?: boolean;
  showRowLabels?: boolean;
  seats: SeatLayoutSeat[];
  specialCells?: SeatLayoutSpecialCell[];
  categoryPricing?: SeatLayoutCategoryPricing;
  amenities?: SeatLayoutAmenities;
  notes?: string;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface DepartureSeat {
  id: string;
  seatId: string;
  label: string;
  floor: number;
  row: number;
  col: number;
  category?: SeatCategoryCode | null;
  baseStatus: 'available' | 'blocked' | 'disabled';
  status: SeatStatus;
  holdId?: string | null;
  cartId?: string | null;
  cartItemId?: string | null;
  orderId?: string | null;
  reservationId?: string | null;
  expiresAt?: Timestamp | Date | null;
  blockedBy?: 'default' | 'admin' | null;
  blockReason?: string | null;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface OrderPayment {
  provider: 'mercadopago';
  externalReference: string;
  preferenceId?: string | null;
  initPoint?: string | null;
  paymentId?: string | null;
  status?: OrderPaymentStatus;
  statusDetail?: string | null;
  updatedAt?: Timestamp | Date | null;
}

export interface Order {
  id: string;
  status: OrderStatus;
  cartId: string;
  checkoutIntentId?: string | null;
  currency: CartCurrency;
  amountTotal: number;
  items: OrderItemSnapshot[];
  referral?: { code: string } | null;
  customer?: {
    email?: string | null;
    name?: string | null;
    phone?: string | null;
    document?: string | null;
    birthDate?: string | null;
    comments?: string | null;
  } | null;
  passengerDetails?: ReservationTravelerDetails[] | null;
  expiresAt: Timestamp | Date;
  payment: OrderPayment;
  processedPaymentIds?: string[];
  reservationIds?: string[];
  failureReason?: string | null;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
  paidAt?: Timestamp | Date | null;
}

export interface BlogPost {
  id: string;
  titulo: string;
  slug: string;
  extracto: string;
  contenido: string;
  imagenPrincipal?: string;
  imagenTarjeta?: string;
  imagenPortada?: string;
  autor?: string;
  autorRol?: string;
  categoria?: string;
  tiempoLectura?: number;
  visible: boolean;
  destacado: boolean;
  orden: number;
  fechaPublicacion: Timestamp | Date;
  fechaCreacion: Timestamp | Date;
}

export interface Consulta {
  id?: string;
  nombre: string;
  apellido?: string;
  nombreCompleto?: string;
  email: string;
  telefono: string;
  mensaje: string;
  paquete?: string;
  paqueteId?: string; // Slug del paquete para construir la URL
  ticketId?: string;
  cantidadPersonas?: number;
  ciudad?: string;
  codigoPostal?: string;
  fechaCreacion: Timestamp | Date;
  leida: boolean;
}
export interface Cliente {
  id: string; // UID de Firebase Auth
  nombre?: string;
  apellido?: string;
  nombreCompleto?: string;
  email: string;
  telefono?: string;
  ciudad?: string;
  codigoPostal?: string;
  cantidadPersonas?: number;
  photoURL?: string;
  provider?: 'password' | 'google';
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}
