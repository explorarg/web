'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Flame, MapPin } from 'lucide-react';
import type { Paquete } from '@/types';
import { getPackageFeatures } from '@/lib/utils/packageFeatures';

interface PaqueteHeroProps {
  paquete: Paquete;
  hideFeatures?: boolean;
  hideBadges?: boolean;
}

export default function PaqueteHero({
  paquete,
  hideFeatures = false,
  hideBadges = false,
}: PaqueteHeroProps) {
  // Obtener features del paquete
  const features = hideFeatures ? [] : getPackageFeatures(paquete.incluye || [], 4);

  const tickets = paquete.tickets || [];
  const cheapestTicket =
    tickets.length > 0
      ? tickets.reduce((min, ticket) => (ticket.valor < min.valor ? ticket : min), tickets[0])
      : undefined;
  const priceValue = cheapestTicket?.valor ?? paquete.precio;
  const priceMoneda = cheapestTicket?.moneda ?? paquete.moneda ?? 'ARS';
  const showDesde = tickets.length > 1 ? true : Boolean(paquete.mostrarDesde);

  const eventDateValue = paquete.eventoFecha?.trim();
  const eventTarget = useMemo(
    () => (eventDateValue ? new Date(`${eventDateValue}T00:00:00Z`) : null),
    [eventDateValue]
  );
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!eventTarget || Number.isNaN(eventTarget.getTime())) {
      setTimeLeft('');
      return;
    }

    const update = () => {
      const diff = eventTarget.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('En curso');
        return;
      }
      const totalSeconds = Math.floor(diff / 1000);
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setTimeLeft(`${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [eventTarget]);

  const eventDateLabel =
    eventDateValue && !Number.isNaN(new Date(`${eventDateValue}T00:00:00Z`).getTime())
      ? new Date(`${eventDateValue}T00:00:00Z`).toLocaleDateString('es-AR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '';

  return (
    <div className="relative h-[500px] md:h-[600px]">
      <Image
        src={paquete.imagenPortada || paquete.imagenPrincipal || '/images/placeholder-package.jpg'}
        alt={paquete.titulo}
        fill
        className="object-cover"
        priority
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 pb-8 md:pb-12">
        <div className="container mx-auto">
          {!hideBadges && (
            <div className="flex items-center flex-wrap gap-2 mb-4">
              <Badge className="bg-white/20 text-white backdrop-blur-sm hover:bg-white/20 border border-white/30 text-base">
                {paquete.tipo === 'individual'
                  ? 'Individual'
                  : paquete.tipo === 'grupal'
                    ? 'Grupal'
                    : paquete.tipo === 'internacional'
                      ? 'Internacional'
                      : paquete.tipo === 'educativo'
                        ? 'Educativo'
                        : paquete.tipo === 'eventos'
                          ? 'Eventos'
                          : paquete.tipo === 'recitales'
                            ? 'Recitales'
                            : paquete.tipo === 'oferta'
                              ? 'Oferta'
                              : 'A Medida'}
              </Badge>
              {paquete.destacado && (
                <Badge className="bg-white/20 text-white backdrop-blur-sm hover:bg-white/20 border border-white/30 text-base">
                  Destacado
                </Badge>
              )}
            </div>
          )}
          <h1 className="text-lg md:text-lg lg:text-lg font-semibold text-white mb-3 md:mb-4 leading-tight">{paquete.titulo}</h1>
          
          {/* Iconos de servicios - solo iconos */}
          {features.length > 0 && (
            <div className="flex gap-2 mb-4">
              {features.map((feature, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-center bg-white/20 backdrop-blur-sm text-white rounded-lg p-2.5 border border-white/30"
                  title={feature.label}
                >
                  <span className="text-white">{feature.icon}</span>
                </div>
              ))}
            </div>
          )}

          {/* <div className="flex flex-wrap items-center gap-4 md:gap-6 text-white text-base md:text-lg">
            <div className="flex items-center">
              <MapPin className="h-4 w-4 md:h-5 md:w-5 mr-2 text-white" />
              {paquete.eventoLugar || paquete.destino || 'F1'}
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 md:h-5 md:w-5 mr-2 text-white" />
              {eventDateLabel || paquete.duracion}
              {timeLeft && (
                <span className="ml-2 text-white/80 text-sm md:text-base font-normal">({timeLeft})</span>
              )}
            </div>
            <div className="text-lg md:text-lg font-semibold text-white">
              {showDesde && <span className="text-lg md:text-base font-normal mr-1">Desde</span>}
              {discountValue ? (
                <div className="flex flex-col gap-1.5 leading-none">
                  <div className="inline-flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-white" strokeWidth={2.5} />
                    <span className="text-white font-extrabold text-lg md:text-lg">
                      {priceMoneda} ${Number(priceValue || 0).toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <Flame className="h-5 w-5 text-amber-400" strokeWidth={2.5} />
                    <span className="text-amber-400 font-extrabold text-lg md:text-lg">
                      ${Number(discountValue).toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>
              ) : (
                <span>
                  {priceMoneda} ${Number(priceValue || 0).toLocaleString('es-AR')}
                </span>
              )}
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
}
