import ComingSoon from './components/ComingSoon';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VIAGGIO TUR — Próximamente',
  description: 'Preparando los motores para la nueva temporada. Muy pronto lanzamos la nueva web.',
};

export default function Home() {
  return <ComingSoon logoSrc="/logo-lado-v.png" logoAlt="VIAGGIO TUR" />;
}
