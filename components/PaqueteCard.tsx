'use client';

import { motion } from 'framer-motion';
import { Paquete } from '@/types';
import HomeDepartureCard from '@/components/home/HomeDepartureCard';

interface PaqueteCardProps {
  paquete: Paquete;
  index?: number;
  basePath?: string;
  badgeLabel?: string;
  disableAnimation?: boolean;
  fullWidth?: boolean;
}

export default function PaqueteCard({ paquete, index = 0, basePath = '/paquete', badgeLabel, disableAnimation = false, fullWidth = false }: PaqueteCardProps) {
  const direction = index % 2 === 0 ? -1 : 1;
  const vertical = index % 3 === 0 ? -1 : 1;
  const duration = 0.6 + (index % 3) * 0.05;

  if (disableAnimation) {
    return (
      <div className="h-full">
        <HomeDepartureCard paquete={paquete} hrefBasePath={basePath} fullWidth={fullWidth} />
      </div>
    );
  }

  return (
    <motion.div
      initial={{
        opacity: 0,
        x: 50 * direction,
        y: 32 * vertical,
        scale: 0.97,
        rotate: 0.6 * direction,
        filter: 'blur(6px)',
      }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: -50 * direction, y: -24 * vertical, scale: 0.98, rotate: -0.4 * direction }}
      transition={{ duration, ease: [0.16, 1, 0.3, 1], delay: index * 0.08 }}
      viewport={{ once: true, margin: '-120px' }}
      className="h-full"
    >
      <HomeDepartureCard paquete={paquete} hrefBasePath={basePath} fullWidth={fullWidth} />
    </motion.div>
  );
}
