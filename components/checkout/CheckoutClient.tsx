'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArgentineDateInput } from '@/components/ui/argentine-date-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import SinglePassengerSurchargeBreakdown from '@/components/pricing/SinglePassengerSurchargeBreakdown';
import {
  ArrowLeft,
  Lock,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Wallet,
  Landmark,
  Mail,
  TicketPercent,
  Calendar,
  User
} from 'lucide-react';
import type { Experience, ReservationRoomSelection, ReservationRoomType, RoomTypeDefinition } from '@/components/landing-reserva/types';
import { Skeleton } from '../ui/skeleton';
import { computeReservationPricing, getReservationExtraTotalAmount, getSinglePassengerSurchargeSummary, isSinglePassengerSurchargeExtra } from '@/lib/packages/resolve-departure';
import { normalizeTravelerDetails } from '@/lib/reservas/traveler-utils';
import { getAuthInstance } from '@/lib/firebase';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { isValidIsoDateString } from '@/lib/utils/argentine-date';
import {
  getPackageRoomTypeLabel,
  getPackageRoomTypeOptions,
} from '@/lib/reservas/room-types';

const getSiteUrl = () =>
  typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL ?? '';

/** Formatea monto según moneda (ars, brl, usd). */
function formatAmount(amount: number, currency: string): string {
  const n = amount.toLocaleString('es-AR', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  if (currency === 'brl') return `R$ ${n}`;
  if (currency === 'usd') return `USD ${n}`;
  return `$ ${n}`;
}

type CheckoutClientProps = {
  mode: 'legacy';
  experience: Experience;
  date: string;
  people: number;
} | {
  mode: 'cart';
  cartId: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MIN_LENGTH = 2;
const PHONE_MIN_LENGTH = 8;

const CHECKOUT_STORAGE_PREFIX = 'checkout_form_';

function getCheckoutStorageKey(slug: string, date: string, people: number) {
  return `${CHECKOUT_STORAGE_PREFIX}${slug}_${date}_${people}`;
}

type CartValidateResponse = {
  ok: boolean;
  cart: any;
  items: any[];
  invalid?: Array<{ itemId: string; reason: string }>;
};

function formatAmountCents(amountCents: number, currency: string): string {
  const normalized = (currency || 'ars').toUpperCase();
  const locale = normalized === 'BRL' ? 'pt-BR' : normalized === 'USD' ? 'en-US' : 'es-AR';
  const symbol = normalized === 'USD' ? 'US$' : normalized === 'BRL' ? 'R$' : '$';
  const value = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format((amountCents || 0) / 100);
  return `${symbol} ${value} ${normalized}`;
}

async function getOptionalCommunityAuthorizationHeader(): Promise<Record<string, string>> {
  try {
    const user = getAuthInstance().currentUser;
    return user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {};
  } catch {
    return {};
  }
}

function getExtraTotalAmount(extra: any, people: number): number {
  return getReservationExtraTotalAmount(extra, people);
}

type TravelerForm = {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  document: string;
  country: string;
};

type CheckoutRoomType = ReservationRoomType | '';
type CheckoutStep = 'form' | 'companions' | 'payment';

const EMPTY_TRAVELER: TravelerForm = {
  firstName: '',
  lastName: '',
  birthDate: '',
  phone: '',
  document: '',
  country: '',
};

export default function CheckoutClient(props: CheckoutClientProps) {
  const isCartMode = props.mode === 'cart';
  const storageKey = isCartMode
    ? `${CHECKOUT_STORAGE_PREFIX}cart_${props.cartId}`
    : getCheckoutStorageKey(props.experience.slug, props.date, props.people);
  const [step, setStep] = useState<CheckoutStep>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(isCartMode);
  const [communityUser, setCommunityUser] = useState<FirebaseUser | null>(null);
  const [communityAuthReady, setCommunityAuthReady] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [communityQuote, setCommunityQuote] = useState<{ promotion: { kind: string; id: string; code?: string } | null; discount: { nombre: string; montoDescuento: number; montoFinal: number } | null; originalAmountCents: number; finalAmountCents: number; currency: string } | null>(null);
  const [isCheckingPromotion, setIsCheckingPromotion] = useState(false);
  const [communityQuoteError, setCommunityQuoteError] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [cartData, setCartData] = useState<CartValidateResponse | null>(null);
  const [companionsSubmitted, setCompanionsSubmitted] = useState(false);
  const [touched, setTouched] = useState({ firstName: false, lastName: false, email: false, phone: false, document: false, birthDate: false });
  const [form, setForm] = useState({
    customerFirstName: '',
    customerLastName: '',
    customerEmail: '',
    customerPhone: '',
    customerCountry: '',
    customerDocument: '',
    customerBirthDate: '',
    roomType: '' as CheckoutRoomType,
    roomSelection: [] as ReservationRoomSelection[],
    customerComments: '',
    passengerDetails: [] as TravelerForm[],
  });

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    try {
      unsubscribe = onAuthStateChanged(getAuthInstance(), async (user) => {
        if (!active) return;
        setCommunityUser(user);
        if (!user) {
          setCommunityAuthReady(true);
          return;
        }
        try {
          const token = await user.getIdToken();
          const response = await fetch('/api/community/profile', {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          const result = response.ok ? await response.json() : {};
          const profile = result.profile ?? {};
          const displayName = String(user.displayName ?? '').trim().split(/\s+/).filter(Boolean);
          const firstName = String(profile.nombre ?? displayName[0] ?? '').trim();
          const lastName = String(profile.apellido ?? displayName.slice(1).join(' ') ?? '').trim();
          if (!active) return;
          setForm((previous) => ({
            ...previous,
            customerFirstName: firstName || previous.customerFirstName,
            customerLastName: lastName || previous.customerLastName,
            customerEmail: String(user.email ?? profile.email ?? previous.customerEmail).trim().toLowerCase(),
            customerPhone: String(profile.telefono ?? previous.customerPhone),
          }));
        } catch {
          if (active && user.email) {
            setForm((previous) => ({ ...previous, customerEmail: user.email!.trim().toLowerCase() }));
          }
        } finally {
          if (active) setCommunityAuthReady(true);
        }
      });
    } catch {
      setCommunityAuthReady(true);
    }
    return () => { active = false; unsubscribe(); };
  }, []);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<typeof form>;
        setForm((prev) => ({
          ...prev,
          ...(parsed.customerFirstName != null && { customerFirstName: String(parsed.customerFirstName) }),
          ...(parsed.customerLastName != null && { customerLastName: String(parsed.customerLastName) }),
          ...(parsed.customerEmail != null && { customerEmail: String(parsed.customerEmail) }),
          ...(parsed.customerPhone != null && { customerPhone: String(parsed.customerPhone) }),
          ...(parsed.customerCountry != null && { customerCountry: String(parsed.customerCountry) }),
          ...(parsed.customerDocument != null && { customerDocument: String(parsed.customerDocument) }),
          ...(parsed.customerBirthDate != null && { customerBirthDate: String(parsed.customerBirthDate) }),
          ...((parsed as any).roomType != null && {
            roomType: String((parsed as any).roomType) as CheckoutRoomType,
          }),
          ...(Array.isArray((parsed as any).roomSelection) && {
            roomSelection: (parsed as any).roomSelection
              .map((item: any) => ({
                roomType: String(item?.roomType ?? '') as ReservationRoomType,
                quantity: Math.max(0, Number(item?.quantity ?? 0) || 0),
              }))
              .filter((item: ReservationRoomSelection) => item.quantity > 0 && item.roomType),
          }),
          ...(parsed.customerComments != null && { customerComments: String(parsed.customerComments) }),
          ...(Array.isArray((parsed as any).passengerDetails) && {
            passengerDetails: (parsed as any).passengerDetails.map((item: any) => ({
              firstName: String(item?.firstName ?? ''),
              lastName: String(item?.lastName ?? ''),
              birthDate: String(item?.birthDate ?? ''),
              phone: String(item?.phone ?? ''),
              document: String(item?.document ?? ''),
              country: String(item?.country ?? ''),
            })),
          }),
        }));
      }
    } catch {
      // ignore invalid JSON
    }
    setRestored(true);
  }, [storageKey]);

  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(form));
    } catch {
      // ignore quota / private mode
    }
  }, [restored, storageKey, form]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('ref') || url.searchParams.get('referral') || url.searchParams.get('code');
      setReferralCode(code && code.trim() ? code.trim() : null);
    } catch {
      setReferralCode(null);
    }
  }, []);

  useEffect(() => {
    if (!isCartMode || !cartData?.items?.length) return;
    const firstRoomType = String(cartData.items[0]?.roomType ?? '').trim();
    const firstRoomSelection = Array.isArray((cartData.items[0] as any)?.roomSelection)
      ? ((cartData.items[0] as any).roomSelection as ReservationRoomSelection[])
      : [];
    if (!firstRoomType && firstRoomSelection.length === 0) return;
    setForm((prev) =>
      !prev.roomType && prev.roomSelection.length === 0
        ? {
            ...prev,
            roomType: firstRoomType as CheckoutRoomType,
            roomSelection: firstRoomSelection,
          }
        : prev
    );
  }, [cartData?.items, isCartMode]);

  const experience = !isCartMode ? props.experience : null;
  const date = !isCartMode ? props.date : 'sin-fecha';
  const people = !isCartMode ? props.people : 0;

  const directAdministrativeFeeAmount = !isCartMode
    ? Math.max(
      0,
      Number(
        (experience as any)?.gastosAdministrativos ??
        (experience as any)?.precioDescuentoPrimerosCupos ??
        0
      ) || 0
    ) * 100
    : 0;

  const bc = experience?.bookingConfig;
  const paymentMethodsFromConfig = bc?.paymentMethods;
  const hasMercadoPago = !isCartMode
    ? (paymentMethodsFromConfig
      ? !!paymentMethodsFromConfig.mercadoPago
      : true)
    : true;

  const directPricing = useMemo(() => {
    if (isCartMode || !experience) return null;
    return computeReservationPricing(experience as any, date, {
      people,
      selectedExtras: directAdministrativeFeeAmount > 0
        ? [{
          code: 'administrativeFee',
          label: 'Gastos Administrativos',
          amount: directAdministrativeFeeAmount,
          source: 'package',
          scope: 'per_person',
        }]
        : [],
    });
  }, [date, directAdministrativeFeeAmount, experience, isCartMode, people]);
  const total = !isCartMode
    ? (directPricing?.subtotalAmount ?? 0)
    : (typeof cartData?.cart?.amountTotal === 'number' ? cartData.cart.amountTotal : 0);
  const currency = !isCartMode
    ? ((bc?.currency === 'brl' || bc?.currency === 'usd') ? bc.currency : 'ars')
    : (cartData?.cart?.currency ?? 'ars');
  const dateLabel = !isCartMode
    ? (date && date !== 'sin-fecha'
      ? new Date(date + 'T12:00:00').toLocaleDateString('es-AR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
      : 'Sin fecha específica (a coordinar)')
    : '';
  const totalTravelers = !isCartMode
    ? people
    : (Array.isArray(cartData?.items)
      ? cartData.items.reduce((sum, item) => sum + Math.max(0, Number(item?.people ?? 0) || 0), 0)
      : 0);
  const roomTypeOptionSets = useMemo(() => {
    if (!isCartMode) return [getPackageRoomTypeOptions(experience as any)];
    return (cartData?.items ?? []).map((item: any) => {
      if (Array.isArray(item?.availableRoomTypeOptions)) return item.availableRoomTypeOptions as RoomTypeDefinition[];
      return Array.isArray(item?.availableRoomTypes)
        ? item.availableRoomTypes.map((id: string) => ({ id, label: id, description: '' }))
        : [];
    });
  }, [cartData?.items, experience, isCartMode]);
  const availableRoomTypeOptions = useMemo(() => {
    if (roomTypeOptionSets.length === 0) return [];
    return roomTypeOptionSets.slice(1).reduce<RoomTypeDefinition[]>(
      (common, options) => common.filter((option) => options.some((candidate: RoomTypeDefinition) => candidate.id === option.id)),
      roomTypeOptionSets[0]
    );
  }, [roomTypeOptionSets]);
  const availableRoomTypes = useMemo(() => availableRoomTypeOptions.map((option) => option.id), [availableRoomTypeOptions]);
  const roomTypeRequired = roomTypeOptionSets.some((options) => options.length > 0);
  const roomConfigurationReady = !isCartMode || Boolean(cartData?.items?.length);
  const roomTypeCompatible =
    !roomTypeRequired ||
    availableRoomTypes.includes(form.roomType as ReservationRoomType);
  const checkoutExtras = useMemo(() => {
    if (!isCartMode) {
      const extras = Array.isArray((directPricing as any)?.selectedExtras) ? (directPricing as any).selectedExtras : [];
      if (!extras.length) {
        return { amount: 0, items: [] as Array<{ code: string; label: string; amount: number }> };
      }
      return {
        amount: extras.reduce((sum: number, extra: any) => sum + getExtraTotalAmount(extra, Math.max(1, people)), 0),
        items: extras.map((extra: any) => ({
          code: String(extra?.code ?? ''),
          label: String(extra?.label ?? ''),
          amount: getExtraTotalAmount(extra, Math.max(1, people)),
        })),
      };
    }
    if (!Array.isArray(cartData?.items)) return { amount: 0, items: [] as Array<{ code: string; label: string; amount: number }> };
    const byLabel = new Map<string, { code: string; label: string; amount: number }>();
    let amount = 0;
    for (const item of cartData.items) {
      const people = Math.max(1, Number(item?.people ?? 0) || 0);
      if (Array.isArray(item?.selectedExtras)) {
        for (const extra of item.selectedExtras) {
          const label = String(extra?.label ?? '').trim();
          if (!label) continue;
          const extraAmount = getExtraTotalAmount(extra, people);
          amount += extraAmount;
          const current = byLabel.get(label);
          if (current) {
            current.amount += extraAmount;
          } else {
            byLabel.set(label, { code: String(extra?.code ?? ''), label, amount: extraAmount });
          }
        }
      }
    }
    return { amount, items: Array.from(byLabel.values()) };
  }, [cartData?.items, directPricing, isCartMode, people]);
  const checkoutBaseSubtotal = Math.max(0, total - checkoutExtras.amount);
  const appliedCommunityDiscount = communityQuote?.discount && communityQuote.currency.toLowerCase() === currency.toLowerCase()
    ? Math.min(checkoutBaseSubtotal, Math.max(0, Number(communityQuote.discount.montoDescuento) || 0))
    : 0;
  const checkoutDisplayTotal = Math.max(0, total - appliedCommunityDiscount);
  const checkoutSinglePassengerSurcharge = useMemo(
    () => getSinglePassengerSurchargeSummary({
      people: totalTravelers,
      baseSubtotalAmount: checkoutBaseSubtotal,
      selectedExtras: checkoutExtras.items.map((item: { code: string; label: string; amount: number }) => ({
        code: item.code === 'singlePassengerSurcharge' ? 'singlePassengerSurcharge' : 'administrativeFee',
        label: item.label,
        amount: item.amount,
        scope: 'per_booking',
      })),
    }),
    [checkoutBaseSubtotal, checkoutExtras.items, totalTravelers]
  );
  const additionalTravelers = Math.max(0, totalTravelers - 1);
  const hasAdditionalTravelers = additionalTravelers > 0;
  const steps = useMemo(
    () => [
      { id: 'form' as const, title: 'Tus datos', icon: User },
      ...(hasAdditionalTravelers ? [{ id: 'companions' as const, title: 'Pasajeros', icon: User }] : []),
      { id: 'payment' as const, title: 'Pago', icon: CreditCard },
    ],
    [hasAdditionalTravelers]
  );

  useEffect(() => {
    setForm((prev) => {
      const current = Array.isArray(prev.passengerDetails) ? prev.passengerDetails : [];
      if (current.length === additionalTravelers) return prev;
      const next = Array.from({ length: additionalTravelers }, (_, index) => current[index] ?? { ...EMPTY_TRAVELER });
      return { ...prev, passengerDetails: next };
    });
    setCompanionsSubmitted(false);
  }, [additionalTravelers]);

  useEffect(() => {
    if (!roomConfigurationReady) return;
    const hasStoredRoom = Boolean(form.roomType) || form.roomSelection.length > 0;
    const roomIsUnavailable =
      availableRoomTypes.length === 0 ||
      (form.roomType && !availableRoomTypes.includes(form.roomType as ReservationRoomType));
    if (hasStoredRoom && roomIsUnavailable) {
      setForm((prev) => ({ ...prev, roomType: '', roomSelection: [] }));
    }
  }, [availableRoomTypes, form.roomSelection.length, form.roomType, roomConfigurationReady]);

  useEffect(() => {
    if (!isCartMode) return;
    let cancelled = false;
    const run = async () => {
      setIsValidating(true);
      const res = await fetch('/api/cart/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId: props.cartId }),
      });
      if (!res.ok) throw new Error('No se pudo validar el carrito.');
      const json = (await res.json()) as CartValidateResponse;
      if (!cancelled) {
        setCartData(json);
        setIsValidating(false);
      }
    };
    run().catch((e) => {
      if (!cancelled) {
        setError(e instanceof Error ? e.message : 'Error validando carrito.');
        setIsValidating(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isCartMode, isCartMode ? props.cartId : null]);

  const firstNameError = touched.firstName && form.customerFirstName.trim().length < NAME_MIN_LENGTH;
  const lastNameError = touched.lastName && form.customerLastName.trim().length < NAME_MIN_LENGTH;
  const emailError = touched.email && form.customerEmail.trim() !== '' && !EMAIL_REGEX.test(form.customerEmail.trim());
  const phoneError = touched.phone && (form.customerPhone.trim().length < PHONE_MIN_LENGTH);
  const documentError = touched.document && !form.customerDocument.trim();
  const birthDateError = touched.birthDate && !isValidIsoDateString(form.customerBirthDate.trim());

  const getTravelerErrors = (traveler: TravelerForm) => {
    return {
      firstName: traveler.firstName.trim().length < NAME_MIN_LENGTH,
      lastName: traveler.lastName.trim().length < NAME_MIN_LENGTH,
      birthDate: !isValidIsoDateString(traveler.birthDate.trim()),
      phone: traveler.phone.trim().length < PHONE_MIN_LENGTH,
      document: !traveler.document.trim(),
      country: traveler.country.trim().length < 2,
    };
  };

  const hasTravelerErrors = form.passengerDetails.some((traveler) => {
    const errors = getTravelerErrors(traveler);
    return Object.values(errors).some(Boolean);
  });

  const sanitizedPassengerDetails = form.passengerDetails.map((traveler) =>
    normalizeTravelerDetails({
      firstName: traveler.firstName.trim(),
      lastName: traveler.lastName.trim(),
      birthDate: traveler.birthDate.trim(),
      phone: traveler.phone.trim(),
      document: traveler.document.trim(),
      country: traveler.country.trim(),
    })
  );

  const syncRoomTypeForCart = async (
    roomType: ReservationRoomType | null | undefined,
    roomSelection: ReservationRoomSelection[] | null | undefined
  ) => {
    if (!isCartMode || !cartData?.items?.length) return;
    for (const item of cartData.items) {
      const itemId = String(item?.id ?? '').trim();
      if (!itemId) continue;
      const response = await fetch('/api/cart/items', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          ...(roomType === undefined ? {} : { roomType }),
          roomSelection,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || 'No se pudo guardar la distribución de habitaciones.');
      }
    }
    if (roomType !== undefined) {
      setCartData((prev) =>
        prev
          ? {
            ...prev,
            items: prev.items.map((item) => ({ ...item, roomType, roomSelection })),
          }
          : prev
      );
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCheckingPromotion || communityQuoteError || (communityUser && (!communityAuthReady || !communityQuote))) return;
    setTouched({ firstName: true, lastName: true, email: true, phone: true, document: true, birthDate: true });
    const firstName = form.customerFirstName.trim();
    const lastName = form.customerLastName.trim();
    const email = form.customerEmail.trim();
    const phone = form.customerPhone.trim();
    const document = form.customerDocument.trim();
    const birthDate = form.customerBirthDate.trim();

    if (!firstName || firstName.length < NAME_MIN_LENGTH) {
      setError('Ingresá tu nombre (mínimo 2 caracteres).');
      return;
    }
    if (!lastName || lastName.length < NAME_MIN_LENGTH) {
      setError('Ingresá tu apellido (mínimo 2 caracteres).');
      return;
    }
    if (email && !EMAIL_REGEX.test(email)) {
      setError('Ingresá un email válido.');
      return;
    }
    if (!phone) {
      setError('El WhatsApp es obligatorio.');
      return;
    }
    if (phone.length < PHONE_MIN_LENGTH) {
      setError(`El WhatsApp debe tener al menos ${PHONE_MIN_LENGTH} caracteres.`);
      return;
    }
    if (!document) {
      setError('El DNI / Pasaporte es obligatorio.');
      return;
    }
    if (!isValidIsoDateString(birthDate)) {
      setError('Ingresá tu fecha de nacimiento.');
      return;
    }
    if (!isCartMode && !roomTypeCompatible) {
      setError('Seleccioná uno de los tipos de habitación disponibles.');
      return;
    }
    setError(null);
    setStep(hasAdditionalTravelers ? 'companions' : 'payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitCompanions = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCheckingPromotion || communityQuoteError || (communityUser && (!communityAuthReady || !communityQuote))) return;
    setCompanionsSubmitted(true);
    if (!hasAdditionalTravelers) {
      setStep('payment');
      return;
    }
    if (form.passengerDetails.length !== additionalTravelers) {
      setError('Faltan completar pasajeros acompañantes.');
      return;
    }
    if (hasTravelerErrors) {
      setError('Completá los datos de todos los pasajeros antes de continuar.');
      return;
    }
    setError(null);
    setStep('payment');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const createMercadoPagoPreferenceForLegacy = async () => {
    if (isCartMode || !experience) {
      setError('Este checkout requiere un carrito válido.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      if (date && date !== 'sin-fecha') {
        try {
          const availRes = await fetch(`/api/experiencias/${encodeURIComponent(experience.slug)}/availability?date=${encodeURIComponent(date)}&people=${encodeURIComponent(String(people))}`);
          if (!availRes.ok) {
            const d = await availRes.json().catch(() => ({}));
            throw new Error(d?.error || 'No se pudo verificar disponibilidad.');
          }
          const availData = await availRes.json();
          if (!availData.ok) {
            throw new Error(`No hay cupo suficiente. Disponible: ${availData.available ?? 0}.`);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error verificando disponibilidad.');
          setIsLoading(false);
          return;
        }
      }
      const baseUrl = getSiteUrl();
      const communityHeaders = communityUser
        ? { Authorization: `Bearer ${await communityUser.getIdToken()}` }
        : await getOptionalCommunityAuthorizationHeader();
      const response = await fetch('/api/mercadopago/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...communityHeaders },
        body: JSON.stringify({
          slug: experience.slug,
          packageId: experience.id,
          date,
          people,
          customerEmail: communityUser?.email?.trim() || form.customerEmail.trim(),
          customerFirstName: form.customerFirstName.trim(),
          customerLastName: form.customerLastName.trim(),
          customerName: `${form.customerFirstName.trim()} ${form.customerLastName.trim()}`.trim(),
          customerPhone: form.customerPhone.trim() || undefined,
          customerCountry: form.customerCountry.trim() || undefined,
          customerDocument: form.customerDocument.trim() || undefined,
          customerBirthDate: form.customerBirthDate.trim() || undefined,
          ...(form.roomType ? { roomType: form.roomType } : {}),
          ...(form.roomSelection.length > 0 ? { roomSelection: form.roomSelection } : {}),
          customerComments: form.customerComments.trim() || undefined,
          passengerDetails: sanitizedPassengerDetails,
          ...(couponCode.trim() ? { couponCode: couponCode.trim().toUpperCase() } : {}),
          ...(communityQuote ? { expectedPromotionId: communityQuote.promotion?.id ?? '', expectedDiscountCents: communityQuote.discount?.montoDescuento ?? 0 } : {}),
          successUrl: `${baseUrl}/checkout/success?slug=${encodeURIComponent(experience.slug)}&date=${encodeURIComponent(date)}&people=${encodeURIComponent(String(people))}`,
          failureUrl: `${baseUrl}/checkout/cancel?slug=${encodeURIComponent(experience.slug)}`,
          pendingUrl: `${baseUrl}/checkout/success?slug=${encodeURIComponent(experience.slug)}&date=${encodeURIComponent(date)}&people=${encodeURIComponent(String(people))}`,
          ...(referralCode ? { referralCode } : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'No se pudo crear la sesión de pago.');
      }

      const data = (await response.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('No se recibió URL de pago.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar el pago.');
    } finally {
      setIsLoading(false);
    }
  };

  const createMercadoPagoPreferenceForCart = async () => {
    if (!isCartMode) return;
    setError(null);
    setIsLoading(true);
    try {
      const validateRes = await fetch('/api/cart/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cartId: props.cartId }),
      });
      const validateData = (await validateRes.json().catch(() => ({}))) as CartValidateResponse;
      if (!validateRes.ok || !validateData.ok) {
        setCartData(validateData);
        throw new Error('Tu carrito no es válido o venció. Volvé al carrito para actualizar.');
      }
      setCartData(validateData);

      const baseUrl = getSiteUrl();
      const communityHeaders = communityUser
        ? { Authorization: `Bearer ${await communityUser.getIdToken()}` }
        : await getOptionalCommunityAuthorizationHeader();
      const response = await fetch('/api/mercadopago/preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...communityHeaders },
        body: JSON.stringify({
          cartId: props.cartId,
          customerEmail: communityUser?.email?.trim() || form.customerEmail.trim(),
          customerFirstName: form.customerFirstName.trim(),
          customerLastName: form.customerLastName.trim(),
          customerName: `${form.customerFirstName.trim()} ${form.customerLastName.trim()}`.trim(),
          customerPhone: form.customerPhone.trim() || undefined,
          customerDocument: form.customerDocument.trim() || undefined,
          customerBirthDate: form.customerBirthDate.trim() || undefined,
          customerComments: form.customerComments.trim() || undefined,
          passengerDetails: sanitizedPassengerDetails,
          ...(couponCode.trim() ? { couponCode: couponCode.trim().toUpperCase() } : {}),
          ...(communityQuote ? { expectedPromotionId: communityQuote.promotion?.id ?? '', expectedDiscountCents: communityQuote.discount?.montoDescuento ?? 0 } : {}),
          successUrl: `${baseUrl}/checkout/success?cart=1&cartId=${encodeURIComponent(props.cartId)}`,
          failureUrl: `${baseUrl}/checkout/cancel?cart=1&cartId=${encodeURIComponent(props.cartId)}`,
          pendingUrl: `${baseUrl}/checkout/success?cart=1&cartId=${encodeURIComponent(props.cartId)}`,
          ...(referralCode ? { referralCode } : {}),
        }),
      });
      if (!response.ok) {
        const d = await response.json().catch(() => ({}));
        throw new Error(d?.error || 'No se pudo iniciar el pago.');
      }
      const data = (await response.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error('No se recibió URL de pago.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar el pago.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!communityAuthReady) return;
    if (!communityUser) {
      setCommunityQuote(null);
      setCommunityQuoteError('');
      setIsCheckingPromotion(false);
      return;
    }
    if (isCartMode && (!cartData?.items?.length || isValidating)) return;
    if (!isCartMode && (!experience || checkoutBaseSubtotal < 1)) return;

    let cancelled = false;
    const controller = new AbortController();
    setCommunityQuote(null);
    setCommunityQuoteError('');
    setIsCheckingPromotion(true);
    const timer = window.setTimeout(async () => {
      try {
        const token = await communityUser.getIdToken();
        const checkout = isCartMode
          ? {
              cartId: props.cartId,
              customerEmail: communityUser.email?.trim().toLowerCase(),
              ...(couponCode.trim() ? { couponCode: couponCode.trim().toUpperCase() } : {}),
              previewOnly: true,
            }
          : {
              customerEmail: communityUser.email?.trim().toLowerCase(),
              ...(form.roomType ? { roomType: form.roomType.trim() } : {}),
              ...(form.roomSelection.length > 0 ? { roomSelection: form.roomSelection } : {}),
              ...(couponCode.trim() ? { couponCode: couponCode.trim().toUpperCase() } : {}),
              slug: experience?.slug,
              packageId: experience?.id,
              date,
              people,
              previewOnly: true,
            };
        const response = await fetch('/api/mercadopago/preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(checkout),
          signal: controller.signal,
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'No se pudo actualizar la promoción.');
        if (!cancelled) setCommunityQuote(result);
      } catch (cause) {
        if (!cancelled && !controller.signal.aborted) {
          setCommunityQuoteError(cause instanceof Error ? cause.message : 'No se pudo actualizar la promoción.');
        }
      } finally {
        if (!cancelled) setIsCheckingPromotion(false);
      }
    }, couponCode.trim() ? 350 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    communityAuthReady,
    communityUser,
    couponCode,
    isCartMode,
    cartData?.items,
    isValidating,
    experience,
    date,
    people,
    checkoutBaseSubtotal,
    form.customerEmail,
    form.roomType,
    form.roomSelection,
    props.mode === 'cart' ? props.cartId : null,
  ]);

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 md:py-12 selection:bg-[#2BB8BF]/20 selection:text-[#2BB8BF]">
      <div className="container mx-auto max-w-2xl px-4">
        {/* Header Navigation */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center justify-between"
        >
          <Link
            href={isCartMode ? '/carrito' : `/paquete/${experience?.slug}`}
            className="group flex items-center gap-2 text-sm font-semibold text-slate-600 transition-all hover:text-[#2BB8BF]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-200 transition-all group-hover:ring-[#2BB8BF]/30">
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </div>
            {isCartMode ? 'Volver al carrito' : `Volver`}
          </Link>

          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-100 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            CHECKOUT SEGURO
          </div>
        </motion.div>

        {/* Main Content (Single Column Centered) */}
        <div className="space-y-6">
          <motion.header
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-2"
          >
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Finalizá tu <span className="text-[#2BB8BF]">Reserva</span>
            </h1>
            <p className="text-sm font-medium text-slate-500">
              Completá los pasos para asegurar tu lugar.
            </p>
          </motion.header>

          {/* Stepper (Compact) */}
          <div className="flex items-center justify-center gap-4 py-2">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              const isActive = step === s.id;
              const currentIndex = steps.findIndex((item) => item.id === step);
              const isCompleted = idx < currentIndex;
              return (
                <div key={s.id} className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{
                        scale: isActive ? 1.05 : 1,
                        backgroundColor: isCompleted || isActive ? '#2BB8BF' : '#fff'
                      }}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ring-1 transition-all ${isCompleted || isActive ? 'ring-[#2BB8BF]/30' : 'ring-slate-200'
                        }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-white" />
                      ) : (
                        <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      )}
                    </motion.div>
                    <span className={`text-xs font-bold ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>
                      {s.title}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className="h-[1px] w-8 bg-slate-200" />
                  )}
                </div>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {step === 'form' ? (
              <motion.div
                key="form-step"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Order Summary (Integrated at top) */}
                <Card className="overflow-hidden border-0 shadow-lg shadow-slate-200/50 ring-1 ring-slate-200/60 rounded-2xl">
                  <CardHeader className="bg-slate-50/50 pb-3 pt-4 px-6">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-400">Resumen de pago</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6">
                    {isValidating ? (
                      <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-3 text-sm text-slate-700">
                          <div className="flex items-center justify-between gap-3">
                            <span>Subtotal ({totalTravelers} pasajeros)</span>
                            <span className="font-semibold text-slate-900">
                              {formatAmountCents(checkoutBaseSubtotal, currency)}
                            </span>
                          </div>
                          {communityUser && isCheckingPromotion && <div className="space-y-2 py-1" aria-label="Actualizando resumen"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>}
                          {appliedCommunityDiscount > 0 && <div className="flex items-center justify-between gap-3 text-[#187F80]">
                            <span>{communityQuote?.discount?.nombre ?? 'Beneficio de comunidad'}</span>
                            <span className="font-semibold">− {formatAmountCents(appliedCommunityDiscount, currency)}</span>
                          </div>}
                          {checkoutExtras.items
                            .filter((extra: { code: string; label: string; amount: number }) => !isSinglePassengerSurchargeExtra(extra as any))
                            .map((extra: { code: string; label: string; amount: number }) => (
                            <div
                              key={extra.label}
                              className="flex items-center justify-between gap-3"
                            >
                              <span>{extra.label}</span>
                              <span className="font-semibold text-slate-900">
                                {formatAmountCents(extra.amount, currency)}
                              </span>
                            </div>
                          ))}
                          {checkoutSinglePassengerSurcharge.applies ? (
                            <SinglePassengerSurchargeBreakdown
                              label={checkoutSinglePassengerSurcharge.label}
                              amountLabel={formatAmountCents(checkoutSinglePassengerSurcharge.amount, currency)}
                              tone="teal"
                            />
                          ) : null}
                          <div className="h-px bg-slate-200" />
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-slate-900">Total a pagar</span>
                            <span className="text-xl font-bold text-[#2BB8BF]">{formatAmountCents(checkoutDisplayTotal, currency)}</span>
                          </div>
                          {isCartMode ? (
                            <p className="text-xs font-medium text-slate-500">
                              {`${totalTravelers} ${totalTravelers === 1 ? 'viajero' : 'viajeros'} · ${cartData?.items?.length ?? 0} destino(s)`}
                            </p>
                          ) : (
                            <p className="text-xs font-medium text-slate-500">
                              {`${people} ${people === 1 ? 'viajero' : 'viajeros'} · ${dateLabel}`}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/60 rounded-2xl">
                  <CardHeader className="bg-white pb-2 pt-6 px-6">
                    <CardTitle className="text-xl font-bold text-slate-900">Pasajero 1</CardTitle>
                    <p className="text-xs font-medium text-slate-500">
                      Usaremos estos datos para enviarte la confirmación y contactarte.
                    </p>
                  </CardHeader>
                  <CardContent className="p-6">
                    <form onSubmit={handleSubmitForm} className="space-y-5" noValidate>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="customerFirstName" className="text-xs font-bold text-slate-700 ml-1">Nombre *</Label>
                          <Input
                              id="customerFirstName"
                              autoComplete="given-name"
                            value={form.customerFirstName}
                              onChange={(e) => setForm((f) => ({ ...f, customerFirstName: e.target.value }))}
                            onBlur={() => setTouched((t) => ({ ...t, firstName: true }))}
                            placeholder="Ej: María"
                            className="h-11 rounded-xl border-slate-200 bg-slate-50/30 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                          />
                          {firstNameError && <p className="text-[10px] font-bold text-red-500 ml-1">Mínimo 2 caracteres</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="customerLastName" className="text-xs font-bold text-slate-700 ml-1">Apellido *</Label>
                          <Input
                              id="customerLastName"
                              autoComplete="family-name"
                            value={form.customerLastName}
                            onChange={(e) => setForm((f) => ({ ...f, customerLastName: e.target.value }))}
                            onBlur={() => setTouched((t) => ({ ...t, lastName: true }))}
                            placeholder="Ej: García"
                            className="h-11 rounded-xl border-slate-200 bg-slate-50/30 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                          />
                          {lastNameError && <p className="text-[10px] font-bold text-red-500 ml-1">Mínimo 2 caracteres</p>}
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor="customerEmail" className="text-xs font-bold text-slate-700 ml-1">Email de contacto</Label>
                          <div className="relative">
                            <Input
                              id="customerEmail"
                              type="email"
                              value={form.customerEmail}
                              onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
                              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                              placeholder="tu@email.com"
                              disabled={Boolean(communityUser) || !communityAuthReady}
                              autoComplete="email"
                              className="h-11 rounded-xl border-slate-200 bg-slate-50/30 pl-10 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600"
                            />
                            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          </div>
                          <p className="text-[10px] text-slate-500 ml-1">{communityUser ? 'Correo de tu cuenta Explorarg; no se puede modificar durante el checkout.' : 'Lo usamos para enviarte el comprobante.'}</p>
                          {emailError && <p className="text-[10px] font-bold text-red-500 ml-1">Ingresá un email válido</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="customerPhone" className="text-xs font-bold text-slate-700 ml-1">WhatsApp *</Label>
                          <Input
                            id="customerPhone"
                            value={form.customerPhone}
                            onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                            onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                            placeholder="+54 11 ..."
                            className="h-11 rounded-xl border-slate-200 bg-slate-50/30 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                          />
                          {phoneError && <p className="text-[10px] font-bold text-red-500 ml-1">WhatsApp obligatorio</p>}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="customerDocument" className="text-xs font-bold text-slate-700 ml-1">DNI / Pasaporte *</Label>
                          <Input
                            id="customerDocument"
                            value={form.customerDocument}
                            onChange={(e) => setForm((f) => ({ ...f, customerDocument: e.target.value }))}
                            onBlur={() => setTouched((t) => ({ ...t, document: true }))}
                            placeholder="Número de doc"
                            className="h-11 rounded-xl border-slate-200 bg-slate-50/30 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                          />
                          {documentError && <p className="text-[10px] font-bold text-red-500 ml-1">DNI / Pasaporte obligatorio</p>}
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor="customerBirthDate" className="text-xs font-bold text-slate-700 ml-1">Fecha de nacimiento *</Label>
                          <ArgentineDateInput
                            id="customerBirthDate"
                            value={form.customerBirthDate}
                            onChange={(value) => setForm((f) => ({ ...f, customerBirthDate: value }))}
                            onBlur={() => setTouched((t) => ({ ...t, birthDate: true }))}
                            className="h-11 rounded-xl border-slate-200 bg-slate-50/30 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                          />
                          {birthDateError && <p className="text-[10px] font-bold text-red-500 ml-1">Fecha de nacimiento obligatoria</p>}
                        </div>
                        {!isCartMode && availableRoomTypes.length > 0 && (
                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor="roomType" className="text-xs font-bold text-slate-700 ml-1">
                            Distribución de habitaciones *
                          </Label>
                          <Select
                            value={form.roomType || undefined}
                            onValueChange={(value) => {
                              const roomType = value as ReservationRoomType;
                              setForm((f) => ({
                                ...f,
                                roomType,
                                roomSelection: [{ roomType, quantity: 1 }],
                              }));
                            }}
                          >
                            <SelectTrigger
                              id="roomType"
                              className="h-11 rounded-xl border-slate-200 bg-slate-50/30 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                            >
                              <SelectValue placeholder="Elegí un tipo de habitación" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableRoomTypeOptions.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className={`text-[10px] font-medium ml-1 ${roomTypeCompatible ? 'text-slate-500' : 'text-red-500'}`}>
                            {roomTypeCompatible
                              ? `Habitación elegida: ${getPackageRoomTypeLabel({ roomTypes: availableRoomTypes, roomTypeOptions: availableRoomTypeOptions } as any, form.roomType)}.`
                              : 'Seleccioná uno de los tipos de habitación disponibles.'}
                          </p>
                        </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="customerComments" className="text-xs font-bold text-slate-700 ml-1">Comentarios Especiales</Label>
                        <Textarea
                          id="customerComments"
                          value={form.customerComments}
                          onChange={(e) => setForm((f) => ({ ...f, customerComments: e.target.value }))}
                          placeholder="Dietas especiales, punto de encuentro, etc."
                          className="min-h-[80px] rounded-xl border-slate-200 bg-slate-50/30 text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                        />
                      </div>

                      {error && (
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl bg-red-50 p-4 text-xs font-bold text-red-600 ring-1 ring-red-100 flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          {error}
                        </motion.div>
                      )}

                      <Button
                        type="submit"
                        disabled={!communityAuthReady || isCheckingPromotion || Boolean(communityQuoteError) || (communityUser !== null && !communityQuote)}
                        className="group h-12 w-full rounded-xl bg-[#2BB8BF] text-base font-bold text-white shadow-md shadow-[#2BB8BF]/10 transition-all hover:bg-[#25A1A7] active:scale-[0.98]"
                      >
                        {hasAdditionalTravelers ? 'Continuar con pasajeros' : 'Continuar al pago'}
                        <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            ) : step === 'companions' ? (
              <motion.div
                key="companions-step"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/60 rounded-2xl">
                  <CardHeader className="bg-white pb-2 pt-6 px-6">
                    <CardTitle className="text-xl font-bold text-slate-900">Datos de los demás pasajeros</CardTitle>
                    <p className="text-xs font-medium text-slate-500">
                      Completá los datos de quienes viajan con vos antes de pasar al pago.
                    </p>
                  </CardHeader>
                  <CardContent className="p-6">
                    <form onSubmit={handleSubmitCompanions} className="space-y-5" noValidate>
                      {form.passengerDetails.map((traveler, index) => {
                        const travelerErrors = getTravelerErrors(traveler);
                        return (
                          <div key={`traveler-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                            <div className="mb-4">
                              <div className="text-sm font-bold text-slate-900">Pasajero {index + 2}</div>
                              <div className="text-xs text-slate-500">Cargá sus datos tal como figuran en su documento.</div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700 ml-1">Nombre *</Label>
                                <Input
                                  value={traveler.firstName}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      passengerDetails: prev.passengerDetails.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, firstName: e.target.value } : item
                                      ),
                                    }))
                                  }
                                  placeholder="Ej: Juan"
                                  className="h-11 rounded-xl border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                                />
                                {companionsSubmitted && travelerErrors.firstName && <p className="text-[10px] font-bold text-red-500 ml-1">Nombre obligatorio</p>}
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700 ml-1">Apellido *</Label>
                                <Input
                                  value={traveler.lastName}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      passengerDetails: prev.passengerDetails.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, lastName: e.target.value } : item
                                      ),
                                    }))
                                  }
                                  placeholder="Ej: Pérez"
                                  className="h-11 rounded-xl border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                                />
                                {companionsSubmitted && travelerErrors.lastName && <p className="text-[10px] font-bold text-red-500 ml-1">Apellido obligatorio</p>}
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700 ml-1">Fecha de nacimiento *</Label>
                                <ArgentineDateInput
                                  value={traveler.birthDate}
                                  onChange={(value) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      passengerDetails: prev.passengerDetails.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, birthDate: value } : item
                                      ),
                                    }))
                                  }
                                  className="h-11 rounded-xl border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                                />
                                {companionsSubmitted && travelerErrors.birthDate && <p className="text-[10px] font-bold text-red-500 ml-1">Fecha obligatoria</p>}
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700 ml-1">Teléfono *</Label>
                                <Input
                                  value={traveler.phone}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      passengerDetails: prev.passengerDetails.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, phone: e.target.value } : item
                                      ),
                                    }))
                                  }
                                  placeholder="+54 11 ..."
                                  className="h-11 rounded-xl border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                                />
                                {companionsSubmitted && travelerErrors.phone && <p className="text-[10px] font-bold text-red-500 ml-1">Teléfono obligatorio</p>}
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700 ml-1">DNI *</Label>
                                <Input
                                  value={traveler.document}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      passengerDetails: prev.passengerDetails.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, document: e.target.value } : item
                                      ),
                                    }))
                                  }
                                  placeholder="Número de doc"
                                  className="h-11 rounded-xl border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                                />
                                {companionsSubmitted && travelerErrors.document && <p className="text-[10px] font-bold text-red-500 ml-1">DNI obligatorio</p>}
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700 ml-1">País *</Label>
                                <Input
                                  value={traveler.country}
                                  onChange={(e) =>
                                    setForm((prev) => ({
                                      ...prev,
                                      passengerDetails: prev.passengerDetails.map((item, itemIndex) =>
                                        itemIndex === index ? { ...item, country: e.target.value } : item
                                      ),
                                    }))
                                  }
                                  placeholder="Ej: Argentina"
                                  className="h-11 rounded-xl border-slate-200 bg-white text-sm focus:ring-2 focus:ring-[#2BB8BF]/10 focus:border-[#2BB8BF]"
                                />
                                {companionsSubmitted && travelerErrors.country && <p className="text-[10px] font-bold text-red-500 ml-1">País obligatorio</p>}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {error && (
                        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-xl bg-red-50 p-4 text-xs font-bold text-red-600 ring-1 ring-red-100 flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                          {error}
                        </motion.div>
                      )}

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setError(null);
                            setCompanionsSubmitted(false);
                            setStep('form');
                          }}
                          className="h-12 w-full rounded-xl sm:min-w-0 sm:flex-1"
                        >
                          Volver
                        </Button>
                        <Button
                          type="submit"
                          disabled={isCheckingPromotion || Boolean(communityQuoteError) || (communityUser !== null && (!communityAuthReady || !communityQuote))}
                          className="group h-12 w-full rounded-xl bg-[#2BB8BF] text-base font-bold text-white shadow-md shadow-[#2BB8BF]/10 transition-all hover:bg-[#25A1A7] active:scale-[0.98] sm:min-w-0 sm:flex-1"
                        >
                          Continuar al pago
                          <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="payment-step"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <Card className="overflow-hidden border-0 shadow-xl shadow-slate-200/50 ring-1 ring-slate-200/60 rounded-2xl">
                  <CardHeader className="bg-white pb-6 pt-8 text-center px-6">
                    <CardTitle className="text-2xl font-bold text-slate-900">Método de Pago</CardTitle>
                    <p className="text-sm font-medium text-slate-500 mt-1">
                      Seleccioná tu forma de pago preferida.
                    </p>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="rounded-xl border border-[#D8E8E8] bg-[#F8FCFC] p-4">
                      {appliedCommunityDiscount > 0 && <div className="mb-2 flex items-center justify-between gap-3 text-sm text-[#187F80]"><span>{communityQuote?.discount?.nombre}</span><span className="font-semibold">− {formatAmountCents(appliedCommunityDiscount, currency)}</span></div>}
                      <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium text-slate-600">Total a pagar</span><span className="text-lg font-bold text-[#183F4A]">{formatAmountCents(checkoutDisplayTotal, currency)}</span></div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-[#F8FAFD] p-4 text-sm">
                      {communityUser ? <><p className="font-semibold text-[#153F4A]">Cuenta Explorarg conectada</p><p className="mt-1 text-xs leading-5 text-[#60777D]">Esta compra se asociará a {communityUser.email}. Tus datos y beneficios se actualizan automáticamente.</p></> : <><p className="font-semibold text-[#183F4A]">¿Sos parte de la comunidad?</p><p className="mt-1 text-xs leading-5 text-[#60777D]">Ingresá a tu cuenta para asociar la compra y consultar los beneficios disponibles.</p><Link href="/login?next=%2Fcheckout" className="mt-2 inline-flex font-semibold text-[#167F82] underline underline-offset-4">Iniciar sesión</Link></>}
                    </div>
                    <div className="rounded-2xl border border-[#D8E8E8] bg-white p-4 sm:p-5">
                      <div className="flex items-start gap-3"><span className="rounded-xl bg-[#E7F6F4] p-2.5 text-[#17888B]"><TicketPercent className="h-4 w-4" /></span><div><p className="font-semibold text-[#183F4A]">Beneficios y cupones</p><p className="mt-1 text-xs leading-5 text-slate-500">Si tenés un cupón, ingresalo y el precio se actualiza solo.</p></div></div>
                      <div className="mt-4"><Input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Código de cupón (opcional)" autoComplete="off" className="h-11 rounded-xl border-slate-200 uppercase" aria-label="Código de cupón" /></div>
                      {isCheckingPromotion && <div className="mt-4 space-y-2" aria-label="Actualizando beneficios"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>}
                      {!isCheckingPromotion && communityQuote?.discount && <div role="status" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#ECF8F3] p-3 text-sm text-[#216B53]"><div><p className="font-semibold">{communityQuote.discount.nombre}</p><p className="mt-1 text-xs">Aplicado al precio de tu reserva.</p></div><p className="font-bold">Ahorrás {formatAmountCents(appliedCommunityDiscount, currency)}</p></div>}
                      {!isCheckingPromotion && communityUser && communityQuote && !communityQuote.discount && !communityQuoteError && <p className="mt-3 text-xs text-slate-500">{couponCode.trim() ? 'No encontramos un descuento aplicable para este cupón.' : 'No hay beneficios aplicables a esta compra por el momento.'}</p>}
                      {communityQuoteError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{communityQuoteError}</p>}
                      {!communityUser && couponCode.trim() && <p className="mt-2 text-xs text-slate-500">Para usar un cupón, iniciá sesión con tu cuenta Explorarg.</p>}
                    </div>
                    <div className="space-y-3">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Pagar con:</Label>
                      <motion.button
                        whileHover={{ scale: 1.01, borderColor: '#009EE3' }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => isCartMode ? createMercadoPagoPreferenceForCart() : createMercadoPagoPreferenceForLegacy()}
                        disabled={isLoading || isCheckingPromotion || Boolean(communityQuoteError) || (communityUser !== null && (!communityAuthReady || !communityQuote)) || (isCartMode && !(cartData?.ok ?? false))}
                        className="group relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:shadow-lg disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
                              {isLoading ? (
                                <Loader2 className="h-6 w-6 animate-spin text-[#009EE3]" />
                              ) : (
                                <img
                                  src="/images/mercado-pago-logo.png"
                                  alt="Mercado Pago"
                                  className="h-6"
                                />
                              )}
                            </div>
                            <div className="text-left">
                              <h3 className="text-base font-bold text-slate-900">Mercado Pago</h3>
                              <p className="text-xs font-medium text-slate-500">Tarjetas, Débito o Dinero en cuenta</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 rounded-lg bg-[#009EE3] px-4 py-2 text-xs font-bold text-white shadow-md transition-all group-hover:bg-[#008ED1]">
                            Pagar
                            <ChevronRight className="h-3 w-3" />
                          </div>
                        </div>
                      </motion.button>
                    </div>

                    <div className="flex items-start gap-3 rounded-2xl bg-blue-50/50 p-5 text-xs font-medium text-blue-900 ring-1 ring-blue-100">
                      <ShieldCheck className="h-4 w-4 text-[#009EE3] shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        Serás redirigido a <strong>Mercado Pago</strong>. Tus transacciones son 100% seguras y cifradas.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setStep(hasAdditionalTravelers ? 'companions' : 'form');
                      }}
                      className="w-full text-center text-xs font-bold text-slate-400 transition-colors hover:text-[#2BB8BF] py-2"
                    >
                      ← Volver
                    </button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Trust badges (at the bottom) */}
          <div className="flex flex-col items-center gap-4 pt-4">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <Lock className="h-3 w-3" />
              Transacción 100% Segura
            </div>
            <div className="flex gap-4 opacity-40 grayscale hover:grayscale-0 transition-all">
              <img src="/images/mercado-pago-logo.png" alt="MP" className="h-3.5" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Visa_Inc._logo_%282021%E2%80%93present%29.svg/3840px-Visa_Inc._logo_%282021%E2%80%93present%29.svg.png" alt="Visa" className="h-2.5" />
              <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
