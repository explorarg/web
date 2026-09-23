'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ZoomIn } from 'lucide-react';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';
import WhatsAppButton from '@/components/WhatsAppButton';

type TransportImage = {
  src: string;
  alt: string;
  aspectClassName: string;
};

const IMAGES: TransportImage[] = [
  { src: '/images/pexels-wanderer-731217.jpg', alt: 'Transporte turístico', aspectClassName: 'aspect-[4/5]' },
  { src: '/images/pexels-igor-fedoriv-315288-1260991.jpg', alt: 'Servicio de traslado', aspectClassName: 'aspect-square' },
  { src: '/images/pexels-wanderer-731217.jpg', alt: 'Viajes y excursiones', aspectClassName: 'aspect-[3/4]' },
  { src: '/images/pexels-igor-fedoriv-315288-1260991.jpg', alt: 'Traslados grupales', aspectClassName: 'aspect-[16/10]' },
  { src: '/images/pexels-wanderer-731217.jpg', alt: 'Comodidad a bordo', aspectClassName: 'aspect-[4/3]' },
  { src: '/images/pexels-igor-fedoriv-315288-1260991.jpg', alt: 'Unidad habilitada', aspectClassName: 'aspect-[5/6]' },
  { src: '/images/pexels-wanderer-731217.jpg', alt: 'Transporte para eventos', aspectClassName: 'aspect-[9/16]' },
];

const fadeInLeftVariants = {
  hidden: { opacity: 0, x: -60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
  },
};

const fadeInRightVariants = {
  hidden: { opacity: 0, x: 60 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
  },
};

const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2, delayChildren: 0.15 },
  },
};

export default function TransportesPage() {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const slides = useMemo(() => IMAGES.map((img) => ({ src: img.src })), []);

  return (
    <>
      <Navbar variant="homeMockup" reserveSpace />
      <WhatsAppButton />

      <main className="bg-white min-h-screen pt-32 md:pt-40">
        <section className="relative py-16 md:py-24 bg-[#F9FAFB] overflow-hidden">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[-12%] right-[6%] w-[460px] h-[460px] bg-primary/5 rounded-full blur-[110px] opacity-70" />
            <div className="absolute bottom-[-18%] left-[-10%] w-[520px] h-[520px] bg-secondary/5 rounded-full blur-[120px] opacity-70" />
          </div>

          <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
              <motion.div
                className="space-y-6 order-2 lg:order-1 text-left"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                variants={staggerContainerVariants}
              >
                <motion.div className="inline-block mb-2" variants={fadeInLeftVariants}>
                  <span className="inline-block py-1.5 px-4 rounded-full bg-primary/10 text-primary text-xs md:text-sm font-bold tracking-widest uppercase shadow-[0_2px_10px_rgba(76,175,80,0.1)]">
                    Servicio
                  </span>
                </motion.div>

                <motion.h1
                  className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-6 tracking-tight leading-[1.1]"
                  variants={fadeInLeftVariants}
                >
                  Transporte{' '}
                  <span className="text-primary relative whitespace-nowrap">
                    para grupos
                    <svg
                      className="absolute -bottom-2 left-0 w-full h-3 text-secondary/30"
                      viewBox="0 0 100 10"
                      preserveAspectRatio="none"
                    >
                      <path
                        d="M0 5 Q 50 10 100 5"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="transparent"
                        strokeLinecap="round"
                      />
                    </svg>
                  </span>
                </motion.h1>

                <div className="space-y-5 mt-8">
                  <motion.p
                    className="text-lg md:text-xl text-gray-500 font-light leading-relaxed text-left"
                    variants={fadeInLeftVariants}
                  >
                    Realizamos traslados para instituciones, empresas y grupos, con unidades habilitadas y un servicio pensado para
                    viajar cómodo, seguro y a tiempo.
                  </motion.p>
                  <motion.p className="text-base text-gray-500 font-light leading-relaxed" variants={fadeInLeftVariants}>
                    Coordinamos la logística completa según tu necesidad: salidas educativas, deportivos, eventos, excursiones y más.
                  </motion.p>
                  <motion.p className="text-base text-gray-500 font-light leading-relaxed" variants={fadeInLeftVariants}>
                    Consultanos por disponibilidad, recorridos y presupuestos personalizados.
                  </motion.p>
                </div>
              </motion.div>

              <motion.div
                className="relative order-1 lg:order-2"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: '-80px' }}
                variants={fadeInRightVariants}
              >
                <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 to-secondary/5 rounded-[2.5rem] transform rotate-2 -z-10 blur-sm" />

                <div className="relative rounded-3xl overflow-hidden border border-secondary/30 bg-white/70 backdrop-blur-sm shadow-[0_20px_50px_rgb(0,0,0,0.08)] p-4 md:p-6">
                  <div className="columns-2 gap-4">
                    {IMAGES.map((img, index) => (
                      <button
                        key={`${img.src}-${index}`}
                        type="button"
                        className="mb-4 w-full break-inside-avoid group"
                        onClick={() => setLightboxIndex(index)}
                        aria-label={`Abrir imagen ${index + 1}`}
                      >
                        <div className={`relative w-full ${img.aspectClassName} rounded-2xl overflow-hidden bg-[#F3F4F6]`}>
                          <Image
                            src={img.src}
                            alt={img.alt}
                            fill
                            className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                            sizes="(max-width: 1024px) 100vw, 50vw"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors duration-300 flex items-center justify-center">
                            <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <HomeFooter />

      <Lightbox
        open={lightboxIndex !== null}
        close={() => setLightboxIndex(null)}
        index={lightboxIndex ?? 0}
        slides={slides}
        plugins={[Zoom]}
        styles={{ container: { zIndex: 120 } }}
      />
    </>
  );
}

