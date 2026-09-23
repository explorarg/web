'use client';

import { motion, Variants } from 'framer-motion';
import Script from 'next/script';
import { SOCIAL_MEDIA } from '@/lib/constants';

interface InstagramSectionProps {
  fadeInLeftVariants: Variants;
  fadeInRightVariants: Variants;
  fadeInUpVariants: Variants;
  fadeInDownVariants: Variants;
  fadeInScaleVariants: Variants;
  staggerFastVariants: Variants;
}

export default function InstagramSection({
  fadeInLeftVariants,
  fadeInRightVariants,
  fadeInUpVariants,
  fadeInDownVariants,
  fadeInScaleVariants,
  staggerFastVariants,
}: InstagramSectionProps) {
  const lineRevealVariants: Variants = {
    hidden: { y: '100%' },
    visible: {
      y: '0%',
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <section className="py-8 md:py-12 bg-transparent border-t border-primary/10 overflow-x-hidden">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="mb-10 md:mb-14 max-w-3xl"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-150px" }}
          variants={staggerFastVariants}
          transition={{ staggerChildren: 0.18, delayChildren: 0.25 }}
        >
          <motion.div className="inline-block mb-4" variants={fadeInDownVariants}>
            <span className="badge-pluma pluma-underline block">Instagram</span>
          </motion.div>
          <motion.h2
            className="text-lg md:text-lg lg:text-lg font-bold leading-tight overflow-hidden"
            variants={fadeInRightVariants}
            transition={{ duration: 0.85 }}
          >
            <motion.span className="block" variants={lineRevealVariants}>
              Últimas publicaciones
            </motion.span>
          </motion.h2>
          <motion.p
            className="text-sm md:text-sm text-[#4B5563] overflow-hidden"
            variants={fadeInUpVariants}
            transition={{ duration: 0.8 }}
          >
            <motion.span className="block" variants={lineRevealVariants}>
              Seguinos en Instagram para novedades y experiencias reales.
            </motion.span>
          </motion.p>
        </motion.div>

        <motion.div
          className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
          variants={fadeInScaleVariants}
          transition={{ duration: 1.1, delay: 0.1 }}
        >
          <Script src="https://elfsightcdn.com/platform.js" strategy="lazyOnload" />
          <div
            className="elfsight-app-d76e2806-2ea4-494e-a68a-2be617fd890a"
            data-elfsight-app-lazy
          />
        </motion.div>

        {SOCIAL_MEDIA.instagram && (
          <div className="mt-8">
            <a
              href={SOCIAL_MEDIA.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#515BD4] text-white px-6 py-3 font-semibold transition-all hover:brightness-105"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9zm9.25 2.25a1.25 1.25 0 1 1 0 2.5a1.25 1.25 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10a5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6a3 3 0 0 0 0-6z" />
              </svg>
              <motion.span
                className="block overflow-hidden"
                variants={lineRevealVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-120px' }}
              >
                Ver más en Instagram
              </motion.span>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
