'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { BlogPost } from '@/types';

interface BlogCardProps {
  post: BlogPost;
  index?: number;
}

export default function BlogCard({ post, index = 0 }: BlogCardProps) {
  const direction = index % 2 === 0 ? -1 : 1;
  const vertical = index % 3 === 0 ? -1 : 1;
  const duration = 0.6 + (index % 3) * 0.05;
  const rawDate = post.fechaPublicacion || post.fechaCreacion;
  let date: Date | undefined;
  if (rawDate instanceof Date) {
    date = rawDate;
  } else if (rawDate && typeof rawDate === 'object' && 'toDate' in rawDate) {
    date = (rawDate as { toDate: () => Date }).toDate();
  } else if (rawDate) {
    date = new Date(rawDate as string);
  }
  const dateLabel = date
    ? new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(date as Date)
    : 'Reciente';

  const cardImage = post.imagenTarjeta || post.imagenPrincipal || '/logo.png';

  return (
    <motion.article
      initial={{
        opacity: 0,
        x: 50 * direction,
        y: 32 * vertical,
        scale: 0.98,
        rotate: 0.6 * direction,
        filter: 'blur(6px)',
      }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, x: -50 * direction, y: -24 * vertical, scale: 0.98, rotate: -0.4 * direction }}
      transition={{ duration, ease: [0.16, 1, 0.3, 1], delay: index * 0.08 }}
      viewport={{ once: true, margin: '-120px' }}
      className="group relative overflow-hidden rounded-2xl md:rounded-3xl bg-[#0B0B0C] shadow-[0_12px_32px_rgba(0,0,0,0.18)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_60px_rgba(0,0,0,0.25)]"
    >
      <Link href={`/blog/${post.slug}`} className="block h-full">
        <div className="relative aspect-[1/1] md:aspect-[4/5] overflow-hidden">
          <Image
            src={cardImage}
            alt={post.titulo}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5" />
        </div>
        <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-6">
          <div className="absolute top-4 right-4 opacity-0 translate-y-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0 pointer-events-none">
            <div className="h-9 w-9 rounded-full bg-success text-secondary flex items-center justify-center shadow-lg">
              <Eye className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-sm md:text-lg font-semibold text-white leading-snug line-clamp-2 md:line-clamp-3 mb-1 md:mb-2">
            {post.titulo}
          </h3>
          <p className="text-xs md:text-sm text-white/80 line-clamp-2 md:line-clamp-3">{post.extracto}</p>
          <div className="mt-3 md:mt-4 text-[11px] md:text-xs text-white/70 flex items-center gap-2">
            <span>{dateLabel}</span>
            <span className="text-white/40">•</span>
            <span>VIAGGIO TUR</span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
