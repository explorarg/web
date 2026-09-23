'use client';

import { useEffect, useMemo, useState } from 'react';
// import { experience as defaultExperience } from './experience-data'; // TODO: Replace with package data
import testimonialsData from '@/testimonials/testimonials.json';
import HeroSection from './HeroSection';
import ImageCarousel from './ImageCarousel';
import TwoColumnLists from './TwoColumnLists';
import CtaSection from './CtaSection';
import TestimonialsSection from './TestimonialsSection';
import ReservaWidget from './ReservaWidget';
import MidVideoSection from './MidVideoSection';
import FaqSection from './FaqSection';
import LandingFooter from './LandingFooter';
import WhatsAppCtaButton from './WhatsAppCtaButton';
import { getWhatsAppLinkForExperience } from '@/lib/utils/whatsapp';
// import { toBookingPublicData } from '@/lib/paquetes';
import ScrollSmoother from '@/components/ScrollSmoother';
import type { BookingPublicData } from './types';
// type Experience removed - using Paquete from @/types
import type { Paquete } from '@/types';

const formatDateIso = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

type Props = {
  /** Cuando se pasa (ej. desde /paquetes/[slug]), se usa este paquete en lugar de la por defecto. */
  paqueteProp?: Paquete;
};

// TODO: Replace defaultExperience with defaultPackage from package-data
const defaultPackage = {} as Paquete;

export default function LandingReservaPage({ paqueteProp }: Props) {
  const paquete = paqueteProp ?? defaultPackage;

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [people, setPeople] = useState(1);
  const [peopleTouched, setPeopleTouched] = useState(false);

  const whatsappLink = useMemo(() => {
    const date = selectedDate ? formatDateIso(selectedDate) : undefined;
    const includePeople = peopleTouched || !!selectedDate;

    return getWhatsAppLinkForExperience({
      experienceTitle: paquete.titulo,
      date,
      people: includePeople ? people : undefined,
    });
  }, [paquete, selectedDate, people, peopleTouched]);

  const handlePeopleChange = (value: number) => {
    setPeopleTouched(true);
    setPeople(value);
  };

  const testimonials = useMemo(() => {
    // TODO: Agregar testimonios al tipo Paquete si es necesario
    return testimonialsData.testimonials.map((testimonial) => ({
      name: testimonial.name,
      quote: testimonial.comment,
      role: testimonial.country,
    }));
  }, []);

  // Mapeo temporal de paquete a formato Experience para compatibilidad con componentes existentes
  const experience = useMemo(() => ({
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
    // Booking config compatibility
    bookingConfig: paquete.bookingConfig as any,
    // Extra properties required by Experience type
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
  }), [paquete]);

  // TODO: Implementar toBookingPublicData para paquetes
  const fallbackBookingData = useMemo(
    () => (paqueteProp ? null : null),
    [paqueteProp]
  );
  const [bookingDataFromApi, setBookingDataFromApi] = useState<BookingPublicData | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!paqueteProp?.slug) {
      return;
    }
    const fetchBooking = () => {
      fetch(`/api/paquetes/${encodeURIComponent(paqueteProp.slug)}/booking`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!cancelled && data?.booking) setBookingDataFromApi(data.booking);
          else if (!cancelled) setBookingDataFromApi(null);
        })
        .catch(() => {
          if (!cancelled) setBookingDataFromApi(null);
        });
    };

    fetchBooking();
    const interval = setInterval(() => {
      fetchBooking();
    }, 30000); // refrescar cada 30s

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [paqueteProp?.slug]);

  const bookingData = bookingDataFromApi !== undefined ? bookingDataFromApi : fallbackBookingData;
  const showReservaBlock = !bookingData || bookingData.enabled;


  return (
    <div className="landing-reserva">
      <ScrollSmoother />
      <HeroSection experience={experience} whatsappLink={whatsappLink} hideWhatsApp />
      <ImageCarousel
        images={experience.cardImage ? [experience.cardImage, ...(experience.images ?? [])] : (experience.images ?? [])}
        title={experience.title}
        intro={experience.galleryIntro}
      />
      <TwoColumnLists experience={experience} />
      <CtaSection
        whatsappLink={whatsappLink}
        title={`Reservá tu lugar en ${experience.title}`}
        description="Coordinamos todo para que vivas una experiencia a tu medida con Viaggio Tur."
        dividerText={experience.dividerPhrase}
        sectionId="cta-reserva"
        hideWhatsApp
      />
      <div id="cta-reserva-end" className="h-px w-full" />
      <TestimonialsSection testimonials={testimonials} />
      {showReservaBlock && (
        <ReservaWidget
          experienceId={experience.id}
          experienceSlug={experience.slug}
          bookingData={bookingData ?? undefined}
          maxPeople={experience.maxPeople}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          people={people}
          onPeopleChange={handlePeopleChange}
          calendarIntro={experience.calendarIntro}
          reservationMicrocopy={experience.reservationMicrocopy}
        />
      )}
      <MidVideoSection experience={experience} />
      <FaqSection faqs={experience.faqs} />
      <LandingFooter />
    </div>
  );
}
