'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import ScrollToReservaButton from './ScrollToReservaButton';
import WhatsAppCtaButton from './WhatsAppCtaButton';
import { fadeLeft, fadeRight, fadeUp, scaleIn, staggerFast } from './animations';

type CtaSectionProps = {
  whatsappLink: string;
  title?: string;
  description?: string;
  sticky?: boolean;
  sectionId?: string;
  dividerText?: string;
  /** Si es true, no se muestra el botón de WhatsApp (solo Reserva). */
  hideWhatsApp?: boolean;
};

export default function CtaSection({
  whatsappLink,
  title,
  description,
  sticky = false,
  sectionId,
  dividerText,
  hideWhatsApp = false,
}: CtaSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const sectionY = useTransform(scrollYProgress, [0, 1], [40, -40]);
  const accordionScale = useTransform(scrollYProgress, [0, 0.6, 1], [1, 1, 0.92]);
  const accordionOpacity = useTransform(scrollYProgress, [0, 0.7, 1], [1, 1, 0.88]);

  return (
    <section
      ref={sectionRef}
      id={sectionId}
      className={`relative bg-gray-50 ${sticky ? 'min-h-[60vh]' : ''}`}
    >
      <motion.div
        className="relative z-10 mx-auto flex w-full flex-col items-center px-4 pb-8 pt-6 text-center sm:px-6 sm:pb-10 sm:pt-7 md:pb-12 md:pt-10"
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: '-120px' }}
        style={{ y: sectionY }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="flex w-full max-w-5xl flex-col items-center gap-4"
          variants={staggerFast}
          style={{ scaleY: accordionScale, opacity: accordionOpacity, transformOrigin: 'top' }}
        >
          {title && (
            <motion.h2 className="text-2xl font-semibold text-white" variants={fadeUp}>
              {title}
            </motion.h2>
          )}
          {description && (
            <motion.p className="font-subtitle text-base text-black/70" variants={fadeUp}>
              {description}
            </motion.p>
          )}
          <motion.div
            className="mt-2 flex w-full flex-col items-center justify-center gap-3 sm:flex-row"
            variants={scaleIn}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <motion.div variants={fadeLeft} className="w-full sm:w-auto">
              <ScrollToReservaButton className="w-full sm:w-auto" />
            </motion.div>
            {!hideWhatsApp && (
              <motion.div variants={fadeRight} className="w-full sm:w-auto">
                <WhatsAppCtaButton href={whatsappLink} className="w-full sm:w-auto" />
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
