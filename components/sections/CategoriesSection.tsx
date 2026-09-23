'use client';

import { useState } from 'react';
import { motion, Variants } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import CategoriaCard from '@/components/CategoriaCard';
import { Categoria } from '@/types';

interface CategoriesSectionProps {
  categorias: Categoria[];
  fadeInUpVariants: Variants;
  staggerFastVariants: Variants;
}

export default function CategoriesSection({
  categorias,
  fadeInUpVariants,
  staggerFastVariants,
}: CategoriesSectionProps) {
  const [showAllCategorias, setShowAllCategorias] = useState(false);

  return (
    <section id="categorias" className="py-10 md:py-16 bg-[#F9FAFB] overflow-x-hidden">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <motion.div
          className="mb-16 md:mb-20 max-w-3xl"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-150px" }}
          variants={staggerFastVariants}
        >
          <motion.div className="inline-block mb-4" variants={fadeInUpVariants}>
            <span className="badge-pluma pluma-underline">Destinos</span>
          </motion.div>
          <motion.h2
            className="text-lg md:text-lg lg:text-lg font-bold leading-tight"
            variants={fadeInUpVariants}
          >
            Nuestros Destinos
          </motion.h2>
          <motion.p
            className="text-base md:text-lg text-[#4B5563] leading-relaxed"
            variants={fadeInUpVariants}
          >
            Explorá nuestras categorías y encontrá el viaje perfecto para vos
          </motion.p>
        </motion.div>

        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {categorias.length > 0 ? (
            categorias.map((categoria, index) => (
              <CategoriaCard key={categoria.id} categoria={categoria} index={index} />
            ))
          ) : (
            <motion.div
              className="col-span-full text-center py-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-base md:text-lg text-gray-400">
                No hay categorías destacadas disponibles
              </p>
            </motion.div>
          )}
        </div>

        <div className="md:hidden space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {categorias.length > 0 ? (
              categorias
                .slice(0, showAllCategorias ? categorias.length : 3)
                .map((categoria, index) => (
                  <CategoriaCard key={categoria.id} categoria={categoria} index={index} />
                ))
            ) : (
              <motion.div
                className="text-center py-20"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                <p className="text-base md:text-lg text-gray-400">
                  No hay categorías destacadas disponibles
                </p>
              </motion.div>
            )}
          </div>

          {categorias.length > 3 && !showAllCategorias && (
            <motion.div
              className="flex justify-center pt-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <button
                onClick={() => setShowAllCategorias(true)}
                className="inline-flex items-center justify-center bg-secondary hover:bg-secondary/90 text-success-strong px-8 py-3 rounded-xl font-semibold transition-all duration-300 shadow-md hover:shadow-lg"
              >
                Ver todos los destinos ({categorias.length})
                <ArrowRight className="ml-2 h-5 w-5" />
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  );
}
