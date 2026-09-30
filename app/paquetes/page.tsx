import { collection, getDocs, limit, orderBy as firestoreOrderBy, query, where } from 'firebase/firestore';
import { db, firebaseEnabled } from '@/lib/firebase';
import { Paquete, Categoria } from '@/types';
import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';
import WhatsAppButton from '@/components/WhatsAppButton';
import PaquetesClient from '@/components/PaquetesClient';
import type { Metadata } from 'next';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/constants';
import { siteConfig } from '@/lib/siteConfig';

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  title: `Paquetes - ${SITE_NAME}`,
  description: `Explorá nuestros paquetes turísticos con ${SITE_NAME}. ${SITE_DESCRIPTION}`,
  alternates: {
    canonical: `${siteUrl}/paquetes`,
  },
  openGraph: {
    type: 'website',
    url: `${siteUrl}/paquetes`,
    title: `Paquetes - ${SITE_NAME}`,
    description: `Explorá nuestros paquetes turísticos con ${SITE_NAME}.`,
    siteName: SITE_NAME,
    locale: siteConfig.seo.locale,
  },
  twitter: {
    card: 'summary_large_image',
    title: `Paquetes - ${SITE_NAME}`,
    description: `Explorá nuestros paquetes turísticos con ${SITE_NAME}.`,
  },
  keywords: [...siteConfig.seo.keywords, 'paquetes', 'paquetes turísticos'],
};

/** Sin caché: los cambios del admin (paquetes) se ven de inmediato */
export const revalidate = 0;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function getPaquetes(): Promise<Paquete[]> {
  if (!firebaseEnabled) return [];
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'paquetes'),
        where('visible', '==', true),
        firestoreOrderBy('orden', 'asc')
      )
    );

    return snapshot.docs.map((doc) => serializeFirestoreData<Paquete>({ id: doc.id, ...doc.data() }));
  } catch (error) {
    // Fallback sin índice compuesto
    const snapshot = await getDocs(query(collection(db, 'paquetes'), where('visible', '==', true)));
    return snapshot.docs
      .map((doc) => serializeFirestoreData<Paquete>({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }
}

async function getCategorias(): Promise<Categoria[]> {
  if (!firebaseEnabled) return [];
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'categorias'),
        where('activa', '==', true),
        firestoreOrderBy('orden', 'asc')
      )
    );

    return snapshot.docs.map((doc) => serializeFirestoreData<Categoria>({ id: doc.id, ...doc.data() }));
  } catch (error) {
    const snapshot = await getDocs(query(collection(db, 'categorias'), where('activa', '==', true)));
    return snapshot.docs
      .map((doc) => serializeFirestoreData<Categoria>({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }
}

function normalizeParam(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  return values
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export default async function PaquetesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const [paquetes, categorias] = await Promise.all([
    getPaquetes(),
    getCategorias(),
  ]);

  const tipos = normalizeParam(resolvedSearchParams.tipo);
  const tag = normalizeParam(resolvedSearchParams.tag);
  const transportes = normalizeParam(resolvedSearchParams.transporte);
  const categoriasSeleccionadas = normalizeParam(resolvedSearchParams.categoria);

  let heroTitle = 'Paquetes';
  let heroSubtitle = 'Descubre los mejores destinos turísticos con paquetes diseñados para ti';
  const categoriaPrincipal =
    categoriasSeleccionadas.length === 1
      ? categorias.find((categoria) => String(categoria.slug || '').trim().toLowerCase() === categoriasSeleccionadas[0]) ?? null
      : null;

  if (categoriaPrincipal) {
    heroTitle = categoriaPrincipal.nombre;
    heroSubtitle =
      categoriaPrincipal.descripcion || `Explorá los paquetes disponibles en ${categoriaPrincipal.nombre}`;
  } else if (tipos.includes('grupal')) {
    heroTitle = 'Salidas grupales';
    heroSubtitle = 'Viajes organizados para compartir, con todo planificado';
  } else if (tipos.includes('internacional')) {
    heroTitle = 'Paquetes internacionales';
    heroSubtitle = 'Explorá destinos internacionales con propuestas seleccionadas';
  } else if (tipos.includes('educativo')) {
    heroTitle = 'Paquetes educativos';
    heroSubtitle = 'Opciones pensadas para instituciones, contingentes y grupos';
  } else if (tipos.includes('eventos') || tipos.includes('recitales')) {
    heroTitle = 'Eventos / Recitales';
    heroSubtitle = 'Eventos y recitales para compartir con tu grupo';
  } else if (transportes.length > 0) {
    heroTitle = 'Paquetes con transporte';
    heroSubtitle = 'Encontrá paquetes por tipo de transporte';
  } else if (tag.includes('promo')) {
    heroTitle = 'Promos';
    heroSubtitle = 'Ofertas y oportunidades para viajar al mejor precio';
  } else if (tag.includes('escapada') || tag.includes('religioso')) {
    heroTitle = 'Eventos / Recitales';
    heroSubtitle = 'Eventos y recitales para compartir con tu grupo';
  }

  return (
    <div className="w-full min-w-0 overflow-x-clip bg-[#F5FAFF]">
      <Navbar variant="homeMockup" reserveSpace />
      <WhatsAppButton />

      <section className="border-b border-[#E4EDF6] bg-[#F5FAFF] pt-0 md:pt-16">
        <div className="container mx-auto px-4 py-14 md:px-6 md:py-20 lg:px-8">
          <div className="max-w-2xl">
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#A1ACB8]">
              Catálogo
            </div>
            <h1 className="mt-4 text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#112B49] md:text-[46px]">
              {heroTitle}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[#8A98A8] md:text-base">
              {heroSubtitle}
            </p>
          </div>
        </div>
      </section>

      <PaquetesClient paquetes={paquetes} categorias={categorias} />

      <HomeFooter />
    </div>
  );
}
