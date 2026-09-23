'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type VendorPasswordResetRequestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEmail?: string;
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());
}

export default function VendorPasswordResetRequestDialog({
  open,
  onOpenChange,
  initialEmail = '',
}: VendorPasswordResetRequestDialogProps) {
  const [email, setEmail] = useState(initialEmail);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail(initialEmail);
    setSubmitting(false);
    setSubmitted(false);
  }, [initialEmail, open]);

  const canSubmit = useMemo(() => isValidEmail(email) && !submitting, [email, submitting]);

  const requestReset = async () => {
    if (!isValidEmail(email)) {
      toast.error('Ingresá un email válido.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/vendor/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!response.ok) {
        throw new Error('request-failed');
      }

      setSubmitted(true);
    } catch {
      toast.error('No pudimos procesar la solicitud en este momento.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-[#CDECEF] bg-white/95 p-0 shadow-[0_28px_90px_rgba(15,23,42,0.20)] backdrop-blur-xl sm:max-w-lg">
        <div className="bg-[linear-gradient(135deg,#F5FEFF_0%,#FFFFFF_48%,#F7FBFF_100%)] px-5 py-5 sm:px-6">
          <DialogHeader className="text-left">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E7FBFC] text-[#2BB8BF] shadow-[0_12px_24px_rgba(43,184,191,0.16)]">
              <Mail className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-black tracking-[-0.02em] text-[#072852]">
              Recuperar acceso
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-[#56718E]">
              Te vamos a enviar un enlace seguro para que generes tu nueva contraseña sin depender del soporte manual.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#D9EDF8] bg-[#F8FCFF] px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6B86A5]">Paso 1</div>
              <div className="mt-1 text-sm font-semibold text-[#0B2A52]">Confirmá tu email</div>
              <div className="mt-1 text-xs text-[#6882A3]">Usamos el correo registrado del vendedor.</div>
            </div>
            <div className="rounded-2xl border border-[#D9F4E8] bg-[#F7FFFB] px-4 py-3">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#4E8B6A]">Paso 2</div>
              <div className="mt-1 text-sm font-semibold text-[#155B41]">Creá una nueva clave</div>
              <div className="mt-1 text-xs text-[#4B7D65]">El enlace expira en 1 hora por seguridad.</div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="submitted"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-3xl border border-[#BEECD2] bg-[#F5FFF8] p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E7FAEF] text-[#1F9B5A]">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-black tracking-[-0.02em] text-[#145B40]">
                      Solicitud enviada
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[#46745C]">
                      Si el correo está registrado y activo, va a recibir un enlace seguro para generar una nueva contraseña.
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#1A6A49] shadow-sm ring-1 ring-[#D7EFE0]">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Enlace temporal y de uso único
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="mt-5 h-11 w-full rounded-2xl bg-[#2BB8BF] font-semibold text-white hover:bg-[#25A6AD]"
                >
                  Entendido
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="vendor-reset-email" className="text-sm font-semibold text-[#0B2A52]">
                    Email registrado
                  </Label>
                  <Input
                    id="vendor-reset-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="vendedor@explorarg.ar"
                    className="h-12 rounded-2xl border-[#D7E6F5] bg-[#F9FCFF] px-4 text-base transition focus-visible:border-[#2BB8BF] focus-visible:ring-[#2BB8BF]/20"
                  />
                  <p className="text-xs leading-5 text-[#6A84A3]">
                    Solo necesitás confirmar el correo asociado a tu usuario para iniciar el proceso.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={() => void requestReset()}
                  disabled={!canSubmit}
                  className="h-12 w-full rounded-2xl bg-[#2BB8BF] text-base font-semibold text-white shadow-[0_14px_28px_rgba(43,184,191,0.24)] hover:bg-[#25A6AD]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando enlace...
                    </>
                  ) : (
                    'Enviar enlace seguro'
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
