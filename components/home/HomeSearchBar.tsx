"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BedDouble,
  Calendar,
  Check,
  MapPin,
  Package,
  Palmtree,
  Plane,
  Route,
  Search,
  Tag,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Paquete, Salida } from "@/types";

type Props = {
  paquetes: Paquete[];
};

type TabId = "ofertas" | "paquetes" | "escapadas" | "circuitos" | "vuelos" | "hoteles";

type Tab = {
  id: TabId;
  label: string;
  icon: LucideIcon;
};

const TABS: Tab[] = [
  { id: "ofertas", label: "Ofertas", icon: Tag },
  { id: "paquetes", label: "Paquetes", icon: Package },
];

const ACCENT = "#2BB8BF";
const ACCENT_HOVER = "#22A9B0";

function formatDateLabel(fecha: string): string {
  try {
    const date = new Date(`${fecha}T12:00:00`);
    return date.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return fecha;
  }
}

function SelectField({
  id,
  icon: Icon,
  label,
  value,
  placeholder,
  caption,
  options,
  searchable,
  open,
  onToggle,
  onSelect,
  onClear,
  disabled = false,
  showAsActive = false,
}: {
  id: string;
  icon: LucideIcon;
  label: string;
  value: string;
  placeholder: string;
  caption: string;
  options: { value: string; label: string }[];
  searchable?: boolean;
  open: boolean;
  onToggle: () => void;
  onSelect: (value: string) => void;
  onClear?: () => void;
  disabled?: boolean;
  showAsActive?: boolean;
}) {
  const [term, setTerm] = useState("");
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const filtered = useMemo(() => {
    if (!searchable || !term.trim()) return options;
    const t = term.toLowerCase().trim();
    return options.filter((o) => o.label.toLowerCase().includes(t));
  }, [options, searchable, term]);

  const hasValue = Boolean(value && value !== "");
  const isActiveField = hasValue && (showAsActive || value !== "");

  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={disabled ? undefined : onToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        disabled={disabled}
        className={`flex w-full items-center gap-3 rounded-[20px] px-4 py-3 text-left transition-colors ${
          disabled
            ? "opacity-50 cursor-not-allowed"
            : open
              ? "bg-[#F4F8FC]"
              : isActiveField
                ? "bg-[#EAF9FA] hover:bg-[#E0F5F6]"
                : "hover:bg-[#F7FAFD]"
        }`}
      >
        <Icon className="h-5 w-5 shrink-0 text-[#0B3B5A]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#9AA7B6]">
            {label}
          </span>
          <span className="block truncate text-[15px] font-semibold text-[#112B49]">
            {hasValue ? selected?.label : placeholder}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-[#A6B2C0]">{caption}</span>
        </span>
        {hasValue && !disabled && onClear && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#A6B2C0] hover:bg-[#E9EFF5] hover:text-[#112B49] transition"
            aria-label="Limpiar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </button>

      <AnimatePresence>
        {open && !disabled && (
          <motion.div
            id={`${id}-listbox`}
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[320px] min-w-[240px] overflow-y-auto rounded-[22px] border border-[#E4EDF6] bg-white p-2 shadow-[0_28px_60px_rgba(7,40,82,0.18)]"
          >
            {searchable && (
              <div className="sticky top-0 z-10 bg-white pb-2">
                <input
                  autoFocus
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full rounded-2xl border border-[#E4EDF6] bg-[#F8FBFE] px-4 py-2.5 text-sm text-[#112B49] outline-none placeholder:text-[#A6B2C0] focus:border-[#B7D7EC]"
                />
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-[#8FA0B2]">Sin resultados</div>
            ) : (
              filtered.map((opt) => {
                const isActive = opt.value === value;
                return (
                  <button
                    key={opt.value || "any"}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    onClick={() => onSelect(opt.value)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-[#EAF9FA] font-semibold text-[#112B49]"
                        : "text-[#3D5570] hover:bg-[#F5F9FD]"
                    }`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isActive && <Check className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />}
                  </button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function HomeSearchBar({ paquetes }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("ofertas");
  const [paqueteSlug, setPaqueteSlug] = useState("");
  const [salidaFecha, setSalidaFecha] = useState("");
  const [pax, setPax] = useState("");
  const [paxUserInteracted, setPaxUserInteracted] = useState(false);
  const [openField, setOpenField] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenField(null);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];

  const paquetesFiltrados = useMemo(() => {
    return paquetes.filter((p) => {
      if (!p.visible) return false;
      if (tab === "ofertas") return p.tipo === "oferta" || p.tipos?.includes("oferta");
      if (tab === "paquetes") return p.tipo === "grupal" || p.tipo === "internacional" || p.tipos?.includes("grupal") || p.tipos?.includes("internacional");
      return true;
    });
  }, [paquetes, tab]);

  const paqueteOptions = useMemo(
    () => [
      { value: "", label: "Todos los paquetes" },
      ...paquetesFiltrados
        .filter((p) => p.slug)
        .map((p) => ({ value: p.slug, label: p.titulo }))
        .sort((a, b) => a.label.localeCompare(b.label, "es")),
    ],
    [paquetesFiltrados]
  );

  const paqueteSeleccionado = useMemo(
    () => paquetesFiltrados.find((p) => p.slug === paqueteSlug),
    [paquetesFiltrados, paqueteSlug]
  );

  const salidasOptions = useMemo(
    () => {
      if (!paqueteSeleccionado || !paqueteSeleccionado.salidas?.length) return [];
      return [
        { value: "", label: "Cualquier fecha" },
        ...paqueteSeleccionado.salidas
          .filter((s) => s.fecha)
          .sort((a, b) => a.fecha.localeCompare(b.fecha))
          .map((s) => ({
            value: s.fecha,
            label: `${formatDateLabel(s.fecha)}${s.ciudadSalida ? ` · ${s.ciudadSalida}` : ""}`,
          })),
      ];
    },
    [paqueteSeleccionado]
  );

  const hasSalidas = salidasOptions.length > 1;
  const salidasDisabled = !hasSalidas;

  const paxOptions = useMemo<{ value: string; label: string }[]>(
    () => [
      ...Array.from({ length: 10 }, (_, i) => {
        const n = i + 1;
        return { value: String(n), label: n === 1 ? "1 persona" : `${n} personas` };
      }),
      { value: "10+", label: "Más de 10 personas" },
    ],
    []
  );

  const toggleField = (field: string) => setOpenField((prev) => (prev === field ? null : field));

  const clearPaquete = () => {
    setPaqueteSlug("");
    setSalidaFecha("");
    setOpenField("paquete");
  };

  const clearSalida = () => {
    setSalidaFecha("");
    setOpenField("fecha");
  };

  const handleSearch = () => {
    setOpenField(null);

    const selectedPkg = paqueteSeleccionado;
    const hasDate = Boolean(salidaFecha);
    const finalPax = pax || "2";

    if (selectedPkg && hasDate) {
      router.push(`/paquete/${selectedPkg.slug}?fecha=${salidaFecha}&pax=${finalPax}`);
      return;
    }

    if (selectedPkg) {
      router.push(`/paquetes?slug=${selectedPkg.slug}&pax=${finalPax}`);
      return;
    }

    const params = new URLSearchParams();
    // Map tab to actual filters for PaquetesClient
    if (tab === "ofertas") {
      // Ofertas are filtered by tag, not tipo
      params.set("tag", "oferta");
    } else if (tab === "paquetes") {
      params.append("tipo", "grupal");
      params.append("tipo", "internacional");
    }
    if (salidaFecha) params.set("mes", salidaFecha.substring(0, 7));
    params.set("pasajeros", finalPax);
    router.push(`/paquetes?${params.toString()}`);
  };

  return (
    <div ref={containerRef} className="w-full">
      <div
        role="tablist"
        aria-label="Tipo de búsqueda"
        className="inline-flex max-w-full overflow-x-auto rounded-[26px] bg-white p-2 shadow-[0_18px_45px_rgba(7,40,82,0.14)] scrollbar-hide"
      >
        <div className="flex items-stretch gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setTab(t.id);
                  setOpenField(null);
                  setPaqueteSlug("");
                  setSalidaFecha("");
                }}
                className="relative flex w-[74px] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[18px] px-2 py-2.5 sm:w-[86px]"
              >
                {isActive && (
                  <motion.span
                    layoutId="home-search-tab"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-[18px]"
                    style={{ backgroundColor: ACCENT }}
                  />
                )}
                <Icon
                  className={`relative h-5 w-5 transition-colors ${
                    isActive ? "text-white" : "text-[#0B3B5A]"
                  }`}
                />
                <span
                  className={`relative text-[11px] font-semibold transition-colors ${
                    isActive ? "text-white" : "text-[#6B7C8F]"
                  }`}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 rounded-[26px] bg-white p-2 shadow-[0_22px_60px_rgba(7,40,82,0.16)] md:mt-4">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-stretch gap-1 lg:flex-row lg:items-center"
          >
            <SelectField
              id="paquete"
              icon={MapPin}
              label="¿A dónde querés ir?"
              value={paqueteSlug}
              placeholder="Elegí un paquete"
              caption={activeTab.label === "Ofertas" ? "Salidas con descuento" : "Salidas grupales acompañadas"}
              options={paqueteOptions}
              searchable
              open={openField === "paquete"}
              onToggle={() => toggleField("paquete")}
              onSelect={(v) => {
                setPaqueteSlug(v);
                setSalidaFecha("");
                if (v) {
                  setOpenField("fecha");
                } else {
                  setOpenField(null);
                }
              }}
              onClear={clearPaquete}
            />

            <div className="mx-2 hidden w-px self-stretch bg-[#E9EFF5] lg:block" />

            <SelectField
              id="fecha"
              icon={Calendar}
              label="¿Cuándo salimos?"
              value={salidaFecha}
              placeholder={hasSalidas ? "Elegí una fecha" : "Seleccioná un paquete primero"}
              caption={paqueteSeleccionado ? `${paqueteSeleccionado.salidas?.length ?? 0} fechas disponibles` : "Primero elegí un destino"}
              options={salidasOptions}
              open={openField === "fecha"}
              onToggle={() => toggleField("fecha")}
              onSelect={(v) => {
                setSalidaFecha(v);
                setOpenField(null);
              }}
              onClear={clearSalida}
              disabled={salidasDisabled}
            />

            <div className="mx-2 hidden w-px self-stretch bg-[#E9EFF5] lg:block" />

            <SelectField
              id="pax"
              icon={Users}
              label="¿Cuántos viajan?"
              value={pax}
              placeholder="2 personas"
              caption="Personas en la reserva"
              options={paxOptions}
              open={openField === "pax"}
              onToggle={() => { setPaxUserInteracted(true); toggleField("pax"); }}
              onSelect={(v) => {
                setPax(v);
                setPaxUserInteracted(true);
                setOpenField(null);
              }}
              showAsActive={paxUserInteracted}
            />

            <button
              type="button"
              onClick={handleSearch}
              className="mt-1 inline-flex h-[54px] shrink-0 items-center justify-center gap-2 rounded-[20px] px-8 text-[15px] font-semibold text-white transition-colors hover:bg-[color:var(--accent-hover)] lg:ml-2 lg:mt-0 lg:w-[190px]"
              style={{ backgroundColor: ACCENT, ["--accent-hover" as string]: ACCENT_HOVER }}
            >
              <Search className="h-4 w-4" />
              Buscar
            </button>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}