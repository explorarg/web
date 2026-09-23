'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

const DURATION = 0.2;

/**
 * Transición suave entre páginas sin AnimatePresence.
 * AnimatePresence mode="wait" puede dejar la pantalla en blanco al navegar en Next.js App Router.
 * Aquí solo animamos la entrada del nuevo contenido para que la navegación sea fiable.
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
