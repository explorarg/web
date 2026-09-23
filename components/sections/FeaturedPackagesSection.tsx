'use client';

import { motion, Variants } from 'framer-motion';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PaqueteCard from '@/components/PaqueteCard';
import { Paquete } from '@/types';

interface FeaturedPackagesSectionProps {
  paquetes: Paquete[];
  fadeInUpVariants: Variants;
  staggerFastVariants: Variants;
}

export default function FeaturedPackagesSection({
  paquetes,
  fadeInUpVariants,
  staggerFastVariants,
}: FeaturedPackagesSectionProps) {
  if (paquetes.length === 0) return null;

  return (
    <section className="py-8 md:py-12 bg-white border-t border-gray-200 overflow-x-hidden">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="mb-16 md:mb-20 max-w-3xl"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-150px" }}
          variants={staggerFastVariants}
        >
          <motion.div className="inline-block mb-4" variants={fadeInUpVariants}>
            <span className="badge-pluma pluma-underline">Destacados</span>
          </motion.div>
          <motion.h2
            className="text-lg md:text-lg lg:text-lg font-bold leading-tight"
            variants={fadeInUpVariants}
          >
            Paquetes Destacados
          </motion.h2>
          <motion.p
            className="text-base md:text-lg text-[#4B5563] leading-relaxed"
            variants={fadeInUpVariants}
          >
            Los mejores paquetes turísticos seleccionados especialmente para vos
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {paquetes.map((paquete, index) => (
            <PaqueteCard key={paquete.id} paquete={paquete} index={index} fullWidth={true} />
          ))}
        </div>

        <motion.div
          className="flex justify-center mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Button
            asChild
            size="lg"
            className="px-8 py-6 text-base rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300"
          >
            <Link href="/paquetes">
              Ver todos los paquetes
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
