// Datos de paquete por defecto para landing pages
// TODO: Reemplazar con datos reales de Firestore

import type { Paquete } from '@/types';

export const paquete = {
  id: 'riodejaneiro',
  titulo: 'Rio de Janeiro',
  slug: 'riodejaneiro',
  descripcion: 'Paquete turístico a Rio de Janeiro',
  descripcionCorta: 'Descubrí la magia de Rio',
  descripcionLarga: 'Viví una experiencia única en Rio de Janeiro',
  precio: 500000,
  moneda: 'ARS',
  tipo: 'internacional',
  imagenCard: '/images/riodejaneiro.jpg',
  imagenes: [],
  faqs: [],
  bookingConfig: {
    enabled: true,
    title: 'Rio de Janeiro',
    subtitle1: 'Reservá tu lugar',
    subtitle2: '',
    hasSpecificDates: true,
    currency: 'ars',
    depositAmount: 50000,
    paymentMethods: {
      mercadoPago: true,
    },
  },
} as any;

// Legacy export for backward compatibility
export const experience = {
  id: paquete.id,
  slug: paquete.slug,
  title: paquete.titulo,
  subtitle: paquete.descripcionCorta,
  cardImage: paquete.imagenCard,
  images: paquete.imagenes,
  maxPeople: paquete.bookingConfig?.maxPeoplePerBooking ?? 10,
  galleryIntro: paquete.descripcionCorta,
  dividerPhrase: paquete.descripcionCorta,
  calendarIntro: paquete.descripcionCorta,
  reservationMicrocopy: paquete.descripcionLarga,
  faqs: paquete.faqs?.map((f: any, i: number) => ({
    id: String(i),
    question: f.pregunta ?? f.question ?? '',
    answer: f.respuesta ?? f.answer ?? '',
  })) ?? [],
  bookingConfig: paquete.bookingConfig,
  // Extra properties
  supportText: paquete.descripcionCorta,
  topNoticeText: '',
  videoOverlayText: '',
  includes: [],
  highlights: [],
  itinerary: [],
  testimonials: [],
  headerImage: paquete.imagenCard,
  takeaways: [],
  forWho: [],
  notForWho: [],
};
