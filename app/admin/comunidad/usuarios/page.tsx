'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthInstance } from '@/lib/firebase';
import { ArrowLeft, Loader2, Search, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Member = { uid: string; email: string; nombre: string; apellido: string; telefono: string | null; activo: boolean; tier: string; tierAsignadoManual: boolean; totalCompras: number; totalGastado: number; fechaRegistro: string | null };
const tiers = ['bronce', 'plata', 'oro', 'platino'] as const;

export default function CommunityMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    const user = getAuthInstance().currentUser;
    if (!user) throw new Error('La sesión de administración expiró.');
    return user.getIdToken();
  }, []);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/comunidad/usuarios', { headers: { Authorization: `Bearer ${await getToken()}` }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron cargar los miembros.');
      setMembers(data.miembros ?? []);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Error al cargar miembros.'); }
    finally { setLoading(false); }
  }, [getToken]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? members.filter(member => `${member.nombre} ${member.apellido} ${member.email} ${member.telefono ?? ''}`.toLowerCase().includes(term)) : members;
  }, [members, search]);

  async function update(member: Member, patch: { activo?: boolean; tier?: string }) {
    setSavingUid(member.uid);
    try {
      const response = await fetch('/api/admin/comunidad/usuarios', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ uid: member.uid, ...patch }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'No se pudo actualizar el miembro.');
      setMembers(current => current.map(item => item.uid === member.uid ? { ...item, ...patch, tierAsignadoManual: patch.tier ? true : item.tierAsignadoManual } : item));
      toast.success('Perfil actualizado.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Error al actualizar.'); }
    finally { setSavingUid(null); }
  }

  async function deleteMember() {
    if (!deletingMember) return;
    const member = deletingMember;
    setDeletingUid(member.uid);
    try {
      const response = await fetch('/api/admin/comunidad/usuarios', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getToken()}` },
        body: JSON.stringify({ uid: member.uid }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'No se pudo eliminar el miembro.');
      setMembers(current => current.filter(item => item.uid !== member.uid));
      setDeletingMember(null);
      toast.success('Miembro y cuenta eliminados definitivamente.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el miembro.');
    } finally {
      setDeletingUid(null);
    }
  }

  return <ProtectedRoute><AdminLayout><main className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><Link href="/admin/comunidad" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Comunidad</Link><h1 className="mt-3 text-3xl font-bold text-slate-900">Miembros</h1><p className="mt-1 text-sm text-slate-500">Administrá el estado y nivel de los miembros de Explorarg.</p></div><Badge variant="secondary">{members.length} cargados</Badge></header>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5" />Directorio de miembros</CardTitle><div className="relative mt-3 max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nombre, email o teléfono" className="pl-9" /></div></CardHeader><CardContent>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-cyan-700" /></div> : filtered.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No se encontraron miembros.</p> : <div className="space-y-3">{filtered.map(member => <article key={member.uid} className="grid gap-4 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_150px_170px_auto] lg:items-center">
        <div className="min-w-0"><p className="truncate font-semibold text-slate-900">{member.nombre} {member.apellido}</p><p className="truncate text-sm text-slate-500">{member.email}{member.telefono ? ` · ${member.telefono}` : ''}</p><p className="mt-1 text-xs text-slate-400">{member.totalCompras} compras · {member.fechaRegistro ? new Date(member.fechaRegistro).toLocaleDateString('es-AR') : 'fecha desconocida'}{member.tierAsignadoManual ? ' · nivel manual' : ''}</p></div>
        <Badge variant={member.activo ? 'default' : 'secondary'} className="w-fit">{member.activo ? 'Activo' : 'Inactivo'}</Badge>
        <select aria-label={`Nivel de ${member.nombre}`} value={member.tier} disabled={savingUid === member.uid} onChange={event => void update(member, { tier: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm capitalize">{tiers.map(tier => <option key={tier} value={tier}>{tier}</option>)}</select>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={savingUid === member.uid || deletingUid === member.uid} onClick={() => void update(member, { activo: !member.activo })}>{savingUid === member.uid && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{member.activo ? 'Desactivar' : 'Activar'}</Button>
          <Button variant="outline" size="sm" disabled={savingUid === member.uid || deletingUid === member.uid} onClick={() => setDeletingMember(member)} className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"><Trash2 className="mr-1.5 h-4 w-4" />Eliminar</Button>
        </div>
      </article>)}</div>}
    </CardContent></Card>
    <AlertDialog open={Boolean(deletingMember)} onOpenChange={(open) => { if (!open && !deletingUid) setDeletingMember(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar miembro definitivamente</AlertDialogTitle>
          <AlertDialogDescription>
            Se eliminarán la cuenta de acceso, el perfil y el historial propio de comunidad de <strong className="text-slate-900">{deletingMember?.nombre} {deletingMember?.apellido}</strong> ({deletingMember?.email}). Esta acción no se puede deshacer. Las reservas y ventas históricas se conservarán como registros operativos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={Boolean(deletingUid)}>Cancelar</AlertDialogCancel>
          <Button type="button" disabled={Boolean(deletingUid)} onClick={() => void deleteMember()} className="bg-rose-600 text-white hover:bg-rose-700">
            {deletingUid && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {deletingUid ? 'Eliminando…' : 'Eliminar definitivamente'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </main></AdminLayout></ProtectedRoute>;
}
