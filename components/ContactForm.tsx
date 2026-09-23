'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  categoria: z.enum(['soporte', 'ventas', 'informacion', 'otro'], {
    required_error: 'Selecciona una categoría',
  }),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100, 'El nombre es demasiado largo'),
  email: z.string().email('Email inválido'),
  asunto: z.string().min(5, 'El asunto debe tener al menos 5 caracteres').max(200, 'El asunto es demasiado largo'),
  mensaje: z.string().min(10, 'El mensaje debe tener al menos 10 caracteres').max(2000, 'El mensaje es demasiado largo'),
  referencia: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ContactFormProps {
  showTitle?: boolean;
  paqueteTitulo?: string;
  paqueteId?: string;
  compact?: boolean;
  minimal?: boolean;
}

const MINIMAL_FIELD =
  'h-12 w-full rounded-none border-0 border-b border-[#E4EDF6] bg-transparent px-0 text-sm text-[#112B49] shadow-none transition-colors placeholder:text-[#C2CCD6] focus-visible:border-[#2BB8BF] focus-visible:ring-0';
const MINIMAL_LABEL = 'text-[10px] font-bold uppercase tracking-[0.16em] text-[#A6B2C0]';
const DEFAULT_FIELD =
  'h-9 md:h-10 w-full rounded-xl border-gray-200 bg-gray-50/70 text-xs focus:border-primary focus:ring-primary/30';
const DEFAULT_LABEL = 'text-xs font-medium text-gray-900';

export default function ContactForm({
  showTitle = false,
  paqueteTitulo,
  paqueteId,
  compact = false,
  minimal = false,
}: ContactFormProps) {
  const [loading, setLoading] = useState(false);
  const fieldClass = minimal ? MINIMAL_FIELD : DEFAULT_FIELD;
  const labelClass = minimal ? MINIMAL_LABEL : DEFAULT_LABEL;

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      categoria: 'informacion',
      ...(paqueteTitulo && { asunto: `Consulta sobre: ${paqueteTitulo}` }),
    },
  });

  const categoria = watch('categoria');

  // Determine which additional fields to show based on category
  const showReferencia = categoria === 'soporte' || categoria === 'ventas';

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const response = await fetch('/api/contacto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          ...(paqueteId && { paqueteId }),
          ...(paqueteTitulo && { paqueteTitulo }),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al enviar el mensaje');
      }

      toast.success('¡Mensaje enviado!', {
        description: 'Te responderemos a la brevedad.',
      });

      reset();
    } catch (error) {
      console.error('Error al enviar el formulario:', error);
      toast.error('Error al enviar el mensaje', {
        description: 'Por favor, intenta nuevamente.',
      });
    } finally {
      setLoading(false);
    }
  };

  const getCategoriaLabel = (value: string) => {
    const labels: Record<string, string> = {
      soporte: 'Soporte técnico',
      ventas: 'Ventas',
      informacion: 'Información general',
      otro: 'Otro',
    };
    return labels[value] || value;
  };

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardContent className="p-0">
        <form onSubmit={handleSubmit(onSubmit)} className={minimal ? 'space-y-7' : `space-y-4 ${compact ? 'md:space-y-4' : 'md:space-y-5'}`}>
          {/* Categoría Select */}
          <div className="space-y-2">
            <Label htmlFor="categoria" className={labelClass}>
              Tipo de consulta
            </Label>
            <Controller
              name="categoria"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="categoria" className={fieldClass}>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="soporte">Soporte técnico</SelectItem>
                    <SelectItem value="ventas">Ventas</SelectItem>
                    <SelectItem value="informacion">Información general</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.categoria && <p className="text-xs text-red-600">{errors.categoria.message}</p>}
          </div>

          {/* Nombre y Email */}
          <div className={minimal ? 'grid grid-cols-1 gap-7 md:grid-cols-2' : 'grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4'}>
            <div className="space-y-1">
              <Label htmlFor="nombre" className={labelClass}>
                Nombre completo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nombre"
                {...register('nombre')}
                placeholder="Tu nombre completo"
                className={fieldClass}
              />
              {errors.nombre && <p className="text-xs text-red-600 mt-1">{errors.nombre.message}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="email" className={labelClass}>
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="tu@email.com"
                className={fieldClass}
              />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
            </div>
          </div>

          {/* Asunto */}
          <div className="space-y-1">
            <Label htmlFor="asunto" className={labelClass}>
              Asunto <span className="text-red-500">*</span>
            </Label>
            <Input
              id="asunto"
              {...register('asunto')}
              placeholder="Asunto del mensaje"
              className={fieldClass}
            />
            {errors.asunto && <p className="text-xs text-red-600 mt-1">{errors.asunto.message}</p>}
          </div>

          {/* Conditional fields based on category */}
          {showReferencia && (
            <div className="space-y-1">
              <Label htmlFor="referencia" className={labelClass}>
                {categoria === 'soporte' ? 'Número de reserva o ticket' : 'Referencia (opcional)'}
              </Label>
              <Input
                id="referencia"
                {...register('referencia')}
                placeholder={categoria === 'soporte' ? 'Ej: RES-1234' : 'Referencia adicional'}
                className={fieldClass}
              />
            </div>
          )}

          {/* Mensaje */}
          <div className="space-y-1">
            <Label htmlFor="mensaje" className={labelClass}>
              Mensaje <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="mensaje"
              {...register('mensaje')}
              placeholder="Escribe tu mensaje aquí..."
              rows={compact ? 4 : 5}
              className={
                minimal
                  ? 'w-full resize-none rounded-none border-0 border-b border-[#E4EDF6] bg-transparent px-0 py-3 text-sm text-[#112B49] shadow-none transition-colors placeholder:text-[#C2CCD6] focus-visible:border-[#2BB8BF] focus-visible:ring-0'
                  : 'w-full rounded-xl border-gray-200 bg-gray-50/70 focus:border-primary focus:ring-primary/30 resize-none text-xs py-2.5'
              }
            />
            {errors.mensaje && <p className="text-xs text-red-600 mt-1">{errors.mensaje.message}</p>}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            variant={minimal ? 'default' : 'success'}
            className={
              minimal
                ? 'h-12 w-full rounded-full bg-[#2BB8BF] text-sm font-semibold text-white shadow-none transition-colors hover:bg-[#22A9B0] sm:w-auto sm:px-10'
                : 'h-10 md:h-11 w-full rounded-xl text-sm font-semibold shadow-lg transition-all hover:shadow-xl'
            }
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              'Enviar mensaje'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
