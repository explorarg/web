'use client';

import VendorProtectedRoute from '@/components/vendor/VendorProtectedRoute';
import VendorLayout from '@/components/vendor/VendorLayout';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { Reservation } from '@/components/landing-reserva/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function VendorDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reservas, setReservas] = useState<Reservation[]>([]);
  const [stats, setStats] = useState({ sales: 0, commissions: 0 });

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
        const sales = list.reduce((acc, r) => acc + (r.amountTotal || 0), 0);
        const commissions = list.reduce((acc, r) => acc + (r.referredBy?.commissionAmount || 0), 0);
        setStats({ sales, commissions });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  return (
    <VendorProtectedRoute>
      <VendorLayout>
        <div className="space-y-6">
          <h1 className="text-lg font-semibold text-gray-900">Resumen</h1>
          {loading ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Card key={`skel-card-${i}`} className="relative overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <CardHeader className="pb-2">
                      <div className="h-4 w-32 bg-gray-200 rounded-md animate-pulse" />
                    </CardHeader>
                    <CardContent className="pb-6">
                      <div className="h-8 w-24 bg-gray-200 rounded-md animate-pulse" />
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Card className="rounded-xl border border-gray-200 bg-white">
                <CardHeader className="border-b border-gray-200">
                  <div className="h-5 w-36 bg-gray-200 rounded-md animate-pulse" />
                </CardHeader>
                <CardContent className="p-0">
                  <div className="p-4">
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={`row-skel-${i}`} className="grid grid-cols-5 gap-3">
                          {Array.from({ length: 5 }).map((__, j) => (
                            <div key={`cell-${i}-${j}`} className="h-4 bg-gray-200 rounded animate-pulse" />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Ventas referidas</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">{(stats.sales/100).toLocaleString()}</CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Comisiones</CardTitle>
                  </CardHeader>
                  <CardContent className="text-2xl font-semibold">{(stats.commissions/100).toLocaleString()}</CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Últimas reservas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">Fecha</th>
                          <th className="px-4 py-3 text-left font-medium">Paquete</th>
                          <th className="px-4 py-3 text-left font-medium">Cliente</th>
                          <th className="px-4 py-3 text-left font-medium">Venta</th>
                          <th className="px-4 py-3 text-left font-medium">Comisión</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reservas.slice(0, 20).map(r => (
                          <tr key={r.id} className="border-t border-gray-100">
                            <td className="px-4 py-3">{new Date((r.createdAt as any)?.seconds ? (r.createdAt as any).seconds * 1000 : Date.now()).toLocaleDateString()}</td>
                            <td className="px-4 py-3">{r.experienceTitle}</td>
                            <td className="px-4 py-3">{r.customerName}</td>
                            <td className="px-4 py-3">{(r.amountTotal/100).toLocaleString()} {r.currency?.toUpperCase?.()}</td>
                            <td className="px-4 py-3">{r.referredBy ? (r.referredBy.commissionAmount/100).toLocaleString() : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </VendorLayout>
    </VendorProtectedRoute>
  );
}
