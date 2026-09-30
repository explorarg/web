'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import { getReservaById, getReservaPayments, type ReservaPaymentEvent } from '@/lib/reservas';
import type {
  Reservation,
  ReservationAttachment,
  ReservationStatus,
} from '@/components/landing-reserva/types';
import type { StockMovement } from '@/lib/stock';
import {
  getPackageRoomTypeLabel,
  getPackageRoomTypeOptions,
  getRoomTypeOptionLabel,
} from '@/lib/reservas/room-types';
import AdminLayout from '@/components/admin/AdminLayout';
import SeatMap from '@/components/seats/SeatMap';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DepartureSeat, Paquete, ReservationExtraSelection, SeatLayoutTemplate } from '@/types';
import { getPaqueteById } from '@/lib/paquetes';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Armchair,
  CalendarDays,
  CarFront,
  CreditCard,
  FileText,
  Globe,
  Info,
  LayoutGrid,
  Loader2,
  Mail,
  MailCheck,
  MapPin,
  Paperclip,
  Pencil,
  Receipt,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  UploadCloud,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { getSeatCategoryLabel, isSeatCategoryCode } from '@/lib/seats/categories';
import type { Vendor, ReferralLink } from '@/types/vendor';
import { getVendors, getReferralLinksByVendor } from '@/lib/vendors';
import { getSeatCategoryExtraSummaries, getSeatCategoryTotalAmount, getSeatTypeLabel } from '@/lib/reservas/seat-category-extras';
import {
  buildVentaStatuses,
  deriveAdminEmailStatus,
  deriveCustomerConfirmationEmailStatus,
  deriveVoucherStatus,
  ventaStatusLabel,
} from '@/lib/sales/status';
import { getReservationOfficialBaseAmount } from '@/lib/reservas/pricing';
import { getReservationExtraTotalAmount, getSinglePassengerSurchargeSummary, isSinglePassengerSurchargeExtra } from '@/lib/packages/resolve-departure';
import SinglePassengerSurchargeBreakdown from '@/components/pricing/SinglePassengerSurchargeBreakdown';

const reservationStatusOptions: { value: ReservationStatus; label: string }[] = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'reserved', label: 'Reservada' },
  { value: 'completed', label: 'Completada' },
  { value: 'cancelled', label: 'Cancelada' },
];

type StockSummary = {
  baseCapacity: number;
  available: number;
  movements: StockMovement[];
};

type PaymentMovementType = 'payment' | 'extra' | 'discount' | 'refund' | 'adjustment';

type PaymentFormAttachment = {
  id: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  file: File | null;
  url?: string;
  key?: string | null;
  name: string;
  type: string;
  uploadedBy?: string | null;
  progress?: number;
  error?: string | null;
};

type PaymentFormState = {
  movementType: PaymentMovementType;
  amount: string;
  method: string;
  reference: string;
  message: string;
};

const formatDate = (date: unknown): string => {
  if (!date) return '—';
  if (typeof date === 'string')
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  const d =
    typeof date === 'object' &&
      date !== null &&
      'toDate' in date
      ? (date as { toDate: () => Date }).toDate()
      : new Date(date as Date);
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatDateTime = (date: unknown): string => {
  if (!date) return '—';
  if (typeof date === 'string')
    return new Date(date).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const d =
    typeof date === 'object' &&
      date !== null &&
      'toDate' in date
      ? (date as { toDate: () => Date }).toDate()
      : new Date(date as Date);
  return d.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const toTimestampMs = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return new Date(value).getTime();
  if (value && typeof value === 'object' && 'toDate' in value) {
    const asDate = (value as { toDate: () => Date }).toDate();
    return asDate.getTime();
  }
  if (value && typeof value === 'object' && 'seconds' in value) {
    return ((value as { seconds: number }).seconds ?? 0) * 1000;
  }
  return 0;
};

const formatAmount = (amountTotal: number, currency: string): string => {
  const value = amountTotal / 100;
  const normalized = currency.toUpperCase();
  const locale = normalized === 'BRL' ? 'pt-BR' : normalized === 'USD' ? 'en-US' : 'es-AR';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: normalized, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${normalized} ${value.toFixed(2)}`;
  }
};

const statusBadgeVariant: Record<ReservationStatus, 'default' | 'outline' | 'destructive' | 'secondary'> = {
  pending: 'outline',
  reserved: 'secondary',
  completed: 'default',
  cancelled: 'destructive',
};

const emailStatusLabel = (status: string) =>
  status === 'sent'
    ? 'Enviado'
    : status === 'queued'
      ? 'En cola'
      : status === 'sending'
        ? 'Enviando'
        : status === 'failed'
          ? 'Fallido'
          : 'Sin enviar';

const voucherStatusLabel = (status: string) =>
  status === 'sent'
    ? 'Voucher enviado'
    : status === 'generated'
      ? 'Voucher generado'
      : status === 'queued'
        ? 'Voucher en cola'
        : status === 'failed'
          ? 'Voucher fallido'
          : 'Sin voucher';

const communicationStatusDescription = (status: string, kind: 'confirmation' | 'voucher' | 'admin', scheduledAt?: unknown, sentAt?: unknown) => {
  if (kind === 'voucher') {
    if (status === 'sent') return sentAt ? `Enviado: ${formatDateTime(sentAt)}` : 'Voucher enviado correctamente.';
    if (status === 'queued' || status === 'sending') {
      return scheduledAt ? `Programado: ${formatDateTime(scheduledAt)}` : 'Pendiente de envío.';
    }
    if (status === 'failed') return 'No se pudo enviar. Revisá la configuración de correo y reintentá.';
    return 'Se envía automáticamente 48 hs antes de la salida.';
  }
  if (kind === 'confirmation') {
    if (status === 'sent') return 'Confirmación de compra enviada correctamente.';
    if (status === 'queued' || status === 'sending') return 'Pendiente de envío.';
    if (status === 'failed') return 'No se pudo enviar la confirmación. Revisá la configuración de correo.';
    return 'Confirmación inmediata de compra.';
  }
  if (status === 'sent') return 'Aviso interno enviado correctamente.';
  if (status === 'queued' || status === 'sending') return 'Pendiente de envío.';
  if (status === 'failed') return 'No se pudo enviar el aviso interno. Revisá la configuración de correo.';
  return 'Notificación operativa para el panel interno.';
};

const paymentMovementLabels: Record<PaymentMovementType, string> = {
  payment: 'Pago Recibido',
  extra: 'Extra',
  adjustment: 'Ajuste',
  discount: 'Descuento',
  refund: 'Reembolso',
};

const paymentMethodLabels: Record<string, string> = {
  mercadopago: 'Mercado Pago',
  admin: 'Manual',
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro',
};

const reservationStatusText = (status: ReservationStatus): string =>
  reservationStatusOptions.find((option) => option.value === status)?.label ?? status;

const normalizePaymentMovementType = (payment: ReservaPaymentEvent): PaymentMovementType => {
  const value = String(payment.movementType ?? '').trim().toLowerCase();
  if (value === 'extra' || value === 'discount' || value === 'refund' || value === 'adjustment') {
    return value;
  }
  return 'payment';
};

const normalizePaymentMovementTypeForDisplay = (movementType: PaymentMovementType): PaymentMovementType => {
  return movementType;
};

const paymentMethodLabel = (value: string | null | undefined): string => {
  const key = String(value ?? '').trim().toLowerCase();
  return paymentMethodLabels[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Sin definir');
};

const paymentDateLabel = (payment: ReservaPaymentEvent): string =>
  formatDateTime(payment.occurredAt ?? payment.createdAt);

const moneyInputToCents = (value: string): number => {
  const normalized = value.replace(/\./g, '').replace(',', '.').trim();
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
};

const centsToMoneyInput = (amount: number): string => (amount / 100).toFixed(2).replace('.', ',');

type PassengerFormItem = {
  firstName: string;
  lastName: string;
  document: string;
  birthDate: string;
  phone: string;
  country: string;
};

const emptyPassenger = (): PassengerFormItem => ({
  firstName: '',
  lastName: '',
  document: '',
  birthDate: '',
  phone: '',
  country: '',
});

export default function ReservaDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [reserva, setReserva] = useState<Reservation | null>(null);
  const [reservationPackage, setReservationPackage] = useState<Paquete | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ReservationStatus>('completed');
  const [statusNote, setStatusNote] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [attachments, setAttachments] = useState<ReservationAttachment[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [removingAttachmentIds, setRemovingAttachmentIds] = useState<string[]>([]);
  const [payments, setPayments] = useState<ReservaPaymentEvent[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState<string>('');
  const [referralLinks, setReferralLinks] = useState<ReferralLink[]>([]);
  const [referralLinksLoading, setReferralLinksLoading] = useState(false);
  const [selectedReferralCode, setSelectedReferralCode] = useState<string>('');
  const [manualReferralCode, setManualReferralCode] = useState<string>('');
  const [updatingReferral, setUpdatingReferral] = useState(false);
  const [savingPaymentEvent, setSavingPaymentEvent] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    movementType: 'payment',
    amount: '',
    method: 'transfer',
    reference: '',
    message: '',
  });
  const [paymentAttachments, setPaymentAttachments] = useState<PaymentFormAttachment[]>([]);
  const [paymentBeingEdited, setPaymentBeingEdited] = useState<ReservaPaymentEvent | null>(null);
  const [editPaymentForm, setEditPaymentForm] = useState<PaymentFormState | null>(null);
  const [savingPaymentEdit, setSavingPaymentEdit] = useState(false);
  const [paymentPendingDeletion, setPaymentPendingDeletion] = useState<ReservaPaymentEvent | null>(null);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [updatingRoomType, setUpdatingRoomType] = useState(false);
  const [showEditSection, setShowEditSection] = useState(false);
  const [savingEditData, setSavingEditData] = useState(false);
  const [editForm, setEditForm] = useState<{
    customerFirstName: string;
    customerLastName: string;
    customerEmail: string;
    customerPhone: string;
    customerDocument: string;
    customerBirthDate: string;
    customerCountry: string;
    customerComments: string;
    peopleAdults: string;
    peopleMinors: string;
    peopleTotal: string;
    seatType: string;
    selectedSeats: string[];
    pickupPoint: string;
    pickupPointTime: string;
  }>({
    customerFirstName: '',
    customerLastName: '',
    customerEmail: '',
    customerPhone: '',
    customerDocument: '',
    customerBirthDate: '',
    customerCountry: '',
    customerComments: '',
    peopleAdults: '',
    peopleMinors: '',
    peopleTotal: '',
    seatType: '',
    selectedSeats: [],
    pickupPoint: '',
    pickupPointTime: '',
  });
  const [passengerDetailsForm, setPassengerDetailsForm] = useState<PassengerFormItem[]>([]);

  const [seatData, setSeatData] = useState<{ template: SeatLayoutTemplate; seats: DepartureSeat[] } | null>(null);
  const [seatLoading, setSeatLoading] = useState(false);
  const [seatDialogOpen, setSeatDialogOpen] = useState(false);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);

  useEffect(() => {
    if (!reserva) return;
    const initialSeats = Array.isArray((reserva as any).selectedSeats)
      ? (reserva as any).selectedSeats.filter((s: unknown) => typeof s === 'string' && s.trim())
      : [];
    const seatTypeFromExtra = getSeatTypeLabel(
      (reserva as any).extras ?? (reserva as any).extraSelections ?? [],
      initialSeats.length
    );
    const seatTypeCurrent =
      typeof (reserva as any).seatType === 'string' && (reserva as any).seatType.trim()
        ? (reserva as any).seatType.trim()
        : seatTypeFromExtra;
    const targetPeople = Math.max(1, Number(reserva.people) || 1);
    const rawDetails = Array.isArray((reserva as any).passengerDetails)
      ? (reserva as any).passengerDetails.filter((p: any) => p && typeof p === 'object')
      : [];
    const initialDetails: PassengerFormItem[] = [];
    for (let i = 0; i < targetPeople; i++) {
      const raw = rawDetails[i];
      if (raw) {
        initialDetails.push({
          firstName: String(raw.firstName ?? '').trim(),
          lastName: String(raw.lastName ?? '').trim(),
          document: String(raw.document ?? '').trim(),
          birthDate: String(raw.birthDate ?? '').trim(),
          phone: String(raw.phone ?? '').trim(),
          country: String(raw.country ?? (reserva as any).customerCountry ?? '').trim(),
        });
      } else if (i === 0) {
        initialDetails.push({
          firstName: String(reserva.customerFirstName ?? '').trim(),
          lastName: String(reserva.customerLastName ?? '').trim(),
          document: String((reserva as any).customerDocument ?? '').trim(),
          birthDate: String((reserva as any).customerBirthDate ?? '').trim(),
          phone: String((reserva as any).customerPhone ?? '').trim(),
          country: String((reserva as any).customerCountry ?? '').trim(),
        });
      } else {
        initialDetails.push(emptyPassenger());
      }
    }
    setPassengerDetailsForm(initialDetails);
    setEditForm({
      customerFirstName: String(reserva.customerFirstName ?? '').trim(),
      customerLastName: String(reserva.customerLastName ?? '').trim(),
      customerEmail: String((reserva as any).customerEmail ?? '').trim(),
      customerPhone: String((reserva as any).customerPhone ?? '').trim(),
      customerDocument: String((reserva as any).customerDocument ?? '').trim(),
      customerBirthDate: String((reserva as any).customerBirthDate ?? '').trim(),
      customerCountry: String((reserva as any).customerCountry ?? '').trim(),
      customerComments: String((reserva as any).customerComments ?? '').trim(),
      peopleAdults: (reserva as any).peopleAdults != null ? String((reserva as any).peopleAdults) : '',
      peopleMinors: (reserva as any).peopleMinors != null ? String((reserva as any).peopleMinors) : '',
      peopleTotal: reserva.people != null ? String(targetPeople) : '',
      seatType: seatTypeCurrent,
      selectedSeats: initialSeats,
      pickupPoint: String((reserva as any).pickupPoint ?? '').trim(),
      pickupPointTime: String((reserva as any).pickupPointTime ?? '').trim(),
    });
  }, [reserva?.id, reserva?.customerFirstName, reserva?.customerLastName]);

  useEffect(() => {
    const peopleVal = Number(editForm.peopleTotal);
    const targetLen = peopleVal >= 1 ? peopleVal : 1;
    setPassengerDetailsForm((prev) => {
      if (prev.length === targetLen) return prev;
      if (prev.length > targetLen) return prev.slice(0, targetLen);
      const next = [...prev];
      while (next.length < targetLen) next.push(emptyPassenger());
      return next;
    });
  }, [editForm.peopleTotal]);

  useEffect(() => {
    if (passengerDetailsForm.length === 0) return;
    const first = passengerDetailsForm[0];
    setEditForm((prev) => {
      const next: typeof prev = { ...prev };
      let changed = false;
      if (first.firstName !== prev.customerFirstName) {
        next.customerFirstName = first.firstName;
        changed = true;
      }
      if (first.lastName !== prev.customerLastName) {
        next.customerLastName = first.lastName;
        changed = true;
      }
      if (first.document !== prev.customerDocument) {
        next.customerDocument = first.document;
        changed = true;
      }
      if (first.birthDate !== prev.customerBirthDate) {
        next.customerBirthDate = first.birthDate;
        changed = true;
      }
      if (first.phone !== prev.customerPhone) {
        next.customerPhone = first.phone;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [
    passengerDetailsForm[0]?.firstName,
    passengerDetailsForm[0]?.lastName,
    passengerDetailsForm[0]?.document,
    passengerDetailsForm[0]?.birthDate,
    passengerDetailsForm[0]?.phone,
  ]);

  const updatePassenger = useCallback(
    (index: number, field: keyof PassengerFormItem, value: string) => {
      setPassengerDetailsForm((prev) => {
        if (index < 0 || index >= prev.length) return prev;
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    []
  );

  const addPassenger = useCallback(() => {
    setPassengerDetailsForm((prev) => [...prev, emptyPassenger()]);
    setEditForm((prev) => ({
      ...prev,
      peopleTotal: String(Math.max(1, Number(prev.peopleTotal) || 0) + 1),
    }));
  }, []);

  const removePassenger = useCallback((index: number) => {
    setPassengerDetailsForm((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      setEditForm((p) => ({
        ...p,
        peopleTotal: String(Math.max(1, next.length)),
      }));
      return next;
    });
  }, []);

  const fetchSeatMap = useCallback(async () => {
    if (!reserva || !user) return;
    const packageId = String(reserva.packageId ?? reserva.experienceId ?? '').trim();
    const date = String(reserva.date ?? '').trim();
    if (!packageId || !date || date === 'sin-fecha') {
      setSeatData(null);
      return;
    }
    setSeatLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/admin/seats?packageId=${encodeURIComponent(packageId)}&date=${encodeURIComponent(date)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'No se pudo cargar el mapa de butacas');
      }
      const json = await res.json();
      if (!json?.enabled) {
        setSeatData(null);
        setSelectedSeatIds([]);
        return;
      }
      setSeatData({ template: json.template, seats: json.seats });
    } catch (err) {
      console.error('fetchSeatMap error:', err);
      setSeatData(null);
    } finally {
      setSeatLoading(false);
    }
  }, [reserva?.id, reserva?.packageId, reserva?.experienceId, reserva?.date, user]);

  useEffect(() => {
    if (seatDialogOpen || showEditSection) {
      void fetchSeatMap();
    }
  }, [seatDialogOpen, showEditSection, fetchSeatMap]);

  const seatLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of seatData?.seats ?? []) map.set(String(s.seatId), String(s.label));
    return map;
  }, [seatData?.seats]);

  const seatIdByLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of seatData?.seats ?? []) map.set(String(s.label).toLowerCase(), String(s.seatId));
    return map;
  }, [seatData?.seats]);

  const selectedSeatLabels = useMemo(
    () => selectedSeatIds.map((id) => seatLabelById.get(id) || id).filter(Boolean),
    [selectedSeatIds, seatLabelById]
  );

  const seatCategoryExtraSelections = useMemo<ReservationExtraSelection[]>(() => {
    if (!seatData?.template || !seatData.seats.length) return [];
    const counts = new Map<string, number>();
    for (const id of selectedSeatIds) {
      const seat = seatData.seats.find((s) => String(s.seatId) === String(id));
      if (!seat) continue;
      const code =
        seat.category && isSeatCategoryCode(seat.category) ? seat.category : 'standard';
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    const pricing = (seatData.template as any)?.categoryPricing ?? {};
    const result: ReservationExtraSelection[] = [];
    for (const [code, quantity] of counts.entries()) {
      if (code === 'standard') continue;
      const def = pricing[code];
      const amount = Math.max(0, Number(def?.amount ?? def?.price ?? 0) || 0);
      result.push({
        code: code as any,
        label: getSeatCategoryLabel(code as any) || code,
        amount,
        quantity,
        categoryCode: isSeatCategoryCode(code) ? code : null,
        source: 'seatCategory',
        scope: 'per_selected_seat',
      } as any);
    }
    return result;
  }, [selectedSeatIds, seatData?.template, seatData?.seats]);

  const seatCategorySummaries = useMemo(
    () => getSeatCategoryExtraSummaries(seatCategoryExtraSelections),
    [seatCategoryExtraSelections]
  );

  const autoSeatTypeLabel = useMemo(
    () => getSeatTypeLabel(seatCategoryExtraSelections, selectedSeatIds.length),
    [seatCategoryExtraSelections, selectedSeatIds.length]
  );

  useEffect(() => {
    if (seatData?.seats?.length && selectedSeatIds.length === 0 && editForm.selectedSeats.length > 0) {
      const nextIds: string[] = [];
      for (const label of editForm.selectedSeats) {
        const id = seatIdByLabel.get(String(label).toLowerCase());
        if (id) nextIds.push(id);
      }
      if (nextIds.length) {
        setSelectedSeatIds(nextIds);
      }
    }
  }, [seatData?.seats, seatIdByLabel, editForm.selectedSeats, selectedSeatIds.length]);

  useEffect(() => {
    setEditForm((prev) => {
      const labelsChanged =
        prev.selectedSeats.length !== selectedSeatLabels.length ||
        prev.selectedSeats.some((s, i) => s !== selectedSeatLabels[i]);
      const nextSeatType = autoSeatTypeLabel || prev.seatType;
      const seatTypeChanged = nextSeatType && nextSeatType !== prev.seatType;
      if (!labelsChanged && !seatTypeChanged) return prev;
      return {
        ...prev,
        selectedSeats: labelsChanged ? [...selectedSeatLabels] : prev.selectedSeats,
        seatType: seatTypeChanged ? nextSeatType : prev.seatType,
      };
    });
  }, [selectedSeatLabels, autoSeatTypeLabel]);

  const isFullDayDeparture = useMemo(() => {
    if (!reserva) return false;
    const roomType = String((reserva as any).roomType ?? '').trim();
    const definition = getPackageRoomTypeOptions(reservationPackage).find((option) => option.id === roomType);
    return definition?.isFullDay ?? roomType === 'full-day';
  }, [reserva, reservationPackage]);

  const handleSaveEditData = async () => {
    if (!reserva || !user) return;
    const cleanedPassengers = passengerDetailsForm.map((p, i) => ({
      firstName: String(p.firstName ?? '').trim(),
      lastName: String(p.lastName ?? '').trim(),
      document: String(p.document ?? '').trim(),
      birthDate: String(p.birthDate ?? '').trim(),
      phone: String(p.phone ?? '').trim(),
      country: String(p.country ?? '').trim(),
    }));
    const firstPassenger = cleanedPassengers[0];
    if (firstPassenger) {
      if (!firstPassenger.firstName || firstPassenger.firstName.length < 2) {
        toast.error('Pasajero 1: el nombre debe tener al menos 2 caracteres.');
        return;
      }
      if (!firstPassenger.lastName || firstPassenger.lastName.length < 2) {
        toast.error('Pasajero 1: el apellido debe tener al menos 2 caracteres.');
        return;
      }
      if (!firstPassenger.document || firstPassenger.document.length < 3) {
        toast.error('Pasajero 1: el documento debe tener al menos 3 caracteres.');
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(firstPassenger.birthDate)) {
        toast.error('Pasajero 1: la fecha de nacimiento es inválida.');
        return;
      }
      if (!firstPassenger.phone || firstPassenger.phone.length < 8) {
        toast.error('Pasajero 1: el teléfono debe tener al menos 8 caracteres.');
        return;
      }
      if (!firstPassenger.country || firstPassenger.country.length < 2) {
        toast.error('Pasajero 1: el país es obligatorio.');
        return;
      }
    }
    const additionalPassengers = cleanedPassengers.slice(1).filter((p) => p.firstName || p.lastName || p.document || p.birthDate || p.phone || p.country);
    for (let i = 0; i < additionalPassengers.length; i++) {
      const p = additionalPassengers[i];
      const originalIndex = cleanedPassengers.indexOf(p);
      if (!p.firstName || p.firstName.length < 2) {
        toast.error(`Pasajero ${originalIndex + 1}: el nombre debe tener al menos 2 caracteres.`);
        return;
      }
      if (!p.lastName || p.lastName.length < 2) {
        toast.error(`Pasajero ${originalIndex + 1}: el apellido debe tener al menos 2 caracteres.`);
        return;
      }
      if (!p.document || p.document.length < 3) {
        toast.error(`Pasajero ${originalIndex + 1}: el documento debe tener al menos 3 caracteres.`);
        return;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.birthDate)) {
        toast.error(`Pasajero ${originalIndex + 1}: la fecha de nacimiento es inválida.`);
        return;
      }
      if (!p.phone || p.phone.length < 8) {
        toast.error(`Pasajero ${originalIndex + 1}: el teléfono debe tener al menos 8 caracteres.`);
        return;
      }
      if (!p.country || p.country.trim().length < 2) {
        toast.error(`Pasajero ${originalIndex + 1}: el país es obligatorio.`);
        return;
      }
    }
    const finalPassengers = [firstPassenger, ...additionalPassengers].filter(Boolean) as typeof cleanedPassengers;
    setSavingEditData(true);
    try {
      const payload: Record<string, any> = { reservationId: reserva.id };
      if (editForm.customerFirstName.trim()) payload.customerFirstName = editForm.customerFirstName.trim();
      if (editForm.customerLastName.trim()) payload.customerLastName = editForm.customerLastName.trim();
      if (editForm.customerEmail !== undefined) payload.customerEmail = editForm.customerEmail.trim();
      if (editForm.customerPhone !== undefined) payload.customerPhone = editForm.customerPhone.trim();
      if (editForm.customerDocument !== undefined) payload.customerDocument = editForm.customerDocument.trim();
      if (editForm.customerBirthDate !== undefined) payload.customerBirthDate = editForm.customerBirthDate.trim();
      if (editForm.customerCountry !== undefined) payload.customerCountry = editForm.customerCountry.trim();
      if (editForm.customerComments !== undefined) payload.customerComments = editForm.customerComments.trim();
      if (editForm.pickupPoint !== undefined) payload.pickupPoint = editForm.pickupPoint.trim();
      if (editForm.pickupPointTime !== undefined) {
        payload.pickupPointTime = editForm.pickupPointTime.trim() ? editForm.pickupPointTime.trim() : null;
      }
      const peopleTotal = editForm.peopleTotal === '' ? null : Number(editForm.peopleTotal);
      if (peopleTotal != null && Number.isFinite(peopleTotal) && peopleTotal >= 1 && peopleTotal <= 50) {
        payload.people = Math.max(1, Math.floor(peopleTotal));
      }
      const finalSeatType = autoSeatTypeLabel || editForm.seatType;
      if (typeof finalSeatType === 'string') payload.seatType = finalSeatType;
      if (Array.isArray(editForm.selectedSeats)) payload.selectedSeats = editForm.selectedSeats.filter((s) => s && s.trim());
      payload.passengerDetails = finalPassengers;

      const token = await user.getIdToken();
      const response = await fetch('/api/admin/reservas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'No se pudieron guardar los cambios.');
      }
      toast.success('Datos de la reserva actualizados');
      await loadReserva({ showLoading: false });
      setShowEditSection(false);
    } catch (error) {
      console.error('Error guardando edición:', error);
      toast.error(error instanceof Error ? error.message : 'No pudimos actualizar los datos.');
    } finally {
      setSavingEditData(false);
    }
  };

  const loadReserva = useCallback(async (options: { showLoading?: boolean } = {}) => {
    if (options.showLoading) setLoading(true);
    try {
      const data = await getReservaById(params.id);
      if (!data) {
        toast.error('Venta no encontrada');
        router.replace('/admin/ventas');
        return;
      }
      setReserva(data);
      setStatus(data.status);
      setAttachments(data.attachments ?? []);
      setPaymentsLoading(true);
      const pay = await getReservaPayments(params.id, { limit: 50 });
      setPayments(pay);
    } catch (error) {
      console.error('Error cargando venta:', error);
      toast.error('No pudimos cargar la venta');
    } finally {
      if (options.showLoading) setLoading(false);
      setPaymentsLoading(false);
    }
  }, [params.id, router]);

  const ventaStatuses = useMemo(() => (reserva ? buildVentaStatuses(reserva) : null), [reserva]);
  const paymentsCurrency = useMemo(() => {
    const first = payments.find((p) => typeof p.currency === 'string' && p.currency.trim());
    return String(first?.currency ?? reserva?.currency ?? 'ars');
  }, [payments, reserva?.currency]);
  const referralLinksForReservation = useMemo(() => {
    const packageId = String(reserva?.packageId ?? reserva?.experienceId ?? '').trim();
    if (!packageId) return referralLinks;
    return referralLinks.filter((link) => {
      const linkPackageId = String(link.packageId ?? link.experienceId ?? '').trim();
      return !linkPackageId || linkPackageId === packageId;
    });
  }, [referralLinks, reserva?.experienceId, reserva?.packageId]);
  const paymentSummary = useMemo(() => {
    const baseTotal = Number(reserva?.amountTotal ?? 0);
    let totalPaid = 0;
    let totalAdjustments = 0;
    for (const payment of payments) {
      const movementType = normalizePaymentMovementType(payment);
      const amount = Math.max(0, Number(payment.amount ?? 0));
      if (movementType === 'payment') totalPaid += amount;
      if (movementType === 'refund') totalPaid -= amount;
      if (movementType === 'extra' || movementType === 'adjustment') totalAdjustments += amount;
      if (movementType === 'discount') totalAdjustments -= amount;
    }
    const billedTotal = Math.max(0, baseTotal + totalAdjustments);
    const balance = billedTotal - totalPaid;
    return { baseTotal, totalAdjustments, billedTotal, totalPaid, balance };
  }, [payments, reserva?.amountTotal]);
  const reservaRoomTypeOptions = useMemo(() => {
    const currentRoomType = String((reserva as any)?.roomType ?? '').trim();
    const options = getPackageRoomTypeOptions(reservationPackage).map((option) => ({
      value: option.id,
      label: option.label,
      description: option.description,
    }));
    if (currentRoomType && !options.some((option) => option.value === currentRoomType)) {
      options.push({ value: currentRoomType, label: currentRoomType, description: '' });
    }
    return options;
  }, [reserva, reservationPackage]);

  useEffect(() => {
    loadReserva({ showLoading: true });
  }, [loadReserva]);

  useEffect(() => {
    const packageId = String(reserva?.packageId ?? reserva?.experienceId ?? '').trim();
    if (!packageId) {
      setReservationPackage(null);
      return;
    }
    let cancelled = false;
    void getPaqueteById(packageId).then((paquete) => {
      if (!cancelled) setReservationPackage(paquete);
    }).catch(() => {
      if (!cancelled) setReservationPackage(null);
    });
    return () => { cancelled = true; };
  }, [reserva?.experienceId, reserva?.packageId]);

  useEffect(() => {
    let cancelled = false;
    const loadVendors = async () => {
      try {
        const list = await getVendors({ activeOnly: true, limit: 200 });
        if (!cancelled) setVendors(list);
      } catch {
      }
    };
    loadVendors();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!reserva?.referredBy) {
      setVendorId('');
      setSelectedReferralCode('');
      setManualReferralCode('');
      setReferralLinks([]);
      return;
    }
    setVendorId(reserva.referredBy.vendorId ?? '');
    setSelectedReferralCode(reserva.referredBy.code ?? '');
    setManualReferralCode('');
  }, [reserva?.referredBy]);

  useEffect(() => {
    let cancelled = false;
    const loadLinks = async () => {
      if (!vendorId) {
        setReferralLinks([]);
        setReferralLinksLoading(false);
        return;
      }
      setReferralLinksLoading(true);
      try {
        const links = await getReferralLinksByVendor(vendorId);
        if (!cancelled) setReferralLinks(links);
      } catch {
        if (!cancelled) setReferralLinks([]);
      } finally {
        if (!cancelled) setReferralLinksLoading(false);
      }
    };
    loadLinks();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  useEffect(() => {
    if (!selectedReferralCode || referralLinksLoading) return;
    const exists = referralLinksForReservation.some((link) => link.code === selectedReferralCode);
    const currentAssignedCode = String(reserva?.referredBy?.code ?? '').trim();
    if (!exists && selectedReferralCode !== currentAssignedCode) setSelectedReferralCode('');
  }, [referralLinksForReservation, referralLinksLoading, reserva?.referredBy?.code, selectedReferralCode]);

  const fetchStockInfo = useCallback(async () => {
    const packageId = String(reserva?.packageId ?? reserva?.experienceId ?? '').trim();
    const date = String(reserva?.date ?? '').trim();
    if (!reserva || !user || !packageId || !date || date === 'sin-fecha') {
      setStockSummary(null);
      return;
    }
    setStockLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/admin/stock?packageId=${encodeURIComponent(packageId)}&date=${encodeURIComponent(date)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        setStockSummary(null);
        return;
      }
      const data = await response.json();
      setStockSummary(data);
    } catch {
      setStockSummary(null);
    } finally {
      setStockLoading(false);
    }
  }, [reserva, user]);

  useEffect(() => {
    fetchStockInfo();
  }, [fetchStockInfo]);

  const handleReferralUpdate = async (options: { clear?: boolean } = {}) => {
    if (!reserva || !user) return;
    const manualCode = manualReferralCode.trim();
    const suggestedCode = selectedReferralCode.trim();
    setUpdatingReferral(true);
    try {
      const token = await user.getIdToken();
      const body: any = {
        reservationId: reserva.id,
      };
      if (options.clear) {
        body.clearReferredBy = true;
      } else {
        if (vendorId) body.vendorId = vendorId;
        if (manualCode) {
          body.referralCode = manualCode;
        } else if (suggestedCode) {
          body.referralCode = suggestedCode;
        }
      }
      const response = await fetch('/api/admin/reservas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? 'No se pudo actualizar el referido');
      }
      toast.success(options.clear ? 'Referido eliminado' : 'Referido actualizado');
      await loadReserva({ showLoading: false });
    } catch (error) {
      console.error('Error actualizando referido:', error);
      toast.error('No pudimos actualizar el referido');
    } finally {
      setUpdatingReferral(false);
    }
  };

  const handlePickPaymentAttachments = (files: FileList | File[] | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, 12);
    const mapped: PaymentFormAttachment[] = list.map((file) => ({
      id: crypto.randomUUID(),
      status: 'pending',
      file,
      name: file.name,
      type: file.type,
      uploadedBy: user?.email ?? 'admin',
    }));
    setPaymentAttachments((current) => {
      const merged = [...current, ...mapped];
      return merged.slice(0, 12);
    });
  };

  const handleRemovePaymentAttachment = (id: string) => {
    setPaymentAttachments((current) => current.filter((att) => att.id !== id));
  };

  const handleAddPaymentEvent = async () => {
    if (!reserva || !user) return;
    const amount = moneyInputToCents(paymentForm.amount);
    if (!amount) {
      toast.error('Ingresá un monto válido');
      return;
    }
    if (!paymentForm.message.trim()) {
      toast.error('Ingresá un detalle del movimiento');
      return;
    }

    setSavingPaymentEvent(true);
    let finalAttachments: (PaymentFormAttachment & { url: string; key?: string | null })[] = [];
    try {
      if (paymentAttachments.length > 0) {
        setPaymentAttachments((curr) =>
          curr.map((a) =>
            a.status === 'pending'
              ? { ...a, status: 'uploading' as const, progress: 0 }
              : a
          )
        );

        const uploads: typeof finalAttachments = [];
        for (let i = 0; i < paymentAttachments.length; i++) {
          const att = paymentAttachments[i];
          if (!att.file) continue;
          try {
            const formData = new FormData();
            formData.append('file', att.file);
            const uploadResponse = await fetch('/api/upload', { method: 'POST', body: formData });
            if (!uploadResponse.ok) throw new Error(`No se pudo subir: ${att.name}`);
            const data = (await uploadResponse.json()) as { url: string; key?: string };
            const finished = {
              ...att,
              status: 'done' as const,
              url: data.url,
              key: data.key ?? null,
              progress: 100,
            };
            uploads.push(finished);
            setPaymentAttachments((curr) =>
              curr.map((item) => (item.id === att.id ? finished : item))
            );
          } catch (err) {
            const withError: PaymentFormAttachment = {
              ...att,
              status: 'error',
              error: err instanceof Error ? err.message : 'Error al subir',
            };
            setPaymentAttachments((curr) =>
              curr.map((item) => (item.id === att.id ? withError : item))
            );
            throw err;
          }
        }
        finalAttachments = uploads;
      }

      const token = await user.getIdToken();
      const body: Record<string, unknown> = {
        reservationId: reserva.id,
        addPaymentEvent: {
          movementType: paymentForm.movementType,
          amount,
          currency: reserva.currency,
          method: paymentForm.method,
          reference: paymentForm.reference.trim() || undefined,
          message: paymentForm.message.trim(),
          ...(finalAttachments.length > 0
            ? {
              attachments: finalAttachments.map((a) => ({
                url: a.url,
                key: typeof a.key === 'string' ? a.key : '',
                name: a.name,
                type: a.type,
                uploadedBy: typeof a.uploadedBy === 'string' ? a.uploadedBy : 'admin',
              })),
            }
            : {}),
        },
      };

      const response = await fetch('/api/admin/reservas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? 'No se pudo registrar el movimiento');
      }
      toast.success(
        finalAttachments.length > 0
          ? `Movimiento registrado con ${finalAttachments.length} comprobante${finalAttachments.length !== 1 ? 's' : ''}`
          : 'Movimiento registrado'
      );
      setPaymentForm({
        movementType: 'payment',
        amount: '',
        method: 'transfer',
        reference: '',
        message: '',
      });
      setPaymentAttachments([]);
      await loadReserva({ showLoading: false });
    } catch (error) {
      console.error('Error registrando movimiento financiero:', error);
      toast.error(error instanceof Error ? error.message : 'No pudimos registrar el movimiento');
    } finally {
      setSavingPaymentEvent(false);
    }
  };

  const openPaymentEditor = (payment: ReservaPaymentEvent) => {
    setPaymentBeingEdited(payment);
    setEditPaymentForm({
      movementType: normalizePaymentMovementType(payment),
      amount: centsToMoneyInput(Number(payment.amount ?? 0)),
      method: String(payment.method ?? 'transfer'),
      reference: String(payment.reference ?? ''),
      message: String(payment.message ?? ''),
    });
  };

  const handleEditPaymentEvent = async () => {
    if (!reserva || !user || !paymentBeingEdited || !editPaymentForm) return;
    const amount = moneyInputToCents(editPaymentForm.amount);
    if (!amount) {
      toast.error('Ingresá un monto válido');
      return;
    }
    if (!editPaymentForm.message.trim()) {
      toast.error('Ingresá un detalle del movimiento');
      return;
    }

    setSavingPaymentEdit(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/reservas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          reservationId: reserva.id,
          editPaymentEvent: {
            paymentId: paymentBeingEdited.id,
            movement: {
              movementType: editPaymentForm.movementType,
              amount,
              currency: reserva.currency,
              method: editPaymentForm.method,
              reference: editPaymentForm.reference.trim() || undefined,
              message: editPaymentForm.message.trim(),
            },
          },
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? 'No se pudo editar el movimiento');
      }
      toast.success('Movimiento actualizado');
      setPaymentBeingEdited(null);
      setEditPaymentForm(null);
      await loadReserva({ showLoading: false });
    } catch (error) {
      console.error('Error editando movimiento financiero:', error);
      toast.error(error instanceof Error ? error.message : 'No pudimos editar el movimiento');
    } finally {
      setSavingPaymentEdit(false);
    }
  };

  const handleDeletePaymentEvent = async () => {
    if (!reserva || !user || !paymentPendingDeletion) return;
    setDeletingPayment(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/reservas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          reservationId: reserva.id,
          deletePaymentEvent: { paymentId: paymentPendingDeletion.id },
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? 'No se pudo eliminar el movimiento');
      }
      toast.success('Movimiento eliminado');
      setPaymentPendingDeletion(null);
      await loadReserva({ showLoading: false });
    } catch (error) {
      console.error('Error eliminando movimiento financiero:', error);
      toast.error(error instanceof Error ? error.message : 'No pudimos eliminar el movimiento');
    } finally {
      setDeletingPayment(false);
    }
  };

  const handleStatusUpdate = async (targetStatus: ReservationStatus, note?: string) => {
    if (!reserva || !user) return;
    setStatusUpdating(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/reservas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reservationId: reserva.id,
          status: targetStatus,
          note: note ?? statusNote,
        }),
      });
      if (!response.ok) {
        throw new Error('No se pudo actualizar el estado');
      }
      toast.success('Estado actualizado');
      await loadReserva({ showLoading: false });
      await fetchStockInfo();
    } catch (error) {
      console.error('Error actualizando estado:', error);
      toast.error('No pudimos actualizar el estado');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleCancelReservation = () => handleStatusUpdate('cancelled', 'Cancelada desde el panel administrador');

  const handleRoomTypeUpdate = async (roomType: string) => {
    if (!reserva || !user) return;
    setUpdatingRoomType(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/reservas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reservationId: reserva.id,
          roomType,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? 'No se pudo actualizar el tipo de habitación');
      }
      toast.success('Tipo de habitación actualizado');
      await loadReserva({ showLoading: false });
    } catch (error) {
      console.error('Error actualizando tipo de habitación:', error);
      toast.error('No pudimos actualizar el tipo de habitación');
    } finally {
      setUpdatingRoomType(false);
    }
  };

  const enqueueEmail = async (type: 'customer' | 'admin') => {
    if (!reserva || !user) return;
    try {
      setStatusUpdating(true);
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/reservas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reservationId: reserva.id,
          ...(type === 'customer'
            ? { enqueueCustomerVoucherEmail: true }
            : { enqueueAdminNotificationEmail: true }),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || (type === 'customer' ? 'No se pudo enviar el voucher' : 'No se pudo reenviar el aviso interno'));
      }
      toast.success(type === 'customer' ? 'Voucher enviado' : 'Aviso interno reencolado');
      await loadReserva({ showLoading: false });
    } catch (error) {
      console.error('Error reenviando email:', error);
      toast.error(error instanceof Error ? error.message : 'No pudimos reenviar el email');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    const input = event.currentTarget;
    if (!files?.length || !reserva || !user) return;
    setUploadingAttachments(true);
    const uploadedAttachments: ReservationAttachment[] = [];
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!uploadResponse.ok) {
          throw new Error('No se pudo subir el archivo');
        }
        const data = await uploadResponse.json();
        uploadedAttachments.push({
          id: crypto.randomUUID(),
          url: data.url,
          name: file.name,
          type: file.type,
          uploadedBy: 'admin',
          createdAt: new Date(),
        });
      } catch (error) {
        console.error('[Detalle Reserva] Error subiendo archivo:', error);
        toast.error('No pudimos subir el archivo');
      }
    }

    if (uploadedAttachments.length === 0) {
      setUploadingAttachments(false);
      return;
    }

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/reservas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reservationId: reserva.id,
          attachments: uploadedAttachments.map((attachment) => ({
            url: attachment.url,
            name: attachment.name,
            type: attachment.type,
            uploadedBy: 'admin',
          })),
        }),
      });
      if (!response.ok) {
        throw new Error('No se pudo guardar el comprobante');
      }
      toast.success('Comprobantes actualizados');
      await loadReserva({ showLoading: false });
    } catch (error) {
      console.error('[Detalle Reserva] Error guardando adjuntos:', error);
      toast.error('No pudimos guardar los adjuntos');
    } finally {
      setUploadingAttachments(false);
      if (input) {
        input.value = '';
      }
    }
  };

  const handleAttachmentDelete = async (attachmentId: string) => {
    if (!reserva || !user) return;
    setRemovingAttachmentIds((prev) => [...prev, attachmentId]);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/reservas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reservationId: reserva.id,
          removeAttachments: [{ id: attachmentId }],
        }),
      });
      if (!response.ok) {
        throw new Error('No pudimos borrar el archivo');
      }
      toast.success('Comprobante eliminado');
      await loadReserva({ showLoading: false });
      await fetchStockInfo();
    } catch (error) {
      console.error('[Detalle Reserva] Error eliminando adjunto:', error);
      toast.error('No pudimos eliminar el comprobante');
    } finally {
      setRemovingAttachmentIds((prev) => prev.filter((id) => id !== attachmentId));
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="mx-auto flex flex-col gap-6 px-4 pb-10 pt-6 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <div className="h-3 w-20 bg-gray-200 rounded-md animate-pulse" />
                <div className="h-7 w-56 bg-gray-200 rounded-md animate-pulse" />
                <div className="h-4 w-40 bg-gray-200 rounded-md animate-pulse" />
              </div>
              <div className="h-6 w-20 bg-gray-200 rounded-md animate-pulse" />
            </div>

            <section className="grid gap-4 rounded-3xl bg-white/90 px-5 py-4 shadow-lg ring-1 ring-black/5 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="h-3 w-24 bg-gray-200 rounded-md animate-pulse" />
                <div className="h-6 w-40 bg-gray-200 rounded-md animate-pulse" />
                <div className="flex gap-2">
                  <div className="h-5 w-16 bg-gray-200 rounded-md animate-pulse" />
                  <div className="h-3 w-28 bg-gray-200 rounded-md animate-pulse" />
                </div>
                <div className="h-3 w-24 bg-gray-200 rounded-md animate-pulse" />
              </div>
              <div className="space-y-2 border-l border-dashed border-black/5 pl-4 sm:border-l sm:pl-6">
                <div className="h-3 w-20 bg-gray-200 rounded-md animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-gray-200 rounded-md animate-pulse" />
                  <div className="h-4 w-24 bg-gray-200 rounded-md animate-pulse" />
                  <div className="h-3 w-32 bg-gray-200 rounded-md animate-pulse" />
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white/90 p-5 shadow-lg ring-1 ring-black/5">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-3 w-16 bg-gray-200 rounded-md animate-pulse" />
                  <div className="h-6 w-48 bg-gray-200 rounded-md animate-pulse" />
                  <div className="h-3 w-40 bg-gray-200 rounded-md animate-pulse" />
                </div>
                <div className="h-6 w-16 bg-gray-200 rounded-md animate-pulse" />
              </div>
              <div className="mt-4 grid gap-2 rounded-2xl bg-gray-50/70 p-4 sm:grid-cols-2">
                <div className="h-4 w-24 bg-gray-200 rounded-md animate-pulse" />
                <div className="h-4 w-20 bg-gray-200 rounded-md animate-pulse" />
              </div>
            </section>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (!reserva) return null;

  const statusLabel = reserva.status;
  const reservationLabel = reserva.packageTitle || reserva.experienceTitle || 'Reserva confirmada';
  const reservationCode = String((reserva as any).reservationCode ?? '').trim();
  const pickupPointLabel = String((reserva as any).pickupPoint ?? '').trim();
  const pickupPointTimeLabel = String((reserva as any).pickupPointTime ?? '').trim();
  const selectedExtras = Array.isArray((reserva as any).selectedExtras)
    ? (reserva as any).selectedExtras.filter((item: any) => String(item?.label ?? '').trim().length > 0)
    : [];
  const seatCategoryExtras = getSeatCategoryExtraSummaries(selectedExtras as any);
  const nonSurchargeExtras = selectedExtras.filter((item: any) => !isSinglePassengerSurchargeExtra(item));
  const seatTypeLabel = getSeatTypeLabel(
    selectedExtras as any,
    Array.isArray((reserva as any).selectedSeats) ? (reserva as any).selectedSeats.length : 0
  );
  const seatCategoryTotalAmount = getSeatCategoryTotalAmount(selectedExtras as any);
  const passengerDetails = Array.isArray((reserva as any).passengerDetails)
    ? (reserva as any).passengerDetails
    : [];
  const paymentRows = payments
    .slice()
    .sort((a, b) => toTimestampMs(b.occurredAt ?? b.createdAt) - toTimestampMs(a.occurredAt ?? a.createdAt));
  const baseSubtotalAmount =
    typeof reserva.pricingBaseUnitAmount === 'number' &&
    Number.isFinite(reserva.pricingBaseUnitAmount) &&
    reserva.pricingBaseUnitAmount > 0 &&
    Number(reserva.people) > 0
      ? Math.round(reserva.pricingBaseUnitAmount) * Math.max(1, Number(reserva.people) || 1)
      : Math.max(
          0,
          Number(reserva.amountTotal ?? 0) -
            selectedExtras.reduce(
              (sum: number, extra: any) =>
                sum + getReservationExtraTotalAmount(extra, Math.max(1, Number(reserva.people) || 1)),
              0
            )
        );

  const editedPeopleCount = (() => {
    const val = Number(editForm.peopleTotal);
    return Number.isFinite(val) && val >= 1 ? val : Math.max(1, Number(reserva.people) || 1);
  })();

  const singlePassengerSurcharge = getSinglePassengerSurchargeSummary({
    people: Math.max(1, Number(reserva.people) || 1),
    baseSubtotalAmount,
    selectedExtras: selectedExtras as any,
  });

  const editedSinglePassengerSurcharge = getSinglePassengerSurchargeSummary({
    people: editedPeopleCount,
    baseSubtotalAmount,
    selectedExtras: selectedExtras as any,
  });

  const editedPaymentSummary = (() => {
    const originalPeople = Math.max(1, Number(reserva.people) || 1);
    const originalSurcharge = singlePassengerSurcharge.amount;
    const otherExtrasTotal = selectedExtras
      .filter((item: any) => !isSinglePassengerSurchargeExtra(item))
      .reduce(
        (sum: number, extra: any) => sum + getReservationExtraTotalAmount(extra, originalPeople),
        0
      );
    const editedBase =
      typeof reserva.pricingBaseUnitAmount === 'number' &&
      Number.isFinite(reserva.pricingBaseUnitAmount) &&
      reserva.pricingBaseUnitAmount > 0
        ? Math.round(reserva.pricingBaseUnitAmount) * editedPeopleCount
        : Math.round((baseSubtotalAmount * editedPeopleCount) / originalPeople);
    const editedBaseTotal = editedBase + otherExtrasTotal + editedSinglePassengerSurcharge.amount;
    const editedBilledTotal = Math.max(0, editedBaseTotal + paymentSummary.totalAdjustments);
    const editedBalance = editedBilledTotal - paymentSummary.totalPaid;
    return {
      baseTotal: editedBaseTotal,
      totalAdjustments: paymentSummary.totalAdjustments,
      billedTotal: editedBilledTotal,
      totalPaid: paymentSummary.totalPaid,
      balance: editedBalance,
    };
  })();

  const effectivePaymentSummary = showEditSection ? editedPaymentSummary : paymentSummary;
  const effectiveSurcharge = showEditSection ? editedSinglePassengerSurcharge : singlePassengerSurcharge;
  const referralCommissionBaseAmount = reserva.referredBy
    ? getReservationOfficialBaseAmount({
      pricingBaseUnitAmount: reserva.pricingBaseUnitAmount,
      people: reserva.people,
      baseSubtotalAmount: (reserva as any).baseSubtotalAmount,
      amountTotal: reserva.amountTotal,
      extrasTotalAmount: (reserva as any).extrasTotalAmount,
    })
    : null;
  const displayedReferralCommissionAmount =
    reserva.referredBy && referralCommissionBaseAmount !== null
      ? reserva.referredBy.commissionType === 'percent'
        ? Math.round(referralCommissionBaseAmount * ((Number(reserva.referredBy.commissionValue) || 0) / 100))
        : typeof reserva.referredBy.commissionAmount === 'number'
          ? Math.round(reserva.referredBy.commissionAmount)
          : Math.round((Number(reserva.referredBy.commissionValue) || 0) * 100)
      : null;

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="mx-auto flex min-h-[calc(100vh-80px)] flex-col gap-4 px-3 pb-8 pt-4 sm:px-5 xl:max-w-[1560px]">
          {/* HEADER: bread + header banner compacto */}
          <div className="space-y-4">
            <div className="flex items-center gap-1 text-[11px] text-gray-500">
              <Link
                href="/admin/ventas"
                className="flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-gray-100 hover:text-gray-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Volver a ventas</span>
              </Link>
              <span className="text-gray-300">/</span>
              <span className="truncate max-w-[240px]">
                {reservationCode ? `Código ${reservationCode}` : String(reserva.id ?? '').slice(0, 16)}
              </span>
            </div>

            {/* BANNER PRINCIPAL con info + acciones */}
            <Card className="relative overflow-hidden !py-4 shadow-[0_8px_30px_rgba(16,56,91,0.06)]">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#2BB8BF] via-[#5FB0C4] to-[#1D6FA3]" />
              <CardContent className="!px-4 sm:!px-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  {/* Lado izq: Titulo + paquete + data operativa */}
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="min-w-0 flex flex-wrap items-center gap-2">
                      <Badge variant={statusBadgeVariant[statusLabel]} className="text-[11px] capitalize">
                        {ventaStatuses?.commercialStatusLabel ?? ventaStatusLabel(statusLabel)}
                      </Badge>
                      {effectivePaymentSummary.balance > 0 ? (
                        <Badge variant="outline" className="border-amber-200 bg-amber-50/80 text-[11px] font-medium text-amber-700">
                          {formatAmount(effectivePaymentSummary.balance, reserva.currency)} pendiente
                        </Badge>
                      ) : effectivePaymentSummary.balance < 0 ? (
                        <Badge variant="outline" className="border-indigo-200 bg-indigo-50/80 text-[11px] font-medium text-indigo-700">
                          {formatAmount(Math.abs(effectivePaymentSummary.balance), reserva.currency)} a favor
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50/80 text-[11px] font-medium text-emerald-700">
                          Cobro conciliado
                        </Badge>
                      )}
                      {reservationCode ? (
                        <span className="font-mono text-[11px] font-medium text-gray-500">#{reservationCode}</span>
                      ) : null}
                    </div>
                    <h1 className="text-lg font-semibold leading-tight tracking-tight text-gray-900 sm:text-xl">
                      {reserva.customerName || 'Cliente sin nombre'}
                      <span className="ml-2 text-base font-normal text-gray-500">· {reserva.people} pax</span>
                    </h1>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                        {reserva.date === 'sin-fecha' ? 'Fecha a coordinar' : formatDate(reserva.date)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-gray-400" />
                        {ventaStatuses?.paymentMethodLabel ?? paymentMethodLabel(reserva.paymentMethod)}
                      </span>
                      <span className="truncate max-w-[320px] text-gray-500">
                        {reservationLabel}
                      </span>
                      {isFullDayDeparture ? (
                        <Badge variant="outline" className="border-sky-300 bg-white text-[11px] font-semibold uppercase tracking-widest text-sky-700">
                          Full day · Sin habitación
                        </Badge>
                      ) : typeof (reserva as any).roomType === 'string' && (reserva as any).roomType ? (
                        <Badge variant="outline" className="border-indigo-200 bg-indigo-50/60 text-[11px] text-indigo-700">
                          Habitación · {reservationPackage
                            ? getPackageRoomTypeLabel(reservationPackage, (reserva as any).roomType)
                            : getRoomTypeOptionLabel((reserva as any).roomType)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  {/* Lado der: acciones */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowEditSection((v) => !v)}>
                      <FileText className="mr-2 h-4 w-4" />
                      {showEditSection ? 'Cerrar edición' : 'Editar datos'}
                    </Button>
                    <Button size="sm" variant="success" disabled={statusUpdating} onClick={() => enqueueEmail('customer')}>
                      <MailCheck className="mr-2 h-4 w-4" />
                      Enviar comprobante
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

            {/* LAYOUT PRINCIPAL: 3 columnas sticky */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[300px_minmax(0,1fr)_340px] xl:gap-4">
            {/* ============= COLUMNA IZQUIERDA (sticky) ============= */}
            <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
              {/* Operativo básico */}
              <Card className="!py-3">
                <CardHeader className="!px-3 sm:!px-4">
                  <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                    Datos del viaje
                  </CardTitle>
                </CardHeader>
                <CardContent className="!px-3 sm:!px-4 space-y-2 text-sm">
                  <div className="rounded-2xl bg-gradient-to-br from-[#E8F7F8] to-[#E1F3F9] p-3 ring-1 ring-[#C8EAED]">
                    <p className="text-[10px] uppercase tracking-widest text-[#0E7980]/80">Paquete / Experiencia</p>
                    <p className="mt-1 break-words text-sm font-semibold leading-5 text-[#083C48]">
                      {reserva.packageTitle || reserva.experienceTitle || '—'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Number((reserva as any).communityDiscountAmount ?? 0) > 0 && (
                      <div className="col-span-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5">
                        <p className="text-[10px] uppercase tracking-widest text-emerald-700">Beneficio / descuento aplicado</p>
                        <p className="mt-0.5 text-[13px] font-semibold text-emerald-900">{(reserva as any).communityDiscount?.nombre || 'Promoción de comunidad'}{(reserva as any).communityPromotionCode ? ` · Código ${(reserva as any).communityPromotionCode}` : ''}</p>
                        <p className="mt-0.5 text-xs text-emerald-800">Ahorro en esta reserva: {formatAmount(Number((reserva as any).communityDiscountAmount), reserva.currency)}</p>
                      </div>
                    )}
                    <div className="rounded-xl bg-gray-50/80 p-2 ring-1 ring-gray-100">
                      <p className="text-[10px] uppercase tracking-widest text-gray-500">Fecha</p>
                      <p className="mt-0.5 text-[13px] font-semibold leading-5 text-gray-900">
                        {reserva.date === 'sin-fecha' ? 'A coordinar' : formatDate(reserva.date)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-gray-50/80 p-2 ring-1 ring-gray-100">
                      <p className="text-[10px] uppercase tracking-widest text-gray-500">Pasajeros</p>
                      <p className="mt-0.5 text-[13px] font-semibold leading-5 text-gray-900">{reserva.people} pax</p>
                    </div>
                  </div>

                  {/* Butacas */}
                  {Array.isArray((reserva as any).selectedSeats) && (reserva as any).selectedSeats.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-gray-500">Butacas</p>
                      <div className="rounded-2xl border border-[#D7EAF7] bg-[#F4FAFF] p-3">
                        <div className="flex flex-wrap gap-1.5">
                          {((reserva as any).selectedSeats as string[]).map((seat) => (
                            <div
                              key={seat}
                              className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1D6FA3] shadow-[0_1px_0_rgba(29,111,163,0.08)] ring-1 ring-[#D7EAF7]"
                            >
                              <Armchair className="h-3 w-3 opacity-80" />
                              {seat}
                            </div>
                          ))}
                        </div>
                        {seatTypeLabel ? (
                          <p className="mt-2 text-[11px] text-gray-500">
                            Tipo <span className="font-medium text-gray-700">{seatTypeLabel}</span>
                            {seatCategoryTotalAmount > 0
                              ? ` · Plus ${formatAmount(seatCategoryTotalAmount, reserva.currency)}`
                              : ''}
                          </p>
                        ) : null}
                      </div>
                      {reserva.date !== 'sin-fecha' &&
                        (reserva as any).selectedSeats.length > 0 ? (
                        <div className="pt-0.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => setSeatDialogOpen(true)}
                          >
                            <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                            {showEditSection ? 'Seleccionar butacas' : 'Ver mapa de butacas'}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-widest text-gray-500">
                      Tipo de habitación
                    </Label>
                    {reservaRoomTypeOptions.length > 0 ? (
                      <>
                        <select
                          value={String((reserva as any)?.roomType ?? '')}
                          disabled={updatingRoomType}
                          onChange={(e) => handleRoomTypeUpdate(e.target.value)}
                          className="h-10 w-full max-w-sm rounded-xl border border-gray-200 bg-white px-3 text-sm focus:border-[#2BB8BF] focus:ring-2 focus:ring-[#2BB8BF]/10 disabled:opacity-60"
                        >
                          <option value="">Sin definir</option>
                          {reservaRoomTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {updatingRoomType ? (
                          <p className="text-xs text-gray-500">Actualizando…</p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-xs text-gray-500">
                        El paquete no tiene tipos de habitación configurados.
                      </p>
                    )}
                  </div>

                  {/* Ascenso */}
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">Ascenso</p>
                    <div className="rounded-2xl bg-gray-50/80 p-3 ring-1 ring-gray-100">
                      {pickupPointLabel ? (
                        <>
                          <div className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2BB8BF]" />
                            <p className="text-[13px] font-semibold leading-5 text-gray-900 break-words">{pickupPointLabel}</p>
                          </div>
                          {pickupPointTimeLabel ? (
                            <div className="mt-1.5 flex items-center gap-2 text-[11px] leading-4 text-gray-600">
                              <CarFront className="h-3 w-3 text-gray-400" />
                              Horario: <span className="font-medium">{pickupPointTimeLabel}</span>
                            </div>
                          ) : (
                            <p className="mt-1.5 text-[11px] leading-4 text-amber-700">Horario a confirmar</p>
                          )}
                        </>
                      ) : (
                        <p className="text-[11px] leading-4 text-gray-500 flex items-center gap-2">
                          <Info className="h-3.5 w-3.5 text-gray-400" />
                          Sin punto de ascenso asignado
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Extras */}
                  {nonSurchargeExtras.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-[10px] uppercase tracking-widest text-gray-500">Extras</p>
                      <div className="rounded-2xl bg-gray-50/80 p-3 ring-1 ring-gray-100 space-y-1.5">
                        {nonSurchargeExtras.map((item: any, idx: number) => (
                          <p key={`extra-${idx}`} className="text-[13px] leading-5 text-gray-800">
                            · <span className="font-semibold">{String(item.label)}</span>
                          </p>
                        ))}
                        {seatCategoryExtras.length > 0 ? (
                          <p className="mt-1 text-[11px] leading-4 text-gray-500">
                            {seatCategoryExtras
                              .map((extra) => `${extra.label} ${formatAmount(extra.totalAmount, reserva.currency)}`)
                              .join(' · ')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {/* Surcharge individual */}
                  {editedSinglePassengerSurcharge.applies ? (
                    <SinglePassengerSurchargeBreakdown
                      label={editedSinglePassengerSurcharge.label}
                      amountLabel={formatAmount(editedSinglePassengerSurcharge.amount, reserva.currency)}
                    />
                  ) : null}
                </CardContent>
              </Card>

                  {/* Comunicación emails */}
                  <Card className="!py-3">
                    <CardContent className="!px-3 sm:!px-4">
                      <div className="grid gap-2 md:grid-cols-3">
                        {[
                          {
                            key: 'confirmation',
                            icon: MailCheck,
                            title: 'Confirmación',
                            status: emailStatusLabel(
                              ventaStatuses?.customerConfirmationEmailStatus ??
                              deriveCustomerConfirmationEmailStatus(reserva)
                            ),
                          },
                          {
                            key: 'voucher',
                            icon: Receipt,
                            title: 'Voucher',
                            status: voucherStatusLabel(
                              ventaStatuses?.voucherStatus ?? deriveVoucherStatus(reserva)
                            ),
                          },
                          {
                            key: 'admin',
                            icon: Mail,
                            title: 'Aviso admin',
                            status: emailStatusLabel(
                              ventaStatuses?.adminEmailStatus ?? deriveAdminEmailStatus(reserva)
                            ),
                          },
                        ].map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <div
                              key={item.key}
                              className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2"
                            >
                              <ItemIcon className="h-4 w-4 text-gray-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-widest text-gray-500">{item.title}</p>
                                <p className="text-[13px] font-semibold leading-4 text-gray-900 truncate">{item.status}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
            </aside>

            {/* ============= COLUMNA CENTRAL ============= */}
            <main className="min-w-0 space-y-3">
              {/* Editar sección expandible */}
              {showEditSection ? (
                <Card className="!py-4 border-dashed border-2 border-[#2BB8BF]/30">
                  <CardHeader className="!px-4 sm:!px-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0E7980]">
                        Edición completa
                      </CardTitle>
                      <CardDescription className="text-xs text-gray-500 !mt-1">
                        Modificá cualquier dato del cliente, pasajeros, ascenso, butacas o comentarios.
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (reserva) {
                            const initialSeats = Array.isArray((reserva as any).selectedSeats)
                              ? (reserva as any).selectedSeats.filter((s: unknown) => typeof s === 'string' && s.trim())
                              : [];
                            const seatTypeFromExtra = getSeatTypeLabel(
                              (reserva as any).extras ?? (reserva as any).extraSelections ?? [],
                              initialSeats.length
                            );
                            const seatTypeCurrent =
                              typeof (reserva as any).seatType === 'string' && (reserva as any).seatType.trim()
                                ? (reserva as any).seatType.trim()
                                : seatTypeFromExtra;
                            const targetPeople = Math.max(1, Number(reserva.people) || 1);
                            const rawDetails = Array.isArray((reserva as any).passengerDetails)
                              ? (reserva as any).passengerDetails.filter((p: any) => p && typeof p === 'object')
                              : [];
                              const initialDetails: PassengerFormItem[] = [];
                              for (let i = 0; i < targetPeople; i++) {
                                const raw = rawDetails[i];
                                if (raw) {
                                  initialDetails.push({
                                    firstName: String(raw.firstName ?? '').trim(),
                                    lastName: String(raw.lastName ?? '').trim(),
                                    document: String(raw.document ?? '').trim(),
                                    birthDate: String(raw.birthDate ?? '').trim(),
                                    phone: String(raw.phone ?? '').trim(),
                                    country: String(raw.country ?? (reserva as any).customerCountry ?? '').trim(),
                                  });
                                } else if (i === 0) {
                                  initialDetails.push({
                                    firstName: String(reserva.customerFirstName ?? '').trim(),
                                    lastName: String(reserva.customerLastName ?? '').trim(),
                                    document: String((reserva as any).customerDocument ?? '').trim(),
                                    birthDate: String((reserva as any).customerBirthDate ?? '').trim(),
                                    phone: String((reserva as any).customerPhone ?? '').trim(),
                                    country: String((reserva as any).customerCountry ?? '').trim(),
                                  });
                                } else {
                                  initialDetails.push(emptyPassenger());
                                }
                              }
                            setPassengerDetailsForm(initialDetails);
                            setSelectedSeatIds([]);
                            setEditForm({
                              customerFirstName: String(reserva.customerFirstName ?? '').trim(),
                              customerLastName: String(reserva.customerLastName ?? '').trim(),
                              customerEmail: String((reserva as any).customerEmail ?? '').trim(),
                              customerPhone: String((reserva as any).customerPhone ?? '').trim(),
                              customerDocument: String((reserva as any).customerDocument ?? '').trim(),
                              customerBirthDate: String((reserva as any).customerBirthDate ?? '').trim(),
                              customerCountry: String((reserva as any).customerCountry ?? '').trim(),
                              customerComments: String((reserva as any).customerComments ?? '').trim(),
                              peopleAdults: (reserva as any).peopleAdults != null ? String((reserva as any).peopleAdults) : '',
                              peopleMinors: (reserva as any).peopleMinors != null ? String((reserva as any).peopleMinors) : '',
                              peopleTotal: reserva.people != null ? String(targetPeople) : '',
                              seatType: seatTypeCurrent,
                              selectedSeats: initialSeats,
                              pickupPoint: String((reserva as any).pickupPoint ?? '').trim(),
                              pickupPointTime: String((reserva as any).pickupPointTime ?? '').trim(),
                            });
                          }
                          setShowEditSection(false);
                        }}
                        disabled={savingEditData}
                      >
                        Cancelar
                      </Button>
                      <Button size="sm" variant="success" onClick={handleSaveEditData} disabled={savingEditData}>
                        {savingEditData ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Guardando…
                          </>
                        ) : (
                          'Guardar cambios'
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="!px-4 sm:!px-5">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">Nombre</Label>
                        <Input
                          value={passengerDetailsForm[0]?.firstName ?? ''}
                          onChange={(e) => updatePassenger(0, 'firstName', e.target.value)}
                          placeholder="Nombre del cliente"
                          className="h-11 rounded-xl border-gray-200 bg-gray-50/30 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">Apellido</Label>
                        <Input
                          value={passengerDetailsForm[0]?.lastName ?? ''}
                          onChange={(e) => updatePassenger(0, 'lastName', e.target.value)}
                          placeholder="Apellido del cliente"
                          className="h-11 rounded-xl border-gray-200 bg-gray-50/30 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">Email (opcional)</Label>
                        <div className="relative">
                          <Input
                            type="email"
                            value={editForm.customerEmail}
                            onChange={(e) => setEditForm((f) => ({ ...f, customerEmail: e.target.value }))}
                            placeholder="email@ejemplo.com"
                            className="h-11 rounded-xl border-gray-200 bg-gray-50/30 pl-10 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                          />
                          <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">Teléfono / WhatsApp</Label>
                        <Input
                          value={passengerDetailsForm[0]?.phone ?? ''}
                          onChange={(e) => updatePassenger(0, 'phone', e.target.value)}
                          placeholder="+54 11 ..."
                          className="h-11 rounded-xl border-gray-200 bg-gray-50/30 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">DNI / Pasaporte</Label>
                        <Input
                          value={passengerDetailsForm[0]?.document ?? ''}
                          onChange={(e) => updatePassenger(0, 'document', e.target.value)}
                          placeholder="Número de documento"
                          className="h-11 rounded-xl border-gray-200 bg-gray-50/30 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">Fecha de nacimiento</Label>
                        <Input
                          type="date"
                          value={passengerDetailsForm[0]?.birthDate ?? ''}
                          onChange={(e) => updatePassenger(0, 'birthDate', e.target.value)}
                          className="h-11 rounded-xl border-gray-200 bg-gray-50/30 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">País</Label>
                        <div className="relative">
                          <Input
                            value={editForm.customerCountry}
                            onChange={(e) => setEditForm((f) => ({ ...f, customerCountry: e.target.value }))}
                            placeholder="Argentina"
                            className="h-11 rounded-xl border-gray-200 bg-gray-50/30 pl-10 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                          />
                          <Globe className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        </div>
                      </div>
                      <div className="space-y-1.5 grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-600">Total personas</Label>
                          <div className="relative">
                            <Input
                              type="number"
                              min="1"
                              max="50"
                              value={editForm.peopleTotal}
                              onChange={(e) => setEditForm((f) => ({ ...f, peopleTotal: e.target.value }))}
                              placeholder="Ej: 4"
                              className="h-11 rounded-xl border-gray-200 bg-gray-50/30 pl-10 text-sm font-semibold focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                            />
                            <Users className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2BB8BF]" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-gray-600">Tipo de butaca</Label>
                          <div className="relative">
                            <div className="h-11 rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50/50 to-[#E8F7F8]/40 pl-10 pr-3 flex items-center text-sm">
                              <Armchair className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2BB8BF]" />
                              {autoSeatTypeLabel || editForm.seatType ? (
                                <span className="truncate text-gray-900 font-medium">
                                  {autoSeatTypeLabel || editForm.seatType}
                                </span>
                              ) : (
                                <span className="truncate text-gray-400">Determinado por el mapa de butacas</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 md:col-span-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <Label className="text-xs font-medium text-gray-600">Butacas seleccionadas</Label>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                              <span className="text-[11px] text-gray-400">
                                {editForm.selectedSeats.length} butaca{editForm.selectedSeats.length === 1 ? '' : 's'}
                                {Number(editForm.peopleTotal) >= 1
                                  ? ` · límite ${Math.max(1, Number(editForm.peopleTotal) || 1)} pax`
                                  : ''}
                              </span>
                              {Number(editForm.peopleTotal) >= 1 &&
                                editForm.selectedSeats.length > 0 &&
                                editForm.selectedSeats.length !== Number(editForm.peopleTotal) ? (
                                <span className="text-[11px] font-medium text-amber-700">
                                  {editForm.selectedSeats.length < Number(editForm.peopleTotal)
                                    ? `Faltan ${Number(editForm.peopleTotal) - editForm.selectedSeats.length} butaca${Number(editForm.peopleTotal) - editForm.selectedSeats.length === 1 ? '' : 's'
                                    }`
                                    : `${editForm.selectedSeats.length - Number(editForm.peopleTotal)} butaca${editForm.selectedSeats.length - Number(editForm.peopleTotal) === 1 ? '' : 's'
                                    } de más`}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              type="button"
                              variant="success"
                              disabled={seatLoading}
                              onClick={() => setSeatDialogOpen(true)}
                            >
                              <LayoutGrid className="mr-2 h-4 w-4" />
                              {seatLoading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Cargando…
                                </>
                              ) : seatData ? (
                                editForm.selectedSeats.length > 0 ? (
                                  'Cambiar butacas'
                                ) : (
                                  'Elegir butacas'
                                )
                              ) : (
                                'Cargar mapa'
                              )}
                            </Button>
                            {editForm.selectedSeats.length > 0 && (
                              <Button
                                size="sm"
                                type="button"
                                variant="ghost"
                                disabled={seatLoading}
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                onClick={() => {
                                  setSelectedSeatIds([]);
                                  setEditForm((f) => ({ ...f, selectedSeats: [] }));
                                }}
                              >
                                <X className="mr-1 h-3.5 w-3.5" />
                                Limpiar
                              </Button>
                            )}
                          </div>
                        </div>
                        {editForm.selectedSeats.length > 0 ? (
                          <div className="rounded-2xl border border-[#2BB8BF]/20 bg-[#F4FEFD]/60 p-3">
                            <div className="flex flex-wrap gap-1.5">
                              {editForm.selectedSeats.map((seat) => {
                                const matchingSeat = seatData?.seats?.find(
                                  (s) => String(s.label).toLowerCase() === String(seat).toLowerCase()
                                );
                                const catCode = matchingSeat?.category;
                                const isSpecial = catCode && isSeatCategoryCode(catCode);
                                return (
                                  <div
                                    key={seat}
                                    className={cn(
                                      'group inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium shadow-sm',
                                      isSpecial
                                        ? 'ring-1 ring-[#2BB8BF]/30 bg-white text-[#0E7980]'
                                        : 'border border-[#2BB8BF]/30 bg-[#2BB8BF]/5 text-[#0E7980]'
                                    )}
                                  >
                                    <Armchair className="h-3 w-3 opacity-70" />
                                    <span>{seat}</span>
                                    {isSpecial ? (
                                      <span className="ml-0.5 rounded-full bg-[#0E7980]/10 px-1.5 text-[9px] font-bold uppercase tracking-wide text-[#0E7980]">
                                        {catCode === 'cocheCama' ? 'CA' : catCode === 'panoramicos' ? 'PA' : 'CF'}
                                      </span>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const idToRemove = seatIdByLabel.get(String(seat).toLowerCase());
                                        if (idToRemove) {
                                          setSelectedSeatIds((prev) => prev.filter((i) => i !== idToRemove));
                                        }
                                        setEditForm((f) => ({
                                          ...f,
                                          selectedSeats: f.selectedSeats.filter((s) => s !== seat),
                                        }));
                                      }}
                                      className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[#0E7980]/70 transition hover:bg-[#2BB8BF]/20 hover:text-[#0E7980]"
                                      title={`Quitar butaca ${seat}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/40 p-4 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-gray-500">
                              <Armchair className="h-4 w-4 text-gray-400" />
                              <span className="text-xs">
                                Sin butacas asignadas — usá &quot;Elegir butacas&quot; para abrir el mapa interactivo
                              </span>
                            </div>
                          </div>
                        )}
                        {seatCategorySummaries.length > 0 ? (
                          <div className="rounded-2xl bg-gradient-to-br from-[#FFF8EC]/60 via-white to-[#F0FDFF]/40 p-3 ring-1 ring-[#F2D089]/20 space-y-1.5">
                            <div className="text-[10px] uppercase tracking-widest text-amber-700/80 font-semibold">
                              Categorías &amp; plus
                            </div>
                            {seatCategorySummaries.map((extra) => (
                              <div key={`${extra.code}-${extra.label}`} className="text-xs text-gray-800 flex items-center justify-between gap-2">
                                <span>
                                  <span className="font-semibold">{extra.label}</span>
                                  <span className="text-gray-500">
                                    {' '}
                                    · {formatAmount(extra.unitAmount, reserva?.currency || 'ars')} x {extra.quantity}
                                  </span>
                                </span>
                                <span className="font-bold text-[#0E7980]">
                                  {formatAmount(extra.totalAmount, reserva?.currency || 'ars')}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">Punto de ascenso</Label>
                        <Input
                          value={editForm.pickupPoint}
                          onChange={(e) => setEditForm((f) => ({ ...f, pickupPoint: e.target.value }))}
                          placeholder="Ej: Terminal de Ómnibus"
                          className="h-11 rounded-xl border-gray-200 bg-gray-50/30 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-gray-600">Horario de ascenso</Label>
                        <Input
                          value={editForm.pickupPointTime}
                          onChange={(e) => setEditForm((f) => ({ ...f, pickupPointTime: e.target.value }))}
                          placeholder="Ej: 07:30 hs"
                          className="h-11 rounded-xl border-gray-200 bg-gray-50/30 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label className="text-xs font-medium text-gray-600">Comentarios / Notas</Label>
                        <Textarea
                          value={editForm.customerComments}
                          onChange={(e) => setEditForm((f) => ({ ...f, customerComments: e.target.value }))}
                          placeholder="Comentarios o indicaciones especiales del cliente"
                          rows={3}
                          className="rounded-xl border-gray-200 bg-gray-50/30 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2BB8BF]/10 text-[#0E7980]">
                              <Users className="h-3.5 w-3.5" />
                            </div>
                            <Label className="text-xs font-medium text-gray-700">
                              Pasajeros ({passengerDetailsForm.length})
                            </Label>
                            <span className="text-[10px] uppercase tracking-widest text-gray-400">
                              Datos de cada persona
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={addPassenger}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Agregar pasajero
                          </Button>
                        </div>
                        <div className="space-y-2.5">
                          {passengerDetailsForm.map((p, idx) => (
                            <div
                              key={idx}
                              className="rounded-2xl border border-gray-200 bg-gray-50/50 p-3 ring-1 ring-gray-100"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2.5">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] font-semibold tracking-widest uppercase text-gray-500 bg-white">
                                    Pasajero {idx + 1}
                                  </Badge>
                                </div>
                                {passengerDetailsForm.length > 1 && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removePassenger(idx)}
                                    className="h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                                <div className="space-y-1">
                                  <Label className="text-[10px] uppercase tracking-widest text-gray-500">
                                    Nombre
                                  </Label>
                                  <Input
                                    value={p.firstName}
                                    onChange={(e) => updatePassenger(idx, 'firstName', e.target.value)}
                                    placeholder="Ej: María"
                                    className="h-10 rounded-xl border-gray-200 bg-white text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] uppercase tracking-widest text-gray-500">
                                    Apellido
                                  </Label>
                                  <Input
                                    value={p.lastName}
                                    onChange={(e) => updatePassenger(idx, 'lastName', e.target.value)}
                                    placeholder="Ej: Gómez"
                                    className="h-10 rounded-xl border-gray-200 bg-white text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] uppercase tracking-widest text-gray-500">
                                    DNI / Pasaporte
                                  </Label>
                                  <Input
                                    value={p.document}
                                    onChange={(e) => updatePassenger(idx, 'document', e.target.value)}
                                    placeholder="Nro documento"
                                    className="h-10 rounded-xl border-gray-200 bg-white text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[10px] uppercase tracking-widest text-gray-500">
                                    Nacimiento
                                  </Label>
                                  <Input
                                    type="date"
                                    value={p.birthDate}
                                    onChange={(e) => updatePassenger(idx, 'birthDate', e.target.value)}
                                    className="h-10 rounded-xl border-gray-200 bg-white text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                                  />
                                </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] uppercase tracking-widest text-gray-500">
                                      Teléfono
                                    </Label>
                                    <Input
                                      value={p.phone}
                                      onChange={(e) => updatePassenger(idx, 'phone', e.target.value)}
                                      placeholder="+54 11 ..."
                                      className="h-10 rounded-xl border-gray-200 bg-white text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] uppercase tracking-widest text-gray-500">
                                      País
                                    </Label>
                                    <Input
                                      value={p.country ?? ''}
                                      onChange={(e) => updatePassenger(idx, 'country', e.target.value)}
                                      placeholder="Ej: Argentina"
                                      className="h-10 rounded-xl border-gray-200 bg-white text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                                    />
                                  </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {/* Cliente */}
              <Card className="!py-3">
                <CardHeader className="!px-3 sm:!px-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                    Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="!px-3 sm:!px-4 space-y-2">
                  <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-white p-3 ring-1 ring-gray-100">
                    <p className="text-sm font-semibold leading-5 text-gray-900">{reserva.customerName || 'Sin nombre'}</p>
                    <div className="mt-1 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                      {reserva.customerEmail ? (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[180px]">{reserva.customerEmail}</span>
                        </span>
                      ) : null}
                      {reserva.customerPhone ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {reserva.customerPhone}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {reserva.customerDocument ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50/60 px-3 py-2 ring-1 ring-gray-100">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span className="text-[10px] uppercase tracking-widest text-gray-500">Documento</span>
                        </div>
                        <span className="text-[13px] font-semibold leading-5 text-gray-900">{reserva.customerDocument}</span>
                      </div>
                    ) : null}
                    {(reserva as any).customerBirthDate ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50/60 px-3 py-2 ring-1 ring-gray-100">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span className="text-[10px] uppercase tracking-widest text-gray-500">Nacimiento</span>
                        </div>
                        <span className="text-[13px] font-semibold leading-5 text-gray-900">{String((reserva as any).customerBirthDate)}</span>
                      </div>
                    ) : null}
                    {reserva.customerCountry ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50/60 px-3 py-2 ring-1 ring-gray-100">
                        <div className="flex items-center gap-2">
                          <Globe className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span className="text-[10px] uppercase tracking-widest text-gray-500">País</span>
                        </div>
                        <span className="text-[13px] font-semibold leading-5 text-gray-900">{reserva.customerCountry}</span>
                      </div>
                    ) : null}
                  </div>
                  {reserva.customerComments ? (
                    <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-3">
                      <p className="text-[10px] uppercase tracking-widest text-amber-700/90">Comentarios del cliente</p>
                      <p className="mt-1 text-xs leading-5 text-amber-900/90">{reserva.customerComments}</p>
                    </div>
                  ) : null}

                  {passengerDetails.length > 0 ? (
                    <div className="space-y-1.5">
                      <p className="text-[10px] uppercase tracking-widest text-gray-500">
                        Pasajeros ({passengerDetails.length})
                      </p>
                      <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                        {passengerDetails.map((traveler: any, index: number) => (
                          <div
                            key={`traveler-${index}`}
                            className="rounded-xl bg-white px-3 py-2 ring-1 ring-gray-100"
                          >
                            <p className="text-[13px] font-semibold leading-5 text-gray-900">
                              {traveler.firstName || '—'} {traveler.lastName || ''}
                            </p>
                            <p className="mt-0.5 text-[11px] leading-4 text-gray-500">
                              {traveler.document ? `DNI ${traveler.document}` : 'Sin DNI'}
                              {traveler.birthDate ? ` · ${traveler.birthDate}` : ''}
                              {traveler.phone ? ` · ${traveler.phone}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              {/* Form agregar movimiento */}
              <Card className="!py-3 border-dashed border-2 border-[#2BB8BF]/40 bg-gradient-to-br from-white to-[#F4FAFF]/60">
                <CardHeader className="!px-3 sm:!px-4">
                  <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0E7980]">
                    Agregar movimiento
                  </CardTitle>
                </CardHeader>
                <CardContent className="!px-3 sm:!px-4">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Tipo</Label>
                      <Select
                        value={paymentForm.movementType}
                        onValueChange={(value) =>
                          setPaymentForm((current) => ({
                            ...current,
                            movementType: value as PaymentMovementType,
                          }))
                        }
                        disabled={savingPaymentEvent}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="payment">Pago</SelectItem>
                          <SelectItem value="discount">Resto</SelectItem>
                          <SelectItem value="adjustment">Ajuste manual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-gray-600">Monto</Label>
                        <Input
                          value={paymentForm.amount}
                          onChange={(event) =>
                            setPaymentForm((current) => ({ ...current, amount: event.target.value }))
                          }
                          placeholder="0,00"
                          disabled={savingPaymentEvent}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-medium text-gray-600">Medio</Label>
                        <Select
                          value={paymentForm.method}
                          onValueChange={(value) =>
                            setPaymentForm((current) => ({ ...current, method: value }))
                          }
                          disabled={savingPaymentEvent}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="transfer">Transferencia</SelectItem>
                            <SelectItem value="cash">Efectivo</SelectItem>
                            <SelectItem value="card">Tarjeta</SelectItem>
                            <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                            <SelectItem value="admin">Manual</SelectItem>
                            <SelectItem value="other">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Referencia</Label>
                      <Input
                        value={paymentForm.reference}
                        onChange={(event) =>
                          setPaymentForm((current) => ({ ...current, reference: event.target.value }))
                        }
                        placeholder="Factura, transferencia, caja, cupón"
                        disabled={savingPaymentEvent}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Detalle</Label>
                      <Textarea
                        value={paymentForm.message}
                        onChange={(event) =>
                          setPaymentForm((current) => ({ ...current, message: event.target.value }))
                        }
                        placeholder="Ej. pago parcial por transferencia, descuento comercial, extra por servicio adicional"
                        className="min-h-[96px] rounded-2xl border border-black/10 bg-white"
                        disabled={savingPaymentEvent}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs font-medium text-gray-600">
                          Comprobante adjunto{' '}
                          <span className="font-normal text-gray-400">(opcional, atado a este pago)</span>
                        </Label>
                        {paymentAttachments.length > 0 && (
                          <span className="text-[11px] text-gray-400">
                            {paymentAttachments.length}/12 archivos
                          </span>
                        )}
                      </div>
                      <label className="block cursor-pointer">
                        <Input
                          type="file"
                          multiple
                          accept="image/*,.pdf"
                          disabled={savingPaymentEvent}
                          onChange={(e) => handlePickPaymentAttachments(e.target.files)}
                          className="cursor-pointer"
                        />
                      </label>
                      {paymentAttachments.length > 0 && (
                        <ul className="space-y-1.5 mt-2">
                          {paymentAttachments.map((att) => (
                            <li
                              key={att.id}
                              className="group flex items-center justify-between gap-2 rounded-xl border border-black/5 bg-white px-3 py-2 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {att.status === 'uploading' ? (
                                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-600" />
                                ) : att.status === 'error' ? (
                                  <span className="text-rose-500 shrink-0">!</span>
                                ) : (
                                  <Upload className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                )}
                                <span className={`truncate min-w-0 ${att.status === 'error' ? 'text-rose-600' : 'text-gray-700'}`}>
                                  {att.name}
                                </span>
                                {att.status === 'error' && att.error && (
                                  <span className="text-[10px] text-rose-500 shrink-0">{att.error}</span>
                                )}
                              </div>
                              {att.status !== 'uploading' && (
                                <button
                                  type="button"
                                  onClick={() => handleRemovePaymentAttachment(att.id)}
                                  className="text-gray-400 hover:text-rose-600 transition"
                                  disabled={savingPaymentEvent}
                                  aria-label="Quitar archivo"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="success"
                      disabled={savingPaymentEvent}
                      onClick={handleAddPaymentEvent}
                      className="w-full"
                    >
                      {savingPaymentEvent ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Guardando
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Agregar movimiento
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Habitación y comprobantes */}
              <Card className="!py-3">
                <CardContent className="!px-3 sm:!px-4 space-y-3">

                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest text-gray-500">
                      Comprobantes de la reserva
                    </Label>
                    {attachments.length === 0 ? (
                      <p className="text-xs text-gray-500">Todavía no hay comprobantes cargados.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 transition hover:border-[#2BB8BF] hover:bg-[#F4FCFC]"
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                              <FileText className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-gray-900">
                                {attachment.name || 'Comprobante'}
                              </span>
                              <span className="block text-[11px] text-gray-500">
                                Cargado por {attachment.uploadedBy === 'admin' ? 'el equipo' : 'el cliente'}
                              </span>
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="!py-3">
                <CardHeader className="!px-3 sm:!px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">Movimientos</CardTitle>
                      <CardDescription className="text-xs text-gray-500 !mt-1">Historial financiero</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-[11px] text-gray-600">{paymentRows.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="!px-3 sm:!px-4">
                  {paymentsLoading ? <div className="space-y-2"><div className="h-12 animate-pulse rounded-xl bg-gray-100" /><div className="h-12 animate-pulse rounded-xl bg-gray-100" /></div> : paymentRows.length === 0 ? <p className="rounded-xl bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">No hay movimientos registrados para esta venta.</p> : (
                    <div className="space-y-2.5">
                      {paymentRows.map((payment) => {
                        const movementType = normalizePaymentMovementType(payment);
                        const reducesBalance = movementType === 'payment' || movementType === 'discount';
                        return <div key={payment.id} className="rounded-xl border border-black/5 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0"><p className="text-[13px] font-semibold text-gray-900">{paymentMovementLabels[movementType]}</p><p className="mt-0.5 break-words text-[11px] text-gray-500">{payment.message || 'Sin detalle'}{payment.reference ? ` · Ref. ${payment.reference}` : ''}</p><p className="mt-1 text-[10px] text-gray-500">{paymentDateLabel(payment)} · {paymentMethodLabel(payment.method)} · {String(payment.status || 'registrado')}{payment.source !== 'manual' ? ' · automático' : ''}</p></div>
                            <div className="shrink-0 text-right"><p className={cn('text-sm font-bold', reducesBalance ? 'text-emerald-700' : 'text-rose-700')}>{reducesBalance ? '-' : '+'}{formatAmount(Number(payment.amount ?? 0), String(payment.currency ?? reserva.currency))}</p>{payment.source === 'manual' ? <div className="mt-1 flex justify-end gap-1"><Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-[#0E7980]" onClick={() => openPaymentEditor(payment)} title="Editar movimiento" aria-label="Editar movimiento"><Pencil className="h-3.5 w-3.5" /></Button><Button type="button" size="icon" variant="destructive" className="h-7 w-7 bg-rose-600 p-0 hover:bg-rose-700" onClick={() => setPaymentPendingDeletion(payment)} title="Eliminar movimiento" aria-label="Eliminar movimiento"><Trash2 className="h-3.5 w-3.5" /></Button></div> : null}</div>
                          </div>
                          {payment.updatedBy && payment.updatedAt ? <p className="mt-2 text-[10px] text-gray-400">Editado por {payment.updatedBy} el {formatDateTime(payment.updatedAt)}</p> : null}
                        </div>;
                      })}
                    </div>
                  )}
                  {Array.isArray((reserva as any).paymentAuditTrail) && (reserva as any).paymentAuditTrail.length > 0 ? <div className="mt-4 border-t border-gray-100 pt-3"><p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Auditoría</p>{(reserva as any).paymentAuditTrail.slice().sort((a: any, b: any) => toTimestampMs(b.createdAt) - toTimestampMs(a.createdAt)).map((entry: any, index: number) => <p key={`${entry.paymentId}-${toTimestampMs(entry.createdAt)}-${index}`} className="mt-1 text-[10px] text-gray-500">{entry.action === 'deleted' ? 'Eliminado' : 'Editado'} por {entry.actor || 'admin'} el {formatDateTime(entry.createdAt)}{entry.summary ? ` · ${entry.summary}` : ''}</p>)}</div> : null}
                </CardContent>
              </Card>

              {/* Control de estado */}
              {/* <Card className="!py-4 border-2 border-dashed border-rose-100">
                <CardHeader className="!px-4 sm:!px-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-600/90">
                      Control de estado
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-500 !mt-1">
                      Los cambios quedan registrados en el historial de la venta.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-[#DC2626] text-white shadow-[0_8px_18px_rgba(220,38,38,0.22)] hover:bg-[#B91C1C]"
                      onClick={handleCancelReservation}
                      disabled={statusUpdating}
                    >
                      Cancelar venta
                    </Button>
                    <Button variant="success" size="sm" onClick={() => handleStatusUpdate(status)}>
                      Guardar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="!px-4 sm:!px-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Estado</Label>
                      <Select value={status} onValueChange={(value) => setStatus(value as ReservationStatus)}>
                        <SelectTrigger className="rounded-2xl border border-black/10 bg-white py-2">
                          <SelectValue placeholder="Seleccioná un estado" />
                        </SelectTrigger>
                        <SelectContent>
                          {reservationStatusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Nota interna</Label>
                      <Textarea
                        value={statusNote}
                        onChange={(event) => setStatusNote(event.target.value)}
                        placeholder="Describe por qué se cambió el estado"
                        className="min-h-[96px] rounded-2xl border border-black/10 bg-white"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card> */}


              {/* Timeline estado + registro */}
              <div className="grid gap-3">
                <Card className="!py-3">
                  <CardHeader className="!px-3 sm:!px-4">
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                      Timeline de la venta
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="!px-3 sm:!px-4">
                    <div className="relative space-y-2 pl-2">
                      <div className="absolute left-[14px] top-1.5 h-[calc(100%-18px)] w-px bg-gray-200/80" />
                      {reserva.statusHistory?.length ? (
                        reserva.statusHistory
                          .slice()
                          .sort((a, b) => toTimestampMs(b.createdAt) - toTimestampMs(a.createdAt))
                          .map((entry) => (
                            <div
                              key={`${entry.status}-${toTimestampMs(entry.createdAt)}`}
                              className="relative space-y-1 rounded-xl border border-black/5 bg-white/90 px-3 py-2 pl-6"
                            >
                              <span className="absolute left-[-8px] top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-gray-200">
                                <span className="h-2 w-2 rounded-full bg-[#2BB8BF]" />
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={statusBadgeVariant[entry.status]}
                                  className="capitalize text-[11px]"
                                >
                                  {reservationStatusText(entry.status)}
                                </Badge>
                                <span className="text-[11px] text-gray-500">{formatDateTime(entry.createdAt)}</span>
                              </div>
                              {entry.note && <p className="text-[13px] leading-5 text-gray-700">{entry.note}</p>}
                            </div>
                          ))
                      ) : (
                        <p className="text-sm text-gray-500">No hay historial registrado.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </main>

            {/* ============= COLUMNA DERECHA sticky: FINANZAS ============= */}
            <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
              {/* Resumen financiero */}
              <Card className="!py-3 border-2 border-[#DCEAF7] bg-gradient-to-br from-white via-white to-[#F4FAFF]">
                <CardHeader className="!px-3 sm:!px-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0E7980]">
                      Cobranza
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-500 !mt-1">Resumen financiero de la venta</CardDescription>
                  </div>
                  <Badge
                    variant={
                      effectivePaymentSummary.balance > 0
                        ? 'outline'
                        : effectivePaymentSummary.balance < 0
                          ? 'secondary'
                          : 'default'
                    }
                    className={
                      effectivePaymentSummary.balance > 0
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : undefined
                    }
                  >
                    {effectivePaymentSummary.balance > 0
                      ? 'Saldo pendiente'
                      : effectivePaymentSummary.balance < 0
                        ? 'Saldo a favor'
                        : 'Saldo conciliado'}
                  </Badge>
                </CardHeader>
                <CardContent className="!px-3 sm:!px-4 space-y-2">
                  {/* Cifra principal */}
                  <div className="rounded-xl bg-gradient-to-br from-[#0E7980] to-[#1D6FA3] p-3 text-white shadow-[0_8px_24px_rgba(29,111,163,0.25)]">
                    <p className="text-[10px] uppercase tracking-widest text-white/70">Saldo actual</p>
                    <p className="mt-1 text-lg font-bold leading-tight">
                      {effectivePaymentSummary.balance > 0
                        ? `${formatAmount(effectivePaymentSummary.balance, reserva.currency)} pendiente`
                        : effectivePaymentSummary.balance < 0
                          ? `${formatAmount(Math.abs(effectivePaymentSummary.balance), reserva.currency)} a favor`
                          : 'Sin saldo pendiente'}
                    </p>
                    <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11px] leading-4 text-white/80">
                      <div>
                        <p className="text-white/70 text-[10px] uppercase tracking-widest">Cobrado</p>
                        <p className="font-semibold text-white mt-0.5">{formatAmount(paymentSummary.totalPaid, paymentsCurrency)}</p>
                      </div>
                      <div>
                        <p className="text-white/70 text-[10px] uppercase tracking-widest">A cobrar</p>
                        <p className="font-semibold text-white mt-0.5">{formatAmount(effectivePaymentSummary.billedTotal, reserva.currency)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Breakdown 4 stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-gray-50/80 p-2 ring-1 ring-gray-100">
                      <p className="text-[10px] uppercase tracking-widest text-gray-500">Venta base</p>
                      <p className="mt-0.5 text-[13px] font-semibold leading-5 text-gray-900">
                        {formatAmount(effectivePaymentSummary.baseTotal, reserva.currency)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-gray-50/80 p-2 ring-1 ring-gray-100">
                      <p className="text-[10px] uppercase tracking-widest text-gray-500">Ajustes</p>
                      <p className="mt-0.5 text-[13px] font-semibold leading-5 text-gray-900">
                        {paymentSummary.totalAdjustments === 0
                          ? 'Sin cambios'
                          : `${paymentSummary.totalAdjustments > 0 ? '+' : '-'}${formatAmount(Math.abs(paymentSummary.totalAdjustments), reserva.currency)}`}
                      </p>
                    </div>
                    <div className="rounded-xl bg-gray-50/80 p-2 ring-1 ring-gray-100">
                       <p className="text-[10px] uppercase tracking-widest text-gray-500">Recargo</p>
                       <p className="mt-0.5 text-[13px] font-semibold leading-5 text-gray-900">
                         {effectiveSurcharge.applies
                           ? formatAmount(effectiveSurcharge.amount, reserva.currency)
                           : 'No aplica'}
                       </p>
                    </div>
                    <div className="rounded-xl bg-gradient-to-br from-[#E8F7F8] to-[#E1F3F9] p-2 ring-1 ring-[#C8EAED]">
                      <p className="text-[10px] uppercase tracking-widest text-[#0E7980]/80">Total facturado</p>
                      <p className="mt-0.5 text-[13px] font-semibold leading-5 text-[#083C48]">
                        {formatAmount(effectivePaymentSummary.billedTotal, reserva.currency)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Canal comercial / vendedor */}
              <Card className="!py-3">
                <CardHeader className="!px-3 sm:!px-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                      Canal comercial
                    </CardTitle>
                    <CardDescription className="text-xs text-gray-500 !mt-1">
                      {reserva.referredBy?.vendorName
                        ? `Vendedor: ${reserva.referredBy.vendorName}`
                        : 'Sin vendedor asignado'}
                    </CardDescription>
                    {reserva.referredBy?.code ? (
                      <p className="text-[11px] font-medium text-sky-700">Código · {reserva.referredBy.code}</p>
                    ) : null}
                  </div>
                  <div className="flex items-start gap-2">
                    {reserva.referredBy && (
                      <Badge variant="outline" className="capitalize text-[11px]">
                        {reserva.referredBy.payoutStatus}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="!px-3 sm:!px-4 space-y-3">
                  <div className="grid gap-3 rounded-2xl bg-gray-50/70 p-4 text-sm text-gray-700">
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Vendedor</Label>
                      <Select
                        value={vendorId || 'none'}
                        onValueChange={(value) => {
                          const nextVendorId = value === 'none' ? '' : value;
                          setVendorId(nextVendorId);
                          setSelectedReferralCode('');
                          setManualReferralCode('');
                        }}
                        disabled={updatingReferral}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Sin vendedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin vendedor</SelectItem>
                          {vendors.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Código sugerido</Label>
                      <Select
                        value={selectedReferralCode || 'none'}
                        onValueChange={(value) => {
                          setSelectedReferralCode(value === 'none' ? '' : value);
                          setManualReferralCode('');
                        }}
                        disabled={
                          !vendorId || referralLinksForReservation.length === 0 || referralLinksLoading || updatingReferral
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Elegí un código" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin código</SelectItem>
                          {referralLinksForReservation.map((link) => (
                            <SelectItem key={link.id} value={link.code}>
                              {link.code} {link.experienceName ? `· ${link.experienceName}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {referralLinksLoading ? (
                        <p className="text-[11px] text-gray-500">Cargando códigos disponibles…</p>
                      ) : !vendorId ? (
                        <p className="text-[11px] text-gray-500">Primero elegí un vendedor.</p>
                      ) : referralLinksForReservation.length === 0 ? (
                        <p className="text-[11px] text-gray-500">
                          Ese vendedor no tiene códigos activos para este paquete.
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-medium text-gray-600">Código manual</Label>
                      <Input
                        value={manualReferralCode}
                        onChange={(event) => {
                          setManualReferralCode(event.target.value);
                          if (event.target.value.trim()) setSelectedReferralCode('');
                        }}
                        placeholder="Ingresá un código exacto"
                        disabled={updatingReferral}
                      />
                      <p className="text-[11px] text-gray-500">
                        Si cargás un código manual, se asigna al vendedor elegido.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="success"
                        disabled={
                          updatingReferral ||
                          (!vendorId && !selectedReferralCode && !manualReferralCode.trim())
                        }
                        onClick={() => handleReferralUpdate()}
                      >
                        {updatingReferral ? (
                          <>
                            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                            Guardando
                          </>
                        ) : (
                          'Guardar cambios'
                        )}
                      </Button>
                      {reserva.referredBy && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingReferral}
                          onClick={() => handleReferralUpdate({ clear: true })}
                        >
                          Cancelar vínculo
                        </Button>
                      )}
                    </div>
                  </div>
                  {reserva.referredBy && (
                    <div className="grid gap-2 rounded-2xl border border-dashed border-gray-200 bg-white/70 p-4">
                      <div className="rounded-xl bg-gray-50/60 px-3 py-2 ring-1 ring-gray-100">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500">Comisión</p>
                        <p className="mt-0.5 text-[13px] font-semibold leading-5 text-gray-900">
                          {(
                            (displayedReferralCommissionAmount ??
                              reserva.referredBy.commissionAmount ??
                              0) / 100
                          ).toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
                          {(
                            reserva.referredBy.commissionCurrency ??
                            reserva.currency ??
                            'ARS'
                          ).toUpperCase()}
                        </p>
                      </div>
                      <div className="rounded-xl bg-gray-50/60 px-3 py-2 ring-1 ring-gray-100">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500">Regla</p>
                        <p className="mt-0.5 text-[13px] font-semibold leading-5 text-gray-900">
                          {reserva.referredBy.commissionType === 'percent'
                            ? `${reserva.referredBy.commissionValue ?? 0}%`
                            : `${reserva.referredBy.commissionValue ?? 0} ${(
                              reserva.referredBy.commissionCurrency ??
                              reserva.currency ??
                              'ARS'
                            ).toUpperCase()}`}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Historial financiero + agregar movimiento */}
              <div className="space-y-3">
                <Card className="hidden !py-3">
                  <CardHeader className="!px-3 sm:!px-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                          Movimientos
                        </CardTitle>
                        <CardDescription className="text-xs text-gray-500 !mt-1">Historial financiero</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {paymentsLoading ? <Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : null}
                        <Badge variant="outline" className="text-[11px] text-gray-600">
                          {paymentRows.length}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="!px-3 sm:!px-4">
                    {paymentsLoading ? (
                      <div className="mt-1 space-y-2">
                        <div className="h-12 w-full animate-pulse rounded-xl bg-gray-100" />
                        <div className="h-12 w-full animate-pulse rounded-xl bg-gray-100" />
                      </div>
                    ) : paymentRows.length === 0 ? (
                      <div className="mt-1 rounded-xl bg-gray-50 px-3 py-4 text-center text-xs text-gray-500">
                        No hay movimientos registrados para esta venta.
                      </div>
                    ) : (
                      <div className="mt-1 space-y-2.5">
                        {paymentRows.map((payment) => {
                          const rawMovementType = normalizePaymentMovementType(payment);
                          const displayMovementType = normalizePaymentMovementTypeForDisplay(rawMovementType);
                          const reducesBalance =
                            displayMovementType === 'payment' || displayMovementType === 'discount';
                          const sign = reducesBalance ? '-' : '+';
                          const amountClass =
                            displayMovementType === 'payment'
                              ? 'text-emerald-700'
                              : displayMovementType === 'discount'
                                ? 'text-emerald-700'
                                : displayMovementType === 'extra'
                                  ? 'text-amber-700'
                                  : displayMovementType === 'refund'
                                    ? 'text-rose-700'
                                    : 'text-gray-700';
                          const movementAttachments = Array.isArray((payment as any).attachments)
                            ? ((payment as any).attachments as Array<{
                              id: string;
                              url: string;
                              name: string;
                              type: string;
                            }>)
                            : [];
                          const amountIcon = reducesBalance ? TrendingDown : TrendingUp;
                          const AmountIcon = amountIcon;
                          const ringClass =
                            displayMovementType === 'payment'
                              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/70'
                              : displayMovementType === 'discount'
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/70'
                                : displayMovementType === 'extra'
                                  ? 'bg-amber-50 text-amber-700 ring-amber-200/70'
                                  : displayMovementType === 'refund'
                                    ? 'bg-rose-50 text-rose-700 ring-rose-200/70'
                                    : 'bg-gray-50 text-gray-700 ring-gray-200/70';
                          return (
                            <div
                              key={payment.id}
                              className="group rounded-2xl border border-black/5 bg-white/80 p-3 transition hover:border-gray-200 hover:shadow-[0_2px_10px_rgba(16,56,91,0.05)]"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex items-start gap-2.5">
                                  <div
                                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${ringClass}`}
                                  >
                                    <AmountIcon className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-semibold leading-5 text-gray-900">
                                      {paymentMovementLabels[displayMovementType]}
                                    </p>
                                    <p className="mt-0.5 break-words text-[11px] leading-4 text-gray-500">
                                      {payment.message || 'Sin detalle'}
                                      {payment.reference ? ` · Ref. ${payment.reference}` : ''}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
                                      <span>{paymentDateLabel(payment)}</span>
                                      <span className="text-gray-300">·</span>
                                      <span>{paymentMethodLabel(payment.method)}</span>
                                      <span className="text-gray-300">·</span>
                                      <span>{String(payment.status || 'registrado')}</span>
                                      {payment.source !== 'manual' ? (
                                        <>
                                          <span className="text-gray-300">·</span>
                                          <span className="italic text-gray-400">automático</span>
                                        </>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className={`text-sm font-bold leading-5 ${amountClass}`}>
                                    {sign}
                                    {formatAmount(Number(payment.amount ?? 0), String(payment.currency ?? reserva.currency))}
                                  </p>
                                  {payment.source === 'manual' ? (
                                    <div className="mt-1 flex justify-end gap-1">
                                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-[#0E7980]" onClick={() => openPaymentEditor(payment)} title="Editar movimiento" aria-label="Editar movimiento">
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button type="button" size="icon" variant="destructive" className="h-7 w-7 bg-rose-600 p-0 hover:bg-rose-700" onClick={() => setPaymentPendingDeletion(payment)} title="Eliminar movimiento" aria-label="Eliminar movimiento">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                              {payment.updatedBy && payment.updatedAt ? (
                                <p className="mt-2 pl-10.5 text-[10px] text-gray-400">Editado por {payment.updatedBy} el {formatDateTime(payment.updatedAt)}</p>
                              ) : null}
                              {movementAttachments.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5 pl-10.5">
                                  {movementAttachments.map((att) => {
                                    const isImage =
                                      typeof att.type === 'string' && att.type.toLowerCase().startsWith('image/');
                                    return (
                                      <a
                                        key={att.id || att.url}
                                        href={att.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50/80 px-2.5 py-1 text-[11px] text-sky-700 transition hover:bg-sky-100 hover:text-sky-800"
                                        title={att.name}
                                      >
                                        <Paperclip className="h-3 w-3 shrink-0 opacity-70 group-hover:opacity-100" />
                                        <span className="max-w-[180px] truncate">
                                          {isImage ? '📷 ' : '📄 '}
                                          {att.name || 'Comprobante'}
                                        </span>
                                      </a>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {Array.isArray((reserva as any).paymentAuditTrail) && (reserva as any).paymentAuditTrail.length > 0 ? (
                      <div className="mt-4 border-t border-gray-100 pt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Auditoría</p>
                        <div className="mt-2 space-y-1.5">
                          {(reserva as any).paymentAuditTrail.slice().sort((a: any, b: any) => toTimestampMs(b.createdAt) - toTimestampMs(a.createdAt)).map((entry: any, index: number) => (
                            <p key={`${entry.paymentId}-${toTimestampMs(entry.createdAt)}-${index}`} className="text-[10px] leading-4 text-gray-500">
                              {entry.action === 'deleted' ? 'Eliminado' : 'Editado'} por {entry.actor || 'admin'} el {formatDateTime(entry.createdAt)}{entry.summary ? ` · ${entry.summary}` : ''}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

              </div>
            </aside>
          </div>
        </div>
        <Dialog open={Boolean(paymentBeingEdited && editPaymentForm)} onOpenChange={(open) => {
          if (!open && !savingPaymentEdit) {
            setPaymentBeingEdited(null);
            setEditPaymentForm(null);
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Editar movimiento</DialogTitle></DialogHeader>
            {editPaymentForm ? <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>Tipo</Label><Select value={editPaymentForm.movementType} onValueChange={(movementType) => setEditPaymentForm((current) => current ? { ...current, movementType: movementType as PaymentMovementType } : current)} disabled={savingPaymentEdit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="payment">Pago recibido</SelectItem><SelectItem value="extra">Extra</SelectItem><SelectItem value="discount">Descuento</SelectItem><SelectItem value="refund">Reembolso</SelectItem><SelectItem value="adjustment">Ajuste manual</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label>Monto</Label><Input value={editPaymentForm.amount} onChange={(event) => setEditPaymentForm((current) => current ? { ...current, amount: event.target.value } : current)} disabled={savingPaymentEdit} /></div>
              </div>
              <div className="space-y-1"><Label>Medio</Label><Select value={editPaymentForm.method} onValueChange={(method) => setEditPaymentForm((current) => current ? { ...current, method } : current)} disabled={savingPaymentEdit}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="transfer">Transferencia</SelectItem><SelectItem value="cash">Efectivo</SelectItem><SelectItem value="card">Tarjeta</SelectItem><SelectItem value="mercadopago">Mercado Pago</SelectItem><SelectItem value="admin">Manual</SelectItem><SelectItem value="other">Otro</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label>Referencia</Label><Input value={editPaymentForm.reference} onChange={(event) => setEditPaymentForm((current) => current ? { ...current, reference: event.target.value } : current)} disabled={savingPaymentEdit} /></div>
              <div className="space-y-1"><Label>Detalle</Label><Textarea value={editPaymentForm.message} onChange={(event) => setEditPaymentForm((current) => current ? { ...current, message: event.target.value } : current)} disabled={savingPaymentEdit} /></div>
              <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => { setPaymentBeingEdited(null); setEditPaymentForm(null); }} disabled={savingPaymentEdit}>Cancelar</Button><Button type="button" variant="success" onClick={handleEditPaymentEvent} disabled={savingPaymentEdit}>{savingPaymentEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar cambios'}</Button></div>
            </div> : null}
          </DialogContent>
        </Dialog>
        <Dialog open={Boolean(paymentPendingDeletion)} onOpenChange={(open) => !open && !deletingPayment && setPaymentPendingDeletion(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Eliminar movimiento</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">Este movimiento dejará de afectar el saldo. La eliminación quedará registrada en la auditoría.</p>
            <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setPaymentPendingDeletion(null)} disabled={deletingPayment}>Cancelar</Button><Button type="button" variant="destructive" onClick={handleDeletePaymentEvent} disabled={deletingPayment}>{deletingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}</Button></div>
          </DialogContent>
        </Dialog>
        {/* Modal Mapa de Butacas — embebido, igual que creación manual */}
        <Dialog open={seatDialogOpen} onOpenChange={setSeatDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between gap-3 pr-8">
                <span className="flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5 text-[#2BB8BF]" />
                  {showEditSection ? 'Seleccionar butacas' : 'Mapa de butacas'}
                </span>
                {seatData && showEditSection ? (
                  <Badge variant="outline" className="border-[#2BB8BF]/30 bg-[#2BB8BF]/5 text-[#0E7980] text-xs">
                    Límite {Math.max(1, Number(editForm.peopleTotal) || 1)} pax
                  </Badge>
                ) : seatData ? (
                  <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-500 text-xs">
                    Solo lectura
                  </Badge>
                ) : null}
              </DialogTitle>
            </DialogHeader>

            {seatLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#2BB8BF]" />
                <p className="text-sm text-gray-500">Cargando mapa de butacas…</p>
              </div>
            )}

            {!seatLoading && seatData && (
              <div className="mt-2">
                <SeatMap
                  template={seatData.template}
                  seats={seatData.seats}
                  selectedSeatIds={selectedSeatIds}
                  onChangeSelected={showEditSection ? (next) => setSelectedSeatIds(next) : undefined}
                  maxSelectable={Math.max(1, Number(editForm.peopleTotal) || 1)}
                />
              </div>
            )}

            {!seatLoading && !seatData && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 py-14 px-6 flex flex-col items-center justify-center text-center gap-2">
                <LayoutGrid className="h-10 w-10 text-gray-300" />
                <p className="text-sm font-medium text-gray-700">
                  Esta salida no tiene mapa de butacas configurado
                </p>
                <p className="text-xs text-gray-500 max-w-md">
                  La fecha o el paquete no tienen habilitada la asignación de butacas por asiento.
                  Podés asignarlas manualmente desde la configuración de la salida.
                </p>
              </div>
            )}

            {showEditSection && seatData && (
              <div className="mt-5 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Armchair className="h-3.5 w-3.5 text-gray-400" />
                  <span>
                    {selectedSeatIds.length} seleccionada{selectedSeatIds.length === 1 ? '' : 's'}
                    {Number(editForm.peopleTotal) >= 1 &&
                      selectedSeatIds.length !== Number(editForm.peopleTotal) ? (
                      <>
                        {' · '}
                        <span className={
                          selectedSeatIds.length < Number(editForm.peopleTotal)
                            ? 'text-amber-600 font-semibold'
                            : 'text-rose-600 font-semibold'
                        }>
                          {selectedSeatIds.length < Number(editForm.peopleTotal)
                            ? `Faltan ${Number(editForm.peopleTotal) - selectedSeatIds.length}`
                            : `${selectedSeatIds.length - Number(editForm.peopleTotal)} de más`}
                        </span>
                      </>
                    ) : selectedSeatIds.length === Number(editForm.peopleTotal) && Number(editForm.peopleTotal) >= 1 ? (
                      <>
                        {' · '}
                        <span className="text-emerald-600 font-semibold">Completo</span>
                      </>
                    ) : null}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setSeatDialogOpen(false)}
                  >
                    Cerrar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="success"
                    onClick={() => setSeatDialogOpen(false)}
                  >
                    Confirmar selección
                  </Button>
                </div>
              </div>
            )}

            {!showEditSection && seatData && (
              <div className="mt-5 pt-4 border-t border-gray-100 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSeatDialogOpen(false)}
                >
                  Cerrar
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </ProtectedRoute>
  );
}
