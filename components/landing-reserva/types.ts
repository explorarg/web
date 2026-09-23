export type Testimonial = {
  name: string;
  quote: string;
  role?: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type BookingDate = {
  date: string; // "2025-02-15" (YYYY-MM-DD)
  capacity: number;
  enabled: boolean;
};

/** Códigos de moneda soportados. */
export type BookingCurrency = 'ars' | 'brl' | 'usd';

export type BookingConfig = {
  enabled: boolean;
  title: string;
  subtitle1: string;
  subtitle2: string;
  hasSpecificDates: boolean;
  dates: BookingDate[];
  depositAmount: number;
  /** Si no se define, en el front no se muestra límite (hasta 50 personas). */
  maxPeoplePerBooking?: number;
  /** Moneda operativa del checkout (ars, brl, usd). */
  currency: BookingCurrency;
  paymentMethods: {
    mercadoPago: boolean;
  };
  /** Comisión por referido específica de la excursión. Si no está definida, se usa la del vendedor. */
  referralCommission?: {
    type: 'percent' | 'fixed';
    value: number;
    currency: BookingCurrency;
  };
};

export type ReservationStatus = 'pending' | 'reserved' | 'completed' | 'cancelled';
export type ReservationPaymentMethod = 'admin' | 'mercadopago';

export type ReservationAttachment = {
  id: string;
  url: string;
  key?: string;
  name?: string;
  type?: string;
  uploadedBy: 'admin' | 'user';
  createdAt: object;
};

export type ReservationHistoryItem = {
  status: ReservationStatus;
  actor: 'admin' | 'system';
  note?: string;
  createdAt: object;
};

export type ReservationPricingSnapshot = {
  /** Precio unitario en moneda (ej. 10 BRL). Puede ser null si se desconoce. */
  unitPrice: number | null;
  /** Precio unitario en centavos. Puede ser null si se desconoce. */
  unitAmount: number | null;
  people: number;
  amountTotal: number;
  baseSubtotalAmount?: number | null;
  extrasTotalAmount?: number | null;
  currency: string;
  paymentMethod: ReservationPaymentMethod;
};

export type ReservationCapacitySnapshot = {
  date: string;
  /** Cupo base configurado para esa fecha en bookingConfig.dates[].capacity. */
  baseCapacity: number;
  maxPeoplePerBooking: number | null;
  hasSpecificDates: boolean;
  enabled: boolean;
};

export type ReservationExperienceSnapshot = {
  id: string;
  slug: string;
  title: string;
};

export type ReservationPackageSnapshot = {
  id: string;
  slug: string;
  title: string;
};

export type ReservationReferralInfo = {
  vendorId: string;
  vendorName: string;
  code?: string;
  channel?: 'link' | 'manual' | 'other';
  commissionType: 'percent' | 'fixed';
  commissionValue: number;
  commissionCurrency: 'ars' | 'brl' | 'usd';
  commissionAmount: number;
  commissionBaseAmount?: number | null;
  extrasExcludedAmount?: number | null;
  payoutStatus: 'pending' | 'accrued' | 'paid' | 'cancelled';
  payoutAt?: object;
};

export type ReservationEmailJobStatus = 'not_sent' | 'queued' | 'sending' | 'sent' | 'failed';

export type ReservationEmailDeliveryItem = {
  status: ReservationEmailJobStatus;
  lastAttemptAt?: object | null;
  sentAt?: object | null;
  error?: string | null;
  provider?: string | null;
  providerMessageId?: string | null;
  jobId?: string | null;
};

export type ReservationEmailDelivery = {
  customerConfirmation?: ReservationEmailDeliveryItem;
  customerVoucher: ReservationEmailDeliveryItem;
  adminNotification?: ReservationEmailDeliveryItem | null;
};

export type ReservationTravelerDetails = {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  document: string;
  country?: string;
  travelerType?: 'adult' | 'minor' | null;
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
  generatedAt?: object | null;
};

export type ReservationExtraCode = 'cocheCama' | 'panoramicos' | 'cafeteras' | 'pickupPoint' | 'administrativeFee' | 'singlePassengerSurcharge';

export type ReservationExtraSelection = {
  code: ReservationExtraCode;
  label: string;
  amount: number;
  quantity?: number | null;
  categoryCode?: 'cocheCama' | 'panoramicos' | 'cafeteras' | null;
  source?: 'seatCategory' | 'seatLayout' | 'pickupPoint' | string | null;
  scope?: 'per_person' | 'per_booking' | 'per_selected_seat' | string | null;
};

export type Reservation = {
  id: string;
  reservationCode?: string | null;
  // Paquete (nuevo modelo)
  packageId?: string;
  packageSlug?: string;
  packageTitle?: string;
  // Legacy: Experience (mantener para compatibilidad)
  experienceId: string;
  experienceSlug: string;
  experienceTitle: string;
  /** Fecha de la experiencia: YYYY-MM-DD o "sin-fecha" */
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
  /** Monto total pagado en centavos */
  amountTotal: number;
  currency: string;
  paymentMethod: ReservationPaymentMethod;
  pricingMode?: 'fixed' | 'percent' | null;
  pricingBaseUnitAmount?: number | null;
  unitAmountAdults?: number | null;
  unitAmountMinors?: number | null;
  depositPercentAdults?: number | null;
  depositPercentMinors?: number | null;
  baseSubtotalAmount?: number | null;
  extrasTotalAmount?: number | null;
  
  // Mercado Pago
  mercadoPagoPaymentId?: string | null;
  mercadoPagoPreferenceId?: string | null;
  mercadoPagoStatus?: string | null;
  mercadoPagoStatusDetail?: string | null;
  externalReference?: string | null;
  
  customerEmail: string;
  customerName: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerPhone?: string;
  customerCountry?: string;
  customerDocument?: string;
  customerBirthDate?: string | null;
  customerComments?: string;
  passengerDetails?: ReservationTravelerDetails[] | null;
  attachments?: ReservationAttachment[];
  statusHistory?: ReservationHistoryItem[];
  /** Fecha de creación de la reserva (compra). En Firestore es Timestamp. */
  createdAt: object;
  updatedAt?: object;
  status: ReservationStatus;
  createdByAdmin?: boolean;
  createdByRole?: 'admin' | 'vendor' | 'system' | null;
  createdByVendorId?: string | null;
  createdByVendorName?: string | null;
  referredBy?: ReservationReferralInfo;

  /** Auditoría / trazabilidad */
  checkoutIntentId?: string | null;
  orderId?: string | null;
  cartId?: string | null;
  cartItemId?: string | null;
  pricingSnapshot?: ReservationPricingSnapshot;
  capacitySnapshot?: ReservationCapacitySnapshot;
  experienceSnapshot?: ReservationExperienceSnapshot;
  packageSnapshot?: ReservationPackageSnapshot;

  /** Butacas */
  seatLayoutId?: string | null;
  selectedSeats?: string[] | null;
  
  /** Voucher */
  paidAt?: object | null;
  voucherSent?: boolean;
  voucherSentAt?: object | null;
  voucherScheduledAt?: object | null;
  emailDelivery?: ReservationEmailDelivery | null;
};

/** Datos públicos del bloque reserva para el front (available = capacity por ahora, luego descontar reservas). */
export type BookingPublicData = {
  enabled: boolean;
  title: string;
  subtitle1: string;
  subtitle2: string;
  hasSpecificDates: boolean;
  dates: { date: string; capacity: number; available: number; enabled: boolean }[];
  depositAmount: number;
  /** Si no se define, en el front no se muestra "Máximo X personas" (techo 50). */
  maxPeoplePerBooking?: number;
  currency: BookingCurrency;
  paymentMethods: { mercadoPago: boolean };
};

export type Experience = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  supportText: string;
  topNoticeText: string;
  videoOverlayText: string;
  videoUrl?: string;
  /** URL de video de YouTube (ej. https://youtube.com/watch?v=xxx) */
  youtubeVideoUrl?: string;
  tiktokVideoId?: string;
  /** Video entre reserva/calendario y FAQ (misma lógica que el del hero) */
  midVideoUrl?: string;
  midYoutubeVideoUrl?: string;
  midTiktokVideoId?: string;
  midVideoOverlayText?: string;
  /** Imagen usada en las cards del sitio. Si no existe, se usa images[0] (retrocompatibilidad). */
  cardImage?: string;
  cardImageKey?: string;
  /** Galería de imágenes adicionales para la página de la experiencia (no incluye banner). */
  images: string[];
  imageKeys?: string[];
  galleryIntro: string;
  includes: string[];
  takeaways: string[];
  forWho: string[];
  notForWho: string[];
  testimonials: Testimonial[];
  dividerPhrase: string;
  calendarIntro: string;
  reservationMicrocopy: string;
  faqs: FaqItem[];
  /** Fechas disponibles para reserva (YYYY-MM-DD) — legacy, preferir bookingConfig.dates */
  availableDates?: string[];
  price?: number;
  maxPeople?: number;
  orden?: number;
  visible?: boolean;
  /** Métodos de pago habilitados — legacy, preferir bookingConfig.paymentMethods */
  paymentMethods?: ('mercadopago')[];
  roomTypes?: ReservationRoomType[];
  roomTypeOptions?: RoomTypeDefinition[];
  /** Configuración completa del bloque Reserva / Calendario */
  bookingConfig?: BookingConfig;
}
