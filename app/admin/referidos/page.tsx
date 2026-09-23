'use client';

import { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminPagination from '@/components/admin/AdminPagination';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Vendor } from '@/types/vendor';
import type { Reservation } from '@/components/landing-reserva/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge as ShadcnBadge } from '@/components/ui/badge';

export default function ReferidosPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [reservas, setReservas] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accrued' | 'paid' | 'cancelled'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const vSnap = await getDocs(query(collection(db, 'vendors'), orderBy('name', 'asc')));
        const vList = vSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Vendor[];
        setVendors(vList);
        const rSnap = await getDocs(query(collection(db, 'reservas'), orderBy('createdAt', 'desc')));
        const rList = rSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Reservation[];
        setReservas(rList.filter(r => r.referredBy));
      } catch {
        toast.error('No se pudieron cargar datos');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = reservas;
    if (vendorFilter !== 'all') {
      list = list.filter(r => r.referredBy?.vendorId === vendorFilter);
    }
    if (statusFilter !== 'all') {
      list = list.filter(r => r.referredBy?.payoutStatus === statusFilter);
    }
    const t = searchTerm.trim().toLowerCase();
    if (t) {
      list = list.filter(r =>
        r.customerEmail.toLowerCase().includes(t) ||
        r.customerName.toLowerCase().includes(t) ||
        r.experienceTitle.toLowerCase().includes(t)
      );
    }
    return list;
  }, [reservas, vendorFilter, statusFilter, searchTerm]);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  const totals = useMemo(() => {
    const totalSales = filtered.reduce((acc, r) => acc + (r.amountTotal || 0), 0);
    const totalCommissions = filtered.reduce((acc, r) => acc + (r.referredBy?.commissionAmount || 0), 0);
    return { totalSales, totalCommissions };
  }, [filtered]);

  const markPaid = async (ids: string[]) => {
    try {
      const res = await fetch('/api/admin/referidos/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Error');
      setReservas(prev => prev.map(r => (ids.includes(r.id) && r.referredBy ? { ...r, referredBy: { ...r.referredBy, payoutStatus: 'paid' } } : r)));
      toast.success('Comisiones marcadas como pagadas');
    } catch {
      toast.error('No se pudo actualizar el estado');
    }
  };

  const [selected, setSelected] = useState<string[]>([]);
  const toggleSel = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const clearSel = () => setSelected([]);

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Referidos</h1>
              <p className="mt-1 text-sm text-gray-600">Reservas con vendedor asignado y comisiones</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" disabled={!selected.length} onClick={() => markPaid(selected)}>Marcar pagadas</Button>
              {selected.length > 0 && <Button variant="ghost" onClick={clearSel}>Limpiar selección</Button>}
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Buscar por cliente o paquete"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setSearchTerm(searchInput);
                    if (e.key === 'Escape') {
                      setSearchInput('');
                      setSearchTerm('');
                    }
                  }}
                  className="w-80"
                />
                {searchInput && (
                  <Button variant="ghost" size="icon" onClick={() => { setSearchInput(''); setSearchTerm(''); }}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setSearchTerm(searchInput)}>Buscar</Button>
              </div>
              <div className="flex items-center gap-3">
                <Select value={vendorFilter} onValueChange={(v) => setVendorFilter(v)}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los vendedores</SelectItem>
                    {vendors.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Estado comisión" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="accrued">Devengada</SelectItem>
                    <SelectItem value="paid">Pagada</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <div className="h-9 w-80 bg-gray-200 rounded-xl animate-pulse" />
                  <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                    <div className="p-4">
                      <div className="space-y-2">
                        {Array.from({ length: 6 }).map((_, i) => (
                          <div key={`ref-row-${i}`} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <section className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                    <Table className="text-sm">
                      <TableHeader className="[&_tr]:border-black/5">
                        <TableRow className="border-black/5 hover:bg-transparent">
                          <TableHead className="px-4">Selec</TableHead>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Paquete</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Venta</TableHead>
                          <TableHead>Comisión</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageItems.map((r) => (
                          <TableRow key={r.id} className="border-black/5 hover:bg-black/[0.02]">
                            <TableCell className="px-4">
                              <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSel(r.id)} />
                            </TableCell>
                            <TableCell>
                              {new Date((r.createdAt as any)?.seconds ? (r.createdAt as any).seconds * 1000 : Date.now()).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="font-medium text-gray-900">{r.experienceTitle}</TableCell>
                            <TableCell>
                              <div className="min-w-0">
                                <div className="font-medium text-gray-900 truncate max-w-[220px]">{r.customerName}</div>
                                <div className="mt-0.5 text-[11px] text-gray-500 truncate max-w-[220px]">{r.customerEmail}</div>
                              </div>
                            </TableCell>
                            <TableCell>{r.referredBy?.vendorName || '-'}</TableCell>
                            <TableCell>{(r.amountTotal / 100).toLocaleString()} {r.currency?.toUpperCase?.()}</TableCell>
                            <TableCell>
                              {r.referredBy ? `${(r.referredBy.commissionAmount / 100).toLocaleString()} ${r.referredBy.commissionCurrency.toUpperCase()}` : '-'}
                            </TableCell>
                            <TableCell>
                              {r.referredBy ? (
                                <ShadcnBadge variant="outline" className="capitalize text-[11px]">
                                  {r.referredBy.payoutStatus}
                                </ShadcnBadge>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </section>
                  <div className="flex items-center justify-between py-3">
                    <div className="text-sm text-gray-600">
                      Total ventas: {(totals.totalSales / 100).toLocaleString()} | Comisiones: {(totals.totalCommissions / 100).toLocaleString()}
                    </div>
                    <AdminPagination
                      currentPage={currentPage}
                      totalItems={filtered.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={setItemsPerPage}
                      itemName="reservas"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
