'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BusFront, ChevronRight, PencilRuler, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type TemplateListItem = {
  id: string;
  name?: string;
  busType?: string;
  status?: 'draft' | 'published';
  floors?: number;
  rows?: number;
  cols?: number;
  seats?: Array<{ floor?: number; row?: number; col?: number; label?: string }>;
  specialCells?: Array<{ floor?: number; row?: number; col?: number; type?: 'wc' | 'stairs' | 'driver' | 'empty' }>;
  updatedAt?: { seconds?: number } | string | Date | null;
};

function formatDate(value: TemplateListItem['updatedAt']) {
  if (!value) return 'Sin cambios recientes';
  try {
    if (typeof value === 'string') return new Date(value).toLocaleDateString('es-AR');
    if (value instanceof Date) return value.toLocaleDateString('es-AR');
    if (typeof value === 'object' && typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000).toLocaleDateString('es-AR');
    }
  } catch {
    return 'Sin fecha';
  }
  return 'Sin fecha';
}

function getDisplayColumns(cols: number, aisleCols: number[]) {
  const sorted = [...aisleCols]
    .filter((item) => item > 0 && item < cols)
    .sort((a, b) => a - b);

  const result: Array<{ kind: 'cell'; col: number } | { kind: 'aisle'; key: string }> = [];
  for (let col = 0; col < cols; col += 1) {
    result.push({ kind: 'cell', col });
    if (sorted.includes(col + 1)) result.push({ kind: 'aisle', key: `aisle-${col}` });
  }
  return result;
}

function PreviewCell({
  seat,
  specialType,
}: {
  seat?: { label?: string } | null;
  specialType?: 'wc' | 'stairs' | 'driver' | 'empty' | undefined;
}) {
  const classes = specialType
    ? specialType === 'driver'
      ? 'border-[#F7C768] bg-[#FFF5DF] text-[#CA7A03]'
      : specialType === 'wc'
        ? 'border-[#AFC9FF] bg-[#F4F8FF] text-[#3B73F5]'
        : specialType === 'stairs'
          ? 'border-[#D7C7FF] bg-[#F8F4FF] text-[#855CF6]'
          : 'border-[#D5DFEA] bg-[#F7FAFD] text-[#6C819A]'
    : 'border-[#BFE9F0] bg-[#F2FEFF] text-[#1493B0]';

  const label = specialType
    ? specialType === 'driver'
      ? 'C'
      : specialType === 'wc'
        ? 'B'
        : specialType === 'stairs'
          ? 'E'
          : ''
    : seat?.label ?? '';

  return (
    <div className={cn('flex h-7 min-w-[28px] items-center justify-center rounded-lg border text-[9px] font-black', classes)}>
      {label}
    </div>
  );
}

function TemplatePreview({ item }: { item: TemplateListItem }) {
  const rows = Math.max(1, Math.min(6, Number(item.rows ?? 0) || 4));
  const cols = Math.max(1, Math.min(4, Number(item.cols ?? 0) || 4));
  const displayColumns = getDisplayColumns(cols, Array.isArray((item as any).aisleCols) ? (item as any).aisleCols : [2]);

  const seatMap = useMemo(() => {
    const map = new Map<string, { label?: string }>();
    for (const seat of item.seats ?? []) {
      const row = Number(seat?.row ?? -1);
      const col = Number(seat?.col ?? -1);
      if (row < 0 || col < 0 || row >= rows || col >= cols) continue;
      map.set(`${row}:${col}`, seat);
    }
    return map;
  }, [cols, item.seats, rows]);

  const specialMap = useMemo(() => {
    const map = new Map<string, 'wc' | 'stairs' | 'driver' | 'empty'>();
    for (const cell of item.specialCells ?? []) {
      const row = Number(cell?.row ?? -1);
      const col = Number(cell?.col ?? -1);
      const floor = Number(cell?.floor ?? 0);
      if (floor !== 0 || row < 0 || col < 0 || row >= rows || col >= cols || !cell.type) continue;
      map.set(`${row}:${col}`, cell.type);
    }
    return map;
  }, [cols, item.specialCells, rows]);

  return (
    <div className="rounded-[26px] border border-[#D6E2EE] bg-[linear-gradient(180deg,#E9ECF0_0%,#FFFFFF_18%,#EEF2F6_100%)] p-[7px] shadow-[0_12px_24px_rgba(15,23,42,0.08)]">
      <div className="rounded-[22px] border border-[#B8C6D6] bg-[linear-gradient(180deg,#EEF2F6_0%,#FFFFFF_20%,#F0F4F8_100%)] px-3 pb-3 pt-4">
        <div className="mx-auto mb-3 h-8 w-[74%] rounded-full border border-[#B9C4D1] bg-[linear-gradient(180deg,#D5DAE0_0%,#FAFBFD_100%)]" />
        <div className="space-y-1.5">
          {Array.from({ length: rows }, (_, row) => (
            <div
              key={`preview-row-${row}`}
              className="grid items-center gap-1.5"
              style={{ gridTemplateColumns: displayColumns.map((itemCol) => itemCol.kind === 'aisle' ? '10px' : 'minmax(28px,1fr)').join(' ') }}
            >
              {displayColumns.map((column) => {
                if (column.kind === 'aisle') {
                  return <div key={column.key} className="mx-auto h-7 w-[6px] rounded-full bg-[#D9E4EE]" />;
                }
                const key = `${row}:${column.col}`;
                return <PreviewCell key={key} seat={seatMap.get(key)} specialType={specialMap.get(key)} />;
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function SeatLayoutsDashboard() {
  const { user } = useAuth();
  const [items, setItems] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/seat-layouts', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('No pudimos cargar las plantillas');
      const data = await res.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      toast.error('No pudimos cargar las plantillas');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user]);

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''), 'es'));
  }, [items]);

  const remove = async (id: string) => {
    if (!user) return;
    const ok = confirm('¿Eliminar plantilla?');
    if (!ok) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/seat-layouts?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('No se pudo eliminar');
      toast.success('Plantilla eliminada');
      await load();
    } catch {
      toast.error('No pudimos eliminar la plantilla');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-[#DCEAF7] bg-white px-6 py-6 shadow-[0_18px_50px_rgba(8,46,86,0.08)]">
        <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-[#7B90A9]">
          <Link href="/admin" className="transition-colors hover:text-[#12325D]">Admin</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-bold text-[#2BB8BF]">Plantillas de butacas</span>
        </div>

        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ECFAFF]">
              <BusFront className="h-6 w-6 text-[#1593B4]" />
            </div>
            <div>
              <h1 className="text-[20px] font-black tracking-[-0.03em] text-[#112B49]">Plantillas de micro</h1>
              <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#6B84A3]">
                Creá, organizá y editá tus plantillas con la misma lógica visual del selector de butacas del front.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="h-11 rounded-2xl border-[#D6E5F4] px-5 text-[#12325D]"
              onClick={() => void load()}
              disabled={loading}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              {loading ? 'Actualizando...' : 'Actualizar'}
            </Button>
            <Button asChild className="h-11 rounded-2xl bg-[#F6C000] px-5 font-bold text-[#4D3700] hover:bg-[#E9B500]">
              <Link href="/admin/plantillas-micro/nuevo">
                <Plus className="mr-2 h-4 w-4" />
                Nueva plantilla
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-[#D5E2EE] bg-white px-6 py-14 text-center shadow-[0_18px_48px_rgba(8,46,86,0.06)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F1FAFF]">
            <PencilRuler className="h-8 w-8 text-[#1692B4]" />
          </div>
          <h2 className="mt-4 text-[18px] font-black tracking-[-0.03em] text-[#112B49]">Todavía no hay plantillas</h2>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-6 text-[#6B84A3]">
            Creá una plantilla para reutilizarla en salidas con selección de butacas y mantener una experiencia consistente en el front.
          </p>
          <Button asChild className="mt-6 h-11 rounded-2xl bg-[#F6C000] px-5 font-bold text-[#4D3700] hover:bg-[#E9B500]">
            <Link href="/admin/plantillas-micro/nuevo">Crear primera plantilla</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {sorted.map((template) => {
            const seatCount = Array.isArray(template.seats) ? template.seats.length : 0;
            const specialCount = Array.isArray(template.specialCells) ? template.specialCells.length : 0;
            const isDraft = template.status === 'draft';

            return (
              <article
                key={template.id}
                className="rounded-[28px] border border-[#DCEAF7] bg-white p-5 shadow-[0_18px_48px_rgba(8,46,86,0.08)]"
              >
                <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <TemplatePreview item={template} />

                  <div className="flex min-w-0 flex-col">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-[18px] font-black tracking-[-0.03em] text-[#112B49]">
                            {template.name ?? template.id}
                          </h3>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]',
                              isDraft
                                ? 'border-[#F7D8A6] bg-[#FFF8EA] text-[#CA7A03]'
                                : 'border-[#BEECD7] bg-[#F2FFF8] text-[#158C58]'
                            )}
                          >
                            {isDraft ? 'Borrador' : 'Publicada'}
                          </span>
                        </div>

                        <div className="mt-2 text-[13px] text-[#6B84A3]">
                          {template.busType || 'Sin tipo'} • {template.floors ?? 1} piso(s) • {template.rows ?? '—'} filas • {template.cols ?? '—'} columnas
                        </div>
                      </div>

                      <div className="text-right text-[12px] text-[#8AA0BA]">
                        Actualizada
                        <div className="font-bold text-[#12325D]">{formatDate(template.updatedAt)}</div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <MetricCard label="Butacas" value={String(seatCount)} accent="text-[#0E90A8]" />
                      <MetricCard label="Especiales" value={String(specialCount)} accent="text-[#7B61FF]" />
                      <MetricCard label="Pisos" value={String(template.floors ?? 1)} accent="text-[#F59E0B]" />
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                      <Button asChild variant="outline" className="h-10 rounded-2xl border-[#D6E5F4] px-4 text-[#12325D]">
                        <Link href={`/admin/plantillas-micro/${encodeURIComponent(template.id)}`}>Editar</Link>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 rounded-2xl border-[#F1D1D8] px-4 text-[#CF4768] hover:bg-[#FFF5F7]"
                        onClick={() => void remove(template.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#E4EEF7] bg-[#FBFDFF] px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8AA0BA]">{label}</div>
      <div className={cn('mt-1 text-[22px] font-black tracking-[-0.04em]', accent)}>{value}</div>
    </div>
  );
}
