'use client';

import Image from 'next/image';
import { motion, useScroll, useSpring } from 'framer-motion';
import { GraduationCap, ShieldCheck, BadgeCheck, ClipboardList, Clock3, CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade, Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-fade';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import Navbar from '@/components/Navbar';
import HomeFooter from '@/components/home/HomeFooter';
import WhatsAppButton from '@/components/WhatsAppButton';
import ContactSection from '@/components/ContactSection';

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

export default function EducativosPage() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.25 });

  return (
    <>
      <Navbar variant="homeMockup" reserveSpace />
      <WhatsAppButton />

      <motion.div
        aria-hidden="true"
        className="fixed bottom-0 left-0 right-0 h-1 bg-success origin-left z-[120]"
        style={{ scaleX: progress }}
      />

      <main className="bg-white min-h-screen pt-32 md:pt-40">
        <section className="relative overflow-hidden bg-[#F9FAFB]">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />
            <div className="absolute inset-0 opacity-[0.35] bg-[radial-gradient(circle_at_1px_1px,rgba(17,24,39,0.08)_1px,transparent_0)] [background-size:28px_28px]" />
          </div>

          <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10 py-14 md:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-120px' }} variants={stagger}>
                <motion.div variants={fadeUp} className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-xs md:text-sm font-bold tracking-widest uppercase">
                  <GraduationCap className="h-4 w-4" aria-hidden="true" />
                  Educativos
                </motion.div>
                <motion.h1 variants={fadeUp} className="mt-5 text-3xl md:text-5xl font-extrabold text-gray-900 tracking-tight leading-[1.08]">
                  Viajes Educativos que dejan huella.
                </motion.h1>
                <motion.p variants={fadeUp} className="mt-5 text-base md:text-lg text-gray-600 leading-relaxed">
                  Diseñamos experiencias pedagógicas a medida, donde la seguridad y la organización son nuestra prioridad
                  para que ustedes solo se preocupen por aprender.
                </motion.p>

                <motion.div variants={fadeUp} className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <a
                    href="#cotizar"
                    className="group relative inline-flex items-center justify-center rounded-xl bg-success text-white px-5 py-3 text-sm font-semibold shadow-lg transition hover:bg-success/90 focus:outline-none focus:ring-2 focus:ring-success/30 focus:ring-offset-2 focus:ring-offset-[#F9FAFB]"
                  >
                    <span className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(120px_120px_at_20%_20%,rgba(255,255,255,0.35),transparent)]" />
                    Cotizar Salida Escolar
                  </a>
                  <div className="flex items-center gap-2 text-sm text-gray-600 justify-center sm:justify-start">
                    <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                    Seguridad + logística integral
                  </div>
                </motion.div>
              </motion.div>

              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-120px' }} variants={fadeIn} className="relative">
                <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 to-secondary/10 rounded-[2.25rem] -z-10 blur-sm" />
                <div className="relative overflow-hidden rounded-3xl border border-secondary/30 bg-white/80 backdrop-blur-sm shadow-[0_20px_50px_rgb(0,0,0,0.08)]">
                  <div className="relative h-[260px] sm:h-[320px] lg:h-[420px]">
                    <Image
                      src="/images/pexels-igor-fedoriv-315288-1260991.jpg"
                      alt="Viajes educativos para instituciones"
                      fill
                      className="object-cover object-center"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      priority
                    />
                    <div className="absolute inset-0 bg-linear-to-b from-black/0 via-black/10 to-black/55" />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="relative py-14 md:py-20 bg-white">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          </div>
          <div className="container mx-auto px-4 md:px-6 lg:px-8">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-120px' }} variants={stagger} className="max-w-3xl">
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-gray-500">
                Servicios
                <span className="h-px w-10 bg-gradient-to-r from-primary/40 to-transparent" aria-hidden="true" />
              </motion.div>
              <motion.h2 variants={fadeUp} className="mt-3 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">
                Una propuesta clara para cada tipo de salida
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-3 text-gray-600 text-base md:text-lg leading-relaxed">
                Coordinación logística total, con tiempos ordenados y acompañamiento real.
              </motion.p>
            </motion.div>

            <div className="mt-10 space-y-8">
              {[
                {
                  title: 'Salidas Educativas',
                  desc: 'Traslados a museos, teatros y centros culturales. Coordinación logística total para que los tiempos se cumplan a la perfección.',
                  bullets: ['Coordinación de horarios', 'Logística puerta a puerta', 'Equipo de acompañamiento'],
                  images: ['/images/pexels-wanderer-731217.jpg', '/images/pexels-igor-fedoriv-315288-1260991.jpg'],
                },
                {
                  title: 'Viajes Recreativos',
                  desc: 'Excursiones y campamentos con gestión integral de actividades, alojamiento y transporte interno.',
                  bullets: ['Alojamiento y actividades', 'Itinerarios flexibles', 'Soporte en todo el viaje'],
                  images: ['/images/pexels-igor-fedoriv-315288-1260991.jpg', '/images/pexels-wanderer-731217.jpg'],
                },
                {
                  title: 'Viajes Nacionales',
                  desc: 'Organización de viajes de estudio en todo el país. Incluye coordinación permanente, hotelería y cobertura de seguros.',
                  bullets: ['Hotelería + traslados', 'Cobertura de seguros', 'Coordinación permanente'],
                  images: ['/images/pexels-wanderer-731217.jpg', '/images/pexels-igor-fedoriv-315288-1260991.jpg'],
                },
              ].map((item, index) => {
                const reverse = index % 2 === 1;
                return (
                  <motion.div
                    key={item.title}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: '-120px' }}
                    variants={fadeUp}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center"
                  >
                    <div
                      className={`order-1 rounded-3xl border border-gray-200 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.08)] px-6 py-7 md:px-8 md:py-8 ${
                        reverse ? 'lg:order-2' : 'lg:order-1'
                      }`}
                    >
                      <div className="text-xs font-bold tracking-widest uppercase text-gray-500">Servicio</div>
                      <h3 className="mt-3 text-xl md:text-2xl font-extrabold tracking-tight text-gray-900">
                        {item.title}
                      </h3>
                      <p className="mt-3 text-sm md:text-base text-gray-600 leading-relaxed">{item.desc}</p>

                      <div className="mt-6 space-y-2.5">
                        {item.bullets.map((b) => (
                          <div key={b} className="flex items-start gap-2">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                            <p className="text-sm text-gray-700 leading-relaxed">{b}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div
                      className={`order-2 rounded-3xl border border-gray-200 bg-white shadow-[0_18px_50px_rgba(0,0,0,0.08)] overflow-hidden ${
                        reverse ? 'lg:order-1' : 'lg:order-2'
                      }`}
                    >
                      <div className={`educativos-swiper relative aspect-[16/10] sm:aspect-[16/9] lg:aspect-[4/3]`}>
                        <button
                          type="button"
                          className={`educativos-svc-prev-${index} absolute left-3 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/85 p-2 text-primary shadow-lg backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
                          aria-label="Anterior"
                        >
                          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={`educativos-svc-next-${index} absolute right-3 top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/85 p-2 text-primary shadow-lg backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
                          aria-label="Siguiente"
                        >
                          <ChevronRight className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <Swiper
                          modules={[Autoplay, EffectFade, Navigation, Pagination]}
                          effect="fade"
                          fadeEffect={{ crossFade: true }}
                          loop
                          speed={650}
                          autoplay={{ delay: 2600, disableOnInteraction: false }}
                          navigation={{
                            prevEl: `.educativos-svc-prev-${index}`,
                            nextEl: `.educativos-svc-next-${index}`,
                          }}
                          pagination={{ clickable: true }}
                          className="h-full w-full"
                        >
                          {item.images.map((src, imgIndex) => (
                            <SwiperSlide key={`${src}-${imgIndex}`}>
                              <div className="relative h-full">
                                <Image
                                  src={src}
                                  alt={`${item.title} - imagen ${imgIndex + 1}`}
                                  fill
                                  className="object-cover object-center"
                                  sizes="(max-width: 1024px) 100vw, 50vw"
                                />
                                <div className="absolute inset-0 bg-linear-to-b from-black/0 via-black/10 to-black/40" />
                              </div>
                            </SwiperSlide>
                          ))}
                        </Swiper>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
        <style jsx global>{`
          .educativos-swiper .swiper-pagination {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 12px;
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            pointer-events: none;
          }

          .educativos-swiper .swiper-pagination-bullet {
            width: 7px;
            height: 7px;
            border-radius: 9999px;
            background: rgba(255, 255, 255, 0.75);
            opacity: 1;
            margin: 0;
            pointer-events: auto;
            box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
            transition: width 200ms ease, background-color 200ms ease, transform 200ms ease;
          }

          .educativos-swiper .swiper-pagination-bullet:hover {
            transform: scale(1.06);
          }

          .educativos-swiper .swiper-pagination-bullet-active {
            width: 18px;
            background: rgba(255, 255, 255, 0.98);
          }
        `}</style>

        <section className="relative py-14 md:py-20 bg-primary">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 opacity-[0.25] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.16)_1px,transparent_0)] [background-size:24px_24px]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          </div>
          <div className="container mx-auto px-4 md:px-6 lg:px-8">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-120px' }} variants={stagger} className="max-w-3xl relative z-10">
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-white/80">
                Confianza
                <span className="h-px w-10 bg-gradient-to-r from-white/55 to-transparent" aria-hidden="true" />
              </motion.div>
              <motion.h2 variants={fadeUp} className="mt-3 text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                Diferenciales que bajan la incertidumbre
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-3 text-white/80 text-base md:text-lg leading-relaxed">
                Para directivos y docentes: previsibilidad, control y respaldo en cada etapa.
              </motion.p>
            </motion.div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  title: 'Habilitación Nacional',
                  desc: 'Agencia de Viajes autorizada (Legajo EVT 19155).',
                  icon: <BadgeCheck className="h-6 w-6" aria-hidden="true" />,
                },
                {
                  title: 'Seguridad Total',
                  desc: 'Cobertura de seguros obligatorios para todos los pasajeros y rastreo satelital de cada unidad.',
                  icon: <ShieldCheck className="h-6 w-6" aria-hidden="true" />,
                },
                {
                  title: 'Planificación Integral',
                  desc: 'Un equipo de profesionales acompaña a docentes y directivos desde la idea inicial hasta el regreso a casa.',
                  icon: <ClipboardList className="h-6 w-6" aria-hidden="true" />,
                },
              ].map((item) => (
                <motion.div
                  key={item.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-120px' }}
                  variants={fadeUp}
                  className="group rounded-3xl border border-white/15 bg-white/10 backdrop-blur-sm p-6 text-white shadow-[0_14px_40px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-1 hover:bg-white/12"
                >
                  <div className="flex items-start gap-3">
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-white/10 text-white flex items-center justify-center">
                      <span className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(120px_120px_at_30%_30%,rgba(255,255,255,0.25),transparent)]" />
                      <span className="relative">{item.icon}</span>
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-white">{item.title}</h3>
                      <p className="mt-1.5 text-sm md:text-base text-white/80 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden py-16 md:py-24 bg-[#F9FAFB]">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-24 right-[10%] h-72 w-72 rounded-full bg-success/10 blur-3xl" />
            <div className="absolute -bottom-24 left-[8%] h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
          </div>

          <div className="container mx-auto px-4 md:px-6 lg:px-8 relative z-10">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-120px' }}
              variants={stagger}
              className="max-w-3xl"
            >
              <motion.div variants={fadeUp} className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-gray-500">
                Convenios
                <span className="h-px w-10 bg-gradient-to-r from-success/50 to-transparent" aria-hidden="true" />
              </motion.div>
              <motion.h2 variants={fadeUp} className="mt-3 text-2xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
                Tarifas institucionales, claras y escalables
              </motion.h2>
              <motion.p variants={fadeUp} className="mt-3 text-gray-600 text-base md:text-lg leading-relaxed">
                Tres niveles de acompañamiento. Misma calidad, distinta profundidad de planificación.
              </motion.p>
            </motion.div>

            <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {[
                {
                  title: 'Viaje Aislado',
                  eyebrow: 'Tarifa estándar',
                  desc: 'Ideal para una salida puntual con coordinación completa.',
                  bullets: ['Logística y coordinación', 'Equipo de soporte', 'Cobertura según normativa'],
                  icon: <Clock3 className="h-7 w-7" aria-hidden="true" />,
                  variant: 'default' as const,
                },
                {
                  title: 'Convenio Anual',
                  eyebrow: 'Recomendado',
                  desc: 'Prioridad máxima. Planificamos todo el ciclo lectivo con agenda bloqueada.',
                  bullets: ['Tarifa preferencial', 'Agenda planificada', 'Coordinación total', 'Cobertura y control'],
                  icon: <BadgeCheck className="h-7 w-7" aria-hidden="true" />,
                  variant: 'featured' as const,
                },
                {
                  title: 'Pack 3+ Viajes',
                  eyebrow: 'Tarifa institucional',
                  desc: 'Para colegios con agenda activa: beneficios administrativos y planificación por tramos.',
                  bullets: ['Beneficios administrativos', 'Planificación por etapas', 'Acompañamiento continuo'],
                  icon: <CalendarCheck className="h-7 w-7" aria-hidden="true" />,
                  variant: 'default' as const,
                },
              ].map((plan) => (
                <motion.div
                  key={plan.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-120px' }}
                  variants={fadeUp}
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className={
                    plan.variant === 'featured'
                      ? 'relative overflow-hidden rounded-3xl border border-success/30 bg-white shadow-[0_22px_60px_rgba(0,0,0,0.14)]'
                      : 'relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_14px_40px_rgba(0,0,0,0.07)]'
                  }
                >
                  <div className="absolute inset-0 pointer-events-none">
                    {plan.variant === 'featured' ? (
                      <>
                        <div className="absolute -right-16 -top-24 h-80 w-80 rounded-full bg-success/20 blur-3xl" />
                        <div className="absolute -left-16 -bottom-24 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
                        <div className="absolute inset-x-0 top-0 h-1 bg-success" />
                      </>
                    ) : (
                      <>
                        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
                        <div className="absolute -left-20 -bottom-24 h-64 w-64 rounded-full bg-success/10 blur-3xl" />
                      </>
                    )}
                  </div>

                  <div className="relative p-6 md:p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex items-start gap-3">
                        
                        <div className="min-w-0">
                          <div
                            className={
                              plan.variant === 'featured'
                                ? 'inline-flex items-center rounded-full bg-success/10 text-success px-3 py-1 text-[11px] font-extrabold tracking-widest uppercase'
                                : 'inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-3 py-1 text-[11px] font-extrabold tracking-widest uppercase'
                            }
                          >
                            {plan.eyebrow}
                          </div>
                          <h3 className="mt-3 text-xl md:text-2xl font-extrabold tracking-tight text-gray-900">
                            {plan.title}
                          </h3>
                        </div>
                      </div>
                      <div
                          className={
                            plan.variant === 'featured'
                              ? 'relative h-14 w-14 shrink-0 rounded-2xl border border-success/30 bg-success/10 text-success flex items-center justify-center'
                              : 'relative h-14 w-14 shrink-0 rounded-2xl border border-gray-200 bg-gray-50 text-primary flex items-center justify-center'
                          }
                        >
                          <span className="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(140px_140px_at_30%_30%,rgba(255,255,255,0.55),transparent)]" />
                          <span className="relative">{plan.icon}</span>
                        </div>
                    </div>

                    <p className="mt-3 text-sm md:text-base text-gray-600 leading-relaxed">
                      {plan.desc}
                    </p>

                    <div className="mt-6 space-y-2.5">
                      {plan.bullets.map((b) => (
                        <div key={b} className="flex items-start gap-2">
                          <span
                            className={plan.variant === 'featured' ? 'mt-2 h-1.5 w-1.5 rounded-full bg-success' : 'mt-2 h-1.5 w-1.5 rounded-full bg-primary'}
                            aria-hidden="true"
                          />
                          <p className="text-sm text-gray-700 leading-relaxed">{b}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-7">
                      <a
                        href="#cotizar"
                        className={
                          plan.variant === 'featured'
                            ? 'inline-flex w-full items-center justify-center rounded-xl bg-success px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-success/90 transition'
                            : 'inline-flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition'
                        }
                      >
                        Solicitar propuesta
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="cotizar" className="py-14 md:py-20 bg-white scroll-mt-32">
          <div className="container mx-auto px-4 md:px-6 lg:px-8">
            <ContactSection showTitle paqueteTitulo="Salida Escolar" paqueteId="educativos" />
          </div>
        </section>
      </main>

      <HomeFooter />
    </>
  );
}
