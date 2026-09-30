"use client";

import Image from "next/image";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import HomeSearchBar from "@/components/home/HomeSearchBar";
import type { Paquete } from "@/types";

type Props = {
  paquetes: Paquete[];
  backgroundImage?: string | null;
};

const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function HomeHero({ paquetes, backgroundImage }: Props) {
  const bg = backgroundImage || "/images/hero-placeholder.svg";

  // Posición del cursor normalizada (-0.5 a 0.5) para el parallax
  const pointerX = useMotionValue(0.5);
  const pointerY = useMotionValue(0.5);
  const hovering = useMotionValue(0);

  const smoothX = useSpring(pointerX, { stiffness: 90, damping: 20, mass: 0.5 });
  const smoothY = useSpring(pointerY, { stiffness: 90, damping: 20, mass: 0.5 });
  const smoothHover = useSpring(hovering, { stiffness: 120, damping: 24 });

  const imageX = useTransform(smoothX, [0, 1], [14, -14]);
  const imageY = useTransform(smoothY, [0, 1], [10, -10]);
  const imageScale = useTransform(smoothHover, [0, 1], [1, 1.035]);

  const contentX = useTransform(smoothX, [0, 1], [-6, 6]);
  const contentY = useTransform(smoothY, [0, 1], [-4, 4]);

  const glowX = useTransform(smoothX, [0, 1], ['12%', '58%']);
  const glowY = useTransform(smoothY, [0, 1], ['18%', '62%']);
  const glowOpacity = useTransform(smoothHover, [0, 1], [0.55, 1]);
  const glowBackground = useMotionTemplate`radial-gradient(42% 52% at ${glowX} ${glowY}, rgba(43,184,191,0.28), transparent)`;

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - bounds.left) / bounds.width);
    pointerY.set((event.clientY - bounds.top) / bounds.height);
    hovering.set(1);
  };

  const handlePointerLeave = () => {
    pointerX.set(0.5);
    pointerY.set(0.5);
    hovering.set(0);
  };

  return (
    <section className="relative z-20 w-full min-w-0 overflow-x-clip">
      <div
        className="group/hero relative min-h-[560px] pb-16 sm:min-h-[620px] md:min-h-[720px] md:pb-[110px]"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {/* El recorte va en el fondo para no clipear los dropdowns del buscador */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -inset-6"
            style={{ x: imageX, y: imageY, scale: imageScale }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Image
              src={bg}
              alt=""
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
          </motion.div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/20 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/30 to-black/10" />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: glowBackground, opacity: glowOpacity }}
        />
        {/* Brillo diagonal que barre el banner al entrar el mouse */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -inset-y-10 -left-1/3 w-1/3 -translate-x-full rotate-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.10),transparent)] transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/hero:translate-x-[420%]" />
        </div>

        <motion.div
          style={{ x: contentX, y: contentY }}
          className="relative z-20 container mx-auto flex h-full min-w-0 flex-col justify-center px-4 pt-12 sm:px-6 sm:pt-16 lg:px-8 lg:pt-24"
        >
          <motion.div
            className="max-w-2xl pt-8 sm:pt-10 md:pt-16"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
            }}
          >
            <motion.p
              className="text-white/85 text-sm font-semibold tracking-wide mb-4"
              variants={fadeUp}
            >
              Explorá más.
            </motion.p>
            <motion.h1
              className="text-white text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight"
              variants={fadeUp}
            >
              Descubrí tu
              <br />
              próxima{" "}
              <span className="font-logo text-[#FFD34D] italic font-normal">aventura</span>
            </motion.h1>
            <motion.p
              className="mt-5 text-white/85 text-base md:text-lg leading-relaxed max-w-xl"
              variants={fadeUp}
            >
              Viajes grupales acompañados, momentos únicos y destinos increíbles
            </motion.p>
          </motion.div>

          <motion.div
            className="mt-6 w-full min-w-0 max-w-5xl md:mt-10"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: 0.45 }}
          >
            <HomeSearchBar paquetes={paquetes} />
          </motion.div>
        </motion.div>

        {/* Curvatura invertida que cierra el banner */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[-1px] z-10">
          <svg
            viewBox="0 0 1440 120"
            preserveAspectRatio="none"
            className="block h-[46px] w-full md:h-[86px]"
            aria-hidden="true"
          >
            <path d="M0,120 L0,98 C 340,18 1100,18 1440,98 L1440,120 Z" fill="#F5FAFF" />
          </svg>
        </div>
      </div>
    </section>
  );
}
