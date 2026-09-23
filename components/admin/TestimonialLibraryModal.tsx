'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, BookOpen, ChevronLeft, ChevronRight, FolderPlus } from 'lucide-react';
import type { Testimonial } from '@/components/landing-reserva/types';

export type LibraryTestimonial = Testimonial & { id: string };

type ApiResponse = {
  items: LibraryTestimonial[];
  total: number;
  page?: number;
  totalPages?: number;
  limit?: number;
  categories: string[];
};

type TestimonialLibraryModalProps = {
  open: boolean;
  onClose: () => void;
  onAdd: (testimonials: Testimonial[]) => void;
};

const PAGE_SIZE = 8;

export function TestimonialLibraryModal({ open, onClose, onAdd }: TestimonialLibraryModalProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<LibraryTestimonial[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Map<string, LibraryTestimonial>>(new Map());
  const [addingFolder, setAddingFolder] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);

  const fetchPage = useCallback(
    async (pageNum: number, categoryFilter: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(pageNum),
          limit: String(PAGE_SIZE),
        });
        if (categoryFilter && categoryFilter !== 'General') {
          params.set('category', categoryFilter);
        }
        const res = await fetch(`/api/testimonials?${params.toString()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!res.ok) throw new Error('Error al cargar');
        const data: ApiResponse = await res.json();
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
        if (data.categories?.length) setCategories(data.categories);
        return data;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!open) return;
    setCategory('');
    setPage(1);
    setSelectedIds(new Set());
    setSelectedItems(new Map());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    fetchPage(page, category);
  }, [open, page, category, fetchPage]);

  const toggleSelect = (item: LibraryTestimonial, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => new Set(prev).add(item.id));
      setSelectedItems((prev) => new Map(prev).set(item.id, item));
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
      setSelectedItems((prev) => {
        const next = new Map(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  /** Selecciona o deselecciona todos los testimonios de la carpeta/categoría actual (o todo el archivo si es General). */
  const selectAllInFolder = async (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      setSelectedItems(new Map());
      return;
    }
    setSelectingAll(true);
    try {
      const params = new URLSearchParams({ all: 'true' });
      if (category && category !== 'General') params.set('category', category);
      const res = await fetch(`/api/testimonials?${params.toString()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) throw new Error('Error al cargar');
      const data: { items: LibraryTestimonial[] } = await res.json();
      const list = data.items ?? [];
      const newIds = new Set(list.map((i) => i.id));
      const newItems = new Map(list.map((i) => [i.id, i]));
      setSelectedIds(newIds);
      setSelectedItems(newItems);
    } finally {
      setSelectingAll(false);
    }
  };

  const handleAddSelected = () => {
    const toAdd = Array.from(selectedItems.values()).map(({ name, quote, role }) => ({
      name,
      quote,
      role,
    }));
    if (toAdd.length) onAdd(toAdd);
    setSelectedIds(new Set());
    setSelectedItems(new Map());
    onClose();
  };

  const handleAddFolder = async () => {
    if (!category) return;
    setAddingFolder(true);
    try {
      const res = await fetch(
        `/api/testimonials?category=${encodeURIComponent(category)}&all=true`,
        { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } }
      );
      if (!res.ok) throw new Error('Error al cargar carpeta');
      const data: { items: LibraryTestimonial[] } = await res.json();
      const toAdd = (data.items ?? []).map(({ name, quote, role }) => ({ name, quote, role }));
      if (toAdd.length) onAdd(toAdd);
      onClose();
    } finally {
      setAddingFolder(false);
    }
  };

  const selectedCount = selectedIds.size;
  const allInFolderSelected = total > 0 && selectedCount === total;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[90vh] flex flex-col sm:max-w-2xl bg-white border border-gray-200 rounded-2xl shadow-2xl p-0 gap-0 overflow-hidden"
        showCloseButton={true}
      >
        <div className="bg-gradient-to-br from-gray-50 to-white border-b border-gray-100 px-6 py-5">
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex items-center gap-3 text-lg font-semibold text-gray-900">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BookOpen className="h-5 w-5" />
              </span>
              Biblioteca de testimonios
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600 leading-relaxed">
              Elegí uno o varios testimonios, o agregá todos los de una carpeta. La lista se actualiza desde{' '}
              <code className="rounded bg-gray-200/80 px-1.5 py-0.5 text-xs font-medium text-gray-700">testimonials.json</code>.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex flex-col gap-4 flex-1 min-h-0 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Carpeta</span>
              <Select
                value={category || 'General'}
                onValueChange={(v) => {
                  setCategory(v === 'General' ? '' : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[160px] h-9 bg-white border-gray-200 shadow-sm">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {(categories.length ? categories : ['General']).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {category && category !== 'General' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddFolder}
                disabled={addingFolder}
                className="gap-1.5 border-gray-200 bg-white hover:bg-gray-50"
              >
                {addingFolder ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderPlus className="h-4 w-4" />
                )}
                Agregar toda la carpeta
              </Button>
            )}
          </div>

          {(items.length > 0 || total > 0) && (
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer text-gray-600 hover:text-gray-900 transition-colors">
                <Checkbox
                  checked={allInFolderSelected}
                  onCheckedChange={(c) => selectAllInFolder(!!c)}
                  disabled={selectingAll}
                  className="border-gray-300 data-[state=checked]:bg-primary"
                />
                {selectingAll ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Cargando…
                  </span>
                ) : (
                  'Seleccionar Todos'
                )}
              </label>
              <span className="text-gray-500 font-medium">
                {total} testimonio{total !== 1 ? 's' : ''} en total
              </span>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-gray-50/50 overflow-auto flex-1 min-h-[260px] max-h-[340px] shadow-inner">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[260px] gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-gray-500">Cargando testimonios...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[260px] text-gray-500 gap-3 px-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                  <BookOpen className="h-7 w-7 text-gray-400" />
                </span>
                <p className="text-sm font-medium text-gray-600">No hay testimonios en esta carpeta</p>
                <p className="text-xs text-gray-400 text-center max-w-[220px]">Probá con otra carpeta o agregá testimonios en el JSON.</p>
              </div>
            ) : (
              <ul className="p-2 space-y-2">
                {items.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  return (
                    <li
                      key={item.id}
                      onClick={() => toggleSelect(item, !isSelected)}
                      className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(c) => toggleSelect(item, !!c)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 shrink-0 border-gray-300 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-gray-600 line-clamp-2 mt-1 leading-relaxed">"{item.quote}"</p>
                        {item.role && (
                          <p className="text-xs text-gray-500 mt-1.5 font-medium">{item.role}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {totalPages > 1 && !loading && (
            <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-100 px-4 py-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="gap-1.5 border-gray-200 bg-white"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm font-medium text-gray-600">
                Página {page} de {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="gap-1.5 border-gray-200 bg-white"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-gray-100 bg-gray-50/80 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose} className="border-gray-200">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleAddSelected}
            disabled={selectedCount === 0}
            className="bg-primary hover:bg-primary/90 font-semibold text-white"
          >
            Agregar seleccionados {selectedCount > 0 && `(${selectedCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
