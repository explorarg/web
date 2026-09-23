'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { Paquete } from '@/types';
import SeatMap from '@/components/seats/SeatMap';
import type { DepartureSeat, SeatStatus } from '@/types';
import { getReservaById } from '@/lib/reservas';
import { buildSeatReportHtml, type SeatReportReservation } from '@/lib/seats/report';
import {
  Search,
  Download,
  RefreshCw,
  Settings2,
  UserCheck,
  Lock,
  Unlock,
  CircleCheckBig,
  XCircle,
  Armchair,
  Info,
} from 'lucide-react';
import ArgentineCalendarPicker from '@/components/ui/argentine-calendar-picker';

type Props = {
  paquetes: Paquete[];
  initialPackageId?: string;
  initialDate?: string;
};

function translateSeatStatus(status: SeatStatus | string): { label: string; className: string } {
  switch (status) {
    case 'available':
      return { label: 'Disponible', className: 'border-[#D9E8F7] bg-white text-[#334E71]' };
    case 'held':
      return { label: 'En proceso', className: 'border-[#A6DDE7] bg-[#F0FDFF] text-[#117C93]' };
    case 'reserved':
      return { label: 'Reservada', className: 'border-[#F4C77A] bg-[#FFF3DB] text-[#9A6B11]' };
    case 'paid':
      return { label: 'Pagada / Ocupada', className: 'border-[#2E7D5F] bg-[#1E6B4F] text-white' };
    case 'blocked':
      return { label: 'Bloqueada', className: 'border-[#F2C7D3] bg-[#FFF4F7] text-[#C24162]' };
    case 'disabled':
      return { label: 'No disponible', className: 'border-[#E0E8EF] bg-[#F6FAFD] text-[#7B8EA5]' };
    default:
      return { label: String(status), className: 'border-gray-200 bg-gray-50 text-gray-600' };
  }
}

const STATUS_ICONS: Record<string, React.ElementType> = {
  available: CircleCheckBig,
  held: UserCheck,
  reserved: UserCheck,
  paid: CircleCheckBig,
  blocked: Lock,
  disabled: XCircle,
};

const SEAT_CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  cocheCama: {
    bg: 'bg-[#FFF8EC]',
    border: 'border-[#F6D6A8]',
    text: 'text-[#B95D03]',
    badge: 'bg-[#FFF8EC] text-[#B95D03] border-[#F6D6A8]',
  },
  panoramicos: {
    bg: 'bg-[#F0FDFF]',
    border: 'border-[#A6DDE7]',
    text: 'text-[#117C93]',
    badge: 'bg-[#F0FDFF] text-[#117C93] border-[#A6DDE7]',
  },
  cafeteras: {
    bg: 'bg-[#F3EEFF]',
    border: 'border-[#D9C8FF]',
    text: 'text-[#6D28D9]',
    badge: 'bg-[#F3EEFF] text-[#6D28D9] border-[#D9C8FF]',
  },
};

export default function SeatsDashboard({ paquetes, initialPackageId, initialDate }: Props) {
  const { user } = useAuth();
  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    initialPackageId && paquetes.some((p) => p.id === initialPackageId) ? initialPackageId : (paquetes[0]?.id ?? '')
  );
  const [date, setDate] = useState(() => initialDate || new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSeat, setDetailSeat] = useState<DepartureSeat | null>(null);
  const [detailReservation, setDetailReservation] = useState<any>(null);
  const [assignReservationId, setAssignReservationId] = useState('');
  const [assignStatus, setAssignStatus] = useState<'reserved' | 'paid'>('reserved');
  const [searchText, setSearchText] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);
  const fetchStateRequestId = useRef(0);

  useEffect(() => {
    if (initialPackageId && paquetes.some((p) => p.id === initialPackageId)) {
      setSelectedPackageId(initialPackageId);
    }
    if (initialDate) setDate(initialDate);
  }, [initialPackageId, initialDate, paquetes]);

  const paquete = useMemo(
    () => paquetes.find((p) => p.id === selectedPackageId) ?? null,
    [paquetes, selectedPackageId]
  );

  const fetchState = async () => {
    if (!user || !selectedPackageId || !date) return;
    const requestId = ++fetchStateRequestId.current;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(
        `/api/admin/seats?packageId=${encodeURIComponent(selectedPackageId)}&date=${encodeURIComponent(date)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'No pudimos cargar el mapa');
      }
      const json = await res.json();
      if (requestId !== fetchStateRequestId.current) return;
      setData(json);
      setSelectedSeatIds([]);
    } catch (error) {
      if (requestId !== fetchStateRequestId.current) return;
      toast.error('No pudimos cargar el mapa de butacas');
      setData(null);
    } finally {
      if (requestId === fetchStateRequestId.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void fetchState();
  }, [user, selectedPackageId, date]);

  const seats: DepartureSeat[] = Array.isArray(data?.seats) ? data.seats : [];

  const handleExportTaquilla = async () => {
    if (!selectedPackageId || !date) {
      toast.error('Elegí un paquete y una fecha antes de exportar');
      return;
    }
    if (!data?.enabled || seats.length === 0) {
      toast.error('Esta salida no tiene una taquilla cargada');
      return;
    }
    if (loading) {
      toast.error('Esperá a que cargue el mapa antes de exportar');
      return;
    }

    setExporting(true);
    try {
      const reservationIds = Array.from(
        new Set(
          seats
            .filter((seat) => ['reserved', 'paid', 'held'].includes(String(seat.status)))
            .map((seat) => String(seat.reservationId ?? ''))
            .filter(Boolean)
        )
      );

      const reservationsById: Record<string, SeatReportReservation | null> = {};
      await Promise.all(
        reservationIds.map(async (id) => {
          try {
            reservationsById[id] = (await getReservaById(id)) as SeatReportReservation | null;
          } catch {
            reservationsById[id] = null;
          }
        })
      );

      const html = buildSeatReportHtml({
        packageTitle: paquete?.titulo ?? selectedPackageId,
        date,
        templateName: data?.template?.name ?? null,
        busType: data?.template?.busType ?? null,
        seats,
        reservationsById,
        template: data?.template ?? null,
      });

      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taquilla-${selectedPackageId}-${date}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF generado correctamente');
    } catch (error) {
      console.error('[butacas] error exportando taquilla:', error);
      toast.error('No pudimos generar el PDF de la taquilla');
    } finally {
      setExporting(false);
    }
  };

  const updateSeats = async (payload: {
    action: 'block' | 'unblock' | 'assign' | 'free' | 'free-paid';
    seatIds: string[];
    reason?: string | null;
    reservationId?: string;
    assignStatus?: 'reserved' | 'paid';
  }) => {
    if (!user || !selectedPackageId || !date || payload.seatIds.length === 0) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          packageId: selectedPackageId,
          date,
          seatIds: payload.seatIds,
          action: payload.action,
          ...(payload.reason ? { reason: payload.reason } : {}),
          ...(payload.reservationId ? { reservationId: payload.reservationId } : {}),
          ...(payload.assignStatus ? { assignStatus: payload.assignStatus } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'No se pudo actualizar');
      }
      const json = await res.json();
      setData(json);
      setSelectedSeatIds([]);
      toast.success('Butacas actualizadas');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar butacas');
    } finally {
      setLoading(false);
    }
  };

  const handleSeatClick = (seat: DepartureSeat) => {
    if (selectionMode && seat.status === 'available') {
      setSelectedSeatIds((prev) => (prev.includes(seat.seatId) ? prev.filter((id) => id !== seat.seatId) : [...prev, seat.seatId]));
      return;
    }
    setDetailSeat(seat);
    setDetailOpen(true);
  };

  const searchReservas = async () => {
    if (!user) return;
    const q = searchText.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const token = await user.getIdToken();
      const url = `/api/admin/reservas/search?q=${encodeURIComponent(q)}&packageId=${encodeURIComponent(selectedPackageId)}&date=${encodeURIComponent(date)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'No se pudo buscar reservas');
      }
      const json = await res.json();
      setSearchResults(Array.isArray(json?.items) ? json.items : []);
    } catch (error) {
      setSearchResults([]);
      toast.error(error instanceof Error ? error.message : 'No se pudo buscar reservas');
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadReservation = async () => {
      if (!detailOpen || !detailSeat?.reservationId) {
        setDetailReservation(null);
        return;
      }
      try {
        const res = await getReservaById(String(detailSeat.reservationId));
        if (!cancelled) setDetailReservation(res);
      } catch {
        if (!cancelled) setDetailReservation(null);
      }
    };
    loadReservation();
    return () => {
      cancelled = true;
    };
  }, [detailOpen, detailSeat?.reservationId]);

  const seatCategory = detailSeat?.category ? SEAT_CATEGORY_COLORS[detailSeat.category] : null;
  const statusInfo = detailSeat ? translateSeatStatus(detailSeat.status) : null;
  const StatusIcon = detailSeat ? STATUS_ICONS[detailSeat.status] : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Butacas por salida</h1>
        <p className="text-sm text-gray-500">Gestioná el mapa de butacas, bloques y asignaciones.</p>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start">
        <div className="flex flex-1 flex-col gap-1">
          <Label className="text-xs font-medium text-gray-500">Paquete</Label>
          <Select value={selectedPackageId} onValueChange={setSelectedPackageId}>
            <SelectTrigger className="h-9 w-full">
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
        <div className="flex flex-col gap-1">
          <Label className="text-xs font-medium text-gray-500">Fecha</Label>
          <div className="w-72">
            <ArgentineCalendarPicker
              value={date}
              onChange={setDate}
              availableDates={paquete?.salidas?.map((s: any) => String(s?.fecha ?? '').trim()).filter(Boolean) ?? []}
              disabled={loading || !selectedPackageId}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExportTaquilla()}
            disabled={loading || exporting || !data?.enabled || seats.length === 0}
            className="h-9"
          >
            {exporting ? (
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Generando
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Download className="h-3.5 w-3.5" />
                Exportar PDF
              </span>
            )}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void fetchState()} disabled={loading} className="h-9">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {data && data.enabled && data.template && Array.isArray(data.seats) ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <SeatMap
                template={data.template}
                seats={seats}
                selectedSeatIds={selectedSeatIds}
                onSeatClick={handleSeatClick}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-12 text-center text-sm text-gray-500">
              {loading ? 'Cargando mapa…' : 'Seleccioná paquete y fecha para ver el mapa de butacas.'}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500">Leyenda</div>
            <div className="mt-3 space-y-2.5">
              {(['available', 'held', 'reserved', 'paid', 'blocked', 'disabled'] as const).map((status) => {
                const { label, className } = translateSeatStatus(status);
                const Icon = STATUS_ICONS[status];
                return (
                  <div key={status} className="flex items-center gap-2.5">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md border ${className}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-medium text-gray-700">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetailSeat(null);
            setDetailReservation(null);
            setAssignReservationId('');
            setAssignStatus('reserved');
            setSearchText('');
            setSearchResults([]);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Armchair className="h-5 w-5 text-gray-400" />
              Detalle de butaca
            </DialogTitle>
          </DialogHeader>
          {detailSeat ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-gray-900">Butaca {detailSeat.label}</div>
                    <div className="mt-1 text-xs text-gray-500">{detailSeat.seatId}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {seatCategory && (
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${seatCategory.badge}`}>
                        {detailSeat.category === 'cocheCama' ? 'CA' : detailSeat.category === 'panoramicos' ? 'PA' : 'CF'}
                      </span>
                    )}
                    {statusInfo && (
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusInfo.className}`}>
                        {StatusIcon && <StatusIcon className="h-3 w-3" />}
                        {statusInfo.label}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">Paquete</div>
                    <div className="mt-0.5 font-medium text-gray-900">{paquete?.titulo ?? selectedPackageId}</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-xs text-gray-500">Salida</div>
                    <div className="mt-0.5 font-medium text-gray-900">{date}</div>
                  </div>
                  {detailSeat.blockReason && (
                    <div className="sm:col-span-2 rounded-lg bg-gray-50 p-3">
                      <div className="text-xs text-gray-500">Motivo de bloqueo</div>
                      <div className="mt-0.5 font-medium text-gray-900">{detailSeat.blockReason}</div>
                    </div>
                  )}
                  {detailSeat.holdId && (
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-xs text-gray-500">Hold</div>
                      <div className="mt-0.5 font-medium text-gray-900">{detailSeat.holdId}</div>
                    </div>
                  )}
                  {detailSeat.reservationId && (
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-xs text-gray-500">Reserva</div>
                      <div className="mt-0.5 font-medium text-gray-900">{detailSeat.reservationId}</div>
                    </div>
                  )}
                </div>
              </div>

              {detailReservation && (
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <Info className="h-4 w-4 text-gray-400" />
                    Datos del cliente
                  </div>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-xs text-gray-500">Nombre</div>
                      <div className="mt-0.5 font-medium text-gray-900">{detailReservation.customerName ?? '—'}</div>
                    </div>
                    <div className="rounded-lg bg-gray-50 p-3">
                      <div className="text-xs text-gray-500">Email</div>
                      <div className="mt-0.5 font-medium text-gray-900">{detailReservation.customerEmail ?? '—'}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Button asChild variant="outline" size="sm" className="h-8">
                      <a href={`/admin/reservas/${encodeURIComponent(String(detailSeat.reservationId))}`}>Ver reserva completa</a>
                    </Button>
                  </div>
                </div>
              )}

              {/* <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="text-sm font-medium text-gray-900">Bloqueo</div>
                  <div className="mt-3 space-y-2">
                    <Input
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Motivo (opcional)"
                      className="h-8 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        disabled={loading || detailSeat.status !== 'available'}
                        onClick={() => void updateSeats({ action: 'block', seatIds: [detailSeat.seatId], reason: blockReason.trim() || null })}
                        className="h-8"
                      >
                        <Lock className="mr-1.5 h-3.5 w-3.5" />
                        Bloquear
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading || detailSeat.status !== 'blocked'}
                        onClick={() => void updateSeats({ action: 'unblock', seatIds: [detailSeat.seatId] })}
                        className="h-8"
                      >
                        <Unlock className="mr-1.5 h-3.5 w-3.5" />
                        Liberar
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="text-sm font-medium text-gray-900">Asignación</div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        placeholder="Email o nombre"
                        className="h-8 text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={searchLoading || !searchText.trim()}
                        onClick={() => void searchReservas()}
                        className="h-8"
                      >
                        {searchLoading ? '...' : <Search className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                    {searchResults.length > 0 ? (
                      <div className="max-h-36 space-y-1.5 overflow-auto rounded-lg border border-gray-100 bg-gray-50 p-1.5">
                        {searchResults.map((r) => (
                          <button
                            key={String(r.id)}
                            type="button"
                            className="w-full rounded-md bg-white px-2.5 py-2 text-left text-xs ring-1 ring-gray-200 hover:bg-gray-50"
                            onClick={() => setAssignReservationId(String(r.id))}
                          >
                            <div className="font-medium text-gray-900">{String(r.customerName || '—')}</div>
                            <div className="text-gray-500">{String(r.customerEmail || '—')} · {String(r.status || '—')} · {String(r.date || '')}</div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <Input
                      value={assignReservationId}
                      onChange={(e) => setAssignReservationId(e.target.value)}
                      placeholder="ID de reserva"
                      className="h-8 text-sm"
                    />
                    <Select value={assignStatus} onValueChange={(v) => setAssignStatus(v as any)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reserved">Reservada</SelectItem>
                        <SelectItem value="paid">Pagada</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        disabled={loading || detailSeat.status !== 'available' || !assignReservationId.trim()}
                        onClick={() =>
                          void updateSeats({
                            action: 'assign',
                            seatIds: [detailSeat.seatId],
                            reservationId: assignReservationId.trim(),
                            assignStatus,
                          })
                        }
                        className="h-8"
                      >
                        Asignar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading || detailSeat.status !== 'reserved' || !detailSeat.reservationId}
                        onClick={() =>
                          void updateSeats({
                            action: 'free',
                            seatIds: [detailSeat.seatId],
                            reservationId: String(detailSeat.reservationId),
                          })
                        }
                        className="h-8"
                      >
                        Liberar
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={loading || detailSeat.status !== 'paid' || !detailSeat.reservationId}
                      onClick={() => {
                        if (!window.confirm('¿Liberar esta butaca PAGADA? Solo para cancelaciones manuales.')) return;
                        void updateSeats({
                          action: 'free-paid',
                          seatIds: [detailSeat.seatId],
                          reservationId: String(detailSeat.reservationId),
                        });
                      }}
                      className="h-8 w-full"
                    >
                      Liberar paid
                    </Button>
                  </div>
                </div>
              </div> */}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-gray-500">Seleccioná una butaca.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
