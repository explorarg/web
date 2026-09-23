'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, AlertTriangle } from 'lucide-react';
import { SessionManager } from '@/lib/auth/sessionManager';
import { configureAuthPersistence, validateAdminDomain } from '@/lib/auth/authConfig';
import { useAuth } from '@/hooks/useAuth';
import { ADMIN_EMAIL } from '@/lib/constants';
import { getBrandLogoSrc, isRemoteUrl, renderTemplate, siteConfig } from '@/lib/siteConfig';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimeRemaining, setBlockTimeRemaining] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);
  const router = useRouter();
  const { user } = useAuth();
  const [sessionManager] = useState(() => SessionManager.getInstance());
  const logoSrc = getBrandLogoSrc();
  const logoAlt = renderTemplate(siteConfig.branding.logo.altTextTemplate || '{{siteName}} Logo');

  // Verificar si el usuario ya está autenticado
  useEffect(() => {
    if (user && user.email?.toLowerCase() === ADMIN_EMAIL) {
      router.replace('/admin');
    }
  }, [user, router]);

  // Verificar dominio permitido
  useEffect(() => {
    if (!validateAdminDomain()) {
      toast.error('Acceso no autorizado', {
        description: 'Este dominio no está autorizado para el panel admin',
      });
    }
  }, []);

  // Verificar bloqueo y actualizar timer
  useEffect(() => {
    const checkBlockStatus = () => {
      if (email) {
        const blocked = sessionManager.isUserBlocked(email);
        setIsBlocked(blocked);
        
        if (blocked) {
          const timeRemaining = sessionManager.getBlockTimeRemaining(email);
          setBlockTimeRemaining(timeRemaining);
        }
      }
    };

    checkBlockStatus();
    
    // Actualizar cada segundo si está bloqueado
    let interval: NodeJS.Timeout;
    if (isBlocked && blockTimeRemaining > 0) {
      interval = setInterval(() => {
        const timeRemaining = sessionManager.getBlockTimeRemaining(email);
        setBlockTimeRemaining(timeRemaining);
        
        if (timeRemaining <= 0) {
          setIsBlocked(false);
          setBlockTimeRemaining(0);
        }
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [email, isBlocked, blockTimeRemaining, sessionManager]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones de seguridad
    if (!validateAdminDomain()) {
      toast.error('Dominio no autorizado');
      return;
    }

    if (isBlocked) {
      const minutes = Math.ceil(blockTimeRemaining / 60000);
      toast.error('Cuenta temporalmente bloqueada', {
        description: `Intenta nuevamente en ${minutes} minuto(s)`,
      });
      return;
    }

    // Verificar tiempo mínimo entre intentos
    const now = Date.now();
    const timeSinceLastAttempt = now - lastAttemptTime;
    if (timeSinceLastAttempt < 3000 && lastAttemptTime > 0) {
      toast.warning('Espera un momento', {
        description: 'Debes esperar entre intentos de login',
      });
      return;
    }

    setLastAttemptTime(now);
    setLoading(true);

    try {
      // Obtener instancia de auth (lazy loading)
      const auth = getAuthInstance();
      
      // Configurar persistencia antes del login
      await configureAuthPersistence(auth, rememberMe);
      
      // Intentar login
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      
      // Registrar intento exitoso
      sessionManager.recordLoginAttempt(email, true);
      sessionManager.clearLoginAttempts(email);
      
      // Crear sesión
      sessionManager.createSession(userCredential.user, rememberMe);
      
      toast.success('¡Bienvenido!', {
        description: `Sesión iniciada ${rememberMe ? 'y guardada' : 'temporalmente'}`,
      });
      
      router.push('/admin');
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      
      // Registrar intento fallido
      sessionManager.recordLoginAttempt(email, false);
      
      // Determinar mensaje de error
      const errorMessage = 'Error al iniciar sesión';
      let errorDescription = 'Verifica tus credenciales';
      
      // Firebase Auth errors have a 'code' property
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as { code: string };
        switch (firebaseError.code) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            errorDescription = 'Email o contraseña incorrectos';
            break;
          case 'auth/too-many-requests':
            errorDescription = 'Demasiados intentos. Intenta más tarde';
            break;
          case 'auth/user-disabled':
            errorDescription = 'Cuenta deshabilitada';
            break;
          case 'auth/network-request-failed':
            errorDescription = 'Error de conexión. Verifica tu internet';
            break;
          default:
            errorDescription = 'Error de autenticación';
        }
      }
      
      toast.error(errorMessage, {
        description: errorDescription,
      });
      
      // Verificar si ahora está bloqueado
      const nowBlocked = sessionManager.isUserBlocked(email);
      if (nowBlocked) {
        setIsBlocked(true);
        const timeRemaining = sessionManager.getBlockTimeRemaining(email);
        setBlockTimeRemaining(timeRemaining);
        
        const minutes = Math.ceil(timeRemaining / 60000);
        toast.warning('Cuenta bloqueada temporalmente', {
          description: `Demasiados intentos fallidos. Intenta en ${minutes} minuto(s)`,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const formatBlockTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#2BB8BF] px-4 py-10">
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center">
        <Card className="w-full overflow-hidden rounded-[28px] border-0 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.20)]">
          <CardContent className="p-7 sm:p-8">
            <div className="mb-8 flex flex-col items-center text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#2BB8BF] p-3 shadow-[0_14px_34px_rgba(43,184,191,0.35)]">
                {isRemoteUrl(logoSrc) ? (
                  <img src={logoSrc} alt={logoAlt} className="h-full w-full object-contain" />
                ) : (
                  <Image
                    src={logoSrc}
                    alt={logoAlt}
                    width={48}
                    height={48}
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2BB8BF]">Admin</p>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Ingresar</h2>
              </div>
            </div>

            {isBlocked && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Acceso bloqueado</p>
                  <p className="mt-1 text-red-700">Probá de nuevo en {formatBlockTime(blockTimeRemaining)}.</p>
                </div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={ADMIN_EMAIL}
                  required
                  disabled={loading || isBlocked}
                  className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-4 text-base shadow-none focus:border-[#2BB8BF] focus:ring-[#2BB8BF]/20 disabled:opacity-50"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => setCapsLock((e as any).getModifierState?.('CapsLock') ?? false)}
                    onKeyUp={(e) => setCapsLock((e as any).getModifierState?.('CapsLock') ?? false)}
                    placeholder="••••••••"
                    required
                    disabled={loading || isBlocked}
                    className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-4 pr-11 text-base shadow-none focus:border-[#2BB8BF] focus:ring-[#2BB8BF]/20 disabled:opacity-50"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={loading || isBlocked}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {capsLock && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Bloq Mayús activado
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Label htmlFor="rememberMe" className="text-sm font-medium text-slate-700">
                  Mantener sesión
                </Label>
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  disabled={loading || isBlocked}
                  className="h-5 w-5 border-slate-300 data-[state=checked]:border-[#2BB8BF] data-[state=checked]:bg-[#2BB8BF]"
                />
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-2xl bg-[#2BB8BF] text-base font-semibold text-white shadow-[0_14px_28px_rgba(43,184,191,0.30)] transition hover:bg-[#26a8af]"
                disabled={loading || isBlocked}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Ingresando...
                  </>
                ) : (
                  'Ingresar'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
