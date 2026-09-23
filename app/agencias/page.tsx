'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, LogOut, Shield, ExternalLink } from 'lucide-react';
import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';
import WhatsAppButton from '@/components/WhatsAppButton';
import { getAuthInstance, db } from '@/lib/firebase';
import { configureAuthPersistence } from '@/lib/auth/authConfig';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { getBrandLogoSrc, isRemoteUrl, renderTemplate, siteConfig } from '@/lib/siteConfig';

type AgenciesSettings = {
  sheetsEmbedUrl?: string;
  sheetsOpenUrl?: string;
  title?: string;
  subtitle?: string;
};

const DEFAULT_EMBED_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/pubhtml?widget=true&headers=false';

const fadeInUpVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] },
  },
};

const fadeInLeftVariants = {
  hidden: { opacity: 0, x: -50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] },
  },
};

const fadeInRightVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] },
  },
};

function safeGoogleUrl(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const allowedHosts = ['docs.google.com', 'drive.google.com'];
    if (!allowedHosts.includes(host)) return null;
    if (u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

async function loadAgenciesSettings(): Promise<AgenciesSettings | null> {
  const snap = await getDoc(doc(db, 'settings', 'agencias'));
  if (!snap.exists()) return null;
  const data = snap.data() as AgenciesSettings;
  return data ?? null;
}

export default function AgenciasPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [settings, setSettings] = useState<AgenciesSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  const logoSrc = getBrandLogoSrc();
  const logoAlt = useMemo(
    () => renderTemplate(siteConfig.branding.logo.altTextTemplate || '{{siteName}} Logo'),
    []
  );

  const title = settings?.title?.trim() || 'Portal de Agencias';
  const subtitle =
    settings?.subtitle?.trim() ||
    'Accedé a la información y recursos compartidos. Si necesitás acceso, pedíselo al equipo.';

  const embedUrl = useMemo(() => safeGoogleUrl(settings?.sheetsEmbedUrl) || DEFAULT_EMBED_URL, [settings?.sheetsEmbedUrl]);
  const openUrl = useMemo(() => safeGoogleUrl(settings?.sheetsOpenUrl) || null, [settings?.sheetsOpenUrl]);
  const showChrome = Boolean(user);

  useEffect(() => {
    const auth = getAuthInstance();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setSettingsLoading(true);
    loadAgenciesSettings()
      .then((data) => {
        if (!active) return;
        setSettings(data);
      })
      .catch(() => {
        toast.error('No pudimos cargar la configuración');
      })
      .finally(() => {
        if (!active) return;
        setSettingsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const auth = getAuthInstance();
      await configureAuthPersistence(auth, rememberMe);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      toast.success('Acceso concedido', { description: 'Sesión iniciada correctamente' });
      setPassword('');
    } catch (error) {
      let description = 'Verificá tus credenciales';
      if (error && typeof error === 'object' && 'code' in error) {
        const code = String((error as any).code || '');
        if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
          description = 'Email o contraseña incorrectos';
        } else if (code === 'auth/too-many-requests') {
          description = 'Demasiados intentos. Probá más tarde';
        } else if (code === 'auth/user-disabled') {
          description = 'Cuenta deshabilitada';
        } else if (code === 'auth/network-request-failed') {
          description = 'Error de conexión. Verificá tu internet';
        }
      }
      toast.error('No pudimos iniciar sesión', { description });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      const auth = getAuthInstance();
      await signOut(auth);
      toast.success('Sesión cerrada');
    } catch {
      toast.error('No pudimos cerrar sesión');
    }
  };

  return (
    <>
      {showChrome && <Navbar variant="homeMockup" reserveSpace />}
      {showChrome && <WhatsAppButton />}

      <main className={showChrome ? 'bg-white min-h-screen pt-32 md:pt-40' : 'bg-[#F9FAFB] min-h-screen'}>
        <section className={showChrome ? 'relative py-16 md:py-24 bg-[#F9FAFB] overflow-hidden' : 'relative py-10 md:py-16 bg-[#F9FAFB] overflow-hidden'}>
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[-18%] right-[8%] w-[520px] h-[520px] bg-primary/5 rounded-full blur-[120px] opacity-70" />
            <div className="absolute bottom-[-22%] left-[-10%] w-[560px] h-[560px] bg-secondary/5 rounded-full blur-[130px] opacity-70" />
          </div>

          <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10">
            {!authReady ? (
              <div className="flex items-center justify-center min-h-[50vh]">
                <div className="flex items-center gap-3 text-gray-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-base font-medium">Cargando…</span>
                </div>
              </div>
            ) : user ? (
              <motion.div initial="hidden" animate="visible" variants={fadeInUpVariants} className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 mb-3 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs md:text-sm font-bold tracking-widest uppercase shadow-[0_2px_10px_rgba(76,175,80,0.1)]">
                      <Shield className="h-4 w-4" />
                      Acceso privado
                    </div>
                    <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-[1.1]">
                      {title}
                    </h1>
                    <p className="mt-3 text-base md:text-lg text-gray-600 max-w-3xl leading-relaxed">{subtitle}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {openUrl && (
                      <Button asChild variant="secondary" className="bg-white hover:bg-gray-50 border border-gray-200">
                        <a href={openUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Abrir en Google
                        </a>
                      </Button>
                    )}
                    <Button onClick={handleLogout} className="bg-gray-900 hover:bg-gray-800 text-white">
                      <LogOut className="mr-2 h-4 w-4" />
                      Salir
                    </Button>
                    <div className="text-xs text-gray-500 sm:text-right">
                      <div className="font-semibold text-gray-700">Sesión</div>
                      <div className="truncate max-w-[260px]">{user.email || 'Usuario'}</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl overflow-hidden border border-secondary/30 bg-white/70 backdrop-blur-sm shadow-[0_20px_50px_rgb(0,0,0,0.08)]">
                  <div className="px-5 py-4 md:px-7 md:py-5 border-b border-gray-100 flex items-center justify-between">
                    <div className="text-sm md:text-base font-semibold text-gray-900">Hoja compartida</div>
                    {settingsLoading ? (
                      <div className="flex items-center gap-2 text-gray-500 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Actualizando…
                      </div>
                    ) : (
                      <div className="text-xs md:text-sm text-gray-500">Listo</div>
                    )}
                  </div>
                  <div className="relative w-full">
                    <div className="h-[72vh] min-h-[520px] w-full bg-white">
                      <iframe
                        title="Agencias - Google Sheets"
                        src={embedUrl}
                        className="w-full h-full"
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                className="mx-auto max-w-5xl"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                variants={fadeInUpVariants}
              >
                <Card className="rounded-3xl border border-secondary/30 shadow-[0_20px_50px_rgb(0,0,0,0.08)] overflow-hidden bg-white/80 backdrop-blur-sm py-0 gap-0">
                  <CardHeader className="px-6 md:px-8 py-6 border-b border-gray-100">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                          <Shield className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.24em] text-gray-500 font-bold">Agencias</div>
                          <div className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Ingresar</div>
                          <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                            Accedé con tu email y contraseña. Si no tenés credenciales, solicitá acceso al equipo.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="h-10 md:h-12 flex items-center shrink-0">
                          {isRemoteUrl(logoSrc) ? (
                            <img src={logoSrc} alt={logoAlt} className="h-full w-auto object-contain" />
                          ) : (
                            <Image
                              src={logoSrc}
                              alt={logoAlt}
                              width={176}
                              height={72}
                              className="h-full w-auto object-contain"
                            />
                          )}
                        </div>
                        <div className="hidden sm:block">
                          <div className="text-xs uppercase tracking-[0.24em] text-gray-500 font-bold">Portal</div>
                          <div className="text-sm font-semibold text-gray-900">{siteConfig.branding.siteName}</div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="px-0">
                    <div className="grid grid-cols-1 lg:grid-cols-2">
                      <motion.div className="p-6 md:p-8" variants={fadeInLeftVariants}>
                        <form onSubmit={handleLogin} className="space-y-5">
                          <div className="space-y-2">
                            <Label htmlFor="agencias-email">Email</Label>
                            <Input
                              id="agencias-email"
                              type="email"
                              autoComplete="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="tu@email.com"
                              className="h-11 rounded-xl border border-gray-200/80 bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-sm focus-visible:border-primary/40 focus-visible:ring-primary/20"
                              required
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="agencias-password">Contraseña</Label>
                            <div className="relative">
                              <Input
                                id="agencias-password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="********"
                                className="h-11 pr-11 rounded-xl border border-gray-200/80 bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-sm focus-visible:border-primary/40 focus-visible:ring-primary/20"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-800 transition"
                                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                              >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                              <Checkbox checked={rememberMe} onCheckedChange={(v) => setRememberMe(Boolean(v))} />
                              Recordarme
                            </label>
                            <div className="text-xs text-gray-500">Acceso protegido</div>
                          </div>

                          <Button
                            type="submit"
                            disabled={submitting}
                            className="w-full h-11 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl shadow-sm"
                          >
                            {submitting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Ingresando…
                              </>
                            ) : (
                              'Ingresar'
                            )}
                          </Button>
                        </form>

                        <div className="mt-6 rounded-2xl border border-gray-200 bg-white px-5 py-4">
                          <div className="text-sm font-semibold text-gray-900">¿No tenés acceso?</div>
                          <div className="text-sm text-gray-600 mt-1">
                            Pedí tus credenciales al equipo y te habilitamos el portal.
                          </div>
                        </div>
                      </motion.div>

                      <motion.div
                        className="relative p-6 md:p-8 border-t lg:border-t-0 lg:border-l border-gray-100 bg-gradient-to-b from-white to-[#F9FAFB]"
                        variants={fadeInRightVariants}
                      >
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute top-[-18%] right-[-10%] w-[380px] h-[380px] bg-primary/5 rounded-full blur-[110px] opacity-70" />
                          <div className="absolute bottom-[-22%] left-[-14%] w-[420px] h-[420px] bg-secondary/5 rounded-full blur-[120px] opacity-70" />
                        </div>

                        <div className="relative">
                          <div className="text-xs uppercase tracking-[0.24em] text-gray-500 font-bold">Ventajas</div>
                          <div className="mt-2 text-lg md:text-xl font-extrabold tracking-tight text-gray-900">
                            Todo lo que necesitás, en un solo lugar
                          </div>

                          <div className="mt-6 space-y-3">
                            <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm px-5 py-4">
                              <div className="text-sm font-semibold text-gray-900">Rápido</div>
                              <div className="text-sm text-gray-600 mt-1">Ingresá y accedé al material sin pasos extra.</div>
                            </div>
                            <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm px-5 py-4">
                              <div className="text-sm font-semibold text-gray-900">Seguro</div>
                              <div className="text-sm text-gray-600 mt-1">Acceso con email y contraseña unicos.</div>
                            </div>
                            <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur-sm px-5 py-4">
                              <div className="text-sm font-semibold text-gray-900">Centralizado</div>
                              <div className="text-sm text-gray-600 mt-1">Toda la información disponible y siempre actualizada.</div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </section>
      </main>

      {showChrome && <HomeFooter />}
    </>
  );
}
