'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/admin/ProtectedRoute';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getAuthInstance } from '@/lib/firebase';
import { Gift, Loader2, Pencil, Plus, TicketPercent, Users, Power, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

type Condition = { campo: string; operador: string; valor: string };
type Entry = { id: string; nombre?: string; codigo?: string; descripcion?: string; tipo?: string; condiciones?: Array<{ campo: string; operador: string; valor: unknown }>; tipoDescuento: 'porcentaje' | 'monto_fijo'; valorDescuento?: number; valor?: number; montoMinimoCompra?: number | null; prioridad?: number; usosActuales?: number; usosPorUsuario?: number; usosMaximos?: number | null; usosTotales?: number | null; activo: boolean };
type AdminData = { beneficios: Entry[]; cupones: Entry[]; usuarios: number };
type Kind = 'benefit' | 'coupon';

const benefitTypes = [
  ['bienvenida', 'Bienvenida'], ['fidelidad', 'Fidelidad'], ['volumen', 'Volumen'],
  ['temporal', 'Promoción temporal'], ['segunda_compra', 'Segunda compra'],
  ['tier', 'Nivel de comunidad'], ['referido', 'Referidos'], ['personalizado', 'Personalizado'],
];

export default function ComunidadAdminPage() {
  const [data, setData] = useState<AdminData>({ beneficios: [], cupones: [], usuarios: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<Kind>('benefit');
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState('bienvenida');
  const [discountType, setDiscountType] = useState<'porcentaje' | 'monto_fijo'>('porcentaje');
  const [value, setValue] = useState('');
  const [usageLimit, setUsageLimit] = useState('');
  const [usagePerUser, setUsagePerUser] = useState('1');
  const [minimumAmount, setMinimumAmount] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const user = getAuthInstance().currentUser;
    if (!user) throw new Error('La sesión de administración expiró.');
    const send = (token: string) => fetch(url, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) }, cache: 'no-store' });
    let response = await send(await user.getIdToken());
    // Refresh an expired ID token instead of interrupting the signed-in admin session.
    if (response.status === 401) response = await send(await user.getIdToken(true));
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? 'No se pudo completar la operación.');
    return result;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await request('/api/admin/comunidad')); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los datos.'); }
    finally { setLoading(false); }
  }, [request]);

  useEffect(() => { void load(); }, [load]);

  function resetForm() {
    setNombre(''); setCodigo(''); setDescripcion(''); setValue(''); setUsageLimit(''); setUsagePerUser('1'); setMinimumAmount('');
    setEditingId(null);
    setConditions([]);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const amount = Number(value);
      const common = { tipoDescuento: discountType, usosPorUsuario: Number(usagePerUser), usosTotales: usageLimit ? Number(usageLimit) : null };
      const payload = tab === 'benefit'
        ? { kind: 'benefit', nombre: nombre.trim(), descripcion: descripcion.trim(), tipo, tipoDescuento: discountType, valorDescuento: amount, prioridad: 50, usosMaximos: usageLimit ? Number(usageLimit) : null, usosPorUsuario: Number(usagePerUser), condiciones: conditions.map(condition => ({ ...condition, valor: condition.campo === 'primeraCompra' || condition.campo === 'esSegundoPaquete' ? condition.valor === 'true' : condition.campo === 'tier' ? condition.valor : Number(condition.valor) })) }
        : { kind: 'coupon', codigo: codigo.trim().toUpperCase(), descripcion: descripcion.trim(), ...common, valor: amount, montoMinimoCompra: minimumAmount ? Math.round(Number(minimumAmount) * 100) : null };
      if (editingId) {
        await request('/api/admin/comunidad', { method: 'PATCH', body: JSON.stringify({ ...payload, id: editingId }) });
        toast.success('Configuración actualizada.');
      } else {
        await request('/api/admin/comunidad', { method: 'POST', body: JSON.stringify(payload) });
        toast.success(tab === 'benefit' ? 'Beneficio creado como inactivo.' : 'Cupón creado como inactivo.');
      }
      resetForm();
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo guardar.'); }
    finally { setSaving(false); }
  }

  async function toggle(kind: Kind, entry: Entry) {
    try {
      await request('/api/admin/comunidad', { method: 'PATCH', body: JSON.stringify({ kind, id: entry.id, activo: !entry.activo }) });
      toast.success(`Se ${entry.activo ? 'desactivó' : 'activó'} correctamente.`);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo actualizar.'); }
  }

  function editEntry(kind: Kind, entry: Entry) {
    setTab(kind);
    setEditingId(entry.id);
    setNombre(entry.nombre ?? '');
    setCodigo(entry.codigo ?? '');
    setDescripcion(entry.descripcion ?? '');
    setTipo(entry.tipo ?? 'bienvenida');
    setDiscountType(entry.tipoDescuento);
    setValue(String(entry.valorDescuento ?? entry.valor ?? ''));
    setUsageLimit(String((kind === 'benefit' ? entry.usosMaximos : entry.usosTotales) ?? ''));
    setUsagePerUser(String(entry.usosPorUsuario ?? 1));
    setMinimumAmount(entry.montoMinimoCompra == null ? '' : String(entry.montoMinimoCompra / 100));
    setConditions((entry.condiciones ?? []).map(condition => ({ campo: condition.campo, operador: condition.operador, valor: String(condition.valor) })));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(kind: Kind, entry: Entry) {
    const label = entry.nombre || entry.codigo || 'este elemento';
    if (!window.confirm(`¿Eliminar ${label}? Esta acción no se puede deshacer.`)) return;
    try {
      await request('/api/admin/comunidad', { method: 'DELETE', body: JSON.stringify({ kind, id: entry.id }) });
      toast.success('Eliminado correctamente.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar.');
      void load();
    }
  }

  const entries = tab === 'benefit' ? data.beneficios : data.cupones;

  return <ProtectedRoute><AdminLayout>
    <div className="mx-auto space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-medium text-cyan-700">Explorarg · Administración</p><h1 className="text-lg font-semibold text-gray-900 tracking-tight">Comunidad y beneficios</h1><p className="mt-2 text-sm text-slate-500">Administrá promociones, beneficios y códigos para los miembros.</p></div><Link href="/admin/comunidad/usuarios"><Button variant="outline"><Users className="mr-2 h-4 w-4" />Administrar miembros</Button></Link></header>
      <section className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-4 p-5"><span className="rounded-2xl bg-cyan-50 p-3 text-cyan-700"><Users className="h-5 w-5" /></span><div><p className="text-sm text-slate-500">Miembros registrados</p><p className="text-2xl font-bold">{loading ? '—' : data.usuarios}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5"><span className="rounded-2xl bg-violet-50 p-3 text-violet-700"><Gift className="h-5 w-5" /></span><div><p className="text-sm text-slate-500">Beneficios configurados</p><p className="text-2xl font-bold">{data.beneficios.length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5"><span className="rounded-2xl bg-amber-50 p-3 text-amber-700"><TicketPercent className="h-5 w-5" /></span><div><p className="text-sm text-slate-500">Cupones configurados</p><p className="text-2xl font-bold">{data.cupones.length}</p></div></CardContent></Card>
      </section>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Administrar comunidad">
        <Button variant={tab === 'benefit' ? 'default' : 'outline'} onClick={() => setTab('benefit')}><Gift className="mr-2 h-4 w-4" />Beneficios</Button>
        <Button variant={tab === 'coupon' ? 'default' : 'outline'} onClick={() => setTab('coupon')}><TicketPercent className="mr-2 h-4 w-4" />Cupones</Button>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader><CardTitle>{tab === 'benefit' ? 'Beneficios' : 'Cupones'}</CardTitle></CardHeader>
          <CardContent>
            {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-cyan-700" /></div> : entries.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">Todavía no hay {tab === 'benefit' ? 'beneficios' : 'cupones'} configurados.</p> :
              <div className="space-y-3">{entries.map(entry => <article key={entry.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{entry.nombre || entry.codigo}</h3><Badge variant={entry.activo ? 'default' : 'secondary'}>{entry.activo ? 'Activo' : 'Inactivo'}</Badge></div><p className="mt-1 text-sm text-slate-500">{entry.descripcion || entry.tipo || 'Sin descripción'}</p><p className="mt-1 text-xs text-slate-400">{entry.tipoDescuento === 'porcentaje' ? `${entry.valorDescuento ?? entry.valor}% de descuento` : `$${((entry.valorDescuento ?? entry.valor ?? 0) / 100).toLocaleString('es-AR')} de descuento`} · Usos: {entry.usosActuales ?? 0}/{tab === 'benefit' ? entry.usosMaximos ?? '∞' : entry.usosTotales ?? '∞'}</p></div>
                <div className="flex items-center gap-2"><Button size="icon" variant="outline" aria-label="Editar" onClick={() => editEntry(tab, entry)}><Pencil className="h-4 w-4" /></Button><Button size="sm" variant="outline" onClick={() => void toggle(tab, entry)} title={entry.activo ? 'Desactivar' : 'Activar'}><Power className="mr-1 h-4 w-4" />{entry.activo ? 'Desactivar' : 'Activar'}</Button><Button size="icon" variant="ghost" aria-label="Eliminar" onClick={() => void remove(tab, entry)}><Trash2 className="h-4 w-4 text-red-600" /></Button></div>
              </article>)}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2">{editingId ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}{editingId ? 'Editar' : 'Crear'} {tab === 'benefit' ? 'beneficio' : 'cupón'}{editingId && <Button type="button" size="icon" variant="ghost" className="ml-auto" aria-label="Cancelar edición" onClick={resetForm}><X className="h-4 w-4" /></Button>}</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreate}>
              {tab === 'benefit' ? <>
                <div className="space-y-2"><Label htmlFor="benefit-name">Nombre</Label><Input id="benefit-name" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={100} required placeholder="Ej.: Bienvenida 15%" /></div>
                <div className="space-y-2"><Label htmlFor="benefit-type">Tipo</Label><select id="benefit-type" value={tipo} onChange={e => setTipo(e.target.value)} className="h-10 w-full rounded-md border border-[#BFD8EE] bg-background px-3 text-sm">{benefitTypes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
                <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between"><Label>Condiciones (se deben cumplir todas)</Label><Button type="button" size="sm" variant="outline" disabled={conditions.length >= 5} onClick={() => setConditions(rows => [...rows, { campo: 'totalCompras', operador: '>=', valor: '1' }])}><Plus className="mr-1 h-3.5 w-3.5" />Agregar</Button></div>
                  {conditions.map((condition, index) => <div key={`condition-${index}`} className="mt-3 space-y-2 rounded-lg bg-slate-50 p-2.5">
                    <div className="flex gap-2"><select aria-label="Campo de condición" value={condition.campo} onChange={event => setConditions(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, campo: event.target.value, operador: event.target.value === 'tier' || event.target.value === 'primeraCompra' || event.target.value === 'esSegundoPaquete' ? '==' : '>=', valor: event.target.value === 'tier' ? 'bronce' : event.target.value === 'primeraCompra' || event.target.value === 'esSegundoPaquete' ? 'true' : '1' } : row))} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-white px-2 text-xs"><option value="totalCompras">Compras</option><option value="totalGastado">Gasto acumulado (centavos)</option><option value="cantidadReservas">Reservas</option><option value="diasDesdeRegistro">Días desde registro</option><option value="cantidadReferidos">Referidos</option><option value="tier">Nivel</option><option value="primeraCompra">Primera compra</option><option value="esSegundoPaquete">Segunda compra</option></select><select aria-label="Operador" value={condition.operador} onChange={event => setConditions(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, operador: event.target.value } : row))} className="h-9 w-16 rounded-md border border-input bg-white px-2 text-xs"><option value="==">=</option><option value="!=">≠</option><option value=">=">≥</option><option value="<=">≤</option><option value=">">&gt;</option><option value="<">&lt;</option></select><Button type="button" size="icon" variant="ghost" aria-label="Quitar condición" onClick={() => setConditions(rows => rows.filter((_, rowIndex) => rowIndex !== index))}><Trash2 className="h-4 w-4 text-red-600" /></Button></div>
                    {condition.campo === 'tier' ? <select aria-label="Nivel requerido" value={condition.valor} onChange={event => setConditions(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, valor: event.target.value } : row))} className="h-9 w-full rounded-md border border-input bg-white px-2 text-xs"><option value="bronce">Bronce</option><option value="plata">Plata</option><option value="oro">Oro</option><option value="platino">Platino</option></select> : <Input aria-label="Valor de condición" type={condition.campo === 'primeraCompra' || condition.campo === 'esSegundoPaquete' ? 'text' : 'number'} min={condition.campo === 'primeraCompra' || condition.campo === 'esSegundoPaquete' ? undefined : 0} required readOnly={condition.campo === 'primeraCompra' || condition.campo === 'esSegundoPaquete'} value={condition.valor} onChange={event => setConditions(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, valor: event.target.value } : row))} className="h-9 bg-white text-xs" />}
                  </div>)}
                  {conditions.length === 0 && <p className="mt-2 text-xs text-slate-500">Sin condiciones adicionales; se aplica según el tipo de beneficio.</p>}
                </div>
              </> : <div className="space-y-2"><Label htmlFor="coupon-code">Código</Label><Input id="coupon-code" value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} maxLength={40} required placeholder="EXPLORARG15" /></div>}
              <div className="space-y-2"><Label htmlFor="description">Descripción</Label><Input id="description" value={descripcion} onChange={e => setDescripcion(e.target.value)} maxLength={500} placeholder="Condiciones visibles del beneficio" /></div>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="discount-type">Descuento</Label><select id="discount-type" value={discountType} onChange={e => setDiscountType(e.target.value as 'porcentaje' | 'monto_fijo')} className="h-10 w-full rounded-md border border-[#BFD8EE] bg-background px-3 text-sm"><option value="porcentaje">Porcentaje</option><option value="monto_fijo">Monto fijo</option></select></div><div className="space-y-2"><Label htmlFor="value">{discountType === 'porcentaje' ? 'Porcentaje (%)' : 'Monto (centavos)'}</Label><Input id="value" type="number" min="0.01" max={discountType === 'porcentaje' ? 100 : undefined} step="any" value={value} onChange={e => setValue(e.target.value)} required /></div></div>
              {tab === 'coupon' && <div className="space-y-2"><Label htmlFor="minimum">Compra mínima (ARS)</Label><Input id="minimum" type="number" min="0" step="0.01" value={minimumAmount} onChange={e => setMinimumAmount(e.target.value)} placeholder="Sin mínimo" /></div>}
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label htmlFor="usage-limit">Usos totales</Label><Input id="usage-limit" type="number" min="1" value={usageLimit} onChange={e => setUsageLimit(e.target.value)} placeholder="Ilimitados" /></div><div className="space-y-2"><Label htmlFor="usage-user">Usos por persona</Label><Input id="usage-user" type="number" min="1" value={usagePerUser} onChange={e => setUsagePerUser(e.target.value)} required /></div></div>
              <Button className="w-full" type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Guardar configuración'}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  </AdminLayout></ProtectedRoute>;
}
