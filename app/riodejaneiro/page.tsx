import type { Metadata } from 'next';
import LandingReservaPage from '@/components/landing-reserva/LandingReservaPage';
import { experience } from '@/components/landing-reserva/package-data';

export const metadata: Metadata = {
  title: `Reservar ${experience.title}`,
  description: experience.subtitle,
};

export default function ReservarPage() {
  return <LandingReservaPage />;
}
