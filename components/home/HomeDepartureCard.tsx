"use client";

import Image from "next/image";
import Link from "next/link";
import { Calendar, Coffee, MapPin, ShoppingCart, User } from "lucide-react";
import type { Paquete } from "@/types";
import { cn } from "@/lib/utils";
import { memo, useMemo } from "react";
import AddToCartPackageDialog from "../cart/AddToCartPackageDialog";

function getNextSalida(paquete: Paquete) {
  const now = new Date();
  const salidas = (paquete.salidas ?? [])
    .map((s) => ({ ...s, time: new Date(`${s.fecha}T00:00:00`).getTime() }))
    .sort((a, b) => a.time - b.time);
  const futura = salidas.find((s) => s.time >= now.getTime());
  return futura ?? salidas[0] ?? null;
}

function formatSalidaShort(fecha: string) {
  try {
    const date = new Date(`${fecha}T00:00:00`);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleDateString("es-AR", { month: "short" }).toLowerCase().replace('.', '');
    return `${day} ${month}`;
  } catch {
    return fecha;
  }
}

function formatPrice(value: number) {
  return `$${Number(value || 0).toLocaleString("es-AR")}`;
}

function detectCountry(paquete: Paquete) {
  const haystack = [
    paquete.destino,
    paquete.eventoLugar,
    paquete.titulo,
    ...(paquete.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (haystack.includes("brasil")) return "Brasil";
  if (haystack.includes("argentina")) return "Argentina";
  if (haystack.includes("uruguay")) return "Uruguay";
  if (haystack.includes("chile")) return "Chile";
  if (haystack.includes("paraguay")) return "Paraguay";
  if (haystack.includes("bolivia")) return "Bolivia";
  if (haystack.includes("perú") || haystack.includes("peru")) return "Perú";
  if (haystack.includes("misiones") || haystack.includes("rio hondo") || haystack.includes("mar del plata") || haystack.includes("la rioja")) {
    return "Argentina";
  }
  return paquete.tipo === "internacional" ? "Internacional" : "Argentina";
}

function getFirstDeparture(paquete: Paquete) {
  const now = new Date();
  const sorted = (paquete.salidas ?? [])
    .map((s) => ({ ...s, time: new Date(`${s.fecha}T00:00:00`).getTime() }))
    .sort((a, b) => a.time - b.time);
  const futura = sorted.find((s) => s.time >= now.getTime()) ?? sorted[0];
  return futura?.fecha ? formatSalidaShort(futura.fecha) : "";
}

function getFeatures(paquete: Paquete) {
  const features: { icon: React.ElementType; label: string }[] = [];
  const incluye = paquete.incluye ?? [];

  // First feature (e.g., Viaje en el día or duration)
  if (paquete.duracion) {
    features.push({ icon: MapPin, label: paquete.duracion });
  } else {
    features.push({ icon: MapPin, label: "Viaje en el día" });
  }

  // Second feature (meal)
  const meal = incluye.find(item =>
    /desayuno|media pensi[oó]n|pensi[oó]n completa|all inclusive|almuerzo|cena/i.test(item)
  );
  const mealLabel = meal ? (meal as string).toLowerCase() : "Desayuno";
  features.push({ 
    icon: Coffee, 
    label: mealLabel.charAt(0).toUpperCase() + mealLabel.slice(1) 
  });

  // Third feature (assistance)
  const assistance = incluye.find(item =>
    /coordinador|asistencia|gu[ií]a|acompañamiento/i.test(item)
  );
  const assLabel = assistance ? (assistance as string).toLowerCase() : "Coordinador";
  features.push({
    icon: User,
    label: assLabel.charAt(0).toUpperCase() + assLabel.slice(1)
  });

  return features;
}

type Props = {
  paquete: Paquete;
  hrefBasePath?: string;
  fullWidth?: boolean;
  className?: string;
};

function HomeDepartureCard({
  paquete,
  hrefBasePath = "/paquete",
  fullWidth = false,
  className,
}: Props) {
  const salida = useMemo(() => getNextSalida(paquete), [paquete]);
  const img = paquete.imagenTarjeta || paquete.imagenPrincipal || "/images/placeholder-package.jpg";
  const cupo = salida?.cupo;
  const priceValue = useMemo(() => {
    return typeof paquete.precio === "number" && paquete.precio > 0
      ? paquete.precio
      : salida?.precio ?? 0;
  }, [paquete.precio, salida?.precio]);
  const priceMoneda = useMemo(() => {
    return (typeof paquete.moneda === "string" && paquete.moneda.trim()) ||
      salida?.moneda ||
      "ARS";
  }, [paquete.moneda, salida?.moneda]);
  const country = useMemo(() => detectCountry(paquete), [paquete]);
  const firstDeparture = useMemo(() => getFirstDeparture(paquete), [paquete]);
  const features = useMemo(() => getFeatures(paquete), [paquete]);

  return (
    <article className={cn(
      "group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-gray-100 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.08)]",
      "transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
      "hover:-translate-y-1.5 hover:border-teal-200 hover:shadow-[0_24px_50px_rgba(17,43,73,0.16)]",
      fullWidth ? "w-full" : "w-full md:w-[260px] shrink-0",
      className
    )}>
      {/* Image Section */}
      <div className={cn("relative w-full overflow-hidden rounded-t-[20px]", fullWidth ? "h-[170px] md:h-[180px]" : "h-[160px] md:h-[170px]")}>
        <Image
          src={img}
          alt={paquete.titulo}
          fill
          className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.07]"
          sizes={fullWidth ? "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw" : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 260px"}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,28,48,0)_45%,rgba(7,28,48,0.35)_100%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        {/* Country Label */}
        <div className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 shadow-sm backdrop-blur-sm transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5">
          <span className="text-[11px] font-semibold text-gray-700">{country}</span>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <Link href={`${hrefBasePath}/${paquete.slug}`} className="flex flex-col flex-1">
          <h3 className="line-clamp-2 text-[15px] font-extrabold uppercase leading-tight text-gray-900 transition-colors duration-300 group-hover:text-teal-700">
            {paquete.titulo}
          </h3>

          {firstDeparture && (
            <p className="mt-2 text-[12px] font-medium text-gray-500">
              Salidas: {firstDeparture}
            </p>
          )}

          <div className="mt-3 space-y-1.5">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="flex items-center gap-2">
                  <div className="h-6 w-6 flex items-center justify-center rounded-full border border-gray-200 transition-colors duration-300 group-hover:border-teal-200 group-hover:bg-teal-50">
                    <Icon className="h-3.5 w-3.5 text-teal-600" />
                  </div>
                  <span className="text-[11px] text-gray-600">{feature.label}</span>
                </div>
              );
            })}
          </div>
        </Link>

        {/* Price & Button Section */}
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-gray-400">
              Desde
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-[18px] font-extrabold text-gray-900">
                {formatPrice(priceValue)}
              </span>
              <span className="text-[11px] font-bold text-gray-500">
                {priceMoneda}
              </span>
            </div>
          </div>
          <AddToCartPackageDialog
            paquete={paquete}
            triggerClassName="h-10 px-4 flex items-center gap-2 text-[12px] font-bold rounded-[16px] bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:shadow-[0_10px_22px_rgba(13,148,136,0.28)] hover:scale-[1.03] active:scale-[0.98]"
          />
        </div>
      </div>
    </article>
  );
}

export default memo(HomeDepartureCard);
