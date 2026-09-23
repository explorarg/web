'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArgentineDateInput } from '@/components/ui/argentine-date-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Trash2, CheckCircle2, XCircle, Info, Save } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type {
  ReservationRoomSelection,
  ReservationRoomType,
  ReservationStatus,
  ReservationTravelerDetails,
} from '@/components/landing-reserva/types';
import type { Vendor, ReferralLink } from '@/types/vendor';
import type { DepartureSeat, Paquete, SeatLayoutTemplate } from '@/types';
import { getVendors, getReferralLinksByVendor } from '@/lib/vendors';
import SeatMap from '@/components/seats/SeatMap';
import {
  computeReservationPricing,
  getReservationExtraTotalAmount,
  getOperationalDepartureDates,
  resolveDepartureConfig,
  resolveReservationExtraSelections,
  getSinglePassengerSurchargeSummary,
  isSinglePassengerSurchargeExtra,
} from '@/lib/packages/resolve-departure';
import {
  getPackageRoomTypes,
  getPackageRoomTypeLabel,
  getPackageRoomTypeOptions,
  getRoomSelectionSummary,
} from '@/lib/reservas/room-types';
import { normalizeTravelerDetails } from '@/lib/reservas/traveler-utils';
import { getSeatCategoryExtraSummaries, getSeatCategoryTotalAmount, getSeatTypeLabel } from '@/lib/reservas/seat-category-extras';
import { isValidIsoDateString } from '@/lib/utils/argentine-date';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Props = {
  paquetes: Paquete[];
  submissionMode?: 'admin' | 'vendor';
  lockedVendor?: Pick<Vendor, 'id' | 'name' | 'email'> | null;
  existingReservationsHref?: string;
  successRedirectBuilder?: (reservationId: string) => string;
};

type TravelerForm = {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  document: string;
  country: string;
};

type FormState = {
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  customerCountry: string;
  customerDocument: string;
  customerBirthDate: string;
  customerComments: string;
  selectedPackageId: string;
  date: string;
  adults: number;
  minors: number;
  status: ReservationStatus;
  allowOverbook: boolean;
  vendorId: string;
  selectedReferralCode: string;
  manualReferralCode: string;
  pickupPoint: string;
  roomType: ReservationRoomType | '';
  roomSelection: ReservationRoomSelection[];
  selectedSeatIds: string[];
  passengerDetails: TravelerForm[];
};

const EMPTY_TRAVELER: TravelerForm = {
  firstName: '',
  lastName: '',
  birthDate: '',
  phone: '',
  document: '',
  country: '',
};

const getDefaultFormState = (paquetes: Paquete[]): FormState => ({
  customerFirstName: '',
  customerLastName: '',
  customerEmail: '',
  customerPhone: '',
  customerCountry: '',
  customerDocument: '',
  customerBirthDate: '',
  customerComments: '',
  selectedPackageId: paquetes[0]?.id ?? '',
  date: 'sin-fecha',
  adults: 1,
  minors: 0,
  status: 'reserved',
  allowOverbook: false,
  vendorId: '',
  selectedReferralCode: '',
  manualReferralCode: '',
  pickupPoint: '',
  roomType: '',
  roomSelection: [],
  selectedSeatIds: [],
  passengerDetails: [],
});

const formatAmountCents = (amount: number, currency: string): string => {
  const value = Math.max(0, Number(amount) || 0) / 100;
  if (currency === 'ARS') return `$${value.toLocaleString('es-AR')}`;
  if (currency === 'BRL') return `R$ ${value.toLocaleString('pt-BR')}`;
  if (currency === 'USD') return `USD ${value.toLocaleString('en-US')}`;
  return `${value.toFixed(2)} ${currency}`;
};

type AttachmentPreview = {
  id: string;
  key: string;
  url: string;
  name: string;
  type?: string;
};

const statusOptions: { value: ReservationStatus; label: string }[] = [
  { value: 'reserved', label: 'Reservada (pendiente de cobro)' },
  { value: 'pending', label: 'Pendiente' },
  { value: 'completed', label: 'Completada' },
];

// Componente de feedback de validación
function ValidationFeedback({ valid, message }: { valid: boolean | null; message?: string }) {
  if (valid === null) return null;
  return (
    <div className="mt-1 flex items-center gap-1 text-xs">
      {valid ? (
        <CheckCircle2 className="h-3 w-3 text-green-600" />
      ) : (
        <XCircle className="h-3 w-3 text-red-600" />
      )}
      <span className={valid ? 'text-green-600' : 'text-red-600'}>{message}</span>
    </div>
  );
}

// Componente de sección modular
function FormSection({
  title,
  description,
  children,
  optional = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-gray-100 bg-white/80 p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            {title}
            {optional && <span className="text-xs font-normal text-gray-400">(opcional)</span>}
          </h3>
          {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
        </div>
      </div>
      <div className="pt-2">{children}</div>
    </div>
  );
}

export default function AdminReservaForm({
  paquetes,
  submissionMode = 'admin',
  lockedVendor = null,
  existingReservationsHref = '/admin/ventas',
  successRedirectBuilder,
}: Props) {
  const isVendorMode = submissionMode === 'vendor';
  const router = useRouter();
  const { user } = useAuth();

  // Cargar estado inicial desde localStorage o usar valores por defecto
  const [form, setForm] = useState<FormState>(() => {
    return getDefaultFormState(paquetes);
  });

  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [stockInfo, setStockInfo] = useState<{ baseCapacity: number; available: number } | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [referralLinks, setReferralLinks] = useState<ReferralLink[]>([]);
  const [seatDialogOpen, setSeatDialogOpen] = useState(false);
  const [seatLoading, setSeatLoading] = useState(false);
  const [seatData, setSeatData] = useState<{ template: SeatLayoutTemplate; seats: DepartureSeat[] } | null>(null);

  // Derivados del formulario
  const selectedPaquete = useMemo(
    () => paquetes.find((item) => item.id === form.selectedPackageId) ?? null,
    [paquetes, form.selectedPackageId]
  );

  const peopleTotal = useMemo(
    () => Math.max(0, (Number(form.adults) || 0) + (Number(form.minors) || 0)),
    [form.adults, form.minors]
  );

  const dateOptions = useMemo<string[]>(() => {
    if (!selectedPaquete) return [];
    return getOperationalDepartureDates(selectedPaquete);
  }, [selectedPaquete]);

  const formattedDateLabel = useMemo(() => {
    if (!form.date || form.date === 'sin-fecha') return 'Sin fecha específica';
    try {
      return new Date(`${form.date}T12:00:00`).toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return form.date;
    }
  }, [form.date]);

  const resolvedSelectedDeparture = useMemo(() => {
    if (!selectedPaquete) return null;
    return resolveDepartureConfig(selectedPaquete, form.date);
  }, [selectedPaquete, form.date]);

  const currency = String(
    resolvedSelectedDeparture?.displayCurrency ?? selectedPaquete?.moneda ?? 'ARS'
  ).toUpperCase();

  const pickupPointOptions = useMemo(
    () =>
      (resolvedSelectedDeparture?.pickupPointsConfig ?? []).filter(
        (item) => String(item?.label ?? '').trim().length > 0
      ),
    [resolvedSelectedDeparture?.pickupPointsConfig]
  );

  const pickupPointTimes = useMemo(
    () =>
      new Map(
        pickupPointOptions.map((item) => [String(item.label).trim(), String(item.time ?? '').trim() || null])
      ),
    [pickupPointOptions]
  );

  const selectedExtras = useMemo(() => {
    if (!selectedPaquete) return [];
    return resolveReservationExtraSelections({
      paquete: selectedPaquete,
      pickupPoint: form.pickupPoint || null,
      selectedSeats: form.selectedSeatIds,
      seatLayoutTemplate: seatData?.template ?? null,
    });
  }, [form.pickupPoint, seatData?.template, selectedPaquete, form.selectedSeatIds]);

  const seatCategoryExtraDetails = useMemo(
    () => getSeatCategoryExtraSummaries(selectedExtras),
    [selectedExtras]
  );

  const availableRoomTypeOptions = useMemo(() => getPackageRoomTypeOptions(selectedPaquete), [selectedPaquete]);
  const availableRoomTypes = useMemo(() => getPackageRoomTypes(selectedPaquete), [selectedPaquete]);
  const computedPricing = useMemo(() => {
    if (!selectedPaquete) return null;
    return computeReservationPricing(selectedPaquete, form.date, {
      peopleAdults: Math.max(0, Number(form.adults) || 0),
      peopleMinors: Math.max(0, Number(form.minors) || 0),
      roomType: form.roomType,
      selectedExtras,
    });
  }, [form.adults, form.date, form.minors, form.roomType, selectedExtras, selectedPaquete]);

  const originalPackageAmount = useMemo(() => {
    if (!computedPricing?.baseUnitAmount || peopleTotal < 1) return 0;
    return computedPricing.baseUnitAmount * peopleTotal;
  }, [computedPricing?.baseUnitAmount, peopleTotal]);

  const singlePassengerSurcharge = useMemo(
    () =>
      getSinglePassengerSurchargeSummary({
        people: peopleTotal,
        baseSubtotalAmount: computedPricing?.baseSubtotalAmount ?? 0,
        selectedExtras,
      }),
    [peopleTotal, computedPricing?.baseSubtotalAmount, selectedExtras]
  );

  const seatsEnabled = Boolean(
    resolvedSelectedDeparture?.seatsEnabled && resolvedSelectedDeparture?.seatLayoutId
  );

  // Validaciones en tiempo real
  const validations = useMemo(() => {
    const firstPassenger = form.passengerDetails[0];
    const firstPassengerComplete =
      Boolean(firstPassenger) &&
      firstPassenger.firstName.trim().length >= 2 &&
      firstPassenger.lastName.trim().length >= 2 &&
      isValidIsoDateString(firstPassenger.birthDate) &&
      firstPassenger.phone.trim().length >= 8 &&
      firstPassenger.document.trim().length >= 3 &&
      String(firstPassenger.country || '').trim().length >= 2;

    return {
      customerFirstName: form.customerFirstName.trim().length >= 2,
      customerLastName: form.customerLastName.trim().length >= 2,
      customerEmail: !form.customerEmail.trim() || EMAIL_REGEX.test(form.customerEmail.trim()),
      customerBirthDate: isValidIsoDateString(form.customerBirthDate.trim()),
      hasEnoughPeople: peopleTotal >= 1,
      roomCompatible:
        availableRoomTypes.length === 0 ||
        availableRoomTypes.includes(form.roomType as ReservationRoomType),
      seatsSelected: !seatsEnabled || form.selectedSeatIds.length === peopleTotal,
      firstPassengerComplete,
    };
  }, [availableRoomTypes, form, peopleTotal, seatsEnabled]);

  const isFormValid = useMemo(() => {
    return (
      validations.customerFirstName &&
      validations.customerLastName &&
      validations.customerEmail &&
      validations.customerBirthDate &&
      validations.hasEnoughPeople &&
      validations.roomCompatible &&
      validations.seatsSelected &&
      validations.firstPassengerComplete
    );
  }, [validations]);

  // Actualizar pasajeros adicionales según la cantidad de personas
  useEffect(() => {
    if (peopleTotal < 1) return;
    setForm((prev) => {
      if (prev.passengerDetails.length === peopleTotal) return prev;
      const first = prev.passengerDetails[0] ?? { ...EMPTY_TRAVELER };
      const rest = prev.passengerDetails.slice(1, peopleTotal);
      while (rest.length < peopleTotal - 1) rest.push({ ...EMPTY_TRAVELER });
      return { ...prev, passengerDetails: [first, ...rest] };
    });
  }, [peopleTotal]);

  // Sincronizar primer pasajero con datos del cliente
  useEffect(() => {
    if (peopleTotal < 1 || form.passengerDetails.length < 1) return;

    const first = form.passengerDetails[0];
    const needsSync =
      !first.firstName.trim() ||
      !first.lastName.trim() ||
      !first.birthDate.trim() ||
      !first.phone.trim() ||
      !first.document.trim() ||
      !first.country.trim();

    if (peopleTotal === 1 || needsSync) {
      setForm((prev) => {
        const currentFirst = prev.passengerDetails[0];
        if (!currentFirst) return prev;
        const synced = {
          ...currentFirst,
          firstName: form.customerFirstName.trim() || currentFirst.firstName,
          lastName: form.customerLastName.trim() || currentFirst.lastName,
          birthDate: form.customerBirthDate.trim() || currentFirst.birthDate,
          phone: form.customerPhone.trim() || currentFirst.phone,
          document: form.customerDocument.trim() || currentFirst.document,
          country: form.customerCountry.trim() || currentFirst.country,
        };
        const hasChanged =
          synced.firstName !== currentFirst.firstName ||
          synced.lastName !== currentFirst.lastName ||
          synced.birthDate !== currentFirst.birthDate ||
          synced.phone !== currentFirst.phone ||
          synced.document !== currentFirst.document ||
          synced.country !== currentFirst.country;
        if (!hasChanged) return prev;
        return {
          ...prev,
          passengerDetails: [synced, ...prev.passengerDetails.slice(1)],
        };
      });
    }
  }, [peopleTotal, form.customerFirstName, form.customerLastName, form.customerBirthDate, form.customerPhone, form.customerDocument, form.customerCountry]);

  // Limpiar una habitación que no esté disponible para el paquete seleccionado.
  useEffect(() => {
    const hasStoredRoom = Boolean(form.roomType) || form.roomSelection.length > 0;
    const roomIsUnavailable =
      availableRoomTypes.length === 0 ||
      (form.roomType && !availableRoomTypes.includes(form.roomType as ReservationRoomType));
    if (hasStoredRoom && roomIsUnavailable) {
      setForm((prev) => ({ ...prev, roomType: '', roomSelection: [] }));
    }
  }, [availableRoomTypes, form.roomSelection.length, form.roomType]);

  // Cargar vendedores y códigos
  useEffect(() => {
    if (lockedVendor) {
      setVendors([
        {
          id: lockedVendor.id,
          name: lockedVendor.name,
          email: lockedVendor.email,
          active: true,
          defaultCommission: { type: 'percent', value: 0, currency: 'ars' },
        },
      ]);
      setForm((prev) => ({ ...prev, vendorId: lockedVendor.id }));
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const list = await getVendors({ activeOnly: true, limit: 200 });
        if (!cancelled) setVendors(list);
      } catch {
        // ignore
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [lockedVendor]);

  useEffect(() => {
    if (isVendorMode) {
      setReferralLinks([]);
      return;
    }
    let cancelled = false;
    const loadLinks = async () => {
      if (!form.vendorId) {
        setReferralLinks([]);
        return;
      }
      try {
        const links = await getReferralLinksByVendor(form.vendorId);
        if (!cancelled) setReferralLinks(links);
      } catch {
        setReferralLinks([]);
      }
    };
    loadLinks();
    return () => {
      cancelled = true;
    };
  }, [isVendorMode, form.vendorId]);

  useEffect(() => {
    if (!isVendorMode) return;
    setForm((prev) => {
      if (!prev.selectedReferralCode && !prev.manualReferralCode) {
        return prev;
      }
      return {
        ...prev,
        selectedReferralCode: '',
        manualReferralCode: '',
      };
    });
  }, [isVendorMode]);

  const referralLinksForPackage = useMemo(() => {
    const packageId = String(selectedPaquete?.id ?? '').trim();
    if (!packageId) return referralLinks;
    return referralLinks.filter((link) => {
      const linkPackageId = String(link.packageId ?? link.experienceId ?? '').trim();
      return !linkPackageId || linkPackageId === packageId;
    });
  }, [referralLinks, selectedPaquete?.id]);

  // Cargar stock
  useEffect(() => {
    const run = async () => {
      if (!user || !selectedPaquete?.id || form.date === 'sin-fecha') {
        setStockInfo(null);
        return;
      }
      setStockLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch(
          `${isVendorMode ? '/api/vendor/stock' : '/api/admin/stock'}?packageId=${encodeURIComponent(selectedPaquete.id)}&date=${encodeURIComponent(form.date)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error('No se pudo cargar el stock');
        const data = await res.json();
        setStockInfo({ baseCapacity: data.baseCapacity ?? 0, available: data.available ?? 0 });
      } catch {
        setStockInfo(null);
      } finally {
        setStockLoading(false);
      }
    };
    run();
  }, [form.date, isVendorMode, selectedPaquete?.id, user]);

  // Cargar mapa de butacas
  const fetchSeatMap = async () => {
    if (!user || !selectedPaquete?.id || form.date === 'sin-fecha' || !seatsEnabled) return;
    setSeatLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `${isVendorMode ? '/api/vendor/seats' : '/api/admin/seats'}?packageId=${encodeURIComponent(selectedPaquete.id)}&date=${encodeURIComponent(form.date)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'No se pudo cargar el mapa de butacas');
      }
      const json = await res.json();
      if (!json?.enabled) {
        setSeatData(null);
        setForm((prev) => (prev.selectedSeatIds.length === 0 ? prev : { ...prev, selectedSeatIds: [] }));
        return;
      }
      setSeatData({ template: json.template, seats: json.seats });
    } catch {
      setSeatData(null);
    } finally {
      setSeatLoading(false);
    }
  };

  useEffect(() => {
    setSeatData(null);
    setForm((prev) => (prev.selectedSeatIds.length === 0 ? prev : { ...prev, selectedSeatIds: [] }));
    if (seatsEnabled) void fetchSeatMap();
  }, [seatsEnabled, selectedPaquete?.id, form.date, user]);

  const seatLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of seatData?.seats ?? []) map.set(String(s.seatId), String(s.label));
    return map;
  }, [seatData?.seats]);

  const selectedSeatLabels = useMemo(() => {
    return form.selectedSeatIds.map((id) => seatLabelById.get(id) || id).filter(Boolean);
  }, [form.selectedSeatIds, seatLabelById]);

  // Manejar cambios en el formulario
  const handleFormChange = (field: keyof FormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTravelerChange = (index: number, field: keyof TravelerForm, value: string) => {
    setForm((prev) => ({
      ...prev,
      passengerDetails: prev.passengerDetails.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  // Manejo de archivos
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    setUploadingFiles(true);
    const uploaded: AttachmentPreview[] = [];
    for (const file of Array.from(files)) {
      const formData = new FormData();
      const key = `reservas/${crypto.randomUUID()}-${file.name}`;
      formData.append('file', file);
      formData.append('key', key);
      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          const error = await response.json().catch(() => null);
          toast.error('No se pudo subir el archivo', {
            description: error?.error ?? 'Reintentá con otro archivo',
          });
          continue;
        }
        const data = await response.json();
        uploaded.push({
          id: crypto.randomUUID(),
          key: data.key,
          url: data.url,
          name: file.name,
          type: file.type,
        });
      } catch {
        toast.error('Error subiendo archivo');
      }
    }
    setAttachments((prev) => [...prev, ...uploaded]);
    setUploadingFiles(false);
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleRemoveAttachment = async (attachment: AttachmentPreview) => {
    try {
      await fetch('/api/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: attachment.key }),
      });
    } catch {
      toast.error('No pudimos eliminar el archivo');
      return;
    }
    setAttachments((prev) => prev.filter((item) => item.id !== attachment.id));
  };

  // Limpiar borrador
  const clearDraft = () => {
    setForm(getDefaultFormState(paquetes));
    setAttachments([]);
    toast.success('Borrador limpiado');
  };

  const sanitizedPassengerDetails = useMemo<ReservationTravelerDetails[]>(() => {
    const first = form.passengerDetails[0];
    const hasFirst =
      Boolean(first) &&
      first.firstName.trim().length >= 2 &&
      first.lastName.trim().length >= 2;

    const cleaned = form.passengerDetails
      .map((traveler) =>
        normalizeTravelerDetails({
          firstName: traveler.firstName.trim(),
          lastName: traveler.lastName.trim(),
          birthDate: traveler.birthDate.trim(),
          phone: traveler.phone.trim(),
          document: traveler.document.trim(),
          country: traveler.country.trim(),
        })
      )
      .filter((traveler) => {
        if (!hasFirst) return false;
        if (traveler === form.passengerDetails[0]) return true;
        return (
          traveler.firstName.length >= 2 &&
          traveler.lastName.length >= 2 &&
          traveler.birthDate.length > 0 &&
          traveler.phone.length >= 8 &&
          traveler.document.length >= 3 &&
          traveler.country.length >= 2
        );
      });

    if (!hasFirst) return [];
    return cleaned;
  }, [form.passengerDetails]);

  // Submit
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormValid) {
      toast.error('Por favor completá todos los campos obligatorios');
      return;
    }
    if (!selectedPaquete) {
      toast.error('Seleccioná un paquete antes de continuar');
      return;
    }
    if (!user) {
      toast.error('Debes iniciar sesión para crear la reserva');
      return;
    }

    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      const requestBody = {
        packageId: selectedPaquete.id,
        date: form.date,
        ...(isVendorMode
          ? {
              people: peopleTotal,
            }
          : {
              peopleAdults: Math.max(0, Number(form.adults) || 0),
              peopleMinors: Math.max(0, Number(form.minors) || 0),
            }),
        ...(!isVendorMode ? { status: form.status } : {}),
        ...(!isVendorMode ? { allowOverbook: Boolean(form.allowOverbook) } : {}),
        customerEmail: form.customerEmail,
        customerFirstName: form.customerFirstName,
        customerLastName: form.customerLastName,
        customerPhone: form.customerPhone || undefined,
        customerCountry: form.customerCountry || undefined,
        customerDocument: form.customerDocument || undefined,
        customerBirthDate: form.customerBirthDate || undefined,
        customerComments: form.customerComments || undefined,
        passengerDetails: sanitizedPassengerDetails,
        ...(form.pickupPoint ? { pickupPoint: form.pickupPoint } : {}),
        ...(form.pickupPoint ? { pickupPointTime: pickupPointTimes.get(form.pickupPoint) || null } : {}),
        ...(form.roomType ? { roomType: form.roomType } : {}),
        ...(form.roomSelection.length > 0 ? { roomSelection: form.roomSelection } : {}),
        ...(seatsEnabled ? { selectedSeats: selectedSeatLabels } : {}),
        ...(!isVendorMode && attachments.length > 0
          ? {
              attachments: attachments.map((item) => ({
                key: item.key,
                url: item.url,
                name: item.name,
                type: item.type,
                uploadedBy: 'admin',
              })),
            }
          : {}),
        ...(form.vendorId ? { vendorId: form.vendorId } : {}),
        ...(!isVendorMode && form.manualReferralCode.trim()
          ? { referralCode: form.manualReferralCode.trim() }
          : !isVendorMode && form.selectedReferralCode.trim()
            ? { referralCode: form.selectedReferralCode.trim() }
            : {}),
      };

      const response = await fetch(isVendorMode ? '/api/vendor/reservas' : '/api/admin/reservas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.detail ? `${errorData.error} (${errorData.detail})` : errorData?.error ?? 'No se pudo crear la reserva'
        );
      }

      const payload = await response.json();
      toast.success('Reserva creada exitosamente');
      router.push(
        successRedirectBuilder
          ? successRedirectBuilder(payload.id)
          : submissionMode === 'vendor'
            ? '/vendedor/reservas'
            : `/admin/ventas/${payload.id}`
      );
    } catch (error) {
      console.error('[AdminReservaForm] Error creando reserva:', error);
      toast.error(error instanceof Error ? error.message : 'No pudimos crear la reserva, revisá los datos e intentá otra vez');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Sección 1: Datos básicos de la reserva */}
            <FormSection title="Información de la reserva">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2 space-y-1.5">
                  <Label>Paquete *</Label>
                  <Select
                    value={form.selectedPackageId}
                    onValueChange={(value) => handleFormChange('selectedPackageId', value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccioná un paquete" />
                    </SelectTrigger>
                    <SelectContent>
                      {paquetes.map((pkg) => (
                        <SelectItem key={pkg.id} value={pkg.id}>
                          {pkg.titulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!isVendorMode && (
                  <div className="space-y-1.5">
                    <Label>Estado</Label>
                    <Select value={form.status} onValueChange={(value) => handleFormChange('status', value as ReservationStatus)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <div className="space-y-1.5">
                  <Label>Fecha / salida *</Label>
                  {dateOptions.length > 0 ? (
                    <Select value={form.date} onValueChange={(value) => handleFormChange('date', value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccioná una fecha" />
                      </SelectTrigger>
                      <SelectContent>
                        {dateOptions.map((slot) => (
                          <SelectItem key={slot} value={slot}>
                            {slot}
                          </SelectItem>
                        ))}
                        <SelectItem value="sin-fecha">Sin fecha específica</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="date"
                      value={form.date === 'sin-fecha' ? '' : form.date}
                      onChange={(event) => handleFormChange('date', event.target.value || 'sin-fecha')}
                    />
                  )}
                  <div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-1">
                    {form.date !== 'sin-fecha' && (
                      <span>
                        {stockLoading
                          ? 'Cargando cupos...'
                          : stockInfo
                            ? `Cupo base: ${stockInfo.baseCapacity} · Disponible: ${stockInfo.available}`
                            : 'Stock no disponible'}
                      </span>
                    )}
                  </div>
                  {!isVendorMode && form.date !== 'sin-fecha' && (
                    <label className="mt-2 flex select-none items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.allowOverbook}
                        onChange={(e) => handleFormChange('allowOverbook', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      Permitir sobreventa (ignorar cupo disponible)
                    </label>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Adultos</Label>
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        value={form.adults}
                        onChange={(e) => handleFormChange('adults', parseInt(e.target.value || '0', 10))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-600">Menores</Label>
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        value={form.minors}
                        onChange={(e) => handleFormChange('minors', parseInt(e.target.value || '0', 10))}
                      />
                    </div>
                  </div>
                  <ValidationFeedback
                    valid={validations.hasEnoughPeople}
                    message={validations.hasEnoughPeople ? 'Cantidad válida' : 'Se necesitan al menos 1 persona'}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Máximo por reserva:{' '}
                    {selectedPaquete?.bookingConfig?.maxPeoplePerBooking ?? selectedPaquete?.capacidadMaxima ?? 50}
                  </p>
                </div>
              </div>
            </FormSection>

            {/* Sección 2: Datos del viaje */}
            {(pickupPointOptions.length > 0 || seatsEnabled || selectedPaquete) && (
              <FormSection title="Detalles del viaje">
                <div className="grid gap-4 md:grid-cols-2">
                  {pickupPointOptions.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>Lugar de ascenso</Label>
                      <Select value={form.pickupPoint || 'none'} onValueChange={(value) => handleFormChange('pickupPoint', value === 'none' ? '' : value)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccioná un ascenso" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin ascenso</SelectItem>
                          {pickupPointOptions.map((item) => (
                            <SelectItem key={item.label} value={item.label}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500 mt-1">
                        {form.pickupPoint
                          ? `Horario: ${pickupPointTimes.get(form.pickupPoint) || 'A confirmar'}`
                          : 'Podés dejarlo sin definir si todavía no está confirmado.'}
                      </p>
                    </div>
                  )}

                  {selectedPaquete && availableRoomTypes.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>Distribución de habitaciones *</Label>
                      <Select
                        value={form.roomType || undefined}
                        onValueChange={(value) => {
                          const roomType = value as ReservationRoomType;
                          setForm((prev) => ({
                            ...prev,
                            roomType,
                            roomSelection: [{ roomType, quantity: 1 }],
                          }));
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccioná un tipo de habitación" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableRoomTypeOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <ValidationFeedback
                        valid={validations.roomCompatible}
                        message={
                          validations.roomCompatible
                            ? `Habitación elegida: ${getPackageRoomTypeLabel(selectedPaquete, form.roomType)}.`
                            : 'Seleccioná uno de los tipos de habitación disponibles.'
                        }
                      />
                    </div>
                  )}
                </div>

                {seatsEnabled && form.date !== 'sin-fecha' && (
                  <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Butacas</div>
                        <div className="text-xs text-gray-600">
                          Seleccionadas: <span className="font-semibold text-gray-900">{selectedSeatLabels.length}</span> / {peopleTotal}
                        </div>
                        {selectedSeatLabels.length > 0 && (
                          <div className="mt-1 text-xs text-gray-600">{selectedSeatLabels.join(', ')}</div>
                        )}
                        <ValidationFeedback
                          valid={validations.seatsSelected}
                          message={validations.seatsSelected ? 'Todas las butacas seleccionadas' : 'Faltan butacas por seleccionar'}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={seatLoading || submitting}
                          onClick={() => {
                            setSeatDialogOpen(true);
                            if (!seatData) void fetchSeatMap();
                          }}
                        >
                          Elegir butacas
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={seatLoading || submitting}
                          onClick={() => handleFormChange('selectedSeatIds', [])}
                        >
                          Limpiar
                        </Button>
                      </div>
                    </div>

                    {seatCategoryExtraDetails.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {seatCategoryExtraDetails.map((extra) => (
                          <div key={`${extra.code}-${extra.label}`} className="text-sm text-gray-700">
                            {extra.label}
                            <span className="text-xs text-gray-500">
                              {' '}
                              · {formatAmountCents(extra.unitAmount, currency)} x {extra.quantity} ={' '}
                              {formatAmountCents(extra.totalAmount, currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </FormSection>
            )}

            {/* Sección 3: Datos del cliente */}
            <FormSection title="Pasajero 1">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Nombre *</Label>
                  <Input
                    required
                    value={form.customerFirstName}
                    onChange={(event) => handleFormChange('customerFirstName', event.target.value)}
                  />
                  <ValidationFeedback
                    valid={form.customerFirstName.trim() === '' ? null : validations.customerFirstName}
                    message={validations.customerFirstName ? 'Nombre válido' : 'Nombre demasiado corto'}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Apellido *</Label>
                  <Input
                    required
                    value={form.customerLastName}
                    onChange={(event) => handleFormChange('customerLastName', event.target.value)}
                  />
                  <ValidationFeedback
                    valid={form.customerLastName.trim() === '' ? null : validations.customerLastName}
                    message={validations.customerLastName ? 'Apellido válido' : 'Apellido demasiado corto'}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="Opcional — se usa para envío de comprobante"
                    value={form.customerEmail}
                    onChange={(event) => handleFormChange('customerEmail', event.target.value)}
                  />
                  <ValidationFeedback
                    valid={form.customerEmail.trim() === '' ? null : validations.customerEmail}
                    message={form.customerEmail.trim() === '' ? 'Podés dejarlo en blanco' : validations.customerEmail ? 'Email válido' : 'Email inválido'}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <div className="space-y-1.5">
                  <Label>Teléfono</Label>
                  <Input
                    type="tel"
                    value={form.customerPhone}
                    onChange={(event) => handleFormChange('customerPhone', event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>País</Label>
                  <Input
                    value={form.customerCountry}
                    onChange={(event) => handleFormChange('customerCountry', event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 mt-4">
                <div className="space-y-1.5">
                  <Label>Documento o DNI</Label>
                  <Input
                    value={form.customerDocument}
                    onChange={(event) => handleFormChange('customerDocument', event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Fecha de nacimiento *</Label>
                  <ArgentineDateInput
                    id="customerBirthDate"
                    value={form.customerBirthDate}
                    onChange={(value) => handleFormChange('customerBirthDate', value)}
                  />
                  <ValidationFeedback
                    valid={form.customerBirthDate.trim() === '' ? null : validations.customerBirthDate}
                    message={validations.customerBirthDate ? 'Fecha válida' : 'Fecha inválida'}
                  />
                </div>
              </div>
            </FormSection>

            {/* Sección 4: Pasajeros adicionales (solo cuando hay más de 1) */}
            {peopleTotal > 1 && form.passengerDetails.length >= 1 && (
              <FormSection title={`Pasajeros (${form.passengerDetails.length})`}>
                <div className="space-y-4">
                  {form.passengerDetails.map((traveler, index) => (
                    <div key={`traveler-${index}`} className="rounded-2xl border border-gray-100 bg-white p-5">
                      <p className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        Pasajero {index + 1}
                        {index === 0 && <span className="text-xs text-[#2BB8BF] font-medium">(Titular)</span>}
                      </p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-600">Nombre *</Label>
                          <Input
                            value={traveler.firstName}
                            onChange={(event) => handleTravelerChange(index, 'firstName', event.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-600">Apellido *</Label>
                          <Input
                            value={traveler.lastName}
                            onChange={(event) => handleTravelerChange(index, 'lastName', event.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-600">Fecha de nacimiento *</Label>
                          <ArgentineDateInput
                            value={traveler.birthDate}
                            onChange={(value) => handleTravelerChange(index, 'birthDate', value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-600">Teléfono *</Label>
                          <Input
                            value={traveler.phone}
                            onChange={(event) => handleTravelerChange(index, 'phone', event.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-600">Documento *</Label>
                          <Input
                            value={traveler.document}
                            onChange={(event) => handleTravelerChange(index, 'document', event.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-gray-600">País *</Label>
                          <Input
                            value={traveler.country}
                            onChange={(event) => handleTravelerChange(index, 'country', event.target.value)}
                            placeholder="País del pasajero"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <ValidationFeedback
                     valid={validations.firstPassengerComplete}
                     message={validations.firstPassengerComplete ? 'Datos del pasajero 1 completos' : 'Completá los datos del pasajero 1'}
                  />
                </div>
              </FormSection>
            )}

            {/* Sección 5: Referidos */}
            {!isVendorMode && (
              <FormSection title="Referidos y comisiones" optional>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    {lockedVendor ? (
                      <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                        <div className="font-medium text-gray-900">{lockedVendor.name}</div>
                        <div className="text-xs text-gray-500">{lockedVendor.email}</div>
                      </div>
                    ) : (
                      <Select
                        value={form.vendorId || 'none'}
                        onValueChange={(value) => {
                          handleFormChange('vendorId', value === 'none' ? '' : value);
                          handleFormChange('selectedReferralCode', '');
                          handleFormChange('manualReferralCode', '');
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccioná un vendedor" />
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
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Select
                      value={form.selectedReferralCode || 'none'}
                      onValueChange={(value) => {
                        handleFormChange('selectedReferralCode', value === 'none' ? '' : value);
                        handleFormChange('manualReferralCode', '');
                      }}
                      disabled={!form.vendorId || referralLinksForPackage.length === 0}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Elegí un código del vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin código</SelectItem>
                        {referralLinksForPackage.length === 0 ? (
                          <SelectItem value="__no_codes__" disabled>
                            Sin códigos disponibles
                          </SelectItem>
                        ) : (
                          referralLinksForPackage.map((l) => (
                            <SelectItem key={l.id} value={l.code}>
                              {l.code} {l.experienceName ? `· ${l.experienceName}` : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Input
                      placeholder="o ingresá un código manual"
                      value={form.manualReferralCode}
                      onChange={(e) => {
                        handleFormChange('manualReferralCode', e.target.value);
                        if (e.target.value.trim()) handleFormChange('selectedReferralCode', '');
                      }}
                    />
                    <p className="text-xs text-gray-500">
                      Si completás este campo, se usará el código exacto.
                    </p>
                  </div>
                </div>
              </FormSection>
            )}

            {/* Sección 6: Comentarios y archivos */}
            <FormSection title="Comentarios y comprobantes" optional>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Comentarios del cliente</Label>
                  <Textarea
                    value={form.customerComments}
                    onChange={(event) => handleFormChange('customerComments', event.target.value)}
                    placeholder="Anotá condiciones especiales, requerimientos o cualquier observación"
                    className="min-h-[100px]"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Comprobantes y archivos</Label>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" className="rounded-full px-4" asChild>
                      <label className="cursor-pointer">
                        {uploadingFiles ? 'Subiendo...' : 'Subir archivos'}
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                      </label>
                    </Button>
                    {uploadingFiles && <span className="text-xs text-gray-500">Procesando archivos...</span>}
                  </div>
                  {attachments.length > 0 ? (
                    <div className="space-y-2 rounded-2xl border border-dashed border-gray-100 bg-gray-50 p-3">
                      {attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center justify-between gap-3 rounded-lg bg-white/80 p-3"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">{attachment.name}</p>
                            <p className="text-xs text-gray-500">{attachment.type || 'Archivo adjunto'}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveAttachment(attachment)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">Aún no cargaste comprobantes.</p>
                  )}
                </div>
              </div>
            </FormSection>

            {/* Botón de submit */}
            <div className="flex flex-col gap-3 pt-4">
              <Button type="submit" variant="success" disabled={submitting || !isFormValid} className="text-base py-6">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando reserva
                  </>
                ) : (
                  'Confirmar reserva manual'
                )}
              </Button>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Se registrará el precio y el snapshot de cupo/config. Si la fecha tiene cupos, se valida disponibilidad antes de confirmar.
              </p>
            </div>
          </form>
        </div>

        {/* Columna derecha: Resumen */}
        <Card className="h-fit sticky top-6 space-y-5 bg-gradient-to-b from-secondary/10 to-white/70 shadow-lg">
          <CardHeader className="space-y-2">
            <CardTitle className="text-base font-semibold text-gray-900">Resumen instantáneo</CardTitle>
            <p className="text-xs text-gray-500">Revisa los datos antes de confirmar.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1 rounded-2xl border border-gray-100 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Paquete</p>
              <p className="text-sm font-semibold text-gray-900">{selectedPaquete?.titulo || 'No seleccionado'}</p>
              <Badge variant="outline" className="text-xs mt-1">
                Reserva manual
              </Badge>
            </div>

            {selectedPaquete && (
              <>
                <div className="space-y-1 rounded-2xl border border-gray-100 bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Fecha</p>
                  <p className="text-sm font-semibold text-gray-900">{formattedDateLabel}</p>
                  <p className="text-xs text-gray-500 mt-1">Personas: {peopleTotal}</p>
                  {stockInfo && (
                    <p className="text-xs text-gray-500 mt-1">
                      Cupo base: {stockInfo.baseCapacity} · Disponible: {stockInfo.available}
                    </p>
                  )}
                  {form.roomSelection.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">Habitaciones: {getRoomSelectionSummary(form.roomSelection)}</p>
                  )}
                </div>

                {computedPricing && (
                  <div className="space-y-1 rounded-2xl border border-gray-100 bg-white/80 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Precio</p>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatAmountCents(originalPackageAmount, currency)}
                    </div>
                    {(seatCategoryExtraDetails.length > 0 || singlePassengerSurcharge.applies) && (
                      <div className="mt-3 space-y-1">
                        {seatCategoryExtraDetails.map((extra) => (
                          <div key={extra.code} className="text-xs text-gray-600 flex justify-between">
                            <span>{extra.label}</span>
                            <span>{formatAmountCents(extra.totalAmount, currency)}</span>
                          </div>
                        ))}
                        {singlePassengerSurcharge.applies && (
                          <div className="text-xs text-amber-700 flex justify-between">
                            <span>{singlePassengerSurcharge.label}</span>
                            <span>+ {formatAmountCents(singlePassengerSurcharge.amount, currency)}</span>
                          </div>
                        )}
                        <div className="border-t border-gray-100 pt-2 mt-2 font-semibold text-sm text-gray-900 flex justify-between">
                          <span>Total</span>
                          <span>{formatAmountCents(computedPricing.subtotalAmount, currency)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedSeatLabels.length > 0 && (
                  <div className="space-y-1 rounded-2xl border border-gray-100 bg-white/80 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Butacas</p>
                    <div className="text-sm text-gray-900">{selectedSeatLabels.join(', ')}</div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-1 rounded-2xl border border-gray-100 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">Cliente</p>
              <p className="text-sm font-semibold text-gray-900">
                {form.customerFirstName || form.customerLastName
                  ? `${form.customerFirstName} ${form.customerLastName}`.trim()
                  : 'Sin nombre'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {form.customerEmail || 'Sin email'}
              </p>
              {form.customerPhone && (
                <p className="text-xs text-gray-500 mt-1">
                  {form.customerPhone}
                </p>
              )}
            </div>

            {attachments.length > 0 && (
              <div className="space-y-1 rounded-2xl border border-gray-100 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Comprobantes</p>
                <p className="text-sm text-gray-900">{attachments.length} archivo{attachments.length > 1 ? 's' : ''} adjunto{attachments.length > 1 ? 's' : ''}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de butacas */}
      <Dialog open={seatDialogOpen} onOpenChange={setSeatDialogOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Seleccionar butacas</DialogTitle>
          </DialogHeader>
          {seatLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}
          {seatData && (
            <div className="mt-4">
              <SeatMap
                template={seatData.template}
                seats={seatData.seats}
                selectedSeatIds={form.selectedSeatIds}
                onChangeSelected={(next) => handleFormChange('selectedSeatIds', next)}
                maxSelectable={peopleTotal}
                compact
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
