import { Bus, Hotel, Plane, ShieldCheck, MapPin, Utensils, Coffee } from 'lucide-react';

export type PackageFeature = {
  icon: React.ReactNode;
  label: string;
  priority: number; // Para ordenar por relevancia
};

const FEATURE_KEYWORDS = [
  {
    keywords: ['aéreo', 'aereo', 'pasaje', 'vuelo', 'avión', 'avion', 'flight'],
    icon: <Plane className="h-5 w-5" />,
    label: 'Aéreos',
    priority: 1,
  },
  {
    keywords: ['hotel', 'alojamiento', 'hospedaje', 'noche', 'noches', 'estadía', 'estadia', 'accommodation'],
    icon: <Hotel className="h-5 w-5" />,
    label: 'Alojamiento',
    priority: 2,
  },
  {
    keywords: ['traslado', 'transfer', 'charter', 'aeropuerto', 'transporte', 'bus', 'colectivo'],
    icon: <Bus className="h-5 w-5" />,
    label: 'Traslados',
    priority: 3,
  },
  {
    keywords: ['desayuno', 'breakfast', 'desayunos'],
    icon: <Coffee className="h-5 w-5" />,
    label: 'Desayuno',
    priority: 4,
  },
  {
    keywords: ['comida', 'almuerzo', 'cena', 'media pensión', 'pension', 'pensión completa', 'meals', 'lunch', 'dinner'],
    icon: <Utensils className="h-5 w-5" />,
    label: 'Comidas',
    priority: 5,
  },
  {
    keywords: ['excursión', 'excursion', 'visita', 'tour', 'actividad', 'paseo'],
    icon: <MapPin className="h-5 w-5" />,
    label: 'Excursiones',
    priority: 6,
  },
  {
    keywords: ['asistencia', 'seguro', 'cobertura', 'insurance'],
    icon: <ShieldCheck className="h-5 w-5" />,
    label: 'Asistencia',
    priority: 7,
  },
];

/**
 * Detecta automáticamente las características del paquete basándose en el array de lo que incluye
 * @param incluye Array de strings con lo que incluye el paquete
 * @param maxFeatures Cantidad máxima de features a retornar (default: 4)
 * @returns Array de features con iconos y labels
 */
export function getPackageFeatures(
  incluye: string[],
  maxFeatures: number = 4
): PackageFeature[] {
  if (!incluye || incluye.length === 0) return [];

  // Convertir todo el array a un string en minúsculas para facilitar la búsqueda
  const textoBusqueda = incluye.join(' ').toLowerCase();

  // Detectar features que coincidan
  const featuresDetectados: PackageFeature[] = [];

  for (const featureConfig of FEATURE_KEYWORDS) {
    // Verificar si alguna keyword coincide
    const coincide = featureConfig.keywords.some((keyword) =>
      textoBusqueda.includes(keyword.toLowerCase())
    );

    if (coincide) {
      featuresDetectados.push({
        icon: featureConfig.icon,
        label: featureConfig.label,
        priority: featureConfig.priority,
      });
    }
  }

  // Ordenar por prioridad y limitar cantidad
  return featuresDetectados
    .sort((a, b) => a.priority - b.priority)
    .slice(0, maxFeatures);
}

