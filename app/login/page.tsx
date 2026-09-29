'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { browserLocalPersistence, browserSessionPersistence, setPersistence, signInWithEmailAndPassword } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { AlertTriangle, Eye, EyeOff, KeyRound, Loader2, Mail } from 'lucide-react';
import { CommunityAuthShell } from '@/components/auth/CommunityAuthShell';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const auth = getAuthInstance();
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const token = await credential.user.getIdToken();
      const response = await fetch('/api/community/profile', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'No se pudo cargar tu perfil.');
      if (!result.profile) {
        const displayNameParts = (credential.user.displayName || '').trim().split(/\s+/).filter(Boolean);
        const nombre = displayNameParts.shift() || credential.user.email?.split('@')[0] || 'Usuario';
        const profileResponse = await fetch('/api/community/profile', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ nombre, apellido: displayNameParts.join(' ') }),
        });
        const profileResult = await profileResponse.json();
        if (!profileResponse.ok) throw new Error(profileResult.error ?? 'No se pudo inicializar tu perfil.');
      }
      router.replace('/user');
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : '';
      if (code === 'auth/too-many-requests') toast.error('Hubo varios intentos. Esperá unos minutos y volvé a probar.');
      else if (code === 'auth/network-request-failed') toast.error('No pudimos conectarnos. Revisá tu conexión e intentá nuevamente.');
      else if (code.startsWith('auth/')) toast.error('Email o contraseña incorrectos.');
      else toast.error('No se pudo iniciar sesión. Intentá nuevamente más tarde.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <CommunityAuthShell icon={KeyRound} title="Ingresar" subtitle="Accedé a tu cuenta para continuar y consultar los beneficios de Explorarg.">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-semibold text-[#183F4A]">Email</Label>
          <div className="relative">
            <Input id="email" type="email" autoComplete="email" placeholder="tu@email.com" required value={email} onChange={e => setEmail(e.target.value)} disabled={loading} className="h-12 rounded-2xl border-[#D6E5E5] bg-white pl-11 pr-4 text-[15px] shadow-none placeholder:text-[#9AABAE] focus:border-[#2BB8BF] focus:ring-[#2BB8BF]/15 disabled:opacity-60" />
            <Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#82979A]" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-semibold text-[#183F4A]">Contraseña</Label>
          <div className="relative">
            <KeyRound aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#82979A]" />
            <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Ingresá tu contraseña" required value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => setCapsLock(e.getModifierState('CapsLock'))} onKeyUp={e => setCapsLock(e.getModifierState('CapsLock'))} disabled={loading} className="h-12 rounded-2xl border-[#D6E5E5] bg-white pl-11 pr-12 text-[15px] shadow-none placeholder:text-[#9AABAE] focus:border-[#2BB8BF] focus:ring-[#2BB8BF]/15 disabled:opacity-60" />
            <button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setShowPassword(value => !value)} disabled={loading} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-[#82979A] transition hover:bg-[#F3F8F8] hover:text-[#183F4A] disabled:opacity-50">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
          {capsLock && <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"><AlertTriangle className="h-3.5 w-3.5" />Bloq Mayús activado</div>}
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-[#E1E7F2] bg-[#F8FAFD] px-4 py-3">
          <Label htmlFor="remember" className="cursor-pointer text-sm font-medium text-[#183F4A]">Mantener sesión</Label>
          <Checkbox id="remember" checked={rememberMe} onCheckedChange={value => setRememberMe(value === true)} disabled={loading} className="h-5 w-5 border-[#D6E5E5] data-[state=checked]:border-[#208F91] data-[state=checked]:bg-[#208F91]" />
        </div>
        <Button type="submit" disabled={loading} className="h-12 w-full rounded-2xl bg-[#2BB8BF] text-base font-semibold text-white shadow-[0_10px_22px_rgba(43,184,191,0.22)] transition hover:bg-[#22A9B0]">
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ingresando…</> : 'Iniciar sesión'}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-[#60777D]">¿Todavía no tenés cuenta? <Link className="font-semibold text-[#167F82] underline-offset-4 hover:underline" href="/registro">Registrate</Link></p>
    </CommunityAuthShell>
  );
}
