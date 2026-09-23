'use client';

import { motion } from 'framer-motion';
import type { Experience } from './types';
import { fadeUp, staggerFast } from './animations';

type MidVideoSectionProps = {
  experience: Experience;
};

const YOUTUBE_ID_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;

export default function MidVideoSection({ experience }: MidVideoSectionProps) {
  const hasTiktok = !!experience.midTiktokVideoId?.trim();
  const hasLocal = !!experience.midVideoUrl?.trim();
  const hasYoutube = !!experience.midYoutubeVideoUrl?.trim();
  const ytId = experience.midYoutubeVideoUrl?.trim().match(YOUTUBE_ID_REGEX)?.[1];
  const overlayText = experience.midVideoOverlayText?.trim() ?? '';

  if (!hasTiktok && !hasLocal && !hasYoutube) return null;

  return (
    <section className="relative overflow-hidden bg-cream py-10 md:py-14">
      <motion.div
        className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-80px' }}
        variants={staggerFast}
      >
        <motion.div
          className="relative mx-auto w-full max-w-[680px] overflow-hidden rounded-3xl bg-transparent"
          variants={fadeUp}
        >
          {hasTiktok ? (
            <div className="relative mx-auto w-full max-w-[520px]">
              <div className="relative aspect-9/16 w-full overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/10">
                <iframe
                  src={`https://www.tiktok.com/player/v1/${experience.midTiktokVideoId!.trim()}?autoplay=0&loop=1&controls=1&play_button=1&volume_control=1&fullscreen_button=1&timestamp=0&music_info=0&description=0&closed_caption=0`}
                  className="absolute inset-0 h-full w-full"
                  allow="encrypted-media; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                  title="Video de TikTok"
                />
                {overlayText && (
                  <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-full bg-black/50 px-3 py-1 text-center text-xs font-semibold text-cream backdrop-blur">
                    {overlayText}
                  </div>
                )}
              </div>
            </div>
          ) : hasLocal ? (
            <div className="relative mx-auto w-full max-w-[520px]">
              <video
                className="aspect-9/16 w-full rounded-3xl object-cover"
                muted={false}
                loop
                playsInline
                controls
                preload="metadata"
                src={experience.midVideoUrl}
              />
              {overlayText && (
                <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-full bg-black/50 px-3 py-1 text-center text-xs font-semibold text-cream backdrop-blur">
                  {overlayText}
                </div>
              )}
            </div>
          ) : ytId ? (
            <div className="relative mx-auto w-full max-w-[520px]">
              <div className="relative aspect-9/16 w-full overflow-hidden rounded-3xl shadow-xl ring-1 ring-black/10">
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}?autoplay=0&mute=0&controls=1&loop=1&playlist=${ytId}&playsinline=1`}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title="Video de YouTube"
                />
                {overlayText && (
                  <div className="pointer-events-none absolute bottom-3 left-3 right-3 rounded-full bg-black/50 px-3 py-1 text-center text-xs font-semibold text-cream backdrop-blur">
                    {overlayText}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </motion.div>
      </motion.div>
    </section>
  );
}
