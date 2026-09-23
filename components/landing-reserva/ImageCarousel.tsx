'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, type Variants, useScroll, useTransform } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperType } from 'swiper';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { fadeLeft, fadeRight, fadeUp, staggerFast } from './animations';

type ImageCarouselProps = {
  images: string[];
  title: string;
  intro?: string;
};

export default function ImageCarousel({ images, title, intro }: ImageCarouselProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const prevRef = useRef<HTMLButtonElement | null>(null);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  const paginationRef = useRef<HTMLDivElement | null>(null);
  const swiperRef = useRef<SwiperType | null>(null);
  const [navState, setNavState] = useState({
    isLocked: false,
    isBeginning: true,
    isEnd: false,
  });
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const sectionY = useTransform(scrollYProgress, [0, 1], [70, -70]);
  const layerOneY = useTransform(scrollYProgress, [0, 1], [55, -55]);
  const layerTwoY = useTransform(scrollYProgress, [0, 1], [-45, 45]);
  const carouselItem: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.18, ease: 'easeOut' },
    },
  };

  const updateNavState = (swiper: SwiperType) => {
    setNavState({
      isLocked: swiper.isLocked,
      isBeginning: swiper.isBeginning,
      isEnd: swiper.isEnd,
    });
  };

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      <motion.div
        className="relative z-10 mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6 md:py-10"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-120px' }}
        variants={staggerFast}
        style={{ y: sectionY }}
      >
        <motion.div
          className="pointer-events-none absolute -left-16 top-8 h-40 w-40 rounded-full bg-secondary/20 blur-3xl"
          style={{ y: layerOneY }}
        />
        <motion.div
          className="pointer-events-none absolute -right-12 bottom-10 h-48 w-48 rounded-full bg-primary/15 blur-3xl"
          style={{ y: layerTwoY }}
        />
        <motion.div
          className="sherpa-title-chip mb-6 inline-flex items-center gap-2 px-4 py-2 text-black md:sticky md:top-6 z-10 sm:mb-8"
          variants={staggerFast}
        >
          <span className="h-2 w-2 rounded-full bg-secondary" />
          <motion.h2 className="text-base font-semibold text-black" variants={fadeLeft}>
            Experiencias
          </motion.h2>
          <span className="h-px w-6 bg-primary/50" />
        </motion.div>
        {intro && (
          <motion.p className="text-sm text-black/60" variants={fadeUp}>
            {intro}
          </motion.p>
        )}

        <motion.div className={intro ? 'mt-5 sm:mt-6' : 'mt-7 sm:mt-8'} variants={staggerFast}>
          <div className="relative">
            <button
              type="button"
              ref={prevRef}
              className={`landing-swiper-prev absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/60 bg-white/80 p-2 text-primary shadow-lg backdrop-blur transition hover:bg-white sm:flex ${
                navState.isLocked || navState.isBeginning ? 'opacity-0 pointer-events-none' : ''
              }`}
              aria-label="Ver imágenes anteriores"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              ref={nextRef}
              className={`landing-swiper-next absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/60 bg-white/80 p-2 text-primary shadow-lg backdrop-blur transition hover:bg-white sm:flex ${
                navState.isLocked || navState.isEnd ? 'opacity-0 pointer-events-none' : ''
              }`}
              aria-label="Ver imágenes siguientes"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <Swiper
            modules={[Navigation, Pagination]}
            onBeforeInit={(swiper) => {
              swiperRef.current = swiper;
            }}
            onInit={(swiper) => {
              if (swiper.params.navigation && typeof swiper.params.navigation === 'object') {
                swiper.params.navigation.prevEl = prevRef.current;
                swiper.params.navigation.nextEl = nextRef.current;
                swiper.navigation.init();
                swiper.navigation.update();
              }
              if (swiper.params.pagination && typeof swiper.params.pagination === 'object') {
                swiper.params.pagination.el = paginationRef.current;
                swiper.pagination.init();
                swiper.pagination.update();
              }
              updateNavState(swiper);
            }}
              onSlideChange={(swiper) => updateNavState(swiper)}
              onResize={(swiper) => updateNavState(swiper)}
              onBreakpoint={(swiper) => updateNavState(swiper)}
              navigation={{
                prevEl: '.landing-swiper-prev',
                nextEl: '.landing-swiper-next',
              }}
            pagination={{ clickable: true, el: '.landing-gallery-pagination' }}
            spaceBetween={16}
            slidesPerView={1.05}
            breakpoints={{
              640: { slidesPerView: 1.6 },
              1024: { slidesPerView: 3 },
            }}
              className="landing-gallery-swiper"
          >
            {images.map((src, index) => (
              <SwiperSlide key={src}>
                <motion.div
                    className="relative h-48 overflow-hidden rounded-2xl bg-gray-200 shadow-sm sm:h-56"
                    whileHover={{ scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 18 }}
                  variants={carouselItem}
                >
                  <Image
                    src={src}
                    alt={`${title} - imagen ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </motion.div>
              </SwiperSlide>
            ))}
            </Swiper>
          </div>
          <motion.div className="mt-5 flex items-center justify-center" variants={fadeUp}>
            <div
              ref={paginationRef}
              className={`landing-gallery-pagination flex items-center gap-2 ${
                navState.isLocked ? 'opacity-0 pointer-events-none' : ''
              }`}
            />
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
