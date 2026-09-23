'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { TicketPack } from '@/types';
import F1TicketModal from '@/components/F1TicketModal';

interface F1TicketsSectionProps {
  paqueteTitulo: string;
  paqueteSlug: string;
  tickets: TicketPack[];
  fallbackImage: string;
  activeId?: string;
  onActiveChange?: (id: string) => void;
  lockActive?: boolean;
  onLockChange?: (locked: boolean) => void;
}

export default function F1TicketsSection({
  paqueteTitulo,
  paqueteSlug,
  tickets,
  fallbackImage,
  activeId,
  onActiveChange,
  lockActive = false,
  onLockChange,
}: F1TicketsSectionProps) {
  const [selected, setSelected] = useState<TicketPack | null>(null);

  if (!tickets || tickets.length === 0) {
    return (
      <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Tickets oficiales disponibles</h3>
        <p className="text-sm text-gray-500 mt-2">
          Próximamente.
        </p>
      </div>
    );
  }

  return (
    <div className="sticky top-24 space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Tickets oficiales disponibles</h3>
        <p className="text-sm text-gray-600 mt-1">
          Elegí tu pack y seleccioná para avanzar.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {tickets.map((ticket) => {
              const isActive = ticket.id === activeId;
              return (
                <div
                  key={ticket.id}
                  onMouseEnter={() => {
                    if (!lockActive) onActiveChange?.(ticket.id);
                  }}
                  onClick={() => {
                    const isSame = ticket.id === activeId;
                    onActiveChange?.(ticket.id);
                    onLockChange?.(isSame ? false : true);
                  }}
                  className={`rounded-xl border p-2 transition-all ${
                    isActive
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900">{ticket.titulo}</p>
                      <p className="text-xs font-semibold text-gray-900 mt-0.5">
                        {ticket.moneda} ${ticket.valor.toLocaleString('es-AR')}
                      </p>
                      <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">{ticket.descripcion}</p>
                    </div>
                    <div className="shrink-0">
                      <Button size="sm" className="h-7 px-2 text-[11px]" onClick={() => setSelected(ticket)}>
                        Seleccionar
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      </div>

      {selected && (
        <F1TicketModal
          isOpen={Boolean(selected)}
          onClose={() => setSelected(null)}
          paqueteTitulo={paqueteTitulo}
          paqueteSlug={paqueteSlug}
          ticket={selected}
        />
      )}
    </div>
  );
}
