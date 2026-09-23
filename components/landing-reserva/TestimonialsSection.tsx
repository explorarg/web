import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperType } from 'swiper';
import { Autoplay } from 'swiper/modules';
import 'swiper/css';
import { Card, CardContent } from '@/components/ui/card';
import type { Experience } from './types';
import { fadeLeft, fadeRight, fadeUp, staggerFast } from './animations';

type TestimonialsSectionProps = {
  testimonials: Experience['testimonials'];
};

export default function TestimonialsSection({ testimonials }: TestimonialsSectionProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const titleY = useTransform(scrollYProgress, [0, 1], [45, -45]);
  const shouldLoop = testimonials.length > 3;

  const countryFlags: Record<string, string> = {
    Argentina: '🇦🇷',
    Chile: '🇨🇱',
    Colombia: '🇨🇴',
    Perú: '🇵🇪',
    Mexico: '🇲🇽',
    México: '🇲🇽',
    Uruguay: '🇺🇾',
    Venezuela: '🇻🇪',
    Ecuador: '🇪🇨',
  };

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-cream">
      <motion.div
        className="relative z-10 mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 md:py-14"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-120px' }}
        variants={staggerFast}
      >
        <motion.div
          className="sherpa-title-chip mb-8 inline-flex items-center gap-2 px-4 py-2 text-black md:sticky md:top-6 z-10"
          variants={fadeUp}
          style={{ y: titleY }}
        >
          <span className="h-2 w-2 rounded-full bg-secondary" />
          <h2 className="text-base font-semibold text-black">Testimonios</h2>
          <span className="h-px w-6 bg-primary/50" />
        </motion.div>
        <motion.div className="mt-8" variants={staggerFast}>
          <Swiper
            modules={[Autoplay]}
            autoplay={
              shouldLoop
                ? {
                    delay: 3200,
                    disableOnInteraction: false,
                  }
                : false
            }
            loop={shouldLoop}
            spaceBetween={16}
            slidesPerView={1.05}
            breakpoints={{
              640: { slidesPerView: 1.4 },
              1024: { slidesPerView: 3 },
            }}
            className="landing-testimonials-swiper"
          >
            {testimonials.map((testimonial, index) => {
              const cardVariant = index % 3 === 0 ? fadeLeft : index % 3 === 1 ? fadeUp : fadeRight;
              return (
                <SwiperSlide key={`${testimonial.name}-${testimonial.quote.slice(0, 12)}`}>
                  <motion.div
                    variants={cardVariant}
                    whileHover={{ y: -6, scale: 1.01 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <Card className="sherpa-card">
                      <CardContent className="space-y-4 text-black/70">
                        <p className="text-base leading-relaxed text-black/80">“{testimonial.quote}”</p>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-black">{testimonial.name}</p>
                            {testimonial.role && (
                              <p className="text-sm text-black/60">{testimonial.role}</p>
                            )}
                          </div>
                          {testimonial.role && (
                            <span
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-base"
                              title={testimonial.role}
                            >
                              {countryFlags[testimonial.role] ?? '🌎'}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </SwiperSlide>
              );
            })}
          </Swiper>
        </motion.div>
      </motion.div>
    </section>
  );
}
