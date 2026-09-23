'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { addDoc, collection, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db, getAuthInstance } from '@/lib/firebase';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { onAuthStateChanged } from 'firebase/auth';
import type { Cliente } from '@/types';

const formSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  apellido: z.string().min(2, 'El apellido debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  telefono: z.string().min(8, 'El teléfono debe tener al menos 8 caracteres'),
  mensaje: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres'),
});

type FormData = z.infer<typeof formSchema>;

interface ConsultaModalProps {
  isOpen: boolean;
  onClose: () => void;
  paqueteTitulo: string;
  paqueteId: string;
}

export default function ConsultaModal({ isOpen, onClose, paqueteTitulo, paqueteId }: ConsultaModalProps) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (!isOpen) return;
    const auth = getAuthInstance();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const setIfEmpty = (field: keyof FormData, value?: string) => {
        const current = getValues(field);
        if (!current && value) {
          setValue(field, value);
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
      } catch (error) {
        console.error('Error loading cliente profile:', error);
      }
    });

    return () => unsubscribe();
  }, [isOpen, getValues, setValue]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await addDoc(collection(db, 'consultas'), {
        nombre: data.nombre,
        apellido: data.apellido,
        nombreCompleto: `${data.nombre} ${data.apellido}`.trim(),
        email: data.email,
        telefono: data.telefono,
        mensaje: data.mensaje,
        paquete: paqueteTitulo,
        paqueteId: paqueteId,
        fechaCreacion: Timestamp.now(),
        leida: false,
      });

      toast.success('¡Consulta enviada!', {
        description: 'Te contactaremos a la brevedad.',
      });

      reset();
      onClose();
    } catch (error) {
      console.error('Error al enviar consulta:', error);
      toast.error('Error al enviar la consulta', {
        description: 'Por favor, intenta nuevamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Consultá sobre este paquete</h2>
                  <p className="text-base text-gray-600 mt-1">{paqueteTitulo}</p>
                </div>
                <button
                  onClick={onClose}
                  className="cursor-pointer text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
                {/* Nombre */}
                <div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nombre" className="text-base font-semibold text-gray-900">
                        Nombre *
                      </Label>
                      <Input
                        id="nombre"
                        {...register('nombre')}
                        className={`mt-2 ${errors.nombre ? 'border-red-500' : ''}`}
                        placeholder="Juan"
                        disabled={loading}
                      />
                      {errors.nombre && (
                        <p className="text-red-500 text-sm mt-1">{errors.nombre.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="apellido" className="text-base font-semibold text-gray-900">
                        Apellido *
                      </Label>
                      <Input
                        id="apellido"
                        {...register('apellido')}
                        className={`mt-2 ${errors.apellido ? 'border-red-500' : ''}`}
                        placeholder="Pérez"
                        disabled={loading}
                      />
                      {errors.apellido && (
                        <p className="text-red-500 text-sm mt-1">{errors.apellido.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="email" className="text-base font-semibold text-gray-900">
                    Email *
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    className={`mt-2 ${errors.email ? 'border-red-500' : ''}`}
                    placeholder="juan@ejemplo.com"
                    disabled={loading}
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                  )}
                </div>

                {/* Teléfono */}
                <div>
                  <Label htmlFor="telefono" className="text-base font-semibold text-gray-900">
                    Teléfono *
                  </Label>
                  <Input
                    id="telefono"
                    type="tel"
                    {...register('telefono')}
                    className={`mt-2 ${errors.telefono ? 'border-red-500' : ''}`}
                    placeholder="+54 11 1234-5678"
                    disabled={loading}
                  />
                  {errors.telefono && (
                    <p className="text-red-500 text-sm mt-1">{errors.telefono.message}</p>
                  )}
                </div>

                {/* Mensaje */}
                <div>
                  <Label htmlFor="mensaje" className="text-base font-semibold text-gray-900">
                    Mensaje *
                  </Label>
                  <Textarea
                    id="mensaje"
                    {...register('mensaje')}
                    className={`mt-2 min-h-[120px] ${errors.mensaje ? 'border-red-500' : ''}`}
                    placeholder="Contanos tu consulta sobre este paquete..."
                    disabled={loading}
                  />
                  {errors.mensaje && (
                    <p className="text-red-500 text-sm mt-1">{errors.mensaje.message}</p>
                  )}
                </div>

                {/* Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-base text-gray-600">
                    💡 Te responderemos a la brevedad por email o teléfono. Tus datos están seguros con nosotros.
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-black hover:bg-gray-800 text-white"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Enviar consulta
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

