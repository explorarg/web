'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Clock3,
  Gift,
  Loader2,
  LogOut,
  Mail,
  MapPinned,
  PencilLine,
  ShieldCheck,
  TicketPercent,
  UserRound,
  WalletCards,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';
import { Button } from '@/components/ui/button';
import { getAuthInstance } from '@/lib/firebase';
import type { CommunityProfile } from '@/lib/community/types';

type Purchase = {
  id: string;
  orderId: string;
  amountCents: number;
  currency: string;
  reservationCount: number;
  packages: Array<{ title: string; date?: string; people?: number }>;
  recordedAt: string | null;
};

type UsedBenefit = {
  id: string;
  tipo: string;
  nombre: string;
  codigo: string | null;
  montoOriginal: number;
  montoDescuento: number;
  montoFinal: number;
  moneda: string;
  paquetes: Array<{ title?: string; date?: string }>;
  fechaUso: string | null;
};

type AvailableBenefit = {
  id: string;
  nombre: string;
  descripcion: string;
  tipoDescuento?: 'porcentaje' | 'monto_fijo';
  valorDescuento?: number;
  fechaFin: string | null;
};

type ProfileResponse = {
  profile: CommunityProfile;
  purchases: Purchase[];
  benefitsUsed: UsedBenefit[];
};

type ProfileSection = 'overview' | 'personal' | 'purchases' | 'benefits';

const tierLabels: Record<string, string> = { bronce: 'Bronce', plata: 'Plata', oro: 'Oro', platino: 'Platino' };

function amount(value: number, currency = 'ARS') {
  try {
    const digits = currency.toUpperCase() === 'ARS' ? 0 : 2;
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value / 100);
  } catch {
    return `${currency.toUpperCase()} ${(value / 100).toLocaleString('es-AR')}`;
  }
}

function dateLabel(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function initials(first = '', last = '') {
  return `${first.trim().charAt(0)}${last.trim().charAt(0)}`.toUpperCase() || 'EX';
}

export default function UserProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [benefitsUsed, setBenefitsUsed] = useState<UsedBenefit[]>([]);
  const [benefits, setBenefits] = useState<AvailableBenefit[]>([]);
  const [section, setSection] = useState<ProfileSection>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ nombre: '', apellido: '', telefono: '' });

  const loadProfile = useCallback(async (authUser: User) => {
    const token = await authUser.getIdToken();
    const response = await fetch('/api/community/profile', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'No se pudo cargar tu cuenta.');
    if (!data.profile) throw new Error('No encontramos tu perfil de comunidad. Cerrá sesión e ingresá nuevamente.');
    const result = data as ProfileResponse;
    setProfile(result.profile);
    setPurchases(Array.isArray(result.purchases) ? result.purchases : []);
    setBenefitsUsed(Array.isArray(result.benefitsUsed) ? result.benefitsUsed : []);
    setForm({ nombre: result.profile.nombre ?? '', apellido: result.profile.apellido ?? '', telefono: result.profile.telefono ?? '' });
    const benefitsResponse = await fetch('/api/community/benefits', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (benefitsResponse.ok) {
      const benefitsData = await benefitsResponse.json();
      setBenefits(Array.isArray(benefitsData.beneficios) ? benefitsData.beneficios : []);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(getAuthInstance(), async (authUser) => {
      if (!authUser) {
        router.replace('/login?next=%2Fuser');
        return;
      }
      setUser(authUser);
      try {
        await loadProfile(authUser);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudo cargar tu cuenta.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [loadProfile, router]);

  const stats = useMemo(() => ({
    savings: benefitsUsed.reduce((sum, item) => sum + item.montoDescuento, 0),
    trips: purchases.reduce((sum, item) => sum + item.reservationCount, 0),
  }), [benefitsUsed, purchases]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setError('');
    setNotice('');
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/community/profile', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'No se pudieron guardar los cambios.');
      setProfile(data.profile);
      setEditing(false);
      setNotice('Tus datos se actualizaron correctamente.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await signOut(getAuthInstance());
    router.replace('/');
  }

  const sections: Array<{ id: ProfileSection; label: string; icon: typeof UserRound }> = [
    { id: 'overview', label: 'Resumen', icon: WalletCards },
    { id: 'personal', label: 'Mis datos', icon: UserRound },
    { id: 'purchases', label: 'Compras', icon: MapPinned },
    { id: 'benefits', label: 'Beneficios', icon: Gift },
  ];

  return (
    <div className="min-h-screen bg-[#F5FAFF] text-[#18333E]">
      <Navbar variant="homeMockup" reserveSpace />
      <main className="container mx-auto w-full px-4 pb-20 pt-8 md:px-6 lg:px-8 lg:pt-12">
        {loading ? (
          <div className="flex min-h-[55vh] items-center justify-center gap-3 text-sm font-medium text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-[#2BB8BF]" />Preparando tu espacio Explorarg…</div>
        ) : error && !profile ? (
          <div className="mx-auto my-20 max-w-xl rounded-3xl border border-rose-200 bg-white p-8 text-center">
            <CircleHelp className="mx-auto h-9 w-9 text-rose-500" /><h1 className="mt-4 text-2xl font-bold">No pudimos abrir tu cuenta</h1><p role="alert" className="mt-2 text-sm leading-6 text-slate-600">{error}</p><Button className="mt-6 rounded-full bg-[#2BB8BF] hover:bg-[#189DA4]" onClick={() => router.push('/login')}>Volver a ingresar</Button>
          </div>
        ) : profile ? (
          <>
            <header className="mb-8 flex flex-col justify-between gap-6 border-b border-[#DCE8EC] pb-7 sm:flex-row sm:items-end">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#DDF5F3] text-lg font-bold text-[#167C80]">{initials(profile.nombre, profile.apellido)}</div>
                <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#248E91]">Comunidad Explorarg</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-[#18333E] sm:text-4xl">Hola, {profile.nombre}</h1><p className="mt-1 text-sm text-slate-500">Tu espacio para organizar tus viajes y beneficios.</p></div>
              </div>
              <button onClick={logout} className="inline-flex h-10 items-center gap-2 self-start rounded-full border border-[#D7E3E7] bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 sm:self-auto"><LogOut className="h-4 w-4" />Cerrar sesión</button>
            </header>

            <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
              <aside className="lg:sticky lg:top-28 lg:h-fit">
                <nav aria-label="Secciones de mi cuenta" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                  {sections.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => { setSection(id); setError(''); setNotice(''); }} className={`inline-flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold transition ${section === id ? 'bg-[#183F4A] text-white' : 'text-slate-600 hover:bg-white hover:text-[#183F4A]'}`}>
                      <Icon className="h-[17px] w-[17px]" />{label}{section === id && <ChevronRight className="ml-auto h-4 w-4" />}
                    </button>
                  ))}
                </nav>
                <div className="mt-8 hidden rounded-2xl border border-[#DCE8EC] bg-white p-4 lg:block"><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-[#249699]" />Cuenta protegida</div><p className="mt-2 text-xs leading-5 text-slate-500">Tus datos personales solo se usan para gestionar tu cuenta y tus reservas.</p></div>
              </aside>

              <div className="min-w-0">
                {(error || notice) && <div role={error ? 'alert' : 'status'} className={`mb-5 rounded-xl px-4 py-3 text-sm ${error ? 'border border-rose-200 bg-rose-50 text-rose-800' : 'border border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || notice}</div>}

                {section === 'overview' && <div className="space-y-7">
                  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <article className="rounded-2xl bg-[#183F4A] p-5 text-white sm:col-span-2"><div className="flex items-start justify-between"><div><p className="text-sm text-white/65">Tu nivel Explorarg</p><p className="mt-3 text-3xl font-semibold">{tierLabels[profile.tier] ?? 'Bronce'}</p></div><span className="rounded-xl bg-white/10 p-3"><BadgeCheck className="h-5 w-5 text-[#77DBD1]" /></span></div><div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-xs text-white/65"><CalendarDays className="h-4 w-4" />Miembro desde {dateLabel(profile.fechaRegistro)}</div></article>
                    <article className="rounded-2xl border border-[#DCE8EC] bg-white p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">Viajes registrados</p><MapPinned className="h-4 w-4 text-[#248E91]" /></div><p className="mt-4 text-3xl font-semibold text-[#18333E]">{stats.trips}</p><p className="mt-1 text-xs text-slate-500">En compras confirmadas</p></article>
                    <article className="rounded-2xl border border-[#DCE8EC] bg-white p-5"><div className="flex items-center justify-between"><p className="text-sm text-slate-500">Ahorro acumulado</p><TicketPercent className="h-4 w-4 text-[#248E91]" /></div><p className="mt-4 text-2xl font-semibold text-[#18333E]">{amount(stats.savings)}</p><p className="mt-1 text-xs text-slate-500">Con beneficios Explorarg</p></article>
                  </section>

                  <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
                    <div className="rounded-2xl border border-[#DCE8EC] bg-white p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Tus últimas compras</h2><p className="mt-1 text-sm text-slate-500">Un resumen de tus reservas pagadas.</p></div><button onClick={() => setSection('purchases')} className="text-sm font-semibold text-[#18878B] hover:underline">Ver historial</button></div>
                      {purchases.length ? <div className="mt-5 divide-y divide-slate-100">{purchases.slice(0, 3).map((purchase) => <PurchaseRow key={purchase.id} purchase={purchase} />)}</div> : <EmptyState icon={MapPinned} title="Todavía no hay compras" body="Cuando confirmes una reserva, vas a encontrarla acá." action={<Link href="/paquetes" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#17888B]">Explorar viajes <ChevronRight className="h-4 w-4" /></Link>} />}
                    </div>
                    <div className="rounded-2xl border border-[#DCE8EC] bg-white p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Beneficios disponibles</h2><p className="mt-1 text-sm text-slate-500">Promociones para tu próxima compra.</p></div><Gift className="h-5 w-5 text-[#248E91]" /></div>
                      {benefits.length ? <div className="mt-5 space-y-3">{benefits.slice(0, 3).map((benefit) => <BenefitRow key={benefit.id} benefit={benefit} />)}<button onClick={() => setSection('benefits')} className="pt-1 text-sm font-semibold text-[#17888B] hover:underline">Ver todos</button></div> : <EmptyState icon={Gift} title="Nuevos beneficios pronto" body="Acá vas a ver las promociones disponibles para tu cuenta." />}
                    </div>
                  </section>
                  <section className="flex flex-col justify-between gap-5 rounded-2xl border border-[#CFE9E7] bg-[#E8F7F5] p-5 sm:flex-row sm:items-center sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#258E90]">Tu próxima aventura</p><h2 className="mt-1 text-xl font-semibold text-[#183F4A]">¿A dónde viajamos ahora?</h2><p className="mt-1 text-sm text-slate-600">Descubrí salidas y experiencias para compartir.</p></div><Link href="/paquetes" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#2BB8BF] px-5 text-sm font-semibold text-white transition hover:bg-[#188F96]">Ver paquetes <ArrowUpRight className="h-4 w-4" /></Link></section>
                </div>}

                {section === 'personal' && <section className="max-w-3xl rounded-2xl border border-[#DCE8EC] bg-white p-5 sm:p-8">
                  <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#248E91]">Cuenta personal</p><h2 className="mt-1 text-2xl font-semibold">Mis datos</h2><p className="mt-2 text-sm text-slate-500">Mantené tus datos actualizados para que podamos acompañarte mejor.</p></div>{!editing && <button onClick={() => { setEditing(true); setNotice(''); }} className="inline-flex h-10 items-center gap-2 rounded-full border border-[#D7E3E7] px-4 text-sm font-semibold hover:bg-slate-50"><PencilLine className="h-4 w-4" />Editar</button>}</div>
                  {editing ? <form onSubmit={saveProfile} className="mt-8 space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2"><Field label="Nombre" value={form.nombre} onChange={(value) => setForm((prev) => ({ ...prev, nombre: value }))} required /><Field label="Apellido" value={form.apellido} onChange={(value) => setForm((prev) => ({ ...prev, apellido: value }))} required /></div>
                    <Field label="Teléfono" value={form.telefono} onChange={(value) => setForm((prev) => ({ ...prev, telefono: value }))} placeholder="+54 9…" />
                    <div><label className="mb-2 block text-sm font-medium">Correo electrónico</label><div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-500"><Mail className="h-4 w-4" />{profile.email}<span className="ml-auto text-xs">No editable</span></div><p className="mt-2 text-xs text-slate-500">El correo se administra desde tu inicio de sesión seguro.</p></div>
                    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => { setEditing(false); setForm({ nombre: profile.nombre, apellido: profile.apellido, telefono: profile.telefono ?? '' }); }} className="rounded-full">Cancelar</Button><Button type="submit" disabled={saving} className="rounded-full bg-[#2BB8BF] px-6 text-white hover:bg-[#188F96]">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? 'Guardando…' : 'Guardar cambios'}</Button></div>
                  </form> : <div className="mt-8 divide-y divide-slate-100">{[["Nombre completo", `${profile.nombre} ${profile.apellido}`.trim(), UserRound], ["Correo", profile.email, Mail], ["Teléfono", profile.telefono || 'No agregado', PencilLine], ["Miembro desde", dateLabel(profile.fechaRegistro), CalendarDays]].map(([label, value, Icon]: any) => <div key={label} className="flex items-center gap-4 py-4"><span className="rounded-xl bg-[#EFF8F7] p-3 text-[#278B8D]"><Icon className="h-4 w-4" /></span><div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-[#18333E]">{value}</p></div></div>)}</div>}
                </section>}

                {section === 'purchases' && <section className="rounded-2xl border border-[#DCE8EC] bg-white p-5 sm:p-7"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#248E91]">Tu actividad</p><h2 className="mt-1 text-2xl font-semibold">Historial de compras</h2><p className="mt-2 text-sm text-slate-500">Reservas con pago confirmado asociadas a tu cuenta.</p></div>{purchases.length ? <div className="mt-6 divide-y divide-slate-100">{purchases.map((purchase) => <PurchaseRow key={purchase.id} purchase={purchase} detailed />)}</div> : <EmptyState icon={MapPinned} title="Tu historial empieza con un viaje" body="Cuando completes una compra con tu cuenta Explorarg, la vas a ver en esta sección." action={<Link href="/paquetes" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#17888B]">Explorar paquetes <ChevronRight className="h-4 w-4" /></Link>} />}</section>}

                {section === 'benefits' && <div className="space-y-6">
                  <section className="rounded-2xl border border-[#DCE8EC] bg-white p-5 sm:p-7"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#248E91]">Para tu próximo viaje</p><h2 className="mt-1 text-2xl font-semibold">Beneficios disponibles</h2></div>{benefits.length ? <div className="mt-6 grid gap-3 md:grid-cols-2">{benefits.map((benefit) => <BenefitRow key={benefit.id} benefit={benefit} large />)}</div> : <EmptyState icon={Gift} title="Todavía no hay promociones disponibles" body="Volvé a revisar más adelante: los beneficios cambian durante el año." />}</section>
                  <section className="rounded-2xl border border-[#DCE8EC] bg-white p-5 sm:p-7"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#248E91]">Tus redenciones</p><h2 className="mt-1 text-xl font-semibold">Historial de beneficios usados</h2></div>{benefitsUsed.length ? <div className="mt-5 divide-y divide-slate-100">{benefitsUsed.map((item) => <div key={item.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"><div><p className="font-semibold">{item.nombre}</p><p className="mt-1 text-xs text-slate-500">{dateLabel(item.fechaUso)}{item.codigo ? ` · Código ${item.codigo}` : ''}</p></div><div className="text-sm sm:text-right"><p className="font-semibold text-[#187F80]">Ahorro {amount(item.montoDescuento, item.moneda)}</p><p className="mt-1 text-xs text-slate-500">Compra final {amount(item.montoFinal, item.moneda)}</p></div></div>)}</div> : <EmptyState icon={TicketPercent} title="Aún no usaste beneficios" body="Cuando apliques una promoción a una compra confirmada, aparecerá en tu historial." />}</section>
                </div>}
              </div>
            </div>
          </>
        ) : null}
      </main>
      <HomeFooter />
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return <div><label className="mb-2 block text-sm font-medium" htmlFor={`profile-${label}`}>{label}</label><input id={`profile-${label}`} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} minLength={required ? 2 : undefined} maxLength={label === 'Teléfono' ? 30 : 100} className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#2BB8BF] focus:ring-4 focus:ring-[#2BB8BF]/10" /></div>;
}

function PurchaseRow({ purchase, detailed = false }: { purchase: Purchase; detailed?: boolean }) {
  const title = purchase.packages?.map((item) => item.title).filter(Boolean).join(' + ') || `${purchase.reservationCount} reserva${purchase.reservationCount === 1 ? '' : 's'}`;
  return <div className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"><div className="flex min-w-0 items-start gap-3"><span className="mt-0.5 rounded-xl bg-[#EFF8F7] p-2.5 text-[#278B8D]"><MapPinned className="h-4 w-4" /></span><div className="min-w-0"><p className="truncate font-semibold text-[#18333E]">{title}</p><p className="mt-1 text-xs text-slate-500">{dateLabel(purchase.recordedAt)} · {purchase.reservationCount} reserva{purchase.reservationCount === 1 ? '' : 's'}</p>{detailed && <p className="mt-1 text-xs text-slate-400">Operación {purchase.orderId.slice(0, 12) || 'Explorarg'}</p>}</div></div><div className="pl-12 text-sm font-semibold text-[#18333E] sm:pl-0 sm:text-right">{amount(purchase.amountCents, purchase.currency)}<p className="mt-1 text-xs font-normal text-slate-500">Pago confirmado</p></div></div>;
}

function BenefitRow({ benefit, large = false }: { benefit: AvailableBenefit; large?: boolean }) {
  const value = benefit.tipoDescuento === 'porcentaje' ? `${benefit.valorDescuento ?? 0}% de descuento` : `Ahorro de ${amount(benefit.valorDescuento ?? 0)}`;
  return <article className={`rounded-xl border border-[#DCEAE9] bg-[#FBFEFE] ${large ? 'p-5' : 'p-4'}`}><div className="flex items-start gap-3"><span className="rounded-lg bg-[#E5F5F3] p-2 text-[#258E90]"><Gift className="h-4 w-4" /></span><div className="min-w-0"><p className="font-semibold text-[#18333E]">{benefit.nombre}</p>{benefit.descripcion && <p className="mt-1 text-sm leading-5 text-slate-500">{benefit.descripcion}</p>}<p className="mt-3 text-sm font-semibold text-[#187F80]">{value}</p>{benefit.fechaFin && <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />Vence {dateLabel(benefit.fechaFin)}</p>}</div></div></article>;
}

function EmptyState({ icon: Icon, title, body, action }: { icon: typeof Gift; title: string; body: string; action?: React.ReactNode }) {
  return <div className="my-8 flex flex-col items-center text-center"><span className="rounded-2xl bg-[#EFF8F7] p-3 text-[#248E91]"><Icon className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold text-[#18333E]">{title}</p><p className="mt-1 max-w-sm text-sm leading-5 text-slate-500">{body}</p>{action}</div>;
}
