import { collection, getDocs, query, orderBy as firestoreOrderBy, where, limit } from 'firebase/firestore';
import { db, firebaseEnabled } from '@/lib/firebase';
import { serializeFirestoreData } from '@/lib/utils/serialize';
import { BlogPost, Categoria, Paquete } from '@/types';
import { getPaquetes, getPaquetesDestacados } from '@/lib/paquetes';

/** Límites para la home: evita traer más documentos de los necesarios y reduce memoria */
const HOME_PAQUETES_LIMIT = 12;
const HOME_CATEGORIAS_LIMIT = 6;

async function fetchVisibleOrdered<T>(collectionName: string, maxItems: number) {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, collectionName),
        where('visible', '==', true),
        firestoreOrderBy('orden', 'asc'),
        limit(maxItems)
      )
    );

    return snapshot.docs.map((doc) => serializeFirestoreData<T>({ id: doc.id, ...doc.data() }));
  } catch {
    // Fallback sin índice compuesto: filtramos y ordenamos en memoria
    const snapshot = await getDocs(query(collection(db, collectionName), where('visible', '==', true)));
    return snapshot.docs
      .map((doc) => serializeFirestoreData<T>({ id: doc.id, ...doc.data() }))
      .sort((a, b) => ((a as { orden?: number }).orden ?? 0) - ((b as { orden?: number }).orden ?? 0))
      .slice(0, maxItems);
  }
}

async function fetchFeaturedCategories(maxItems: number) {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'categorias'),
        where('activa', '==', true),
        where('destacada', '==', true),
        firestoreOrderBy('orden', 'asc'),
        limit(maxItems)
      )
    );

    return snapshot.docs.map((doc) => serializeFirestoreData<Categoria>({ id: doc.id, ...doc.data() }));
  } catch {
    const snapshot = await getDocs(query(collection(db, 'categorias'), where('activa', '==', true)));
    return snapshot.docs
      .map((doc) => serializeFirestoreData<Categoria>({ id: doc.id, ...doc.data() }))
      .filter((c) => Boolean((c as { destacada?: boolean }).destacada))
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
      .slice(0, maxItems);
  }
}

export async function getHomeData() {
  if (!firebaseEnabled) {
    return {
      paquetes: [],
      productosOrdenados: [],
      banners: ['/images/hero-placeholder.svg'],
      blogPosts: [],
      categoriasDestacadas: [],
    };
  }
  const [
    paquetesData,
    bannersSnapshot,
    blogData,
    seccionesSnapshot,
    paquetesDestacados,
    categoriasDestacadas,
  ] = await Promise.all([
    fetchVisibleOrdered<Paquete>('paquetes', HOME_PAQUETES_LIMIT),
    getDocs(query(collection(db, 'banners'), firestoreOrderBy('orden', 'asc'))),
    fetchVisibleOrdered<BlogPost>('blog', 5),
    getDocs(query(collection(db, 'secciones'), firestoreOrderBy('orden', 'asc'))),
    getPaquetesDestacados(6),
    fetchFeaturedCategories(HOME_CATEGORIAS_LIMIT),
  ]);

  const seccionesData = seccionesSnapshot.docs
    .map((doc) =>
      serializeFirestoreData<{
        paqueteId?: string;
        tipo: 'paquete' | 'f1' | 'subtitle';
        orden: number;
        titulo?: string;
      }>({
        id: doc.id,
        ...doc.data(),
      })
    )
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const paquetesMap = new Map(paquetesData.map((paq) => [paq.id, paq]));

  const productosDesdeSecciones = seccionesData
    .map((item) => {
      if (item.tipo === 'subtitle') {
        return { tipo: 'subtitle' as const, titulo: item.titulo || 'Sección' };
      }
      if (item.tipo === 'f1') return null;
      const paquete = paquetesMap.get(item.paqueteId || '');
      return paquete ? { paquete, tipo: 'paquete' as const } : null;
    })
    .filter(
      (item): item is { tipo: 'paquete'; paquete: Paquete } | { tipo: 'subtitle'; titulo: string } =>
        Boolean(item)
    );

  const productosFinales =
    productosDesdeSecciones.length > 0
      ? productosDesdeSecciones
      : paquetesData.map((paquete) => ({ paquete, tipo: 'paquete' as const }));

  const bannersData = bannersSnapshot.docs
    .map((doc) => doc.data() as { imageUrl?: string; activa?: boolean; target?: 'home' | 'blog' | 'both' })
    .filter((banner) => {
      if (banner.activa === false || !banner.imageUrl) return false;
      const target = banner.target || 'home';
      return target === 'home' || target === 'both';
    })
    .map((banner) => banner.imageUrl as string);

  return {
    paquetes: paquetesData,
    productosOrdenados: productosFinales,
    banners: bannersData,
    blogPosts: blogData,
    paquetesDestacados,
    categoriasDestacadas,
  };
}
