'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { Categoria } from '@/types';

interface CategoriaCardProps {
  categoria: Categoria;
  index?: number;
}

export default function CategoriaCard({ categoria, index = 0 }: CategoriaCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <Link href={`/categoria/${categoria.slug}`}>
        <Card className="group relative overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_12px_28px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(0,0,0,0.22)] cursor-pointer py-0 gap-0">
          <div className="relative aspect-[4/3] overflow-hidden">
            <Image
              src={categoria.imagen || '/images/placeholder-category.jpg'}
              alt={categoria.nombre}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              loading={index < 3 ? 'eager' : 'lazy'}
              priority={index < 3}
              quality={85}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
            <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(70%_60%_at_70%_20%,rgba(255,255,255,0.18),transparent)]" />
            <div className="absolute top-4 left-4">
              <span className="inline-flex items-center rounded-full bg-white text-primary px-3 py-1 text-xs font-semibold tracking-wide shadow-md">
                Destinos
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5 text-white">
              <div className="rounded-xl p-4">
                <h3 className="text-lg md:text-xl font-bold mb-2 text-white drop-shadow-sm">
                  {categoria.nombre}
                </h3>
                <p className="text-sm md:text-base text-white/80 line-clamp-2">
                  {categoria.descripcion}
                </p>
                <div className="mt-4 inline-flex items-center text-sm font-semibold text-primary bg-white/95 px-3 py-1.5 rounded-full shadow-md transition-all duration-300 group-hover:bg-white">
                  Explorar destino
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}

