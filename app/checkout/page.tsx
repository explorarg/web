import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getPaqueteBySlug, toBookingPublicData } from '@/lib/paquetes';
import CheckoutClient from '@/components/checkout/CheckoutClient';
import { CART_COOKIE_NAME } from '@/lib/cart/server';
import { CART_TERMS_COOKIE_NAME, hasAcceptedCartTerms } from '@/lib/cart/terms';

/** Sin caché: datos de experiencia y reserva siempre actualizados */
export const revalidate = 0;

type SearchParams = Promise<{ slug?: string; date?: string; people?: string; cart?: string }>;

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const slug = params.slug?.trim();
  const dateParam = params.date?.trim();
  const peopleParam = params.people?.trim();
  const isCartMode = params.cart === '1' || (!slug && !peopleParam);

  if (isCartMode) {
    const cookieStore = await cookies();
    const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;
    const termsCookie = cookieStore.get(CART_TERMS_COOKIE_NAME)?.value;
    if (!cartId) redirect('/carrito');
    if (!hasAcceptedCartTerms(termsCookie, cartId)) redirect('/carrito');
    return (
      <div className="min-h-screen bg-gray-50">
        <CheckoutClient mode="cart" cartId={cartId} />
      </div>
    );
  }
  if (!slug || !peopleParam) redirect('/');

  const people = parseInt(peopleParam, 10);
  if (isNaN(people) || people < 1 || people > 50) {
    redirect('/');
  }

  const paquete = await getPaqueteBySlug(slug);
  if (!paquete) {
    redirect('/');
  }

  // Mapeo temporal de paquete a formato Experience para compatibilidad con CheckoutClient
  const experience = {
    id: paquete.id,
    slug: paquete.slug,
    title: paquete.titulo,
    subtitle: paquete.subtitulo ?? '',
    cardImage: paquete.imagenCard ?? '',
    images: paquete.imagenes ?? [],
    maxPeople: paquete.bookingConfig?.maxPeoplePerBooking ?? paquete.capacidadMaxima ?? 10,
    galleryIntro: paquete.descripcionCorta ?? '',
    dividerPhrase: paquete.subtitulo ?? '',
    calendarIntro: paquete.descripcionCorta ?? '',
    reservationMicrocopy: paquete.descripcionLarga ?? '',
    faqs: paquete.faqs?.map((f, i) => ({
      id: String(i),
      question: (f as any).pregunta ?? (f as any).question ?? '',
      answer: (f as any).respuesta ?? (f as any).answer ?? '',
    })) ?? [],
    bookingConfig: paquete.bookingConfig as any,
    roomTypes: paquete.roomTypes,
    roomTypeOptions: paquete.roomTypeOptions,
    supportText: paquete.descripcionCorta ?? '',
    topNoticeText: '',
    videoOverlayText: '',
    includes: [],
    highlights: [],
    itinerary: [],
    testimonials: [],
    headerImage: paquete.imagenCard ?? '',
    takeaways: [],
    forWho: [],
    notForWho: [],
    salidas: paquete.salidas ?? [],
    gastosAdministrativos:
      typeof (paquete as any).gastosAdministrativos === 'number'
        ? (paquete as any).gastosAdministrativos
        : typeof (paquete as any).precioDescuentoPrimerosCupos === 'number'
          ? (paquete as any).precioDescuentoPrimerosCupos
          : 0,
  };

  const bookingData = toBookingPublicData(paquete as any, {});
  const maxPeople = bookingData?.maxPeoplePerBooking ?? experience.maxPeople ?? 50;
  if (people > maxPeople) {
    redirect(`/paquetes/${slug}`);
  }

  const hasSpecificDates = bookingData?.hasSpecificDates ?? true;
  const isNoDate = !dateParam || dateParam === 'sin-fecha';
  if (hasSpecificDates && isNoDate) {
    redirect(`/paquetes/${slug}`);
  }
  if (!hasSpecificDates && !isNoDate) {
    // Si no hay fechas específicas, ignorar date o normalizar a sin-fecha
  }
  const date = isNoDate ? 'sin-fecha' : dateParam;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (date !== 'sin-fecha' && !dateRegex.test(date)) {
    redirect('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CheckoutClient mode="legacy" experience={experience as any} date={date} people={people} />
    </div>
  );
}
