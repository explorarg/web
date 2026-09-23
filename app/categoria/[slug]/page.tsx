import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, firebaseEnabled } from '@/lib/firebase';
import { Categoria } from '@/types';
import { notFound } from 'next/navigation';
import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';
import Hero from '@/components/Hero';
import PaqueteCard from '@/components/PaqueteCard';
import WhatsAppButton from '@/components/WhatsAppButton';
import type { Metadata } from 'next';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import { SITE_NAME, SITE_URL } from '@/lib/constants';
import { siteConfig } from '@/lib/siteConfig';
import { getPaquetesByCategoria } from '@/lib/paquetes';

// Revalidación dinámica - actualiza instantáneamente
export const revalidate = 0;
export const dynamic = 'force-dynamic';


async function getCategoria(slug: string): Promise<Categoria | null> {
  if (!firebaseEnabled) {
    return {
      id: 'local-dev',
      nombre: slug,
      slug,
      descripcion: '',
      orden: 0,
      destacada: false,
      activa: true,
      fechaCreacion: new Date(),
    };
  }
  try {
    // Query simplificada
    const q = query(
      collection(db, 'categorias'),
      where('slug', '==', slug)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    
    const categoria = serializeFirestoreData<Categoria>({ 
      id: snapshot.docs[0].id, 
      ...snapshot.docs[0].data() 
    });
    
    // Verificar que esté activa
    if (!categoria.activa) return null;
    
    return categoria;
  } catch (error) {
    console.error('Error fetching categoria:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  if (!firebaseEnabled) {
    const url = `${SITE_URL}/categoria/${slug}`;
    return {
      title: `${slug} - ${SITE_NAME}`,
      description: `Categoría ${slug} en ${SITE_NAME}.`,
      alternates: { canonical: url },
    };
  }
  const categoria = await getCategoria(slug);
  
  if (!categoria) {
    return {
      title: 'Categoría no encontrada',
    };
  }

  const url = `${SITE_URL}/categoria/${slug}`;

  return {
    title: `${categoria.nombre} - ${SITE_NAME}`,
    description:
      categoria.descripcion ||
      `Descubrí los mejores paquetes turísticos en ${categoria.nombre} con ${SITE_NAME}.`,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'website',
      url,
      title: `${categoria.nombre} - ${SITE_NAME}`,
      description:
        categoria.descripcion ||
        `Descubrí los mejores paquetes turísticos en ${categoria.nombre} con ${SITE_NAME}.`,
      siteName: SITE_NAME,
      locale: siteConfig.seo.locale,
      images: categoria.imagen ? [
        {
          url: categoria.imagen,
          width: 1200,
          height: 630,
          alt: categoria.nombre,
        }
      ] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${categoria.nombre} - ${SITE_NAME}`,
      description:
        categoria.descripcion ||
        `Descubrí los mejores paquetes turísticos en ${categoria.nombre} con ${SITE_NAME}.`,
      images: categoria.imagen ? [categoria.imagen] : [],
    },
    keywords: [...siteConfig.seo.keywords, categoria.nombre, 'viajes', 'turismo', 'paquetes', 'destinos'],
  };
}

export default async function CategoriaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const categoria = await getCategoria(slug);

  if (!categoria) {
    notFound();
  }

  const paquetes = await getPaquetesByCategoria(categoria.id);

  return (
    <>
      <Navbar variant="homeMockup" reserveSpace />
      <WhatsAppButton />

      <Hero
        title={categoria.nombre}
        subtitle={categoria.descripcion}
        backgroundImage={categoria.imagen}
        height="md"
      />

      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          {paquetes.length > 0 ? (
            <>
              <div className="text-center mb-12">
                <h2 className="text-lg md:text-lg lg:text-lg font-bold mb-4">Paquetes Disponibles</h2>
                <p className="text-base md:text-lg text-gray-600">
                  {paquetes.length} {paquetes.length === 1 ? 'paquete disponible' : 'paquetes disponibles'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {paquetes.map((paquete, index) => (
                  <PaqueteCard key={paquete.id} paquete={paquete} index={index} fullWidth={true} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20">
              <h3 className="text-base md:text-lg lg:text-lg font-semibold mb-4">No hay paquetes disponibles</h3>
              <p className="text-base md:text-lg text-gray-600">
                Por el momento no hay paquetes en esta categoría. ¡Consultanos para armar tu viaje a medida!
              </p>
            </div>
          )}
        </div>
      </section>

      <HomeFooter />
    </>
  );
}
