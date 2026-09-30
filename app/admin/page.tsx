'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getReservas, getReservaPayments, type ReservaPaymentEvent } from '@/lib/reservas';
import type { Reservation } from '@/components/landing-reserva/types';
import { buildVentaStatuses } from '@/lib/sales/status';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminPagination from '@/components/admin/AdminPagination';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  FolderKanban,
  MessageSquare,
  Mail,
  CheckCircle2,
  CalendarCheck,
  Receipt,
  DollarSign,
  AlertTriangle,
  Ban,
  Users,
  TrendingUp,
} from 'lucide-react';

const RESERVAS_LIMIT = 200;
const RECENT_RESERVAS = 10;

type BreakdownRow = { key: string; label: string; bookings: number; people: number; amount: number };
type SalesBreakdown = {
  byPackage: BreakdownRow[];
  byMethod: BreakdownRow[];
  byMonth: BreakdownRow[];
};

function buildBreakdown(rows: Map<string, BreakdownRow>, sortByKey = false) {
  const list = Array.from(rows.values());
  return sortByKey
    ? list.sort((a, b) => a.key.localeCompare(b.key))
    : list.sort((a, b) => b.amount - a.amount);
}

function formatReservationDate(dateStr: string): string {
  if (!dateStr || dateStr === 'sin-fecha') return 'A coordinar';
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatAmount(amountTotal: number, currency: string): string {
  const value = amountTotal / 100;
  const c = (currency || 'ars').toLowerCase();
  if (c === 'ars') return `$ ${value.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
  if (c === 'brl') return `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;
  if (c === 'usd') return `USD ${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `${value.toFixed(2)} ${currency}`;
}

type WindowMetric = {
  bookings: number;
  people: number;
  amountTotalCents: number;
  amountPaidCents: number;
  amountPendingCents: number;
  cancelled: number;
};

type CalendarMetrics = {
  today: WindowMetric;
  tomorrow: WindowMetric;
  next7d: WindowMetric;
  next30d: WindowMetric;
  last30dBookings: number;
  last30dAmountCents: number;
  totalCancelled: number;
  totalPendingCents: number;
  totalPaidCents: number;
  avgTicketCents: number;
  currency: string;
};

const emptyWindow = (): WindowMetric => ({
  bookings: 0,
  people: 0,
  amountTotalCents: 0,
  amountPaidCents: 0,
  amountPendingCents: 0,
  cancelled: 0,
});

function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(baseIso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeTotalPaidForReservation(r: Reservation, payments: ReservaPaymentEvent[] | null | undefined): number {
  if (!payments || payments.length === 0) return 0;
  let paid = 0;
  for (const p of payments) {
    const amt = Number(p.amount ?? 0) || 0;
    if (amt <= 0) continue;
    const mt = String(p.movementType ?? '').trim().toLowerCase() || 'payment';
    if (mt === 'payment' || mt === 'refund' || mt === 'discount') {
      paid += amt;
    } else if (mt === 'extra' || mt === 'adjustment') {
      // Los extra ajustan hacia arriba, los refund/discount ya son restas en amount signed
      continue;
    } else {
      paid += amt;
    }
  }
  // Tomamos el mínimo entre los pagos manuales y el amountTotal para no sobrepasar
  return Math.min(Math.max(0, paid), Math.max(0, Number(r.amountTotal ?? 0) || 0));
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    categorias: 0,
    paquetes: 0,
    consultas: 0,
    newsletter: 0,
    ventasConfirmadas: 0,
    ventasPendientes: 0,
    ingresosConfirmados: 0,
    ingresosTotales: 0,
  });
  const [recentVentas, setRecentVentas] = useState<Reservation[]>([]);
  const [calendar, setCalendar] = useState<CalendarMetrics | null>(null);
  const [breakdown, setBreakdown] = useState<SalesBreakdown | null>(null);
  const [upcomingReservas, setUpcomingReservas] = useState<Reservation[]>([]);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingPerPage, setUpcomingPerPage] = useState(5);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [
          categoriasSnap,
          paquetesSnap,
          consultasSnap,
          newsletterSnap,
          reservas,
        ] = await Promise.all([
          getDocs(collection(db, 'categorias')),
          getDocs(collection(db, 'paquetes')),
          getDocs(query(collection(db, 'consultas'), where('leida', '==', false))),
          getDocs(collection(db, 'newsletter')),
          getReservas({ limit: 1000 }),
        ]);

        const ventas = Array.isArray(reservas) ? reservas : [];
        const computed = ventas.reduce(
          (acc, r) => {
            const statuses = buildVentaStatuses(r);
            const isCancelled = statuses.commercialStatus === 'cancelled';
            if (statuses.commercialStatus === 'confirmed') {
              acc.ventasConfirmadas += 1;
              acc.ingresosConfirmados += Number(r.amountTotal ?? 0) || 0;
            }
            if (statuses.commercialStatus === 'pending_payment') {
              acc.ventasPendientes += 1;
            }
            if (!isCancelled) {
              acc.ingresosTotales += Number(r.amountTotal ?? 0) || 0;
            }
            return acc;
          },
          {
            ventasConfirmadas: 0,
            ventasPendientes: 0,
            ingresosConfirmados: 0,
            ingresosTotales: 0,
          }
        );

        // Métricas de calendario y cobranza
        const today = new Date();
        const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const tomorrowIso = addDaysIso(todayIso, 1);
        const in7dIso = addDaysIso(todayIso, 7);
        const in30dIso = addDaysIso(todayIso, 30);
        const minus30dIso = addDaysIso(todayIso, -30);

        const todayMetric = emptyWindow();
        const tomorrowMetric = emptyWindow();
        const next7dMetric = emptyWindow();
        const next30dMetric = emptyWindow();

        let last30dBookings = 0;
        let last30dAmountCents = 0;
        let totalPending = 0;
        let totalPaid = 0;
        let totalCancelled = 0;
        const nonCancelled: Reservation[] = [];

        const paymentsByReservation = new Map<string, ReservaPaymentEvent[]>();
        const reservasWithId = ventas.filter((r) => Boolean(r.id)).slice(0, 400);
        const CHUNK_SIZE = 30;
        for (let i = 0; i < reservasWithId.length; i += CHUNK_SIZE) {
          const chunk = reservasWithId.slice(i, i + CHUNK_SIZE);
          await Promise.all(
            chunk.map(async (r) => {
              try {
                const p = await getReservaPayments(r.id!, { limit: 20 });
                if (p && p.length > 0) paymentsByReservation.set(r.id!, p);
              } catch {
                /* noop */
              }
            })
          );
        }

        for (const r of ventas) {
          const statuses = buildVentaStatuses(r);
          const isCancelled = statuses.commercialStatus === 'cancelled';
          const date = String(r.date ?? '').trim();
          const total = Math.max(0, Number(r.amountTotal ?? 0) || 0);
          const payments = paymentsByReservation.get(r.id) ?? null;
          const paid = computeTotalPaidForReservation(r, payments);
          const pending = isCancelled ? 0 : Math.max(0, total - paid);
          const people = Math.max(0, Number(r.people ?? 0) || 0);
          const createdAtMs =
            typeof (r.createdAt as any)?.toDate === 'function'
              ? (r.createdAt as any).toDate().getTime()
              : typeof r.createdAt === 'string'
                ? new Date(r.createdAt).getTime()
                : typeof r.createdAt === 'number'
                  ? r.createdAt
                  : 0;
          const createdIso = createdAtMs ? new Date(createdAtMs).toISOString().slice(0, 10) : '';

          if (!isCancelled) nonCancelled.push(r);
          else totalCancelled += 1;
          totalPending += pending;
          totalPaid += paid;

          if (createdIso && createdIso >= minus30dIso && createdIso <= todayIso) {
            last30dBookings += 1;
            last30dAmountCents += total;
          }

          if (!date || date === 'sin-fecha') continue;

          const fillWindow = (w: WindowMetric) => {
            w.bookings += isCancelled ? 0 : 1;
            w.people += isCancelled ? 0 : people;
            w.amountTotalCents += isCancelled ? 0 : total;
            w.amountPaidCents += isCancelled ? 0 : paid;
            w.amountPendingCents += isCancelled ? 0 : pending;
            if (isCancelled) w.cancelled += 1;
          };

          // HOY
          if (date === todayIso) fillWindow(todayMetric);
          // MAÑANA
          if (date === tomorrowIso) fillWindow(tomorrowMetric);
          // 7 DÍAS SIGUIENTES (hoy+1 inclusive a hoy+7)
          if (date > todayIso && date <= in7dIso) fillWindow(next7dMetric);
          // 30 DÍAS SIGUIENTES (hoy+1 inclusive a hoy+30)
          if (date > todayIso && date <= in30dIso) fillWindow(next30dMetric);
        }

        const avgTicket =
          nonCancelled.length > 0
            ? Math.round(
                nonCancelled.reduce((s, r) => s + (Math.max(0, Number(r.amountTotal ?? 0) || 0)), 0) / nonCancelled.length
              )
            : 0;

        setCalendar({
          today: todayMetric,
          tomorrow: tomorrowMetric,
          next7d: next7dMetric,
          next30d: next30dMetric,
          last30dBookings,
          last30dAmountCents,
          totalCancelled,
          totalPendingCents: totalPending,
          totalPaidCents: totalPaid,
          avgTicketCents: avgTicket,
          currency: 'ars',
        });

        const byPackage = new Map<string, BreakdownRow>();
        const byMethod = new Map<string, BreakdownRow>();
        const byMonth = new Map<string, BreakdownRow>();
        const METHOD_LABELS: Record<string, string> = {
          mercadopago: 'Mercado Pago',
          admin: 'Carga manual',
          transferencia: 'Transferencia',
          efectivo: 'Efectivo',
        };

        for (const r of nonCancelled) {
          const total = Math.max(0, Number(r.amountTotal ?? 0) || 0);
          const people = Math.max(0, Number(r.people ?? 0) || 0);

          const packageKey = String((r as any).packageId ?? (r as any).packageSlug ?? r.packageTitle ?? 'sin-paquete');
          const packageLabel = String(r.packageTitle ?? (r as any).experienceTitle ?? 'Sin paquete');
          const pkg = byPackage.get(packageKey) ?? { key: packageKey, label: packageLabel, bookings: 0, people: 0, amount: 0 };
          pkg.bookings += 1;
          pkg.people += people;
          pkg.amount += total;
          byPackage.set(packageKey, pkg);

          const methodKey = String((r as any).paymentMethod ?? 'sin-metodo').toLowerCase();
          const method = byMethod.get(methodKey) ?? {
            key: methodKey,
            label: METHOD_LABELS[methodKey] ?? 'Sin método',
            bookings: 0,
            people: 0,
            amount: 0,
          };
          method.bookings += 1;
          method.people += people;
          method.amount += total;
          byMethod.set(methodKey, method);

          const createdMs =
            typeof (r.createdAt as any)?.toDate === 'function'
              ? (r.createdAt as any).toDate().getTime()
              : typeof r.createdAt === 'string'
                ? new Date(r.createdAt).getTime()
                : typeof r.createdAt === 'number'
                  ? r.createdAt
                  : 0;
          if (createdMs) {
            const d = new Date(createdMs);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const monthLabel = d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
            const month = byMonth.get(monthKey) ?? { key: monthKey, label: monthLabel, bookings: 0, people: 0, amount: 0 };
            month.bookings += 1;
            month.people += people;
            month.amount += total;
            byMonth.set(monthKey, month);
          }
        }

        setBreakdown({
          byPackage: buildBreakdown(byPackage).slice(0, 6),
          byMethod: buildBreakdown(byMethod),
          byMonth: buildBreakdown(byMonth, true).slice(-6),
        });

        setStats({
          categorias: categoriasSnap.size,          paquetes: paquetesSnap.size,
          consultas: consultasSnap.size,
          newsletter: newsletterSnap.size,
          ventasConfirmadas: computed.ventasConfirmadas,
          ventasPendientes: computed.ventasPendientes,
          ingresosConfirmados: computed.ingresosConfirmados,
          ingresosTotales: computed.ingresosTotales,
        });
        setRecentVentas(ventas.slice(0, RECENT_RESERVAS));

        const byDateRange = (fromIso: string, toIso: string) =>
          ventas.filter(
            (r) =>
              String(r.date ?? '').trim() >= fromIso &&
              String(r.date ?? '').trim() <= toIso &&
              buildVentaStatuses(r).commercialStatus !== 'cancelled'
          );

        const next7dReservas = byDateRange(tomorrowIso, in7dIso);
        const upcomingList = [
          ...byDateRange(todayIso, todayIso),
          ...next7dReservas,
        ].sort((a, b) => String(a.date ?? '').localeCompare(String(b.date ?? '')));
        setUpcomingReservas(upcomingList);
      } catch (error) {
        console.error('Error fetching dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-gray-600">Resumen del panel de administración</p>
          </div>

          {/* Próximas salidas */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 tracking-tight">Próximas salidas</h2>
            {loading ? (
              <Card className="border border-gray-200/80 bg-white shadow-sm">
                <CardContent className="p-6">
                  <div className="text-sm text-gray-500">Cargando próximas salidas...</div>
                </CardContent>
              </Card>
            ) : upcomingReservas.length === 0 ? (
              <Card className="border border-gray-200/80 bg-white shadow-sm">
                <CardContent className="p-6">
                  <div className="text-sm text-gray-500">Sin salidas próximas.</div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="border border-gray-200/80 bg-white shadow-sm">
                  <CardContent className="p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-left text-gray-500">
                            {['Fecha', 'Paquete', 'Pasajeros', 'Cliente', 'Monto'].map((h) => (
                              <th key={h} className="pb-2 pr-3 font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {upcomingReservas
                            .slice((upcomingPage - 1) * upcomingPerPage, upcomingPage * upcomingPerPage)
                            .map((r) => (
                              <tr key={r.id} className="border-b border-gray-100 last:border-0">
                                <td className="py-3 pr-3">{formatReservationDate(r.date)}</td>
                                <td className="py-3 pr-3">
                                  <Link href={`/admin/ventas/${r.id}`} className="font-semibold text-gray-900 hover:underline">
                                    {r.packageTitle || r.experienceTitle || '—'}
                                  </Link>
                                </td>
                                <td className="py-3 pr-3">{r.people}</td>
                                <td className="py-3 pr-3">{r.customerName || r.customerEmail || '—'}</td>
                                <td className="py-3">{formatAmount(Number(r.amountTotal ?? 0) || 0, String(r.currency ?? 'ars'))}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
                <AdminPagination
                  currentPage={upcomingPage}
                  totalItems={upcomingReservas.length}
                  itemsPerPage={upcomingPerPage}
                  onPageChange={setUpcomingPage}
                  onItemsPerPageChange={setUpcomingPerPage}
                  itemName="salidas"
                />
              </>
            )}
          </section>

          {/* Cobranza */}
          <section className="mt-4 space-y-2">
            <h2 className="text-sm font-semibold text-gray-900 tracking-tight">Cobranza</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {loading || !calendar
                ? Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={`cob-skel-${i}`}
                      className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div className="h-3 w-28 bg-gray-200 rounded animate-pulse" />
                        <div className="h-8 w-8 bg-gray-200 rounded-lg animate-pulse" />
                      </div>
                      <div className="mt-3 h-6 w-32 bg-gray-200 rounded animate-pulse" />
                      <div className="mt-2 h-3 w-32 bg-gray-200 rounded animate-pulse" />
                    </div>
                  ))
                : [
                    {
                      key: 'paid',
                      title: 'Cobrado (todas)',
                      sub: 'Total histórico pagado',
                      value: formatAmount(calendar.totalPaidCents, 'ARS'),
                      valueClass: 'text-gray-900',
                      icon: DollarSign,
                      iconClass: 'bg-emerald-100 text-emerald-700',
                      href: '/admin/ventas',
                    },
                    {
                      key: 'pending',
                      title: 'A cobrar',
                      sub: 'Saldo pendiente global',
                      value: formatAmount(calendar.totalPendingCents, 'ARS'),
                      valueClass: 'text-amber-700',
                      icon: AlertTriangle,
                      iconClass: 'bg-amber-100 text-amber-700',
                      href: '/admin/ventas?status=reserved',
                    },
                    {
                      key: 'last30',
                      title: 'Últimos 30 días',
                      sub: `${formatAmount(calendar.last30dAmountCents, 'ARS')} facturado`,
                      value: String(calendar.last30dBookings),
                      valueClass: 'text-gray-900',
                      icon: CalendarCheck,
                      iconClass: 'bg-sky-100 text-sky-700',
                    },
                    {
                      key: 'cancelled',
                      title: 'Canceladas',
                      sub: 'Histórico canceladas',
                      value: String(calendar.totalCancelled),
                      valueClass: 'text-rose-600',
                      icon: Ban,
                      iconClass: 'bg-rose-100 text-rose-700',
                    },
                  ].map((card) => {
                    const Icon = card.icon;
                    const inner = (
                      <Card
                        key={card.key}
                        className="group h-full border border-gray-200/80 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        <CardHeader className="relative flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-[11px] font-medium uppercase tracking-widest text-gray-600">
                            {card.title}
                          </CardTitle>
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconClass}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                        </CardHeader>
                        <CardContent className="relative">
                          <div className={`text-xl font-bold ${card.valueClass}`}>{card.value}</div>
                          <p className="mt-1 text-[11px] text-gray-500">{card.sub}</p>
                        </CardContent>
                      </Card>
                    );
                    return 'href' in card && card.href ? (
                      <Link key={card.key} href={card.href} className="block">
                        {inner}
                      </Link>
                    ) : (
                      inner
                    );
                  })}
            </div>
          </section>

          {/* Separador visual */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

          {/* Ventas detalladas */}
          {breakdown ? (
            <section className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Ventas detalladas</h2>
                <p className="text-xs text-gray-500">
                  Desglose de reservas no canceladas por paquete, método de pago y mes de creación.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="border border-gray-200/80 bg-white shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Top paquetes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {breakdown.byPackage.length === 0 ? (
                      <p className="text-xs text-gray-500">Sin ventas registradas.</p>
                    ) : (
                      breakdown.byPackage.map((row) => {
                        const max = breakdown.byPackage[0]?.amount || 1;
                        return (
                          <div key={row.key}>
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="truncate text-sm font-medium text-gray-900">{row.label}</span>
                              <span className="shrink-0 text-sm font-semibold text-gray-900">
                                {formatAmount(row.amount, 'ars')}
                              </span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-[#2BB8BF]"
                                style={{ width: `${Math.max(4, Math.round((row.amount / max) * 100))}%` }}
                              />
                            </div>
                            <div className="mt-1 text-[11px] text-gray-500">
                              {row.bookings} reservas · {row.people} pax
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>

                <Card className="border border-gray-200/80 bg-white shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Por método de pago</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {breakdown.byMethod.length === 0 ? (
                      <p className="text-xs text-gray-500">Sin ventas registradas.</p>
                    ) : (
                      breakdown.byMethod.map((row) => {
                        const totalAmount = breakdown.byMethod.reduce((acc, item) => acc + item.amount, 0) || 1;
                        const share = Math.round((row.amount / totalAmount) * 100);
                        return (
                          <div key={row.key} className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-gray-900">{row.label}</div>
                              <div className="text-[11px] text-gray-500">{row.bookings} reservas · {share}%</div>
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-gray-900">
                              {formatAmount(row.amount, 'ars')}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>

                <Card className="border border-gray-200/80 bg-white shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Últimos meses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {breakdown.byMonth.length === 0 ? (
                      <p className="text-xs text-gray-500">Sin ventas registradas.</p>
                    ) : (
                      <div className="flex h-[150px] items-end gap-2">
                        {breakdown.byMonth.map((row) => {
                          const max = Math.max(...breakdown.byMonth.map((m) => m.amount)) || 1;
                          return (
                            <div key={row.key} className="flex flex-1 flex-col items-center gap-2">
                              <div
                                className="w-full rounded-t-lg bg-[#2BB8BF]/85 transition-all"
                                style={{ height: `${Math.max(6, Math.round((row.amount / max) * 110))}px` }}
                                title={`${row.bookings} reservas · ${formatAmount(row.amount, 'ars')}`}
                              />
                              <span className="text-[10px] font-medium uppercase text-gray-500">{row.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>
          ) : null}

          {/* Ventas recientes */}
          <Card className="border border-gray-200/80 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Ventas recientes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-500">
                      {['Código', 'Paquete', 'Fecha', 'Pax', 'Cliente', 'Monto'].map((h) => (
                        <th key={h} className="pb-2 pr-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? Array.from({ length: 6 }).map((_, i) => (
                          <tr key={`row-skel-${i}`} className="border-b border-gray-100 last:border-0">
                            <td className="py-3 pr-3"><div className="h-4 w-32 bg-gray-200 rounded animate-pulse" /></td>
                            <td className="py-3 pr-3"><div className="h-4 w-64 bg-gray-200 rounded animate-pulse" /></td>
                            <td className="py-3 pr-3"><div className="h-4 w-24 bg-gray-200 rounded animate-pulse" /></td>
                            <td className="py-3 pr-3"><div className="h-4 w-16 bg-gray-200 rounded animate-pulse" /></td>
                            <td className="py-3 pr-3"><div className="h-4 w-40 bg-gray-200 rounded animate-pulse" /></td>
                            <td className="py-3"><div className="ml-auto h-4 w-20 bg-gray-200 rounded animate-pulse" /></td>
                          </tr>
                        ))
                      : recentVentas.length === 0
                        ? (
                            <tr>
                              <td colSpan={6} className="py-4">
                                <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-600">Sin ventas.</div>
                              </td>
                            </tr>
                          )
                        : recentVentas.map((r) => (
                            <tr key={r.id} className="border-b border-gray-100 last:border-0">
                              <td className="py-3 pr-3 font-mono text-xs text-gray-700">{String((r as any).reservationCode ?? r.id).slice(0, 16)}</td>
                              <td className="py-3 pr-3">
                                <Link href={`/admin/ventas/${r.id}`} className="font-semibold text-gray-900 hover:underline">
                                  {r.packageTitle || r.experienceTitle || '—'}
                                </Link>
                              </td>
                              <td className="py-3 pr-3">{formatReservationDate(r.date)}</td>
                              <td className="py-3 pr-3">{r.people}</td>
                              <td className="py-3 pr-3">{r.customerName || r.customerEmail || '—'}</td>
                              <td className="py-3">{formatAmount(Number(r.amountTotal ?? 0) || 0, String(r.currency ?? 'ars'))}</td>
                            </tr>
                          ))
                    }
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
