'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Ticket, Users, MapPin, Phone, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addDoc, collection, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db, firebaseEnabled, getAuthInstance } from '@/lib/firebase';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getWhatsAppLink } from '@/lib/utils/whatsapp';
import type { Cliente, TicketPack } from '@/types';
import { onAuthStateChanged } from 'firebase/auth';

const formSchema = z.object({
  cantidadPersonas: z.number().min(1, 'La cantidad debe ser mayor a 0'),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  apellido: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  ciudad: z.string().min(2, 'La ciudad es requerida'),
  codigoPostal: z.string().min(3, 'El código postal es requerido'),
  telefono: z.string().min(8, 'El teléfono debe tener al menos 8 caracteres'),
  email: z.string().email('Email inválido'),
});

type FormData = z.infer<typeof formSchema>;

interface F1TicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  paqueteTitulo: string;
  paqueteSlug: string;
  ticket: TicketPack;
}

export default function F1TicketModal({ isOpen, onClose, paqueteTitulo, paqueteSlug, ticket }: F1TicketModalProps) {
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!mounted) return;
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen, mounted]);

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      cantidadPersonas: 1,
    },
  });

  useEffect(() => {
    if (!isOpen) return;
    if (!firebaseEnabled) return;
    const auth = getAuthInstance();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const setIfEmpty = (field: keyof FormData, value?: string | number) => {
        const current = getValues(field);
        if (!current && value !== undefined && value !== null && value !== '') {
          setValue(field, value as never);
        }
      };

      setIfEmpty('email', user.email || '');
      if (user.displayName) {
        const parts = user.displayName.split(' ');
        setIfEmpty('nombre', parts[0] || '');
        setIfEmpty('apellido', parts.slice(1).join(' ') || '');
      }

      try {
        const ref = doc(db, 'clientes', user.uid);
        const snapshot = await getDoc(ref);
        if (!snapshot.exists()) return;
        const cliente = snapshot.data() as Cliente;

        setIfEmpty('nombre', cliente.nombre || '');
        setIfEmpty('apellido', cliente.apellido || '');
        setIfEmpty('email', cliente.email);
        setIfEmpty('telefono', cliente.telefono);
        setIfEmpty('ciudad', cliente.ciudad);
        setIfEmpty('codigoPostal', cliente.codigoPostal);
        if (cliente.cantidadPersonas) {
          setIfEmpty('cantidadPersonas', cliente.cantidadPersonas);
        }
      } catch (error) {
        console.error('Error loading cliente profile:', error);
      }
    });

    return () => unsubscribe();
  }, [isOpen, getValues, setValue]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const message = `F1 - ${paqueteTitulo} | Pack: ${ticket.titulo} | Cantidad de personas: ${data.cantidadPersonas}`;

      if (!firebaseEnabled) {
        reset();
        onClose();
        window.open(getWhatsAppLink(message), '_blank');
        toast.success('¡Listo!', {
          description: 'Abrimos WhatsApp para enviar tu consulta.',
        });
        return;
      }

      await addDoc(collection(db, 'consultas'), {
        nombre: data.nombre,
        apellido: data.apellido,
        nombreCompleto: `${data.nombre} ${data.apellido}`.trim(),
        email: data.email,
        telefono: data.telefono,
        ciudad: data.ciudad,
        codigoPostal: data.codigoPostal,
        cantidadPersonas: data.cantidadPersonas,
        paquete: `F1 - ${paqueteTitulo}`,
        paqueteId: paqueteSlug,
        packTitulo: ticket.titulo,
        ticketId: ticket.id,
        mensaje: message,
        fechaCreacion: Timestamp.now(),
        leida: false,
      });

      toast.success('¡Consulta enviada!', {
        description: 'Te contactaremos a la brevedad.',
      });

      reset();
      onClose();
      window.open(getWhatsAppLink(message), '_blank');
    } catch (error) {
      console.error('Error al enviar consulta:', error);
      toast.error('Error al enviar la consulta');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            style={{ zIndex: 9999 }}
            onClick={onClose}
          />

          <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-gray-100 ring-1 ring-primary/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative">
                <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-r from-primary/20 via-white to-secondary/15" />
                <div className="relative px-4 pt-4 pb-3 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        <Ticket className="h-3 w-3" />
                        Ticket seleccionado
                      </p>
                      <h2 className="text-base font-semibold text-gray-900 mt-1">Seleccionar ticket</h2>
                      <p className="text-xs text-gray-600 mt-0.5">{ticket.titulo}</p>
                    </div>
                    <button
                      onClick={onClose}
                      className="cursor-pointer rounded-full border border-gray-200 p-1.5 text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
                      aria-label="Cerrar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="px-4 pb-4 pt-3 space-y-3">
                  <div className="rounded-xl border border-gray-200 bg-white/90 p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-700 mb-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Users className="h-3 w-3" />
                      </span>
                      Datos para la consulta
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-2.5">
                      <div>
                        <Label className="text-[11px] font-semibold text-gray-900">Cantidad de personas *</Label>
                        <div
                          className={`mt-1.5 flex items-center rounded-md border bg-white ${
                            errors.cantidadPersonas ? 'border-red-500' : 'border-gray-200'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const current = getValues('cantidadPersonas') || 1;
                              setValue('cantidadPersonas', Math.max(1, current - 1));
                            }}
                            disabled={loading}
                            className="h-7 w-7 text-gray-600 hover:text-gray-900 disabled:opacity-50"
                            aria-label="Disminuir cantidad"
                          >
                            -
                          </button>
                          <Input
                            type="number"
                            {...register('cantidadPersonas', { valueAsNumber: true })}
                            className={`h-7 border-0 text-[9px] text-center shadow-none focus-visible:ring-0 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                              errors.cantidadPersonas ? 'text-red-600' : ''
                            }`}
                            disabled={loading}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const current = getValues('cantidadPersonas') || 1;
                              setValue('cantidadPersonas', current + 1);
                            }}
                            disabled={loading}
                            className="h-7 w-7 text-gray-600 hover:text-gray-900 disabled:opacity-50"
                            aria-label="Aumentar cantidad"
                          >
                            +
                          </button>
                        </div>
                        {errors.cantidadPersonas && (
                          <p className="text-red-500 text-[11px] mt-1">{errors.cantidadPersonas.message}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold text-gray-900">Ciudad *</Label>
                        <div className="relative mt-1.5">
                          <MapPin className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                          <Input
                            {...register('ciudad')}
                            className={`h-7 px-2 pl-7 text-[9px] bg-white ${errors.ciudad ? 'border-red-500' : ''}`}
                            disabled={loading}
                          />
                        </div>
                        {errors.ciudad && <p className="text-red-500 text-[11px] mt-1">{errors.ciudad.message}</p>}
                      </div>

                      <div>
                        <Label className="text-[11px] font-semibold text-gray-900">Código postal *</Label>
                        <div className="relative mt-1.5">
                          <MapPin className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                          <Input
                            {...register('codigoPostal')}
                            className={`h-7 px-2 pl-7 text-[9px] bg-white ${errors.codigoPostal ? 'border-red-500' : ''}`}
                            disabled={loading}
                          />
                        </div>
                        {errors.codigoPostal && (
                          <p className="text-red-500 text-[11px] mt-1">{errors.codigoPostal.message}</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-[11px] font-semibold text-gray-900">Número de contacto *</Label>
                        <div className="relative mt-1.5">
                          <Phone className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                          <Input
                            {...register('telefono')}
                            className={`h-7 px-2 pl-7 text-[9px] bg-white ${errors.telefono ? 'border-red-500' : ''}`}
                            disabled={loading}
                          />
                        </div>
                        {errors.telefono && <p className="text-red-500 text-[11px] mt-1">{errors.telefono.message}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white/90 p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-700 mb-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary/20 text-secondary">
                        <User className="h-3 w-3" />
                      </span>
                      Tus datos
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-2.5">
                      <div>
                        <Label className="text-[11px] font-semibold text-gray-900">Nombre *</Label>
                        <div className="relative mt-1.5">
                          <User className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                          <Input
                            {...register('nombre')}
                            className={`h-7 px-2 pl-7 text-[9px] ${errors.nombre ? 'border-red-500' : ''}`}
                            disabled={loading}
                          />
                        </div>
                        {errors.nombre && <p className="text-red-500 text-[11px] mt-1">{errors.nombre.message}</p>}
                      </div>
                      
                      <div>
                        <Label className="text-[11px] font-semibold text-gray-900">Apellido *</Label>
                        <div className="relative mt-1.5">
                          <User className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                          <Input
                            {...register('apellido')}
                            className={`h-7 px-2 pl-7 text-[9px] ${errors.apellido ? 'border-red-500' : ''}`}
                            disabled={loading}
                          />
                        </div>
                        {errors.apellido && <p className="text-red-500 text-[11px] mt-1">{errors.apellido.message}</p>}
                      </div>

                      <div className="md:col-span-2">
                        <Label className="text-[11px] font-semibold text-gray-900">Email de contacto *</Label>
                        <div className="relative mt-1.5">
                          <Mail className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                          <Input
                            type="email"
                            {...register('email')}
                            className={`h-7 px-2 pl-7 text-[9px] ${errors.email ? 'border-red-500' : ''}`}
                            disabled={loading}
                          />
                        </div>
                        {errors.email && <p className="text-red-500 text-[11px] mt-1">{errors.email.message}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onClose}
                      disabled={loading}
                      className="flex-1 h-9 text-xs border-gray-200 bg-white hover:bg-gray-50 rounded-full"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      variant="success"
                      className="flex-1 h-9 text-xs shadow-sm rounded-full"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        'Enviar'
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
