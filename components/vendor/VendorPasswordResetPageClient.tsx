'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Eye, EyeOff, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { getAuthInstance } from '@/lib/firebase';
import { getBrandLogoSrc, isRemoteUrl, renderTemplate, siteConfig } from '@/lib/siteConfig';

type VerifyState = 'checking' | 'ready' | 'invalid' | 'signing-in';

function validatePassword(password: string) {
  const value = String(password ?? '');
  return {
    minLength: value.length >= 8,
    hasLetters: /[A-Za-z]/.test(value),
    hasNumbers: /[0-9]/.test(value),
    hasSpecial: /[^A-Za-z0-9]/.test(value),
  };
}

function getStrengthScore(password: string) {
  const rules = validatePassword(password);
  return Object.values(rules).filter(Boolean).length;
}

function VendorDashboardEntrySkeleton({
  logoSrc,
  logoAlt,
}: {
  logoSrc: string;
  logoAlt: string;
}) {
  return (
    <div className="min-h-screen bg-gray-50 vendor-scope">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-gray-900 text-gray-200 lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 ring-1 ring-white/10">
              {isRemoteUrl(logoSrc) ? (
                <img src={logoSrc} alt={logoAlt} className="h-8 w-8 object-contain" />
              ) : (
                <Image src={logoSrc} alt={logoAlt} width={40} height={40} className="h-8 w-8 object-contain" />
              )}
            </div>
            <div className="space-y-1">
              <div className="h-4 w-24 animate-pulse rounded bg-white/15" />
              <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
            </div>
          </div>
          <div className="space-y-2 p-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`vendor-nav-skeleton-${index}`}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                  index === 0 ? 'bg-white text-slate-950 shadow-lg shadow-black/20' : 'bg-white/5'
                }`}
              >
                <div className={`h-5 w-5 animate-pulse rounded ${index === 0 ? 'bg-slate-200' : 'bg-white/20'}`} />
                <div className={`h-4 animate-pulse rounded ${index === 0 ? 'w-24 bg-slate-200' : 'w-20 bg-white/20'}`} />
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-6">
            <div className="h-5 w-24 animate-pulse rounded bg-gray-200 lg:hidden" />
            <div className="flex items-center gap-4">
              <div className="h-5 w-28 animate-pulse rounded bg-gray-200" />
              <div className="hidden h-9 w-24 animate-pulse rounded-xl bg-gray-100 sm:block" />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl p-6">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-[#2BB8BF]" />
              <div className="text-sm font-semibold text-[#0B2A52]">Ingresando a tu panel...</div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Card key={`vendor-entry-card-${i}`} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                  <CardContent className="space-y-3 p-6">
                    <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                    <div className="h-8 w-20 animate-pulse rounded bg-gray-200" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="rounded-xl border border-gray-200 bg-white">
              <CardContent className="p-6">
                <div className="mb-5 h-5 w-40 animate-pulse rounded bg-gray-200" />
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, row) => (
                    <div key={`vendor-entry-row-${row}`} className="grid grid-cols-5 gap-3">
                      {Array.from({ length: 5 }).map((__, col) => (
                        <div key={`vendor-entry-cell-${row}-${col}`} className="h-4 animate-pulse rounded bg-gray-200" />
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function VendorPasswordResetPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = String(searchParams.get('email') ?? '').trim().toLowerCase();
  const token = String(searchParams.get('token') ?? '').trim();
  const [state, setState] = useState<VerifyState>('checking');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const logoSrc = getBrandLogoSrc();
  const logoAlt = renderTemplate(siteConfig.branding.logo.altTextTemplate || '{{siteName}} Logo');

  useEffect(() => {
    let cancelled = false;

    const verifyLink = async () => {
      if (!email || !token) {
        if (!cancelled) {
          setState('invalid');
          setError('El enlace no es válido o está incompleto.');
        }
        return;
      }

      try {
        const response = await fetch('/api/vendor/password-reset/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, token }),
        });
        const json = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(json?.error || 'El enlace no es válido o ya expiró.');
        }

        if (!cancelled) {
          setState('ready');
          setError(null);
        }
      } catch (verifyError) {
        if (!cancelled) {
          setState('invalid');
          setError(verifyError instanceof Error ? verifyError.message : 'El enlace no es válido o ya expiró.');
        }
      }
    };

    void verifyLink();

    return () => {
      cancelled = true;
    };
  }, [email, token]);

  const passwordRules = useMemo(() => validatePassword(password), [password]);
  const strengthScore = useMemo(() => getStrengthScore(password), [password]);
  const canSubmit =
    state === 'ready' &&
    !submitting &&
    Object.values(passwordRules).every(Boolean) &&
    password.length > 0 &&
    password === passwordConfirm;

  const submit = async () => {
    if (!canSubmit) {
      toast.error('Revisá la contraseña y su confirmación.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/vendor/password-reset/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          token,
          password,
        }),
      });
      const json = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(json?.error || 'No se pudo restablecer la contraseña.');
      }

      setState('signing-in');
      setError(null);
      const auth = getAuthInstance();
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/vendedor');
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'No se pudo restablecer la contraseña.';
      setState('ready');
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'signing-in') {
    return <VendorDashboardEntrySkeleton logoSrc={logoSrc} logoAlt={logoAlt} />;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F3FCFD_0%,#FFFFFF_45%,#F5FAFF_100%)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-xl items-center justify-center">
        <Card className="w-full overflow-hidden rounded-[30px] border border-white/80 bg-white/95 shadow-[0_32px_90px_rgba(15,23,42,0.16)] backdrop-blur-xl">
          <CardContent className="p-6 sm:p-8">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2BB8BF] p-3 shadow-[0_16px_34px_rgba(43,184,191,0.28)]">
                {isRemoteUrl(logoSrc) ? (
                  <img src={logoSrc} alt={logoAlt} className="h-full w-full object-contain" />
                ) : (
                  <Image src={logoSrc} alt={logoAlt} width={48} height={48} className="h-full w-full object-contain" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2BB8BF]">Portal de vendedores</p>
                <h1 className="text-2xl font-black tracking-[-0.03em] text-[#072852]">Restablecer contraseña</h1>
                <p className="text-sm leading-6 text-[#5D7695]">
                  Validamos el enlace y te guiamos para generar una contraseña nueva, segura y de uso inmediato.
                </p>
              </div>
            </div>

            <div className="mb-6 grid gap-2 sm:grid-cols-3">
              <div className={`rounded-2xl border px-4 py-3 text-left ${state === 'checking' ? 'border-[#BCECF0] bg-[#F3FDFE]' : 'border-[#E3EDF7] bg-[#F9FCFF]'}`}>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6B86A5]">1</div>
                <div className="mt-1 text-sm font-semibold text-[#0B2A52]">Verificación</div>
              </div>
              <div className={`rounded-2xl border px-4 py-3 text-left ${state === 'ready' ? 'border-[#BCECF0] bg-[#F3FDFE]' : 'border-[#E3EDF7] bg-[#F9FCFF]'}`}>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6B86A5]">2</div>
                <div className="mt-1 text-sm font-semibold text-[#0B2A52]">Nueva contraseña</div>
              </div>
              <div className="rounded-2xl border border-[#E3EDF7] bg-[#F9FCFF] px-4 py-3 text-left">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6B86A5]">3</div>
                <div className="mt-1 text-sm font-semibold text-[#0B2A52]">Acceso recuperado</div>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {state === 'checking' ? (
                <motion.div key="checking" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="rounded-3xl border border-[#D8EAF5] bg-[#FAFDFF] p-6 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#2BB8BF]" />
                  <div className="mt-4 text-lg font-black tracking-[-0.02em] text-[#072852]">Verificando enlace seguro</div>
                  <p className="mt-2 text-sm leading-6 text-[#607A99]">
                    Estamos comprobando que el token siga vigente y pertenezca al email registrado.
                  </p>
                </motion.div>
              ) : null}

              {state === 'invalid' ? (
                <motion.div key="invalid" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="rounded-3xl border border-red-200 bg-red-50 p-6">
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-red-500 shadow-sm">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg font-black tracking-[-0.02em] text-red-800">Enlace inválido o vencido</div>
                      <p className="mt-2 text-sm leading-6 text-red-700">
                        {error || 'El enlace ya no se puede usar. Solicitá uno nuevo desde “Olvidé mi contraseña”.'}
                      </p>
                    </div>
                  </div>
                  <Button asChild className="mt-5 h-11 w-full rounded-2xl bg-[#2BB8BF] font-semibold text-white hover:bg-[#25A6AD]">
                    <Link href="/vendedor/login">Volver al login</Link>
                  </Button>
                </motion.div>
              ) : null}

              {state === 'ready' ? (
                <motion.div key="ready" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                  <div className="rounded-3xl border border-[#D9F4E8] bg-[#F6FFF9] p-4">
                    <div className="flex items-start gap-3">
                      <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1C9A59] shadow-sm">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-base font-black tracking-[-0.02em] text-[#155B41]">Enlace verificado</div>
                        <p className="mt-1 text-sm leading-6 text-[#4D7B64]">
                          Ya podés crear una nueva contraseña para <strong>{email}</strong>.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vendor-new-password" className="text-sm font-semibold text-[#0B2A52]">
                      Nueva contraseña
                    </Label>
                    <div className="relative">
                      <Input id="vendor-new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Generá una contraseña segura" className="h-12 rounded-2xl border-[#D7E6F5] bg-[#F9FCFF] px-4 pr-12 text-base transition focus-visible:border-[#2BB8BF] focus-visible:ring-[#2BB8BF]/20" />
                      <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[#6783A3] transition hover:bg-[#EEF6FF] hover:text-[#214A7A]" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vendor-new-password-confirm" className="text-sm font-semibold text-[#0B2A52]">
                      Confirmar contraseña
                    </Label>
                    <div className="relative">
                      <Input id="vendor-new-password-confirm" type={showPasswordConfirm ? 'text' : 'password'} autoComplete="new-password" value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} placeholder="Repetí la contraseña" className="h-12 rounded-2xl border-[#D7E6F5] bg-[#F9FCFF] px-4 pr-12 text-base transition focus-visible:border-[#2BB8BF] focus-visible:ring-[#2BB8BF]/20" />
                      <button type="button" onClick={() => setShowPasswordConfirm((value) => !value)} className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-[#6783A3] transition hover:bg-[#EEF6FF] hover:text-[#214A7A]" aria-label={showPasswordConfirm ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}>
                        {showPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[#D8EAF5] bg-[#FAFDFF] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[#0B2A52]">Seguridad de la contraseña</div>
                      <div className="text-xs font-semibold text-[#5E7898]">{strengthScore}/4</div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#E5EEF7]">
                      <div className={`h-full rounded-full transition-all ${strengthScore >= 4 ? 'bg-emerald-500' : strengthScore >= 3 ? 'bg-amber-500' : 'bg-[#2BB8BF]'}`} style={{ width: `${Math.max(18, strengthScore * 25)}%` }} />
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {[
                        { ok: passwordRules.minLength, label: 'Mínimo 8 caracteres' },
                        { ok: passwordRules.hasLetters, label: 'Incluye letras' },
                        { ok: passwordRules.hasNumbers, label: 'Incluye números' },
                        { ok: passwordRules.hasSpecial, label: 'Incluye símbolo especial' },
                      ].map((rule) => (
                        <div key={rule.label} className={`rounded-2xl border px-3 py-2 text-sm ${rule.ok ? 'border-[#CDEFD8] bg-[#F6FFF9] text-[#155B41]' : 'border-[#E3EDF7] bg-white text-[#627D9D]'}`}>
                          {rule.label}
                        </div>
                      ))}
                    </div>
                    {passwordConfirm && password !== passwordConfirm ? (
                      <p className="mt-3 text-sm text-red-600">Las contraseñas no coinciden.</p>
                    ) : null}
                  </div>

                  {error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {error}
                    </div>
                  ) : null}

                  <Button type="button" onClick={() => void submit()} disabled={!canSubmit} className="h-12 w-full rounded-2xl bg-[#2BB8BF] text-base font-semibold text-white shadow-[0_14px_28px_rgba(43,184,191,0.24)] hover:bg-[#25A6AD]">
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando nueva contraseña...
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Confirmar nueva contraseña
                      </>
                    )}
                  </Button>
                </motion.div>
              ) : null}

            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
