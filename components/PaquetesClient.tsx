'use client';

import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Paquete, Categoria } from '@/types';
import HomeDepartureCard from '@/components/home/HomeDepartureCard';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, SlidersHorizontal, Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronDown } from "lucide-react";
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { packageHasCategory } from '@/lib/packages/category-utils';

interface PaquetesClientProps {
  paquetes: Paquete[];
  categorias: Categoria[];
}

const TIPO_LABELS: Record<string, string> = {
  individual: 'Individual',
  grupal: 'Grupal',
  'a-medida': 'A Medida',
  internacional: 'Internacional',
  educativo: 'Educativo',
  eventos: 'Eventos',
  recitales: 'Recitales',
  oferta: 'Oferta',
};

const TRANSPORTE_OPTIONS = [
  { value: 'bus', label: 'Bus' },
  { value: 'avion', label: 'Avión' },
  { value: 'barco', label: 'Barco' },
] as const;

export function normalizeMulti(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'es')
  );
}

export function readMulti(searchParams: URLSearchParams, key: string): string[] {
  return normalizeMulti(searchParams.getAll(key).flatMap((v) => v.split(',')));
}

type SortPaquetes = 'relevancia' | 'nombre' | 'precio' | 'destino';

function PaquetesClientContent({ paquetes, categorias }: PaquetesClientProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
  const [selectedTipos, setSelectedTipos] = useState<string[]>([]);
  const [selectedTransportes, setSelectedTransportes] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDestinos, setSelectedDestinos] = useState<string[]>([]);
  const [selectedIncluye, setSelectedIncluye] = useState<string[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [mes, setMes] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortPaquetes>('relevancia');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialized = useRef(false);
  const guardUrlToState = useRef(false);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // 1. URL -> State
  useEffect(() => {
    if (!searchParams) return;
    const urlParams = new URLSearchParams(searchParams.toString());
    
    const urlQ = urlParams.get('q') || '';
    const urlSlug = urlParams.get('slug') || null;
    const urlMes = urlParams.get('mes') || '';
    const urlCategoria = readMulti(urlParams, 'categoria');
    const urlTipo = readMulti(urlParams, 'tipo');
    const urlTransporte = readMulti(urlParams, 'transporte').map((t) => t.toLowerCase());
    const urlTag = readMulti(urlParams, 'tag').map((t) => t.toLowerCase());
    const urlDestino = readMulti(urlParams, 'destino');
    const urlIncluye = readMulti(urlParams, 'incluye');

    let didApply = false;

    if (searchTerm !== urlQ) {
      setSearchTerm(urlQ);
      setDebouncedSearchTerm(urlQ);
      didApply = true;
    }
    if (slug !== urlSlug) {
      setSlug(urlSlug);
      didApply = true;
    }
    if (mes !== urlMes) {
      setMes(urlMes);
      didApply = true;
    }
    if (JSON.stringify(selectedCategorias) !== JSON.stringify(urlCategoria)) {
      setSelectedCategorias(urlCategoria);
      didApply = true;
    }
    if (JSON.stringify(selectedTipos) !== JSON.stringify(urlTipo)) {
      setSelectedTipos(urlTipo);
      didApply = true;
    }
    if (JSON.stringify(selectedTransportes) !== JSON.stringify(urlTransporte)) {
      setSelectedTransportes(urlTransporte);
      didApply = true;
    }
    if (JSON.stringify(selectedTags) !== JSON.stringify(urlTag)) {
      setSelectedTags(urlTag);
      didApply = true;
    }
    if (JSON.stringify(selectedDestinos) !== JSON.stringify(urlDestino)) {
      setSelectedDestinos(urlDestino);
      didApply = true;
    }
    if (JSON.stringify(selectedIncluye) !== JSON.stringify(urlIncluye)) {
      setSelectedIncluye(urlIncluye);
      didApply = true;
    }

    if (didApply) {
      guardUrlToState.current = true;
    }
    initialized.current = true;
  }, [searchParams]);

  // 2. State -> URL
  useEffect(() => {
    if (!initialized.current) return;
    if (guardUrlToState.current) {
      guardUrlToState.current = false;
      return;
    }

    const currentUrl = searchParams ? searchParams.toString() : '';
    const params = new URLSearchParams();

    if (debouncedSearchTerm.trim()) params.set('q', debouncedSearchTerm.trim());
    if (slug) params.set('slug', slug);
    if (mes) params.set('mes', mes);
    
    normalizeMulti(selectedCategorias).forEach((v) => params.append('categoria', v));
    normalizeMulti(selectedTipos).forEach(v => params.append('tipo', v));
    normalizeMulti(selectedTransportes.map((t) => t.toLowerCase())).forEach((v) => params.append('transporte', v));
    normalizeMulti(selectedTags.map((t) => t.toLowerCase())).forEach((v) => params.append('tag', v));
    normalizeMulti(selectedDestinos).forEach(v => params.append('destino', v));
    normalizeMulti(selectedIncluye).forEach(v => params.append('incluye', v));

    const nextUrl = params.toString();
    if (nextUrl !== currentUrl) {
      router.replace(`${pathname}${nextUrl ? `?${nextUrl}` : ''}`, { scroll: false });
    }
  }, [
    debouncedSearchTerm,
    slug,
    mes,
    selectedCategorias,
    selectedTipos,
    selectedTransportes,
    selectedTags,
    selectedDestinos,
    selectedIncluye,
    router,
    pathname,
    searchParams,
  ]);

  const normalizeTransport = (value: string): 'bus' | 'avion' | 'barco' | null => {
    const v = String(value).trim().toLowerCase();
    if (!v) return null;
    if (v.includes('bus')) return 'bus';
    if (v.includes('avion') || v.includes('avión') || v.includes('aereo') || v.includes('aéreo')) return 'avion';
    if (v.includes('barco')) return 'barco';
    return null;
  };

  // Filtros dinámicos: solo valores que existen en los datos
  const destinos = useMemo(() => {
    const unique = Array.from(
      new Set(paquetes.map((p) => p.destino || p.eventoLugar).filter(Boolean))
    ) as string[];
    return unique.sort();
  }, [paquetes]);

  const tiposUnicos = useMemo(() => {
    const unique = Array.from(new Set(paquetes.map((p) => p.tipo).filter(Boolean)));
    return unique.sort((a, b) => a.localeCompare(b));
  }, [paquetes]);

  const categoriasDisponibles = useMemo(() => {
    return (categorias || [])
      .filter((categoria) => categoria.activa)
      .filter((categoria) => paquetes.some((paquete) => packageHasCategory(paquete, categoria.id)))
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));
  }, [categorias, paquetes]);

  const categoryIdBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const categoria of categoriasDisponibles) {
      const slugValue = String(categoria.slug || '').trim().toLowerCase();
      if (!slugValue) continue;
      map.set(slugValue, categoria.id);
    }
    return map;
  }, [categoriasDisponibles]);

  const selectedCategoryIds = useMemo(() => {
    return selectedCategorias
      .map((categoriaSlug) => categoryIdBySlug.get(String(categoriaSlug).trim().toLowerCase()) || '')
      .filter(Boolean);
  }, [categoryIdBySlug, selectedCategorias]);

  const incluyeOpciones = useMemo(() => {
    const set = new Set<string>();
    paquetes.forEach((p) => {
      (p.incluye || []).forEach((item) => {
        const t = String(item).trim();
        if (t) set.add(t);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [paquetes]);

  const tagsUnicos = useMemo(() => {
    const set = new Set<string>();
    paquetes.forEach((p) => {
      (p.tags || []).forEach((tag) => {
        const t = String(tag).trim().toLowerCase();
        if (t) set.add(t);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [paquetes]);

  const formatMes = (yyyyMm: string) => {
    const [y, m] = yyyyMm.split("-");
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1);
    return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  };

  // Calculate available months from the currently filtered packages,
  // but don't filter the months list by the selected month itself (so user can change selection)
  const mesesDisponibles = useMemo(() => {
    const setMeses = new Set<string>();
    // Temporarily filter by all criteria except 'mes' to calculate available months
    const paquetesSinMes = paquetes.filter((paquete) => {
      // 1. Slug (Deep link) - Es excluyente
      if (slug && paquete.slug !== slug) return false;

      // 2. Búsqueda por texto
      if (debouncedSearchTerm.trim()) {
        const searchLower = debouncedSearchTerm.toLowerCase().trim();
        const matchesSearch =
          paquete.titulo.toLowerCase().includes(searchLower) ||
          (paquete.destino && paquete.destino.toLowerCase().includes(searchLower)) ||
          (paquete.eventoLugar && paquete.eventoLugar.toLowerCase().includes(searchLower)) ||
          (paquete.eventoFecha && paquete.eventoFecha.toLowerCase().includes(searchLower)) ||
          (paquete.descripcion && paquete.descripcion.toLowerCase().includes(searchLower)) ||
          (paquete.descripcionCorta && paquete.descripcionCorta.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // 3. Categorías
      if (selectedCategoryIds.length > 0) {
        const matchesCategory = selectedCategoryIds.some((categoriaId) => packageHasCategory(paquete, categoriaId));
        if (!matchesCategory) return false;
      }

      // 4. Tipos
      if (selectedTipos.length > 0) {
        if (!selectedTipos.includes(paquete.tipo)) return false;
      }

      // 5. Transportes
      if (selectedTransportes.length > 0) {
        const paqueteTransportes = new Set(
          (paquete.tiposTransporte || [])
            .map((t) => normalizeTransport(t))
            .filter((t): t is "bus" | "avion" | "barco" => Boolean(t))
        );
        const hasAny = selectedTransportes.some((t) => paqueteTransportes.has(t as "bus" | "avion" | "barco"));
        if (!hasAny) return false;
      }

      // 6. Tags
      if (selectedTags.length > 0) {
        const packageTags = new Set((paquete.tags || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean));
        const etiquetaTags = (paquete.etiqueta || "")
          .split(",")
          .map((t) => String(t).trim().toLowerCase())
          .filter(Boolean);
        etiquetaTags.forEach((t) => packageTags.add(t));
        const hasAny = selectedTags.some((t) => packageTags.has(String(t).trim().toLowerCase()));
        if (!hasAny) return false;
      }

      // 7. Destinos
      if (selectedDestinos.length > 0 && !slug) {
        const destinoValue = paquete.destino || paquete.eventoLugar;
        if (!destinoValue || !selectedDestinos.includes(destinoValue)) return false;
      }

      // 8. Incluye
      if (selectedIncluye.length > 0) {
        const paqueteIncluye = (paquete.incluye || []).map((i) => String(i).trim());
        const tieneTodos = selectedIncluye.every((sel) => paqueteIncluye.includes(sel));
        if (!tieneTodos) return false;
      }

      return true;
    });

    paquetesSinMes.forEach((p) => {
      p.salidas?.forEach((s) => {
        if (s.fecha) setMeses.add(s.fecha.substring(0, 7));
      });
    });
    return Array.from(setMeses).sort();
  }, [
    paquetes,
    slug,
    debouncedSearchTerm,
    selectedCategoryIds,
    selectedTipos,
    selectedTransportes,
    selectedTags,
    selectedDestinos,
    selectedIncluye,
  ]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedCategorias, selectedTipos, selectedTransportes, selectedTags, selectedDestinos, selectedIncluye, sortBy, slug, mes]);

  const paquetesFiltrados = useMemo(() => {
    // Deduplicate first to avoid duplicates
    const uniquePaquetes = Array.from(
      new Map(paquetes.map(p => [p.id, p])).values()
    );

    let list = uniquePaquetes.filter((paquete) => {
      // 1. Slug (Deep link) - Es excluyente
      if (slug && paquete.slug !== slug) return false;

      // 2. Búsqueda por texto
      if (debouncedSearchTerm.trim()) {
        const searchLower = debouncedSearchTerm.toLowerCase().trim();
        const matchesSearch =
          paquete.titulo.toLowerCase().includes(searchLower) ||
          (paquete.destino && paquete.destino.toLowerCase().includes(searchLower)) ||
          (paquete.eventoLugar && paquete.eventoLugar.toLowerCase().includes(searchLower)) ||
          (paquete.eventoFecha && paquete.eventoFecha.toLowerCase().includes(searchLower)) ||
          (paquete.descripcion && paquete.descripcion.toLowerCase().includes(searchLower)) ||
          (paquete.descripcionCorta && paquete.descripcionCorta.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // 3. Categorías
      if (selectedCategoryIds.length > 0) {
        const matchesCategory = selectedCategoryIds.some((categoriaId) => packageHasCategory(paquete, categoriaId));
        if (!matchesCategory) return false;
      }

      // 4. Tipo
      if (selectedTipos.length > 0) {
        if (!selectedTipos.includes(paquete.tipo)) return false;
      }

      // 5. Con transporte
      if (selectedTransportes.length > 0) {
        const paqueteTransportes = new Set(
          (paquete.tiposTransporte || [])
            .map((t) => normalizeTransport(t))
            .filter((t): t is 'bus' | 'avion' | 'barco' => Boolean(t))
        );
        const hasAny = selectedTransportes.some((t) => paqueteTransportes.has(t as 'bus' | 'avion' | 'barco'));
        if (!hasAny) return false;
      }

      // 6. Tags (ej: promo, escapada, religioso)
      if (selectedTags.length > 0) {
        const packageTags = new Set((paquete.tags || []).map((t) => String(t).trim().toLowerCase()).filter(Boolean));
        const etiquetaTags = (paquete.etiqueta || '')
          .split(',')
          .map((t) => String(t).trim().toLowerCase())
          .filter(Boolean);
        etiquetaTags.forEach((t) => packageTags.add(t));
        const hasAny = selectedTags.some((t) => packageTags.has(String(t).trim().toLowerCase()));
        if (!hasAny) return false;
      }

      // 7. Destino
      if (selectedDestinos.length > 0 && !slug) {
        const destinoValue = paquete.destino || paquete.eventoLugar;
        if (!destinoValue || !selectedDestinos.includes(destinoValue)) return false;
      }

      // 8. Mes
      if (mes) {
        const hasMes = paquete.salidas?.some(s => s.fecha && s.fecha.substring(0, 7) === mes);
        if (!hasMes) return false;
      }

      // 9. Incluye
      if (selectedIncluye.length > 0) {
        const paqueteIncluye = (paquete.incluye || []).map((i) => String(i).trim());
        const tieneTodos = selectedIncluye.every((sel) => paqueteIncluye.includes(sel));
        if (!tieneTodos) return false;
      }

      return true;
    });

    // Ordenar
    if (sortBy === 'nombre') {
      list = [...list].sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
    } else if (sortBy === 'precio') {
      list = [...list].sort((a, b) => (a.precio ?? 0) - (b.precio ?? 0));
    } else if (sortBy === 'destino') {
      list = [...list].sort((a, b) => {
        const da = (a.destino || a.eventoLugar || '').toLowerCase();
        const db = (b.destino || b.eventoLugar || '').toLowerCase();
        return da.localeCompare(db);
      });
    }
    return list;
  }, [paquetes, debouncedSearchTerm, selectedCategoryIds, selectedTipos, selectedTransportes, selectedTags, selectedDestinos, selectedIncluye, sortBy, slug, mes]);

  const toggleCategoria = (categoriaSlug: string) => {
    setSelectedCategorias((prev) =>
      prev.includes(categoriaSlug) ? prev.filter((slugValue) => slugValue !== categoriaSlug) : [...prev, categoriaSlug]
    );
  };

  // Calcular paginación
  const totalPages = Math.ceil(paquetesFiltrados.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  
  const paquetesPaginados = useMemo(() => {
    return paquetesFiltrados.slice(startIndex, endIndex);
  }, [paquetesFiltrados, startIndex, endIndex]);

  // Scroll al inicio al cambiar de página
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  const toggleTipo = (tipo: string) => {
    setSelectedTipos(prev =>
      prev.includes(tipo)
        ? prev.filter(t => t !== tipo)
        : [...prev, tipo]
    );
  };

  const toggleDestino = (destino: string) => {
    setSelectedDestinos(prev =>
      prev.includes(destino)
        ? prev.filter(d => d !== destino)
        : [...prev, destino]
    );
  };

  const toggleIncluye = (item: string) => {
    setSelectedIncluye((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
    );
  };

  const toggleTag = (tag: string) => {
    const t = String(tag).trim().toLowerCase();
    if (!t) return;
    setSelectedTags((prev) => (prev.includes(t) ? prev.filter((v) => v !== t) : [...prev, t]));
  };

  const limpiarFiltros = () => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setSelectedCategorias([]);
    setSelectedTipos([]);
    setSelectedTransportes([]);
    setSelectedTags([]);
    setSelectedDestinos([]);
    setSelectedIncluye([]);
    setSlug(null);
    setMes('');
  };

  const hayFiltrosActivos =
    debouncedSearchTerm.trim() !== '' ||
    selectedCategorias.length > 0 ||
    selectedTipos.length > 0 ||
    selectedTransportes.length > 0 ||
    selectedTags.length > 0 ||
    selectedDestinos.length > 0 ||
    selectedIncluye.length > 0 ||
    slug !== null ||
    mes !== '';

  return (
    <section className="bg-[#F5FAFF] pb-12 pt-6 md:pb-16 md:pt-10">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          <aside className="lg:col-span-1">
            <div className="lg:hidden mb-4">
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                className="w-full border-gray-300 bg-white hover:bg-gray-50 text-black h-11 font-semibold"
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
              </Button>
            </div>

            <div
              className={`${showFilters ? 'block' : 'hidden'} lg:block sticky top-4 rounded-[24px] border border-[#E7EEF5] bg-white p-5 shadow-[0_14px_34px_rgba(17,43,73,0.08)]`}
            >
              <div className="mb-5 flex items-center justify-between border-b border-[#EDF2F7] pb-3">
                <h2 className="text-base font-extrabold tracking-[-0.02em] text-[#112B49]">Filtros</h2>
                {hayFiltrosActivos && (
                  <Button onClick={limpiarFiltros} variant="ghost" size="sm" className="text-xs text-[#6C829A] hover:bg-[#F4F8FB] hover:text-[#112B49]">
                    Limpiar
                  </Button>
                )}
              </div>

              <div className="space-y-5">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 block">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Destino, título..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="h-10 border-[#E7EEF5] bg-[#FBFDFF] pl-10 text-sm focus:border-[#2BB8BF] focus:ring-1 focus:ring-[#2BB8BF]"
                    />
                  </div>
                </div>

                {/* Mes selector */}
                {mesesDisponibles.length > 0 && (
                  <div className="pt-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 block">Fecha</Label>
                    <div className="relative">
                      <select
                        value={mes}
                        onChange={(e) => setMes(e.target.value)}
                        className="w-full h-10 border-[#E7EEF5] bg-[#FBFDFF] px-3 text-sm focus:border-[#2BB8BF] focus:ring-1 focus:ring-[#2BB8BF] rounded-md appearance-none cursor-pointer"
                      >
                        <option value="">Cualquier fecha</option>
                        {mesesDisponibles.map((m) => (
                          <option key={m} value={m}>
                            {formatMes(m)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                )}

                {categoriasDisponibles.length > 0 && (
                  <div className="pt-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 block">Destinos</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {categoriasDisponibles.map((categoria) => (
                        <label key={categoria.id} className="flex items-center gap-2.5 cursor-pointer group">
                          <Checkbox
                            checked={selectedCategorias.includes(String(categoria.slug).trim().toLowerCase())}
                            onCheckedChange={() => toggleCategoria(String(categoria.slug).trim().toLowerCase())}
                            className="border-gray-300 data-[state=checked]:bg-black data-[state=checked]:border-black"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-black">{categoria.nombre}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {tiposUnicos.length > 0 && (
                  <div className="pt-4">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 block">Tipo</Label>
                    <div className="space-y-2">
                      {tiposUnicos.map((tipo) => (
                        <label key={tipo} className="flex items-center gap-2.5 cursor-pointer group">
                          <Checkbox
                            checked={selectedTipos.includes(tipo)}
                            onCheckedChange={() => toggleTipo(tipo)}
                            className="border-gray-300 data-[state=checked]:bg-black data-[state=checked]:border-black"
                          />
                          <span className="text-sm text-gray-700 group-hover:text-black capitalize">
                            {TIPO_LABELS[tipo] || tipo}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tipo, Transporte y Etiquetas ya no se muestran: solo quedan destino, fecha y buscador.
                    El filtrado por esos campos sigue activo vía query params (?tipo=, ?transporte=, ?tag=). */}

                {/* Sección 'Incluye' oculta según requerimiento */}
              </div>
            </div>
          </aside>

          {/* Grid de Paquetes */}
          <div className="lg:col-span-3">
            {/* Barra: resultados + ordenar + por página */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 pb-4 border-b border-gray-200">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-black">{paquetesFiltrados.length}</span>{' '}
                {paquetesFiltrados.length === 1 ? 'paquete' : 'paquetes'}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 whitespace-nowrap">Ordenar:</span>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortPaquetes)}>
                    <SelectTrigger className="w-[160px] h-9 bg-white border-gray-200 text-sm text-black">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relevancia">Relevancia</SelectItem>
                      <SelectItem value="nombre">Nombre A–Z</SelectItem>
                      <SelectItem value="precio">Precio (menor a mayor)</SelectItem>
                      <SelectItem value="destino">Destino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(v) => {
                    setItemsPerPage(Number(v));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[130px] h-9 bg-white border-gray-200 text-sm text-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12 por página</SelectItem>
                    <SelectItem value="24">24 por página</SelectItem>
                    <SelectItem value="48">48 por página</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {paquetes.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-300">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-800 mb-6">
                  <X className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-lg font-bold text-black mb-3">No hay paquetes disponibles</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">Aún no hay paquetes turísticos cargados.</p>
              </div>
            ) : paquetesFiltrados.length > 0 ? (
              <>
                <div className="text-xs text-gray-500 mb-4">
                  Mostrando {startIndex + 1}–{Math.min(endIndex, paquetesFiltrados.length)} de {paquetesFiltrados.length}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentPage}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
                  >
                    {paquetesPaginados.map((paquete) => (
                      <div key={paquete.id} className="h-full">
                        <HomeDepartureCard
                          paquete={paquete}
                          fullWidth
                          className="h-full"
                        />
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="mt-12 flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2">
                      {/* Primera página */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="h-9 w-9 p-0"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>

                      {/* Página anterior */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="h-9 w-9 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      {/* Números de página */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(page => {
                            // Mostrar: primera, última, actual, y 2 a cada lado de la actual
                            if (page === 1 || page === totalPages) return true;
                            if (Math.abs(page - currentPage) <= 2) return true;
                            return false;
                          })
                          .map((page, index, array) => {
                            // Agregar "..." entre números no consecutivos
                            const prevPage = index > 0 ? array[index - 1] : 0;
                            const showEllipsis = prevPage && page - prevPage > 1;

                            return (
                              <div key={page} className="flex items-center gap-1">
                                {showEllipsis && (
                                  <span className="px-2 text-gray-400">...</span>
                                )}
                                <Button
                                  variant={currentPage === page ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => setCurrentPage(page)}
                                  className={`h-9 w-9 p-0 ${
                                    currentPage === page
                                      ? 'bg-black text-white hover:bg-gray-800 border-black'
                                      : 'border-gray-300 text-black hover:bg-gray-100'
                                  }`}
                                >
                                  {page}
                                </Button>
                              </div>
                            );
                          })}
                      </div>

                      {/* Página siguiente */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="h-9 w-9 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>

                      {/* Última página */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="h-9 w-9 p-0"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>

                    <p className="text-base text-gray-500">
                      Página {currentPage} de {totalPages}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-gray-300">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-800 mb-6">
                  <X className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-lg font-bold text-black mb-3">No se encontraron paquetes</h3>
                <p className="text-gray-600 mb-4 max-w-md mx-auto">
                  No hay paquetes que coincidan con los filtros seleccionados.
                </p>
                {hayFiltrosActivos && (
                  <p className="text-sm text-gray-500 mb-6">
                    Filtros activos:
                    {searchTerm && ` Búsqueda: "${searchTerm}"`}
                    {selectedCategorias.length > 0 && ` · ${selectedCategorias.length} categoría(s)`}
                    {selectedTipos.length > 0 && ` · ${selectedTipos.length} tipo(s)`}
                    {selectedTransportes.length > 0 && ` · ${selectedTransportes.length} transporte(s)`}
                    {selectedTags.length > 0 && ` · ${selectedTags.length} etiqueta(s)`}
                    {selectedDestinos.length > 0 && ` · ${selectedDestinos.length} destino(s)`}
                    {selectedIncluye.length > 0 && ` · ${selectedIncluye.length} incluye`}
                  </p>
                )}
                <Button onClick={limpiarFiltros} className="bg-black text-white hover:bg-gray-800">
                  Limpiar todos los filtros
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function PaquetesClient(props: PaquetesClientProps) {
  return (
    <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-white"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div></div>}>
      <PaquetesClientContent {...props} />
    </Suspense>
  );
}
