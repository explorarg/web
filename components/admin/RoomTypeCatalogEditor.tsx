'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import type { ReservationRoomType, RoomTypeDefinition } from '@/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

type Draft = Omit<RoomTypeDefinition, 'id'>;

const EMPTY_DRAFT: Draft = {
  label: '',
  description: '',
  isFullDay: false,
  active: true,
  order: 0,
};

export default function RoomTypeCatalogEditor({
  selectedIds,
  onSelectedIdsChange,
  selectedOptions,
  onSelectedOptionsChange,
}: {
  selectedIds: ReservationRoomType[];
  onSelectedIdsChange: (value: ReservationRoomType[]) => void;
  selectedOptions: RoomTypeDefinition[];
  onSelectedOptionsChange: (value: RoomTypeDefinition[]) => void;
}) {
  const { user } = useAuth();
  const [items, setItems] = useState<RoomTypeDefinition[]>(selectedOptions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [dialogOpen, setDialogOpen] = useState(false);
  const selectedIdsRef = useRef(selectedIds);
  const onSelectedOptionsChangeRef = useRef(onSelectedOptionsChange);
  selectedIdsRef.current = selectedIds;
  onSelectedOptionsChangeRef.current = onSelectedOptionsChange;

  const syncSelectedOptions = (definitions: RoomTypeDefinition[], ids = selectedIds) => {
    onSelectedOptionsChange(ids.map((id) => definitions.find((item) => item.id === id)).filter(Boolean) as RoomTypeDefinition[]);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/admin/room-types', { headers: { Authorization: `Bearer ${token}` } });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || 'No se pudo cargar el catálogo.');
        const definitions = Array.isArray(payload?.items) ? payload.items as RoomTypeDefinition[] : [];
        if (!cancelled) {
          setItems(definitions);
          onSelectedOptionsChangeRef.current(
            selectedIdsRef.current
              .map((id) => definitions.find((item) => item.id === id))
              .filter(Boolean) as RoomTypeDefinition[]
          );
        }
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'No se pudo cargar el catálogo.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user]);

  const openCreate = () => {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT, order: items.length });
    setDialogOpen(true);
  };

  const openEdit = (item: RoomTypeDefinition) => {
    setEditingId(item.id);
    setDraft({
      label: item.label,
      description: item.description,
      isFullDay: Boolean(item.isFullDay),
      active: item.active !== false,
      order: Number(item.order ?? 0),
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!user || draft.label.trim().length < 2) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/room-types', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editingId ? { id: editingId, data: draft } : draft),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'No se pudo guardar el tipo.');
      const saved = payload.item as RoomTypeDefinition;
      const next = editingId
        ? items.map((item) => item.id === saved.id ? saved : item)
        : [...items, saved];
      next.sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
      setItems(next);
      syncSelectedOptions(next);
      setDialogOpen(false);
      toast.success(editingId ? 'Tipo de habitación actualizado' : 'Tipo de habitación creado');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el tipo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[12px] border border-[#EDF2F7] bg-[#FBFDFF] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold text-[#0F172A]">Tipos de habitación disponibles</div>
          <div className="mt-1 text-[11px] text-[#94A3B8]">Creá opciones reutilizables y elegí cuáles estarán disponibles en este paquete.</div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Nuevo tipo
        </Button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? <div className="text-xs text-[#94A3B8]">Cargando tipos...</div> : null}
        {!loading && items.length === 0 ? <div className="text-xs text-[#94A3B8]">No hay tipos creados.</div> : null}
        {items.map((item) => {
          const checked = selectedIds.includes(item.id);
          return (
            <div key={item.id} className="flex items-start gap-2 rounded-[10px] border border-[#E5EAF0] bg-white p-3">
              <Checkbox
                checked={checked}
                disabled={item.active === false && !checked}
                onCheckedChange={(nextChecked) => {
                  const nextIds = nextChecked
                    ? [...selectedIds, item.id]
                    : selectedIds.filter((id) => id !== item.id);
                  onSelectedIdsChange(nextIds);
                  syncSelectedOptions(items, nextIds);
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12px] font-semibold text-[#0F172A]">{item.label}</span>
                  <button type="button" onClick={() => openEdit(item)} className="text-[#64748B] hover:text-[#0F172A]" aria-label={`Editar ${item.label}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="mt-0.5 block text-[11px] text-[#94A3B8]">{item.description || 'Sin descripción'}</span>
                <div className="mt-1 text-[10px] font-medium uppercase text-[#64748B]">
                  {item.isFullDay ? 'Full Day' : item.active === false ? 'Inactivo' : 'Alojamiento'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar tipo de habitación' : 'Nuevo tipo de habitación'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input value={draft.label} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
            </div>
            <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <span className="text-sm">Es una opción Full Day</span>
              <Switch checked={Boolean(draft.isFullDay)} onCheckedChange={(value) => setDraft((current) => ({ ...current, isFullDay: value }))} />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <span className="text-sm">Disponible para usar</span>
              <Switch checked={draft.active !== false} onCheckedChange={(value) => setDraft((current) => ({ ...current, active: value }))} />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="button" onClick={() => void save()} disabled={saving || draft.label.trim().length < 2}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}