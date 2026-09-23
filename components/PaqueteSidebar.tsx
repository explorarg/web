'use client';

import { useMemo, useState } from 'react';
import AddToCartPackageDialog from '@/components/cart/AddToCartPackageDialog';
import { Paquete } from '@/types';
import { Calendar, CheckCircle2, Clock, Headphones, MapPin, ShieldCheck, Users } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { getWhatsAppLinkForPackage } from '@/lib/utils/whatsapp';
import { getOperationalDepartureDates } from '@/lib/packages/resolve-departure';

interface PaqueteSidebarProps {
  paquete: Paquete;
}

export default function PaqueteSidebar({ paquete }: PaqueteSidebarProps) {
  const destino = paquete.destino || paquete.eventoLugar || '—';
  const duracion = paquete.duracion || '—';
  const nextDate = useMemo(() => {
    const now = new Date();
    const all = getOperationalDepartureDates(paquete);
    const future = all
      .map((d) => ({ d, t: new Date(`${d}T00:00:00`).getTime() }))
      .filter((x) => !Number.isNaN(x.t) && x.t >= now.getTime())
      .sort((a, b) => a.t - b.t);
    return future.length ? future[0].d : all.sort((a, b) => new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime())[0] || '';
  }, [paquete]);
  const nextDateLabel = useMemo(() => {
    if (!nextDate) return '';
    const dt = new Date(`${nextDate}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return nextDate;
    return dt.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
  }, [nextDate]);
  const whatsappHref = useMemo(() => getWhatsAppLinkForPackage(paquete.titulo), [paquete.titulo]);
  const paymentMethods = ['VISA', 'mastercard', 'NARANJA', 'mercado pago'];
  const [passengers, setPassengers] = useState(2);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-[#D2E5F6] bg-white shadow-[0_18px_40px_rgba(14,63,110,0.1)] p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="rounded-full bg-[#E8F7FF] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-[#0A6E90]">
            Mejor precio
          </div>
        </div>

        <div className="mt-4">
          <div className="text-xs font-semibold text-slate-500">Precio por persona {paquete.mostrarDesde ? 'desde' : ''}</div>
          <div className="mt-1 flex items-end gap-3">
            <div className="text-[44px] leading-none font-black tracking-[-0.02em] text-[#0D223F]">
              ${paquete.precio.toLocaleString('es-AR')}
            </div>
            <div className="mb-2 text-sm font-extrabold uppercase text-[#5A789A]">{paquete.moneda || 'ARS'}</div>
          </div>
        </div>
        {String((paquete as any)?.fechaVencimiento ?? '').trim() ? (
          <div className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
            <Clock className="h-4 w-4 text-gray-600" />
            Vence: <span className="font-semibold text-gray-900">{String((paquete as any).fechaVencimiento)}</span>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          <div className="rounded-2xl border border-[#D6E8F7] bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-[#EDF8FF] flex items-center justify-center">
                <MapPin className="h-4 w-4 text-[#2BB8BF]" />
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Destino</div>
                <div className="text-sm font-bold text-[#0D223F] truncate">{destino}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-[#EDF8FF] flex items-center justify-center">
                <Calendar className="h-4 w-4 text-[#2BB8BF]" />
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Próxima salida disponible</div>
                <div className="text-sm font-bold text-[#0D223F] truncate">{nextDateLabel || 'A coordinar'}</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-2xl bg-[#EDF8FF] flex items-center justify-center">
                <Clock className="h-4 w-4 text-[#2BB8BF]" />
              </div>
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Duración</div>
                <div className="text-sm font-bold text-[#0D223F] truncate">{duracion}</div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#D6E8F7] bg-white p-4">
            <div className="text-xs font-semibold text-slate-500">Pasajeros</div>
            <div className="mt-2 flex items-center justify-between rounded-2xl border border-[#BFD8EE] bg-white px-3 py-2 shadow-[0_4px_12px_rgba(30,136,184,0.06)]">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Users className="h-4 w-4 text-[#2BB8BF]" />
                {passengers} adultos
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-7 w-7 rounded-xl border border-[#D7E8F7] bg-white text-[#2C4E73] hover:bg-[#F4FAFF]"
                  onClick={() => setPassengers((p) => Math.max(1, p - 1))}
                  aria-label="Menos pasajeros"
                >
                  –
                </button>
                <button
                  type="button"
                  className="h-7 w-7 rounded-xl border border-[#D7E8F7] bg-white text-[#2C4E73] hover:bg-[#F4FAFF]"
                  onClick={() => setPassengers((p) => Math.min(8, p + 1))}
                  aria-label="Más pasajeros"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <AddToCartPackageDialog
            paquete={paquete}
            initialAdults={passengers}
            initialMinors={0}
            triggerClassName="group h-12 w-full justify-center gap-2 rounded-full bg-[#2BB8BF] text-[15px] font-semibold text-white shadow-[0_10px_26px_rgba(43,184,191,0.32)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-[#22A9B0] hover:shadow-[0_14px_32px_rgba(43,184,191,0.42)] active:scale-[0.98]"
          />

          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="group flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#D7E8F7] bg-white text-[15px] font-semibold text-[#112B49] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:border-[#2BB8BF] hover:bg-[#F4FCFC] hover:text-[#187AA6] active:scale-[0.98]"
          >
            <FaWhatsapp className="h-[18px] w-[18px] text-[#25D366]" />
            Consultar por WhatsApp
          </a>

          <div className="rounded-2xl border border-[#D6E8F7] bg-white p-4 text-sm text-slate-700 space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#16A34A] mt-0.5" />
              <span>Reservá con seña, pagá el resto en cuotas</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#16A34A] mt-0.5" />
              <span>Cancelación flexible hasta 30 días antes</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#16A34A] mt-0.5" />
              <span>Asistencia 24/7 durante tu viaje</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[#D2E5F6] bg-white shadow-[0_14px_30px_rgba(15,66,116,0.08)] p-5">
        <div className="text-sm font-bold text-[#0D223F]">¿Tenés dudas?</div>
        <div className="mt-2 flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-[#EAF6FF] flex items-center justify-center">
            <Headphones className="h-5 w-5 text-[#2BB8BF]" />
          </div>
          <div className="min-w-0">
            <div className="text-sm text-slate-700">Nuestro equipo te asesora de forma personalizada.</div>
            <a href={whatsappHref} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-[#2BB8BF] hover:underline">
              +54 9 11 234-5678
            </a>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[#D2E5F6] bg-white shadow-[0_14px_30px_rgba(15,66,116,0.08)] p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-[#0D223F]">
          <ShieldCheck className="h-4 w-4 text-[#12A7C7]" />
          Comprás tranquila
        </div>
        <p className="mt-1 text-xs text-slate-600">Tu compra está protegida</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {paymentMethods.map((method) => (
            <span key={method} className="rounded-lg border border-[#D5E6F5] bg-[#F8FBFF] px-2.5 py-1 text-[10px] font-bold uppercase text-[#4B6A8A]">
              {method}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
