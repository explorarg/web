'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { MapPin, Clock, Phone, Mail, Instagram } from 'lucide-react';
import { CONTACT_INFO, SITE_NAME, SOCIAL_MEDIA, LEGAL_INFO, SITE_DESCRIPTION, DEVELOPER_CREDITS } from '@/lib/constants';
import { fadeLeft, fadeRight, fadeUp, staggerFast } from './animations';
import { getBrandLogoSrc, isRemoteUrl, renderTemplate, siteConfig } from '@/lib/siteConfig';

export default function LandingFooter() {
  const logoSrc = getBrandLogoSrc();
  const logoAlt = renderTemplate(siteConfig.branding.logo.altTextTemplate || '{{siteName}} Logo');
  const telefonos = [CONTACT_INFO.telefono, CONTACT_INFO.telefonoSecundario].filter(Boolean).join(' / ');
  return (
    <footer className="relative overflow-hidden bg-primary text-white pt-16 pb-8 border-t-[8px] border-secondary">
      <motion.div
        className="relative z-10 container mx-auto px-4 md:px-6 lg:px-8"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-120px' }}
        variants={staggerFast}
      >
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 md:gap-8 lg:gap-12 mb-12">
          
          {/* Column 1: Logo & Bio */}
          <motion.div className="space-y-6 lg:col-span-4" variants={fadeLeft}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                {isRemoteUrl(logoSrc) ? (
                  <img src={logoSrc} alt={logoAlt} className="h-8 w-8 object-contain" />
                ) : (
                  <Image src={logoSrc} alt={logoAlt} width={32} height={32} className="object-contain" />
                )}
              </div>
              <h3 className="font-logo text-2xl leading-none text-white whitespace-nowrap">{siteConfig.branding.logo.titleText}</h3>
            </div>
            <p className="text-sm text-white/80 leading-relaxed font-light max-w-sm">
              {SITE_DESCRIPTION}
            </p>
          </motion.div>

          {/* Column 2: Quick Links */}
          <motion.div className="space-y-5 lg:col-span-3 lg:mx-auto" variants={fadeUp}>
            <h4 className="text-sm font-bold tracking-wide text-white">Enlaces Rápidos</h4>
            <nav className="flex flex-col space-y-3 text-sm text-white/70 font-light">
              <Link href="/" className=" text-white/70 hover:text-white hover:translate-x-1 transition-all duration-300 w-fit">Inicio</Link>
              <Link href="/paquetes" className=" text-white/70 hover:text-white hover:translate-x-1 transition-all duration-300 w-fit">Paquetes</Link>
              <Link href="/#categorias" className=" text-white/70 hover:text-white hover:translate-x-1 transition-all duration-300 w-fit">Destinos</Link>
              <Link href="/contacto" className=" text-white/70 hover:text-white hover:translate-x-1 transition-all duration-300 w-fit">Contacto</Link>
            </nav>
          </motion.div>

          {/* Column 3: Contact Info & Socials */}
          <motion.div className="space-y-8 lg:col-span-5" variants={fadeRight}>
            <div className="space-y-5">
              <h4 className="text-sm font-bold tracking-wide text-white">Contacto</h4>
              <ul className="space-y-4 text-sm text-white/70 font-light">
                <li className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 shrink-0 mt-0.5 opacity-70" />
                  <span className="leading-relaxed">{CONTACT_INFO.direccion}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5 opacity-70" />
                  <span className="leading-relaxed">{CONTACT_INFO.horario}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Phone className="w-4 h-4 shrink-0 mt-0.5 opacity-70" />
                  <span>{telefonos}</span>
                </li>
                <li className="flex items-start gap-3">
                  <Mail className="w-4 h-4 shrink-0 mt-0.5 opacity-70" />
                  <a href={SOCIAL_MEDIA.email} className="hover:text-white transition-colors">{CONTACT_INFO.email}</a>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-bold tracking-wide text-white">Seguinos</h4>
              <a 
                href={SOCIAL_MEDIA.instagram} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white transition-colors px-5 py-2.5 rounded-full text-sm font-medium w-fit"
              >
                <Instagram className="w-4 h-4" />
                <span>{SOCIAL_MEDIA.instagramHandle}</span>
              </a>
            </div>
          </motion.div>
        </div>

        {/* Bottom Bar */}
        <motion.div 
          className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-light text-white/60"
          variants={fadeUp}
        >
          <div className="text-center md:text-left">
            {renderTemplate(siteConfig.content.footer.copyrightTemplate)}
          </div>
          
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <Link href="/terminos-condiciones" className="hover:text-white transition-colors">
              Términos y Condiciones
            </Link>
            <span className="hidden md:inline">|</span>
            <span>Legajo RNAV N° {LEGAL_INFO.legajoRnav}</span>
          </div>
        </motion.div>

        {/* Credits */}
        <motion.div 
          className="mt-8 text-center text-xs font-light text-white/40 flex items-center justify-center gap-2"
          variants={fadeUp}
        >
          Desarrollado por <span className="font-semibold text-white/60">{DEVELOPER_CREDITS.name}</span>
          <a href={DEVELOPER_CREDITS.url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
            <Instagram className="w-3.5 h-3.5" />
          </a>
        </motion.div>
      </motion.div>
    </footer>
  );
}
