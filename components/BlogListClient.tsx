"use client";

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Clock } from 'lucide-react';
import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';
import WhatsAppButton from '@/components/WhatsAppButton';
import { BlogPost } from '@/types';

interface BlogListClientProps {
  posts: BlogPost[];
  banners: string[];
}

const TODAS = 'Todas';

function toDate(value: BlogPost['fechaPublicacion']): Date | null {
  if (!value) return null;
  const seconds = (value as unknown as { seconds?: number }).seconds;
  if (typeof seconds === 'number') return new Date(seconds * 1000);
  if (value instanceof Date) return value;
  const parsed = new Date(value as unknown as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: BlogPost['fechaPublicacion']) {
  const date = toDate(value);
  if (!date) return '';
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function PostMeta({ post, tone = 'dark' }: { post: BlogPost; tone?: 'dark' | 'light' }) {
  const muted = tone === 'light' ? 'text-white/70' : 'text-[#A6B2C0]';
  const accent = tone === 'light' ? 'text-white' : 'text-[#2BB8BF]';
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${muted}`}>
      {post.categoria ? <span className={accent}>{post.categoria}</span> : null}
      <span>{formatDate(post.fechaPublicacion)}</span>
      {post.tiempoLectura ? (
        <span className="inline-flex items-center gap-1 normal-case tracking-normal">
          <Clock className="h-3 w-3" />
          {post.tiempoLectura} min
        </span>
      ) : null}
    </div>
  );
}

export default function BlogListClient({ posts }: BlogListClientProps) {
  const [categoria, setCategoria] = useState(TODAS);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      if (p.categoria?.trim()) set.add(p.categoria.trim());
    });
    return [TODAS, ...Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))];
  }, [posts]);

  const filtered = useMemo(
    () => (categoria === TODAS ? posts : posts.filter((p) => p.categoria === categoria)),
    [posts, categoria]
  );

  // La nota destacada a pantalla completa solo tiene sentido con varias notas cargadas
  const useLead = filtered.length >= 4;
  const lead = useLead ? filtered[0] : null;
  const rest = useLead ? filtered.slice(1) : filtered;

  return (
    <div className="min-h-[100dvh] w-full min-w-0 overflow-x-clip bg-[#F5FAFF]">
      <Navbar variant="homeMockup" reserveSpace />
      <WhatsAppButton />

      <section className="border-b border-[#E4EDF6] pt-16 md:pt-20">
        <div className="container mx-auto px-4 py-14 md:px-6 md:py-20 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between"
          >
            <div className="max-w-2xl">
              <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#A1ACB8]">
                Diario de viaje
              </div>
              <h1 className="mt-4 text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#112B49] md:text-[46px]">
                Historias que
                <br />
                {/* La tipografía script necesita más interlineado propio */}
                <span className="mt-1 inline-block font-logo text-[1.1em] italic font-normal leading-[1.45] text-[#2BB8BF]">
                  inspiran
                </span>
              </h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-[#8A98A8] md:text-base">
                Recomendaciones, novedades y relatos para planificar mejor tu próximo viaje.
              </p>
            </div>
            <div className="text-sm text-[#A6B2C0]">
              {posts.length} {posts.length === 1 ? 'nota publicada' : 'notas publicadas'}
            </div>
          </motion.div>

          {categorias.length > 2 && (
            <div className="mt-10 flex flex-wrap gap-2">
              {categorias.map((c) => {
                const isActive = c === categoria;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategoria(c)}
                    className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      isActive ? 'text-white' : 'text-[#6B7C8F] hover:text-[#112B49]'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="blog-filter-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                        className="absolute inset-0 rounded-full bg-[#112B49]"
                      />
                    )}
                    <span className="relative">{c}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 md:px-6 md:py-16 lg:px-8">
        {filtered.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[#E4EDF6] py-20 text-center text-sm text-[#A6B2C0]">
            Todavía no hay notas publicadas en esta categoría.
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={categoria}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {lead ? (
              <Link
                href={`/blog/${lead.slug}`}
                className="group relative block h-[380px] overflow-hidden rounded-[28px] bg-[#0B2233] md:h-[520px]"
              >
                <Image
                  src={
                    lead.imagenPortada ||
                    lead.imagenTarjeta ||
                    lead.imagenPrincipal ||
                    '/images/hero-placeholder.svg'
                  }
                  alt={lead.titulo}
                  fill
                  priority
                  className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
                  sizes="100vw"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,28,48,0)_30%,rgba(7,28,48,0.55)_65%,rgba(7,28,48,0.94)_100%)]" />

                <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
                  <PostMeta post={lead} tone="light" />
                  <h2 className="mt-3 max-w-3xl text-[26px] font-extrabold leading-[1.08] tracking-[-0.03em] text-white md:text-[40px]">
                    {lead.titulo}
                  </h2>
                  <p className="mt-3 hidden max-w-xl text-sm leading-relaxed text-white/75 md:block">
                    {lead.extracto}
                  </p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-white">
                    <span className="relative">
                      Leer nota
                      <span className="absolute -bottom-1 left-0 h-px w-0 bg-white transition-all duration-500 group-hover:w-full" />
                    </span>
                    <ArrowUpRight className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1" />
                  </span>
                </div>
              </Link>
              ) : null}

              {rest.length > 0 && (
                <div className={`grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${lead ? 'mt-10 md:mt-14' : ''}`}>
                  {rest.map((post, index) => (
                    <motion.article
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-100px' }}
                      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: (index % 4) * 0.06 }}
                    >
                      <Link href={`/blog/${post.slug}`} className="group block">
                        <div className="relative aspect-4/3 overflow-hidden rounded-[22px] bg-[#EAF4FB]">
                          <Image
                            src={
                              post.imagenTarjeta ||
                              post.imagenPrincipal ||
                              '/images/hero-placeholder.svg'
                            }
                            alt={post.titulo}
                            fill
                            className="object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.06]"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                          />
                        </div>

                        <div className="mt-5">
                          <PostMeta post={post} />
                          <h3 className="mt-2.5 line-clamp-2 text-[19px] font-bold leading-[1.22] tracking-[-0.025em] text-[#112B49] transition-colors group-hover:text-[#187AA6]">
                            {post.titulo}
                          </h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#8A98A8]">
                            {post.extracto}
                          </p>

                          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#112B49]">
                            <span className="relative">
                              Leer nota
                              <span className="absolute -bottom-1 left-0 h-px w-0 bg-[#2BB8BF] transition-all duration-500 group-hover:w-full" />
                            </span>
                            <ArrowUpRight className="h-4 w-4 text-[#2BB8BF] transition-transform duration-500 group-hover:translate-x-1 group-hover:-translate-y-1" />
                          </div>
                        </div>
                      </Link>
                    </motion.article>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </section>

      <HomeFooter />
    </div>
  );
}
