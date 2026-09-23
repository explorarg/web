'use client';

import { motion, Variants } from 'framer-motion';
import PaqueteCard from '@/components/PaqueteCard';
import SkeletonPaqueteCard from '@/components/SkeletonPaqueteCard';
import { Paquete } from '@/types';

const SKELETON_COUNT = 8;

interface ProductsSectionProps {
  items: Array<
    | { tipo: 'paquete'; paquete: Paquete }
    | { tipo: 'subtitle'; titulo: string }
  >;
  filterType?: 'paquete' | 'all';
  sectionBadge: string;
  sectionTitle: string;
  sectionSubtitle: string;
  loading?: boolean;
  fadeInLeftVariants: Variants;
  fadeInRightVariants: Variants;
  fadeInUpVariants: Variants;
  fadeInDownVariants: Variants;
  fadeInScaleVariants: Variants;
  staggerFastVariants: Variants;
}

export default function ProductsSection({
  items,
  filterType = 'all',
  sectionBadge,
  sectionTitle,
  sectionSubtitle,
  loading = false,
  fadeInLeftVariants,
  fadeInRightVariants,
  fadeInUpVariants,
  fadeInDownVariants,
  fadeInScaleVariants,
  staggerFastVariants,
}: ProductsSectionProps) {
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

  const filteredItems =
    filterType === 'all'
      ? items.filter((item): item is { tipo: 'paquete'; paquete: Paquete } => item.tipo !== 'subtitle')
      : items.filter(
          (item): item is { tipo: 'paquete'; paquete: Paquete } => item.tipo === filterType
        );

  const showSkeletons = loading;
  const hasProductos = !loading && filteredItems.length > 0;
  if (!showSkeletons && !hasProductos) return null;

  return (
    <section id="productos" className="py-6 md:py-10 bg-transparent overflow-x-hidden">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className={`max-w-3xl ${filterType === 'paquete' ? 'pb-3 md:pb-4' : ''}`}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-150px" }}
          variants={staggerFastVariants}
          transition={{ staggerChildren: 0.18, delayChildren: 0.22 }}
        >
          <motion.div className="inline-block mb-3" variants={fadeInDownVariants}>
            <span className="badge-pluma pluma-underline block">{sectionBadge}</span>
          </motion.div>
          <motion.h2
            className="text-lg md:text-lg lg:text-lg font-bold leading-tight overflow-hidden"
            variants={fadeInRightVariants}
          >
            <motion.span className="block" variants={lineRevealVariants}>
              {sectionTitle}
            </motion.span>
          </motion.h2>
          <motion.p
            className="text-sm md:text-sm text-[#4B5563] leading-relaxed overflow-hidden"
            variants={fadeInUpVariants}
          >
            <motion.span className="block" variants={lineRevealVariants}>
              {sectionSubtitle}
            </motion.span>
          </motion.p>
        </motion.div>

        <motion.div
          variants={fadeInScaleVariants}
          transition={{ duration: 0.75 }}
          className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
        >
          {showSkeletons
            ? Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <SkeletonPaqueteCard key={`skeleton-paq-${i}`} />
              ))
            : filteredItems.map((item, index) => (
                <PaqueteCard
                  key={`${item.tipo}-${item.paquete.id}`}
                  paquete={item.paquete}
                  index={index}
                  fullWidth={true}
                />
              ))}
        </motion.div>
      </div>
    </section>
  );
}
