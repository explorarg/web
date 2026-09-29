'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react';
import { CommunityAuthShell } from '@/components/auth/CommunityAuthShell';

export default function RegistroPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nombre.trim().length < 2) return toast.error('Ingresá tu nombre.');
    if (apellido.trim().length < 2) return toast.error('Ingresá tu apellido.');
    if (password.length < 8) return toast.error('La contraseña debe tener al menos 8 caracteres.');
    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(getAuthInstance(), email.trim(), password);
      await updateProfile(credential.user, { displayName: `${nombre.trim()} ${apellido.trim()}` });
      const token = await credential.user.getIdToken();
      const response = await fetch('/api/community/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nombre: nombre.trim(), apellido: apellido.trim(), telefono }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'No se pudo crear el perfil de comunidad.');
      toast.success('¡Bienvenido a la comunidad!');
      router.replace('/user');
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : '';
      if (code === 'auth/email-already-in-use') toast.error('Ese email ya tiene una cuenta. Iniciá sesión o usá otro correo.');
      else if (code === 'auth/invalid-email') toast.error('Revisá el formato del correo electrónico.');
      else if (code === 'auth/weak-password') toast.error('Elegí una contraseña más segura, de al menos 8 caracteres.');
      else if (code === 'auth/network-request-failed') toast.error('No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.');
      else toast.error('No se pudo crear tu cuenta. Intentá nuevamente más tarde.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <CommunityAuthShell icon={UserRound} title="Crear cuenta" subtitle="Registrate para formar parte de la comunidad y disfrutar los beneficios de Explorarg.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
          <Label htmlFor="name" className="text-sm font-semibold text-[#183F4A]">Nombre</Label>
          <div className="relative"><UserRound aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#82979A]" /><Input id="name" autoComplete="given-name" placeholder="Tu nombre" required minLength={2} value={nombre} onChange={e => setNombre(e.target.value)} disabled={loading} className="h-12 w-full min-w-0 rounded-2xl border-[#D6E5E5] bg-white pl-10 pr-3 text-[15px] shadow-none placeholder:text-[#9AABAE] focus:border-[#2BB8BF] focus:ring-[#2BB8BF]/15 disabled:opacity-60 sm:pl-11 sm:pr-4" /></div>
          </div>
          <div className="min-w-0 space-y-2">
          <Label htmlFor="surname" className="text-sm font-semibold text-[#183F4A]">Apellido</Label>
          <div className="relative"><UserRound aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#82979A]" /><Input id="surname" autoComplete="family-name" placeholder="Tu apellido" required minLength={2} value={apellido} onChange={e => setApellido(e.target.value)} disabled={loading} className="h-12 w-full min-w-0 rounded-2xl border-[#D6E5E5] bg-white pl-10 pr-3 text-[15px] shadow-none placeholder:text-[#9AABAE] focus:border-[#2BB8BF] focus:ring-[#2BB8BF]/15 disabled:opacity-60 sm:pl-11 sm:pr-4" /></div>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-semibold text-[#183F4A]">Teléfono <span className="font-normal text-[#82979A]">(opcional)</span></Label>
          <div className="relative"><Phone aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#82979A]" /><Input id="phone" type="tel" autoComplete="tel" placeholder="Tu número de teléfono" value={telefono} onChange={e => setTelefono(e.target.value)} disabled={loading} className="h-12 rounded-2xl border-[#D6E5E5] bg-white pl-11 pr-4 text-[15px] shadow-none placeholder:text-[#9AABAE] focus:border-[#2BB8BF] focus:ring-[#2BB8BF]/15 disabled:opacity-60" /></div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-semibold text-[#183F4A]">Email</Label>
          <div className="relative"><Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#82979A]" /><Input id="email" type="email" autoComplete="email" placeholder="tu@email.com" required value={email} onChange={e => setEmail(e.target.value)} disabled={loading} className="h-12 rounded-2xl border-[#D6E5E5] bg-white pl-11 pr-4 text-[15px] shadow-none placeholder:text-[#9AABAE] focus:border-[#2BB8BF] focus:ring-[#2BB8BF]/15 disabled:opacity-60" /></div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-semibold text-[#183F4A]">Contraseña</Label>
          <div className="relative"><LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#82979A]" /><Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="Mínimo 8 caracteres" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} disabled={loading} className="h-12 rounded-2xl border-[#D6E5E5] bg-white pl-11 pr-12 text-[15px] shadow-none placeholder:text-[#9AABAE] focus:border-[#2BB8BF] focus:ring-[#2BB8BF]/15 disabled:opacity-60" /><button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(value => !value)} disabled={loading} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-[#82979A] transition hover:bg-[#F3F8F8] hover:text-[#183F4A] disabled:opacity-50">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
          <p className="text-xs text-[#82979A]">Usá al menos 8 caracteres.</p>
        </div>
        <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-[#2BB8BF] text-base font-semibold text-white shadow-[0_10px_22px_rgba(43,184,191,0.22)] transition hover:bg-[#22A9B0]">
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creando cuenta…</> : 'Crear cuenta'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-[#60777D]">¿Ya tenés cuenta? <Link className="font-semibold text-[#167F82] underline-offset-4 hover:underline" href="/login">Iniciá sesión</Link></p>
    </CommunityAuthShell>
  );
}
