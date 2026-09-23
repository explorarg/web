import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, firebaseEnabled } from '@/lib/firebase';
import { Paquete } from '@/types';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';
import HomeFeaturesRow from '@/components/home/HomeFeaturesRow';
import WhatsAppButton from '@/components/WhatsAppButton';
import PaqueteSidebar from '@/components/PaqueteSidebar';
import PaqueteSchema from '@/components/PaqueteSchema';
import PaqueteCarousel from '@/components/paquete/PaqueteCarousel';
import PaqueteGalleryGrid from '@/components/paquete/PaqueteGalleryGrid';
import Link from 'next/link';
import { CheckCircle, XCircle, Star, CreditCard, Headphones, Plane, MapPin, Clock3, Facebook, Instagram, Link2, Phone } from 'lucide-react';
import type { Metadata } from 'next';
import { SITE_NAME, SITE_URL } from '@/lib/constants';
import { serializeFirestoreData } from '@/lib/utils/serialize';

/** Sin caché: los cambios del admin se ven de inmesdiato */
export const revalidate = 0;

const DEFAULT_CONDICIONES = [
  { titulo: 'Reserva', texto: 'Seña del 40% para asegurar tu lugar.' },
  { titulo: 'Pagos', texto: 'Consultá nuestras cuotas y medios de pago disponibles.' },
  { titulo: 'Confirmación', texto: 'Salida sujeta a la conformación del grupo mínimo.' },
  { titulo: 'Flexibilidad', texto: 'Excursiones condicionadas por clima o imprevistos.' },
  { titulo: 'Seguridad', texto: 'Recomendamos contratar asistencia al viajero.' },
  { titulo: 'Gastos extra', texto: 'No incluye comidas en ruta, bebidas ni opcionales.' },
  { titulo: 'Ingresos', texto: 'No incluye tickets a parques nacionales ni museos.' },
];

function normalizeCondiciones(raw: unknown) {
  if (!Array.isArray(raw)) return DEFAULT_CONDICIONES;
  const parsed = raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const titulo = String((item as { titulo?: unknown }).titulo ?? '').trim();
      const texto = String((item as { texto?: unknown }).texto ?? '').trim();
      if (!titulo || !texto) return null;
      return { titulo, texto };
    })
    .filter((item): item is { titulo: string; texto: string } => Boolean(item));
  return parsed.length > 0 ? parsed : DEFAULT_CONDICIONES;
}

async function getPaquete(slug: string): Promise<Paquete | null> {
  if (!firebaseEnabled) return null;
  try {
    // Query simplificada
    const q = query(collection(db, 'paquetes'), where('slug', '==', slug), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    
    const paquete = serializeFirestoreData<Paquete>({
      id: snapshot.docs[0].id, 
      ...snapshot.docs[0].data() 
    });
    
    // Verificar que esté visible
    if (!paquete.visible) return null;
    
    return {
      ...paquete,
      condiciones: normalizeCondiciones((paquete as Paquete & { condiciones?: unknown }).condiciones),
    };
  } catch (error) {
    console.error('Error fetching paquete:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!firebaseEnabled) {
    const siteUrl = SITE_URL;
    const url = `${siteUrl}/paquete/${slug}`;
    return {
      title: `${slug} - ${SITE_NAME}`,
      description: `Paquete ${slug} en ${SITE_NAME}.`,
      alternates: { canonical: url },
    };
  }
  const paquete = await getPaquete(slug);
  
  if (!paquete) {
    return {
      title: 'Paquete no encontrado',
    };
  }

  const siteUrl = SITE_URL;
  const url = `${siteUrl}/paquete/${slug}`;
  
  // Limpiar HTML de la descripción para metadatos
  const cleanDescription = paquete.descripcionCorta || 
    paquete.descripcion.replace(/<[^>]*>/g, '').substring(0, 160).trim() + '...';

  const coverImage = paquete.imagenPortada || paquete.imagenTarjeta || paquete.imagenPrincipal;

  return {
    title: `${paquete.titulo} - ${SITE_NAME}`,
    description: cleanDescription,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'website',
      url,
      title: `${paquete.titulo} - ${SITE_NAME}`,
      description: cleanDescription,
      siteName: SITE_NAME,
      locale: 'es_AR',
      images: coverImage ? [
        {
          url: coverImage,
          width: 1200,
          height: 630,
          alt: paquete.titulo,
        }
      ] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${paquete.titulo} - ${SITE_NAME}`,
      description: cleanDescription,
      images: coverImage ? [coverImage] : [],
    },
    keywords: [
      paquete.titulo,
      paquete.destino || 'destino',
      'paquete turístico',
      'viajes',
      'turismo',
      SITE_NAME,
    ],
  };
}

export default async function PaquetePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!firebaseEnabled) {
    return (
      <>
        <Navbar variant="homeMockup" reserveSpace />
        <WhatsAppButton />
        <section className="py-24 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-[32px] leading-[40px] tracking-[0.5px] font-semibold mb-4 font-heading text-black">
                {slug}
              </h1>
              <p className="text-base md:text-lg text-gray-700 font-body leading-relaxed">
                Este contenido requiere configuración de Firebase para mostrarse.
              </p>
            </div>
          </div>
        </section>
        <HomeFooter />
      </>
    );
  }
  const paquete = await getPaquete(slug);

  if (!paquete) {
    notFound();
  }

  const images = Array.from(
    new Set(
      [paquete.imagenPortada, paquete.imagenPrincipal, ...(paquete.galeria ?? [])]
        .map((s) => String(s || '').trim())
        .filter(Boolean)
    )
  );
  const short = (paquete.descripcionCorta || '').trim();
  const destino = paquete.destino || paquete.eventoLugar || 'Argentina';
  const locationText = paquete.eventoLugar || paquete.destino || destino;
  const aboutText = paquete.descripcion
    ? paquete.descripcion.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
  const featureCards = [
    { icon: Clock3, title: paquete.duracion || 'Duración total', subtitle: 'Duración total' },
    { icon: CreditCard, title: 'Pagá en cuotas', subtitle: 'Sin interés' },
    { icon: Headphones, title: 'Asistencia 24/7', subtitle: 'Durante tu viaje' },
  ];

  return (
    <div className="min-h-screen bg-[#F5FAFF]">
      <PaqueteSchema paquete={paquete} />
      <Navbar variant="homeMockup" reserveSpace />
      <WhatsAppButton />
      <main className="container mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="text-xs md:text-sm text-[#6A86A6]">
          <Link href="/" className="hover:text-[#2BB8BF]">Inicio</Link>
          <span className="mx-2">›</span>
          <Link href="/paquetes" className="hover:text-[#2BB8BF]">Destinos</Link>
          <span className="mx-2">›</span>
          <span>{destino}</span>
          <span className="mx-2">›</span>
          <span className="text-[#224165]">{paquete.titulo}</span>
        </div>

        <div className="mt-4 pt-8 md:pt-16 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-5">
            <PaqueteCarousel
              images={images}
              title={paquete.titulo}
            />

            <div className="rounded-3xl border border-[#D4E6F7] bg-white p-6 shadow-[0_14px_34px_rgba(15,66,116,0.08)]">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_280px]">
                <div>
                  <h1 className="text-[34px] leading-[1.05] font-extrabold tracking-[-0.02em] text-[#0B2240]">
                    {paquete.titulo}
                  </h1>
                  <p className="mt-2 text-sm text-[#537190]">
                    {short || 'Naturaleza imponente, aventura y confort en una experiencia única.'}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#2A4E74]">
                    <MapPin className="h-4 w-4 text-[#2BB8BF]" />
                    {locationText}
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-[#415F7E]">
                    {aboutText || 'Descubrí paisajes inolvidables y experiencias únicas con un programa premium que combina excursiones, alojamientos seleccionados y servicios exclusivos.'}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                {featureCards.map((f) => (
                  <div key={f.title} className="rounded-2xl border border-[#D8E9F8] bg-white px-4 py-3">
                    <f.icon className="h-4 w-4 text-[#14A0C5]" />
                    <div className="mt-2 text-xs font-extrabold text-[#17395E]">{f.title}</div>
                    <div className="mt-0.5 text-[11px] text-[#5A7898]">{f.subtitle}</div>
                  </div>
                ))}
              </div>

              {images.length > 1 ? (
                <div className="mt-5">
                  <PaqueteGalleryGrid images={images.slice(0)} title={paquete.titulo} />
                </div>
              ) : null}
            </div>
            {(paquete.incluye.length > 0 || (paquete.noIncluye && paquete.noIncluye.length > 0)) && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {paquete.incluye.length > 0 && (
                  <div className="rounded-3xl border border-[#D8EFE0] bg-[#F5FFF7] p-5 shadow-[0_12px_28px_rgba(28,122,67,0.08)]">
                    <h3 className="text-lg font-extrabold text-[#1A7E4F]">Incluye</h3>
                    <ul className="mt-3 space-y-2">
                      {paquete.incluye.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-[#27694B]">
                          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#1AA861]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {paquete.noIncluye && paquete.noIncluye.length > 0 && (
                  <div className="rounded-3xl border border-[#F1DCDC] bg-[#FFF8F8] p-5 shadow-[0_12px_28px_rgba(154,58,58,0.08)]">
                    <h3 className="text-lg font-extrabold text-[#A13C3C]">No incluye</h3>
                    <ul className="mt-3 space-y-2">
                      {paquete.noIncluye.map((item, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-[#7F3A3A]">
                          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D95353]" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-3xl border border-[#D4E6F7] bg-white p-5 shadow-[0_14px_34px_rgba(15,66,116,0.08)]">
              <h3 className="text-sm font-bold text-[#17395E]">Compartí esta experiencia</h3>
              <div className="mt-3 flex items-center gap-2.5">
                <button type="button" className="h-9 w-9 rounded-full border border-[#D7E8F7] bg-white text-[#2C4E73] flex items-center justify-center hover:bg-[#F4FAFF]" aria-label="Compartir por WhatsApp">
                  <Phone className="h-4 w-4" />
                </button>
                <button type="button" className="h-9 w-9 rounded-full border border-[#D7E8F7] bg-white text-[#2C4E73] flex items-center justify-center hover:bg-[#F4FAFF]" aria-label="Compartir en Facebook">
                  <Facebook className="h-4 w-4" />
                </button>
                <button type="button" className="h-9 w-9 rounded-full border border-[#D7E8F7] bg-white text-[#2C4E73] flex items-center justify-center hover:bg-[#F4FAFF]" aria-label="Compartir en Instagram">
                  <Instagram className="h-4 w-4" />
                </button>
                <button type="button" className="h-9 w-9 rounded-full border border-[#D7E8F7] bg-white text-[#2C4E73] flex items-center justify-center hover:bg-[#F4FAFF]" aria-label="Copiar enlace">
                  <Link2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="xl:sticky xl:top-24">
              <PaqueteSidebar paquete={paquete} />
            </div>
          </aside>
        </div>
      </main>

      <HomeFeaturesRow />
      <HomeFooter />
    </div>
  );
}
