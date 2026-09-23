'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

type ScrollToReservaButtonProps = {
  label?: string;
  className?: string;
};

export default function ScrollToReservaButton({
  label = 'Reservar ahora',
  className,
}: ScrollToReservaButtonProps) {
  const handleScroll = () => {
    const section = document.getElementById('reserva');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <motion.div
      whileHover={{ y: -1, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 350, damping: 20 }}
      className="inline-flex"
    >
      <Button
        type="button"
        onClick={handleScroll}
        className={`rounded-full px-5 py-2.5 text-sm font-semibold sm:px-6 sm:py-3 sm:text-base ${className ?? ''}`}
      >
        {label}
      </Button>
    </motion.div>
  );
}
