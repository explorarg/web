'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Globe, Instagram } from 'lucide-react';
import { useState, useEffect } from 'react';
import SocialLinks from './SocialLinks';

interface ComingSoonProps {
  logoSrc: string;
  logoAlt?: string;
}

export default function ComingSoon({ logoSrc, logoAlt = 'VIAGGIO TUR Logo' }: ComingSoonProps) {
  const [currentYear, setCurrentYear] = useState<number>(2024);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <div className="max-w-xl w-full text-center space-y-8 md:space-y-10">
        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src={logoSrc}
            alt={logoAlt}
            width={144}
            height={144}
            className="w-auto h-14 md:h-[72px] object-contain"
            priority
          />
        </div>

        {/* Headline */}
        <h1 className="text-white/90 text-base md:text-base lg:text-base font-bold tracking-tight">
          Preparando los motores para la nueva temporada
        </h1>

        {/* Subtexto */}
        <p className="text-white/70 text-base md:text-sm max-w-md mx-auto leading-relaxed">
          Muy pronto lanzamos la nueva{' '}
          <span className="font-triester-vector text-[#FFD21E] leading-none inline-block" style={{ fontSize: '48px', marginLeft: '5px' }}>web</span>.
          <br />
          <span>Seguinos para enterarte primero.</span>
        </p>

        {/* Social Links */}
        <div className="pt-4">
          <SocialLinks />
        </div>

        {/* Copyright */}
        <p className="text-white/40 text-xs pt-8 md:pt-12">
          © {currentYear} VIAGGIO TUR — <span className="font-triester-vector text-base md:text-sm lg:text-base">Más que un viaje, una experiencia que se comparte</span>
        </p>

        {/* Developer Credit */}
        <div className="pt-6 md:pt-8 flex items-center justify-center gap-3 text-white/30 text-xs">
          <span>Desarrollado por Tucs Digital</span>
          <Link
            href="https://tucsdigital.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center hover:text-[#FFD21E] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#FFD21E] focus:ring-offset-2 focus:ring-offset-[#000000] rounded"
            aria-label="Visitar sitio web de Tucs Digital"
          >
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
          <Link
            href="https://instagram.com/tucsdigital"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center hover:text-[#FFD21E] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#FFD21E] focus:ring-offset-2 focus:ring-offset-[#000000] rounded"
            aria-label="Seguir a Tucs Digital en Instagram"
          >
            <Instagram className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </main>
  );
}
