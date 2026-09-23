'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import VendorPasswordResetRequestDialog from '@/components/vendor/VendorPasswordResetRequestDialog';
import { Eye, EyeOff, Loader2, AlertTriangle, Lock } from 'lucide-react';
import { collection, doc, getDocs, limit, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { getBrandLogoSrc, isRemoteUrl, renderTemplate, siteConfig } from '@/lib/siteConfig';

export default function VendorLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [mustChangeOpen, setMustChangeOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [vendorDocId, setVendorDocId] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const logoSrc = getBrandLogoSrc();
  const logoAlt = renderTemplate(siteConfig.branding.logo.altTextTemplate || '{{siteName}} Logo');

  useEffect(() => {
    const check = async () => {
      if (user && user.email) {
        const q = query(collection(db, 'vendors'), where('email', '==', user.email), limit(1));
        const snap = await getDocs(q);
        if (snap.docs[0]) router.replace('/vendedor');
      }
    };
    check();
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const auth = getAuthInstance();
      await signInWithEmailAndPassword(auth, email.trim(), password);
      const q = query(collection(db, 'vendors'), where('email', '==', email.trim()), limit(1));
      const snap = await getDocs(q);
      const d0 = snap.docs[0];
      if (!d0 || !(d0.data() as any).active) {
        try {
          await getAuthInstance().signOut?.();
        } catch {}
        toast.error('No estás autorizado como vendedor');
        return;
      }
      setVendorDocId(d0.id);
      const must = Boolean((d0.data() as any).mustChangePassword);
      if (must) {
        setMustChangeOpen(true);
      } else {
        router.replace('/vendedor');
      }
    } catch (error) {
      let description = 'Error de autenticación';
      if (error && typeof error === 'object' && 'code' in error) {
        const code = (error as any).code as string;
        switch (code) {
          case 'auth/invalid-credential':
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            description = 'Email o contraseña incorrectos';
            break;
          case 'auth/invalid-api-key':
            description = 'Configuración de Firebase inválida (API key)';
            break;
          case 'auth/user-disabled':
            description = 'Cuenta deshabilitada';
            break;
          case 'auth/network-request-failed':
            description = 'Error de conexión. Verificá tu internet';
            break;
          default:
            description = 'No se pudo iniciar sesión';
        }
        // eslint-disable-next-line no-console
        console.warn('[VendorLogin] auth error:', code);
      }
      toast.error(description);
    } finally {
      setLoading(false);
    }
  };

  const pwdStrength = (val: string) => {
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[a-z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    return score;
  };

  const handleChangePassword = async () => {
    const v1 = newPwd.trim();
    const v2 = newPwd2.trim();
    if (v1 !== v2) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (pwdStrength(v1) < 4) {
      toast.error('La contraseña debe ser fuerte (8+, may/min, número y símbolo)');
      return;
    }
    try {
      const auth = getAuthInstance();
      if (!auth.currentUser) {
        toast.error('Sesión no disponible');
        return;
      }
      await updatePassword(auth.currentUser, v1);
      if (vendorDocId) {
        await updateDoc(doc(db, 'vendors', vendorDocId), { mustChangePassword: false });
      }
      toast.success('Contraseña actualizada');
      setMustChangeOpen(false);
      router.replace('/vendedor');
    } catch {
      toast.error('No se pudo actualizar la contraseña');
    }
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
                  <Image src={logoSrc} alt={logoAlt} width={48} height={48} className="h-full w-full object-contain" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#2BB8BF]">Vendedor</p>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Ingresar</h2>
              </div>
            </div>

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
                  placeholder="vendedor@explorarg.ar"
                  required
                  disabled={loading}
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
                    disabled={loading}
                    className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-4 pr-11 text-base shadow-none focus:border-[#2BB8BF] focus:ring-[#2BB8BF]/20 disabled:opacity-50"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    onClick={() => setShowPassword((v) => !v)}
                    disabled={loading}
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

              <Button
                type="submit"
                className="h-12 w-full rounded-2xl bg-[#2BB8BF] text-base font-semibold text-white shadow-[0_14px_28px_rgba(43,184,191,0.30)] transition hover:bg-[#26a8af]"
                disabled={loading}
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

            <div className="mt-4 text-center">
              <button
                className="text-sm font-medium text-[#2BB8BF] transition hover:text-[#26a8af]"
                onClick={() => setResetOpen(true)}
                disabled={loading}
              >
                Olvidé mi contraseña
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={mustChangeOpen} onOpenChange={(o) => o || setMustChangeOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Cambiar contraseña
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Debes establecer una contraseña nueva y segura para continuar.
            </p>
            <div className="space-y-2">
              <Label htmlFor="newPwd">Nueva contraseña</Label>
              <Input
                id="newPwd"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="********"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPwd2">Confirmar contraseña</Label>
              <Input
                id="newPwd2"
                type="password"
                value={newPwd2}
                onChange={(e) => setNewPwd2(e.target.value)}
                placeholder="********"
              />
            </div>
            <div className="h-2 bg-gray-100 rounded-md overflow-hidden">
              <div
                className={`h-full ${pwdStrength(newPwd) >= 4 ? 'bg-emerald-500' : 'bg-orange-500'} transition-all`}
                style={{ width: `${Math.min(100, pwdStrength(newPwd) * 20 + 20)}%` }}
              />
            </div>
            <ul className="text-[11px] text-gray-600 grid grid-cols-2 gap-x-3 gap-y-1">
              <li>• 8+ caracteres</li>
              <li>• Mayúscula y minúscula</li>
              <li>• Número</li>
              <li>• Símbolo</li>
            </ul>
          </div>
          <DialogFooter>
            <Button onClick={handleChangePassword} className="gap-2">
              Guardar y continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <VendorPasswordResetRequestDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        initialEmail={email}
      />
    </div>
  );
}
