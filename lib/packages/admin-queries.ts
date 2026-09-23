import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Categoria } from '@/types';

export async function fetchActiveCategorias(): Promise<Categoria[]> {
  const categoriasQuery = query(collection(db, 'categorias'), where('activa', '==', true));
  const categoriasSnapshot = await getDocs(categoriasQuery);
  return categoriasSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Categoria));
}

export async function countFeaturedPackages(excludeId?: string): Promise<number> {
  const paquetesQuery = query(collection(db, 'paquetes'), where('destacado', '==', true));
  const paquetesSnapshot = await getDocs(paquetesQuery);
  if (!excludeId) return paquetesSnapshot.size;
  return paquetesSnapshot.docs.filter((doc) => doc.id !== excludeId).length;
}
