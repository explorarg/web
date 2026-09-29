export type CommunityTier = 'bronce' | 'plata' | 'oro' | 'platino';

/** Perfil comunitario; la identidad y la contraseña pertenecen a Firebase Auth. */
export interface CommunityProfile {
  uid: string;
  email: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  rol: 'cliente';
  activo: boolean;
  fechaRegistro: string;
  totalCompras: number;
  totalGastado: number;
  totalGastadoPorMoneda?: Record<string, number>;
  tier: CommunityTier;
}
