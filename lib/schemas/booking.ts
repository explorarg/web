import { z } from 'zod';

const bookingDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  capacity: z.number().int().min(0),
  enabled: z.boolean(),
});

export const bookingConfigSchema = z
  .object({
    enabled: z.boolean(),
    title: z.string().max(200).default(''),
    subtitle1: z.string().max(400).default(''),
    subtitle2: z.string().max(400).default(''),
    hasSpecificDates: z.boolean(),
    dates: z.array(bookingDateSchema),
    depositAmount: z.number().min(0),
    maxPeoplePerBooking: z.number().int().min(1).max(50).optional(),
    currency: z.enum(['ars', 'brl', 'usd']).default('ars'),
    paymentMethods: z.object({
      mercadoPago: z.boolean(),
    }),
    referralCommission: z
      .object({
        type: z.enum(['percent', 'fixed']),
        value: z.number().min(0),
        currency: z.enum(['ars', 'brl', 'usd']),
      })
      .optional(),
  })
  .refine(
    (data) => data.paymentMethods.mercadoPago,
    { message: 'Elegí qué opciones mostrar en el checkout (al menos una)', path: ['paymentMethods'] }
  )
  .refine(
    (data) => {
      if (!data.hasSpecificDates) return true;
      const dates = data.dates.map((d) => d.date);
      return new Set(dates).size === dates.length;
    },
    { message: 'No se permiten fechas duplicadas', path: ['dates'] }
  )
  .refine(
    (data) => {
      return data.dates.every((d) => !d.enabled || d.capacity >= 1);
    },
    { message: 'Capacity mínimo 1 si la fecha está habilitada', path: ['dates'] }
  );

export type BookingConfigInput = z.infer<typeof bookingConfigSchema>;
