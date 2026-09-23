'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, CalendarDays, Loader2, Users } from 'lucide-react';

type PackageReservation = {
  id: string;
  reservationCode?: string;
  customerName?: string;
  name?: string;
  email?: string;
  phone?: string;
  date?: string;
  people?: number;
  amountTotal?: number;
  currency?: string;
  status?: string;
  roomType?: string;
  paymentMethod?: string;
  createdAt?: unknown;
};

function toMillis(value: unknown): number {
  if (!value) return 0;
  const seconds = (value as { seconds?: number })?.seconds;
  if (typeof seconds === 'number') return seconds * 1000;
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function formatDateTime(value: unknown) {
  const ms = toMillis(value);
  if (!ms) return '—';
  return new Date(ms).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(amount?: number, currency?: string) {
  const normalized = String(currency || 'ARS').toUpperCase();
  const prefix = normalized === 'USD' ? 'US$' : normalized === 'EUR' ? 'EUR ' : '$';
  return `${prefix}${Number(amount || 0).toLocaleString('es-AR')}`;
}

const STATUS_STYLES: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-700',
  reserved: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

export default function PackageReservationsPanel({ packageId }: { packageId: string }) {
  const [reservas, setReservas] = useState<PackageReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!packageId) return;
      setLoading(true);
      try {
        const snapshot = await getDocs(
          query(collection(db, 'reservas'), where('packageId', '==', packageId))
        );
        const list = snapshot.docs.map((d) =>
          serializeFirestoreData<PackageReservation>({ id: d.id, ...d.data() })
        );
        if (active) {
          setReservas(list);
          setError(null);
        }
      } catch (err) {
        console.error('[PackageReservationsPanel] error cargando reservas:', err);
        if (active) setError('No se pudieron cargar las reservas de este paquete.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [packageId]);

  // Más recientes primero por fecha de creación
  const ordenadas = useMemo(
    () => [...reservas].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [reservas]
  );

  const totales = useMemo(() => {
    const activas = ordenadas.filter((r) => String(r.status).toLowerCase() !== 'cancelled');
    return {
      cantidad: ordenadas.length,
      pasajeros: activas.reduce((acc, r) => acc + Number(r.people || 0), 0),
      monto: activas.reduce((acc, r) => acc + Number(r.amountTotal || 0), 0),
    };
  }, [ordenadas]);

  return (
    <div className="rounded-[12px] border border-[#E5ECF4] bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#0F172A]">Reservas de este paquete</div>
          <div className="text-xs text-[#64748B]">Ordenadas por fecha de creación (más recientes primero).</div>
        </div>
        {!loading && ordenadas.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary" className="bg-[#EAF9FA] text-[#0E7980]">
              {totales.cantidad} reservas
            </Badge>
            <Badge variant="secondary" className="bg-[#EEF2F6] text-[#334155]">
              <Users className="mr-1 h-3 w-3" />
              {totales.pasajeros} pax
            </Badge>
            <Badge variant="secondary" className="bg-[#EEF2F6] text-[#334155]">
              {formatMoney(totales.monto, ordenadas[0]?.currency)}
            </Badge>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando reservas...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : ordenadas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5ECF4] px-4 py-8 text-center text-sm text-[#94A3B8]">
          Este paquete todavía no tiene reservas.
        </div>
      ) : (
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {ordenadas.map((reserva) => {
            const status = String(reserva.status || 'pending').toLowerCase();
            return (
              <Link
                key={reserva.id}
                href={`/admin/reservas/${reserva.id}`}
                className="group block rounded-xl border border-[#E5ECF4] bg-[#FBFDFF] px-3 py-3 transition hover:border-[#2BB8BF] hover:bg-[#F4FCFC]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold text-[#0F172A]">
                      {reserva.reservationCode || reserva.id}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] uppercase tracking-wide ${STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {status}
                    </Badge>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-[#94A3B8] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#2BB8BF]" />
                </div>

                <div className="mt-1 truncate text-sm text-[#334155]">
                  {reserva.customerName || reserva.name || 'Sin nombre'}
                  {reserva.email ? <span className="text-[#94A3B8]"> · {reserva.email}</span> : null}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B]">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    Salida: {reserva.date && reserva.date !== 'sin-fecha' ? reserva.date : 'sin fecha'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {Number(reserva.people || 0)} pax
                  </span>
                  {reserva.roomType ? <span>Hab.: {reserva.roomType}</span> : null}
                  {reserva.paymentMethod ? <span>Pago: {reserva.paymentMethod}</span> : null}
                  <span className="font-semibold text-[#0F172A]">
                    {formatMoney(reserva.amountTotal, reserva.currency)}
                  </span>
                  <span className="text-[#94A3B8]">Creada: {formatDateTime(reserva.createdAt)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
