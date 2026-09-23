'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { Experience } from './types';
import ScrollToReservaButton from './ScrollToReservaButton';
import WhatsAppCtaButton from './WhatsAppCtaButton';
import { fadeDown, fadeRight, fadeUp, scaleIn, staggerFast } from './animations';
import { SITE_NAME } from '@/lib/constants';
import { getBrandLogoSrc, isRemoteUrl, renderTemplate, siteConfig } from '@/lib/siteConfig';

type HeroSectionProps = {
  experience: Experience;
  whatsappLink: string;
  /** Si es true, no se muestra el botón de WhatsApp en el hero (se usa un botón flotante en la página). */
  hideWhatsApp?: boolean;
};

export default function HeroSection({ experience, whatsappLink, hideWhatsApp }: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const logoSrc = getBrandLogoSrc();
  const logoAlt = renderTemplate(siteConfig.branding.logo.altTextTemplate || '{{siteName}} Logo');
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const mediaY = useTransform(scrollYProgress, [0, 1], [0, 0]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, 0]);
  const noticeY = useTransform(scrollYProgress, [0, 1], [0, -45]);

  return (
    <motion.section
      ref={sectionRef}
      className="relative overflow-hidden bg-transparent"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-120px' }}
      variants={staggerFast}
    >
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-4 pt-4 sm:px-6 md:pb-6">
        <motion.div
          className="group relative mx-auto inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-xs font-semibold text-primary shadow-sm backdrop-blur-sm transition sm:text-sm sm:backdrop-blur"
          variants={fadeDown}
          style={{ y: noticeY }}
          whileHover={{ scale: 1.02 }}
        >
          <motion.span
            className="relative h-2 w-2 rounded-full bg-secondary shadow-[0_0_12px_rgba(83,171,41,0.8)]"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <Sparkles className="h-4 w-4 text-primary/80" />
          <span>{experience.topNoticeText}</span>
          <span className="absolute inset-0 rounded-full bg-linear-to-r from-transparent via-primary/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </motion.div>

        <motion.div className="mt-3 flex justify-start" variants={fadeUp}>
          <div className="flex items-center gap-3 rounded-full border border-primary/10 bg-white/85 px-3 py-1.5 shadow-sm backdrop-blur">
            {isRemoteUrl(logoSrc) ? (
              <img
                src={logoSrc}
                alt={logoAlt}
                className="h-6 w-auto sm:h-7 object-contain"
              />
            ) : (
              <Image
                src={logoSrc}
                alt={logoAlt}
                width={88}
                height={28}
                className="h-6 w-auto sm:h-7"
              />
            )}
            <span className="font-logo text-primary text-xl leading-none whitespace-nowrap">
              {siteConfig.branding.logo.titleText}
            </span>
          </div>
        </motion.div>

        <div className="mt-6 flex flex-col items-center gap-6">
          <motion.div
            className="w-full max-w-3xl space-y-3 text-center"
            variants={staggerFast}
            style={{ y: textY }}
          >
            <motion.h1 className="text-3xl font-semibold text-black sm:text-4xl md:text-5xl" variants={fadeRight}>
              {experience.title}
            </motion.h1>
            <motion.p className="font-subtitle text-base text-black/70 md:text-lg" variants={fadeUp}>
              {experience.subtitle}
            </motion.p>
            <motion.p className="text-sm text-black/60" variants={fadeUp}>
              {experience.supportText}
            </motion.p>
          </motion.div>

          <motion.div
            className="relative w-full max-w-[680px] overflow-hidden rounded-3xl bg-transparent"
            variants={fadeUp}
            style={{ y: mediaY }}
            transition={{ duration: 0.4 }}
          >
            {experience.tiktokVideoId ? (
              <div className="relative mx-auto w-full max-w-[520px]">
                <div className="relative aspect-9/16 w-full overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/10">
                  <iframe
                    src={`https://www.tiktok.com/player/v1/${experience.tiktokVideoId}?autoplay=1&loop=1&controls=1&progress_bar=0&play_button=1&volume_control=1&fullscreen_button=1&timestamp=0&music_info=0&description=0&closed_caption=0`}
                    className="absolute inset-0 h-full w-full"
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                    title="Video de TikTok"
                  />
                  <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-full bg-black/50 px-3 py-1 text-center text-xs font-semibold text-cream backdrop-blur">
                    {experience.videoOverlayText}
                  </div>
                </div>
              </div>
            ) : experience.videoUrl ? (
              <div className="relative mx-auto w-full max-w-[520px]">
                <video
                  className="aspect-9/16 w-full rounded-3xl object-cover"
                  autoPlay
                  muted={false}
                  loop
                  playsInline
                  controls
                  preload="auto"
                  src={experience.videoUrl}
                />
                <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-full bg-black/50 px-3 py-1 text-center text-xs font-semibold text-cream backdrop-blur">
                  {experience.videoOverlayText}
                </div>
              </div>
            ) : experience.youtubeVideoUrl?.trim() ? (
              (() => {
                const ytId = experience.youtubeVideoUrl.trim().match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
                if (!ytId) return null;
                const embedSrc = `https://www.youtube.com/embed/${ytId}?autoplay=1&mute=0&controls=1&loop=1&playlist=${ytId}&playsinline=1`;
                return (
                  <div className="relative mx-auto w-full max-w-[520px]">
                    <div className="relative aspect-9/16 w-full overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/10">
                      <iframe
                        src={embedSrc}
                        className="absolute inset-0 h-full w-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                        title="Video de YouTube"
                      />
                      <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-full bg-black/50 px-3 py-1 text-center text-xs font-semibold text-cream backdrop-blur">
                        {experience.videoOverlayText}
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : null}
            {!experience.tiktokVideoId && !experience.videoUrl && !experience.youtubeVideoUrl?.trim() ? (
              <div className="relative flex aspect-video items-center justify-center bg-linear-to-br from-primary via-success to-secondary">
                <div className="text-center text-white">
                  <p className="text-lg font-semibold">Video de la experiencia</p>
                  <p className="text-sm text-white/80">Próximamente</p>
                </div>
                <Image
                  src="/images/hero-placeholder.svg"
                  alt="Vista previa"
                  width={220}
                  height={140}
                  className="absolute bottom-4 right-4 hidden md:block"
                />
              </div>
            ) : null}
          </motion.div>

          <motion.div
            className="mt-1 flex w-full max-w-[520px] flex-col items-center gap-3 sm:flex-row sm:justify-center"
            variants={fadeUp}
          >
            {!hideWhatsApp && (
              <WhatsAppCtaButton href={whatsappLink} className="w-full max-w-[320px] sm:w-auto sm:max-w-none" />
            )}
            <ScrollToReservaButton className="w-full max-w-[320px] sm:w-auto sm:max-w-none" />
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}
