'use client';

import VendorProtectedRoute from '@/components/vendor/VendorProtectedRoute';
import VendorLayout from '@/components/vendor/VendorLayout';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Reservation, ReservationStatus } from '@/components/landing-reserva/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Eye, Loader2, Search, Trash2 } from 'lucide-react';

type CommissionStatus = 'pending' | 'accrued' | 'paid' | 'cancelled';
type ReservationStatusFilter = 'all' | ReservationStatus;
type CommissionStatusFilter = 'all' | CommissionStatus;

const reservationStatusLabel: Record<ReservationStatus, string> = {
  pending: 'Pendiente',
  reserved: 'Confirmada',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const commissionStatusLabel: Record<CommissionStatus, string> = {
  pending: 'Pendiente',
  accrued: 'Devengada',
  paid: 'Pagada',
  cancelled: 'Cancelada',
};

const reservationBadgeVariant: Record<ReservationStatus, 'outline' | 'secondary' | 'default' | 'destructive'> = {
  pending: 'outline',
  reserved: 'secondary',
  completed: 'default',
  cancelled: 'destructive',
};

function normalizeSearchText(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@._-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toDateLabel(value: unknown): string {
  if (!value) return 'Sin fecha';
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('es-AR');
    }
    return value;
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString('es-AR');
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date(((value as { seconds: number }).seconds ?? 0) * 1000).toLocaleDateString('es-AR');
  }
  return 'Sin fecha';
}

function formatMoney(amount = 0, currency = 'ARS'): string {
  const value = (Number(amount) || 0) / 100;
  const normalizedCurrency = String(currency || 'ARS').toUpperCase();
  if (normalizedCurrency === 'ARS') return `$${value.toLocaleString('es-AR')}`;
  if (normalizedCurrency === 'BRL') return `R$ ${value.toLocaleString('pt-BR')}`;
  if (normalizedCurrency === 'USD') return `USD ${value.toLocaleString('en-US')}`;
  return `${value.toFixed(2)} ${normalizedCurrency}`;
}

function canCancelReservation(reservation: Reservation): boolean {
  return reservation.status !== 'cancelled' && reservation.status !== 'completed' && reservation.paymentMethod === 'admin';
}

export default function VendorReservasPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reservas, setReservas] = useState<Reservation[]>([]);
  const [search, setSearch] = useState('');
  const [reservationStatusFilter, setReservationStatusFilter] = useState<ReservationStatusFilter>('all');
  const [commissionStatusFilter, setCommissionStatusFilter] = useState<CommissionStatusFilter>('all');
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [reservationToCancel, setReservationToCancel] = useState<Reservation | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/vendor/reservas', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('No se pudieron cargar tus reservas');
        const json = await res.json();
        const list = (Array.isArray(json?.reservations) ? json.reservations : []) as Reservation[];
        setReservas(list);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudieron cargar tus reservas');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const filtered = useMemo(() => {
    let list = reservas;

    if (reservationStatusFilter !== 'all') {
      list = list.filter((reservation) => reservation.status === reservationStatusFilter);
    }

    if (commissionStatusFilter !== 'all') {
      list = list.filter((reservation) => reservation.referredBy?.payoutStatus === commissionStatusFilter);
    }

    const query = normalizeSearchText(search);
    if (query) {
      list = list.filter((reservation) => {
        const haystack = normalizeSearchText(
          [
            reservation.customerName,
            reservation.customerEmail,
            reservation.experienceTitle,
            reservation.packageTitle,
            reservation.reservationCode,
          ]
            .filter(Boolean)
            .join(' ')
        );
        return haystack.includes(query);
      });
    }

    return list;
  }, [commissionStatusFilter, reservationStatusFilter, reservas, search]);

  const handleCancelReservation = async () => {
    if (!reservationToCancel || !user) return;
    setCancellingId(reservationToCancel.id);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/vendor/reservas', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reservationId: reservationToCancel.id,
          status: 'cancelled',
          note: 'Cancelada desde el panel vendedor',
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? 'No se pudo cancelar la reserva');
      }

      setReservas((current) =>
        current.map((reservation) =>
          reservation.id === reservationToCancel.id
            ? {
                ...reservation,
                status: 'cancelled',
                referredBy: reservation.referredBy
                  ? { ...reservation.referredBy, payoutStatus: 'cancelled' }
                  : reservation.referredBy,
              }
            : reservation
        )
      );
      setSelectedReservation((current) =>
        current?.id === reservationToCancel.id
          ? {
              ...current,
              status: 'cancelled',
              referredBy: current.referredBy
                ? { ...current.referredBy, payoutStatus: 'cancelled' }
                : current.referredBy,
            }
          : current
      );
      toast.success('La reserva se canceló correctamente y quedó sincronizada con administración.');
      setReservationToCancel(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cancelar la reserva');
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <VendorProtectedRoute>
      <VendorLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-lg font-semibold text-gray-900">Mis reservas</h1>
              <p className="text-sm text-gray-500">
                Acá ves el estado real de cada reserva y, por separado, el estado de tu comisión.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar cliente, paquete o código"
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <Select value={reservationStatusFilter} onValueChange={(value) => setReservationStatusFilter(value as ReservationStatusFilter)}>
                <SelectTrigger className="w-full sm:w-[190px]">
                  <SelectValue placeholder="Estado reserva" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las reservas</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="reserved">Confirmadas</SelectItem>
                  <SelectItem value="completed">Completadas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={commissionStatusFilter} onValueChange={(value) => setCommissionStatusFilter(value as CommissionStatusFilter)}>
                <SelectTrigger className="w-full sm:w-[190px]">
                  <SelectValue placeholder="Estado comisión" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las comisiones</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="accrued">Devengadas</SelectItem>
                  <SelectItem value="paid">Pagadas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
              <Button asChild size="sm" variant="success">
                <a href="/vendedor/reservas/nueva">Crear reserva manual</a>
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden border border-[#E5EDF5] bg-white shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Reservas sincronizadas</CardTitle>
                <Badge variant="outline">{filtered.length} resultados</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3 p-4">
                  <div className="grid grid-cols-9 gap-3">
                    {Array.from({ length: 9 }).map((_, index) => (
                      <div key={`header-skeleton-${index}`} className="h-4 rounded bg-gray-200 animate-pulse" />
                    ))}
                  </div>
                  {Array.from({ length: 6 }).map((_, rowIndex) => (
                    <div key={`row-skeleton-${rowIndex}`} className="grid grid-cols-9 gap-3">
                      {Array.from({ length: 9 }).map((__, colIndex) => (
                        <div key={`cell-skeleton-${rowIndex}-${colIndex}`} className="h-4 rounded bg-gray-200 animate-pulse" />
                      ))}
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
                  <p className="text-sm font-medium text-gray-900">No encontramos reservas con esos filtros.</p>
                  <p className="mt-1 text-sm text-gray-500">Probá con otro estado o buscá por cliente, paquete o código.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-[#E8EEF5] bg-white">
                  <table className="min-w-[980px] w-full table-fixed text-sm">
                    <thead className="bg-[#F8FBFE] text-gray-600">
                      <tr>
                        <th className="w-[82px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Código</th>
                        <th className="w-[92px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Creada</th>
                        <th className="w-[92px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Salida</th>
                        <th className="w-[220px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Paquete</th>
                        <th className="w-[190px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cliente</th>
                        <th className="w-[110px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total</th>
                        <th className="w-[102px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reserva</th>
                        <th className="w-[102px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Comisión</th>
                        <th className="w-[96px] px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((reservation) => {
                        const commissionStatus = reservation.referredBy?.payoutStatus ?? null;
                        const packageTitle = reservation.packageTitle || reservation.experienceTitle;

                        return (
                          <tr key={reservation.id} className="border-t border-[#EEF3F8] align-top transition-colors hover:bg-[#FBFDFF]">
                            <td className="px-3 py-3.5">
                              <span className="inline-flex rounded-full border border-[#D9E5F0] bg-[#F8FBFE] px-2 py-1 font-mono text-[11px] font-semibold text-slate-700">
                                {String(reservation.reservationCode ?? reservation.id).slice(0, 16)}
                              </span>
                            </td>
                            <td className="px-3 py-3.5 text-xs font-medium text-slate-700">{toDateLabel(reservation.createdAt)}</td>
                            <td className="px-3 py-3.5 text-xs font-medium text-slate-700">
                              {reservation.date === 'sin-fecha' ? 'A coordinar' : toDateLabel(reservation.date)}
                            </td>
                            <td className="px-3 py-3.5">
                              <div className="max-w-[220px]">
                                <p
                                  className="overflow-hidden text-ellipsis text-xs font-semibold leading-5 text-slate-900"
                                  title={packageTitle}
                                  style={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                  }}
                                >
                                  {packageTitle}
                                </p>
                              </div>
                            </td>
                            <td className="px-3 py-3.5">
                              <div className="min-w-0">
                                <div className="truncate text-xs font-semibold text-slate-900" title={reservation.customerName}>
                                  {reservation.customerName}
                                </div>
                                <div className="truncate text-[11px] text-slate-500" title={reservation.customerEmail}>
                                  {reservation.customerEmail}
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3.5 text-xs font-semibold text-slate-900">
                              {formatMoney(reservation.amountTotal, reservation.currency)}
                            </td>
                            <td className="px-3 py-3.5">
                              <Badge variant={reservationBadgeVariant[reservation.status]} className="min-w-[84px] justify-center text-[11px]">
                                {reservationStatusLabel[reservation.status]}
                              </Badge>
                            </td>
                            <td className="px-3 py-3.5">
                              {commissionStatus ? (
                                <Badge
                                  variant="outline"
                                  className="min-w-[84px] justify-center border-[#D7E3EE] bg-white text-[11px] text-slate-700"
                                >
                                  {commissionStatusLabel[commissionStatus]}
                                </Badge>
                              ) : (
                                <span className="text-[11px] text-gray-400">Sin comisión</span>
                              )}
                            </td>
                            <td className="px-3 py-3.5">
                              <div className="flex justify-end gap-1.5">
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="outline"
                                  aria-label="Ver detalle"
                                  title="Ver detalle"
                                  className="rounded-full border-[#D5E2EE] bg-white text-slate-700 shadow-none hover:bg-[#F7FBFF]"
                                  onClick={() => setSelectedReservation(reservation)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon-sm"
                                  variant="destructive"
                                  aria-label="Cancelar reserva"
                                  title="Cancelar reserva"
                                  className="rounded-full border border-[#FECACA] bg-[#FFF1F2] text-[#B42318] shadow-none hover:bg-[#FFE4E6] disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                  disabled={!canCancelReservation(reservation) || cancellingId === reservation.id}
                                  onClick={() => setReservationToCancel(reservation)}
                                >
                                  {cancellingId === reservation.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={Boolean(selectedReservation)} onOpenChange={(open) => !open && setSelectedReservation(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Detalle de la reserva</DialogTitle>
            </DialogHeader>
            {selectedReservation && (
              <div className="space-y-5">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">N°</p>
                    <p className="mt-1 font-mono text-sm text-gray-900">
                      {String(selectedReservation.reservationCode ?? selectedReservation.id)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Estado</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant={reservationBadgeVariant[selectedReservation.status]}>
                        {reservationStatusLabel[selectedReservation.status]}
                      </Badge>
                      {selectedReservation.referredBy?.payoutStatus && (
                        <Badge variant="outline">
                          Comisión {commissionStatusLabel[selectedReservation.referredBy.payoutStatus]}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Paquete</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {selectedReservation.packageTitle || selectedReservation.experienceTitle}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      Salida: {selectedReservation.date === 'sin-fecha' ? 'A coordinar' : toDateLabel(selectedReservation.date)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Personas: {selectedReservation.people}</p>
                    {selectedReservation.pickupPoint && (
                      <p className="mt-1 text-xs text-gray-500">
                        Ascenso: {selectedReservation.pickupPoint}
                        {selectedReservation.pickupPointTime ? ` · ${selectedReservation.pickupPointTime}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Pasajero 1</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{selectedReservation.customerName}</p>
                    <p className="mt-2 text-xs text-gray-500">{selectedReservation.customerEmail}</p>
                    {selectedReservation.customerPhone && (
                      <p className="mt-1 text-xs text-gray-500">{selectedReservation.customerPhone}</p>
                    )}
                    {selectedReservation.customerDocument && (
                      <p className="mt-1 text-xs text-gray-500">Documento: {selectedReservation.customerDocument}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Total venta</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {formatMoney(selectedReservation.amountTotal, selectedReservation.currency)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Comisión</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {selectedReservation.referredBy
                        ? formatMoney(
                            selectedReservation.referredBy.commissionAmount,
                            selectedReservation.referredBy.commissionCurrency
                          )
                        : 'Sin comisión'}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Creada</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{toDateLabel(selectedReservation.createdAt)}</p>
                  </div>
                </div>

                {selectedReservation.customerComments && (
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Comentarios</p>
                    <p className="mt-2 text-sm text-gray-700">{selectedReservation.customerComments}</p>
                  </div>
                )}

                {selectedReservation.passengerDetails && selectedReservation.passengerDetails.length > 0 && (
                  <div className="rounded-2xl border border-gray-100 bg-white p-4">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Pasajeros adicionales</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {selectedReservation.passengerDetails.map((traveler, index) => (
                        <div key={`${traveler.document}-${index}`} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                          <p className="text-sm font-medium text-gray-900">
                            {traveler.firstName} {traveler.lastName}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">Documento: {traveler.document}</p>
                          <p className="mt-1 text-xs text-gray-500">Nacimiento: {traveler.birthDate}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(reservationToCancel)} onOpenChange={(open) => !open && setReservationToCancel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar reserva</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción cambia la reserva a cancelada, libera cupo y sincroniza también el estado de comisión.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={Boolean(cancellingId)}>Volver</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void handleCancelReservation();
                }}
                disabled={Boolean(cancellingId)}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {cancellingId ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cancelando
                  </>
                ) : (
                  'Confirmar cancelación'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </VendorLayout>
    </VendorProtectedRoute>
  );
}
