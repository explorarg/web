'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';

interface HeroProps {
  title?: string;
  subtitle?: string;
  backgroundImage?: string; // Fallback para compatibilidad
  backgroundImageMobile?: string;
  backgroundImageDesktop?: string;
  ctaText?: string;
  ctaLink?: string;
  bannerImages?: string[];
  activeBannerIndex?: number;
  onBannerIndexChange?: (nextIndex: number) => void;
  height?: 'sm' | 'md' | 'lg' | 'xl';
  /** Estética Río: fondo cream */
  theme?: 'default' | 'rio';
  children?: React.ReactNode;
}

export default function Hero({
  title,
  subtitle,
  backgroundImage,
  backgroundImageMobile,
  backgroundImageDesktop,
  ctaText,
  ctaLink,
  bannerImages,
  activeBannerIndex,
  onBannerIndexChange,
  height = 'lg',
  theme = 'default',
  children,
}: HeroProps) {
  const isRio = theme === 'rio';
  const heightClasses = {
    sm: 'h-[45vw] md:h-[320px] lg:h-[500px] 2xl:h-[500px]',
    md: 'h-[50vw] md:h-[360px] lg:h-[500px] 2xl:h-[500px]',
    lg: 'h-[55vw] md:h-[420px] lg:h-[500px] 2xl:h-[500px]',
    xl: 'h-[60vw] md:h-[460px] lg:h-[500px] 2xl:h-[500px]',
  };

  // Determinar qué imágenes usar
  const fallbackMobileImage = backgroundImageMobile || backgroundImage || '/images/hero-default.jpg';
  const fallbackDesktopImage = backgroundImageDesktop || backgroundImage || '/images/hero-default.jpg';
  const banners = (bannerImages && bannerImages.length > 0 ? bannerImages : [fallbackDesktopImage]).filter(
    Boolean
  );
  const resolvedIndex =
    typeof activeBannerIndex === 'number' && banners.length > 0
      ? ((activeBannerIndex % banners.length) + banners.length) % banners.length
      : 0;
  const desktopImage = banners[resolvedIndex] || fallbackDesktopImage;
  const mobileImage = banners[resolvedIndex] || fallbackMobileImage;
  const showIndicators = banners.length > 1;

  const handleBannerChange = (nextIndex: number) => {
    if (!onBannerIndexChange || banners.length <= 1) return;
    const normalized = ((nextIndex % banners.length) + banners.length) % banners.length;
    onBannerIndexChange(normalized);
  };

  const trimmedTitle = title?.trim();
  const trimmedSubtitle = subtitle?.trim();
  const hasContent = Boolean(trimmedTitle || trimmedSubtitle || (ctaText && ctaLink) || children);
  const lineRevealVariants = {
    hidden: { y: '100%' },
    visible: {
      y: '0%',
      transition: {
        duration: 0.7,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <div
      className={`relative z-0 w-full ${heightClasses[height]} flex items-center justify-center overflow-hidden ${isRio ? '' : 'bg-[#f4f4f4]'}`}
      data-theme={isRio ? 'rio' : undefined}
    >
      {/* Background Image Mobile: tema Río sin banda (imagen desde top-0) */}
      <div className={`absolute inset-x-0 bottom-0 md:hidden top-0`}>
        <div className="relative h-full w-full">
          <Image
            src={mobileImage}
            alt=""
            fill
            priority
            fetchPriority="high"
            className="object-cover object-center"
            quality={92}
            sizes="(max-width: 768px) 100vw, 100vw"
          />
        </div>
        {!isRio && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-3 gradient" />}
      </div>
      {/* Background Image Desktop: tema Río sin banda (imagen desde top-0) */}
      <div className={`hidden md:block absolute inset-x-0 bottom-0 top-0`}>
        <div className="relative h-full w-full">
          <Image
            src={desktopImage}
            alt=""
            fill
            priority
            fetchPriority="high"
            className="object-cover object-center"
            quality={85}
            sizes="100vw"
          />
        </div>
        {!isRio && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-3 gradient" />}
      </div>

      {showIndicators && (
        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/40 px-3 py-2 text-xs text-white backdrop-blur-sm">
          <span className="text-white/80">
            {resolvedIndex + 1}/{banners.length}
          </span>
          <div className="flex items-center gap-1.5">
            {banners.map((_, index) => (
              <button
                key={`hero-dot-${index}`}
                type="button"
                aria-label={`Ir al banner ${index + 1}`}
                className={`h-2 w-2 rounded-full transition ${
                  index === resolvedIndex ? 'bg-secondary' : 'bg-white/40 hover:bg-white/70'
                }`}
                onClick={() => handleBannerChange(index)}
              />
            ))}
          </div>
        </div>
      )}

      {hasContent && (
        <div className="relative z-10 container mx-auto px-4 text-center text-white">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="space-y-6"
          >
            {trimmedTitle && (
              <h1 className="text-lg md:text-lg lg:text-lg font-bold leading-tight overflow-hidden">
                <motion.span
                  className="block"
                  variants={lineRevealVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {trimmedTitle}
                </motion.span>
              </h1>
            )}
            {trimmedSubtitle && (
              <p className="text-base md:text-lg text-gray-200 max-w-3xl mx-auto overflow-hidden">
                <motion.span
                  className="block"
                  variants={lineRevealVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {trimmedSubtitle}
                </motion.span>
              </p>
            )}
            {ctaText && ctaLink && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                <Button
                  asChild
                  size="lg"
                  className="bg-secondary text-success-strong hover:bg-secondary/90 font-semibold text-base px-8 py-6"
                >
                  <a href={ctaLink}>
                    {ctaText}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                </Button>
              </motion.div>
            )}
            {children && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                {children}
              </motion.div>
            )}
          </motion.div>
        </div>
      )}

      {/* Scroll Indicator */}
      {!showIndicators && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-6 h-10 border-2 border-white rounded-full flex items-start justify-center p-2"
          >
            <div className="w-1 h-3 bg-white rounded-full" />
          </motion.div>
        </motion.div>
      )}

      {showIndicators && (
        <motion.div
          className="absolute inset-0 z-0 md:hidden"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (!onBannerIndexChange) return;
            const swipe = info.offset.x;
            if (swipe < -60) handleBannerChange(resolvedIndex + 1);
            if (swipe > 60) handleBannerChange(resolvedIndex - 1);
          }}
        />
      )}
    </div>
  );
}
