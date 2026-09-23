"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, MapPin, Calendar, X } from "lucide-react";
import { Paquete } from "@/types";
import { Button } from "@/components/ui/button";

interface HeroSearchProps {
  paquetes: Paquete[];
}

export default function HeroSearch({ paquetes }: HeroSearchProps) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [mes, setMes] = useState("");
  
  // Para evitar que q y selectedSlug viajen juntos si no tienen sentido
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedDestino, setSelectedDestino] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQ(q), 200);
    return () => clearTimeout(handler);
  }, [q]);

  // Click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const mesesDisponibles = useMemo(() => {
    const setMeses = new Set<string>();
    paquetes.forEach(p => {
      p.salidas?.forEach(s => {
        if (s.fecha) {
          const yyyyMm = s.fecha.substring(0, 7);
          setMeses.add(yyyyMm);
        }
      });
    });
    return Array.from(setMeses).sort();
  }, [paquetes]);

  const formatMes = (yyyyMm: string) => {
    const [y, m] = yyyyMm.split("-");
    const date = new Date(parseInt(y), parseInt(m) - 1);
    return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  };

  const suggestions = useMemo(() => {
    if (!debouncedQ.trim()) return { destinos: [], paquetes: [] };
    const term = debouncedQ.toLowerCase().trim();
    
    const matchedDestinos = new Set<string>();
    const matchedPaquetes: { titulo: string; slug: string; destino: string }[] = [];

    paquetes.forEach(p => {
      const isMatch = p.titulo.toLowerCase().includes(term) || (p.destino && p.destino.toLowerCase().includes(term));
      if (isMatch) {
        if (p.destino && p.destino.toLowerCase().includes(term)) {
          matchedDestinos.add(p.destino);
        }
        if (p.titulo.toLowerCase().includes(term)) {
          matchedPaquetes.push({ titulo: p.titulo, slug: p.slug, destino: p.destino || "" });
        }
      }
    });

    return {
      destinos: Array.from(matchedDestinos).slice(0, 4),
      paquetes: matchedPaquetes.slice(0, 6)
    };
  }, [debouncedQ, paquetes]);

  const totalSuggestions = suggestions.destinos.length + suggestions.paquetes.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex(prev => (prev < totalSuggestions - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        selectSuggestion(activeIndex);
      } else {
        handleSearch();
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (index: number) => {
    const destLen = suggestions.destinos.length;
    if (index < destLen) {
      const dest = suggestions.destinos[index];
      setQ(dest);
      setSelectedDestino(dest);
      setSelectedSlug(null);
    } else {
      const paq = suggestions.paquetes[index - destLen];
      setQ(paq.titulo);
      setSelectedSlug(paq.slug);
      setSelectedDestino(null);
    }
    setShowSuggestions(false);
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (selectedSlug) {
      params.set("slug", selectedSlug);
    } else if (selectedDestino) {
      params.set("destino", selectedDestino);
    } else if (q.trim()) {
      params.set("q", q.trim());
    }
    
    if (mes) {
      params.set("mes", mes);
    }

    router.push(params.toString() ? `/paquetes?${params.toString()}` : "/paquetes");
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto mt-8 bg-white rounded-2xl shadow-xl p-2 md:p-4 text-gray-800" ref={containerRef}>
      <div className="flex flex-col md:flex-row gap-3">
        {/* Input Buscador */}
        <div className="relative flex-1">
          <div className="flex items-center bg-gray-50 rounded-xl px-4 py-3 border border-transparent focus-within:border-primary focus-within:bg-white transition-colors">
            <Search className="w-5 h-5 text-gray-400 mr-3" />
            <input 
              type="text"
              placeholder="¿A dónde quieres viajar?"
              className="w-full bg-transparent outline-none text-gray-700 placeholder-gray-400"
              value={q}
              onChange={e => {
                setQ(e.target.value);
                setSelectedSlug(null);
                setSelectedDestino(null);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              role="combobox"
              aria-expanded={showSuggestions}
              aria-autocomplete="list"
            />
            {q && (
              <button onClick={() => { setQ(""); setSelectedSlug(null); setSelectedDestino(null); }} className="p-1 hover:bg-gray-200 rounded-full">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {showSuggestions && (debouncedQ.trim().length > 0) && totalSuggestions > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50">
              {suggestions.destinos.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Destinos</div>
                  {suggestions.destinos.map((dest, idx) => (
                    <div 
                      key={`dest-${idx}`}
                      className={`px-4 py-2 cursor-pointer flex items-center gap-3 ${activeIndex === idx ? "bg-gray-50" : "hover:bg-gray-50"}`}
                      onClick={() => selectSuggestion(idx)}
                    >
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>{dest}</span>
                    </div>
                  ))}
                </div>
              )}
              {suggestions.paquetes.length > 0 && (
                <div className="py-2 border-t border-gray-50">
                  <div className="px-4 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Paquetes</div>
                  {suggestions.paquetes.map((paq, idx) => {
                    const globalIdx = suggestions.destinos.length + idx;
                    return (
                      <div 
                        key={`paq-${idx}`}
                        className={`px-4 py-2 cursor-pointer flex items-center gap-3 ${activeIndex === globalIdx ? "bg-gray-50" : "hover:bg-gray-50"}`}
                        onClick={() => selectSuggestion(globalIdx)}
                      >
                        <Search className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium">{paq.titulo}</div>
                          {paq.destino && <div className="text-xs text-gray-500">{paq.destino}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selector de Mes */}
        <div className="w-full md:w-56 relative">
          <div className="flex items-center bg-gray-50 rounded-xl px-4 py-3 border border-transparent focus-within:border-primary focus-within:bg-white transition-colors h-full">
            <Calendar className="w-5 h-5 text-gray-400 mr-3 shrink-0" />
            <select
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-full bg-transparent outline-none text-gray-700 cursor-pointer appearance-none truncate"
            >
              <option value="">Cualquier fecha</option>
              {mesesDisponibles.map((m) => (
                <option key={m} value={m}>
                  {formatMes(m)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Botón Buscar */}
        <Button 
          onClick={handleSearch}
          className="h-auto py-3 px-8 rounded-xl bg-primary text-white hover:bg-primary/90 font-semibold transition-colors"
        >
          Buscar
        </Button>
      </div>
    </div>
  );
}
