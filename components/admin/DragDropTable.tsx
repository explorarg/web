'use client';

import { useState, useEffect } from 'react';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  GripVertical, 
  Pencil, 
  Trash2,
  Copy,
  Save,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Eye,
  MoreHorizontal,
  AlertTriangle,
  Power,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';

interface TableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render: (item: T) => React.ReactNode;
}

type SortState = {
  key: string;
  direction: 'asc' | 'desc';
  mode: 'default' | 'custom';
};

interface DragDropTableProps<T extends { id: string }> {
  items: T[];
  collectionName: 'categorias' | 'paquetes' | 'paquetes_f1' | 'blog' | 'experiencias';
  columns: TableColumn<T>[];
  onItemsChange: (items: T[]) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (item: T) => void;
  canDuplicate?: boolean;
  onToggleActive?: (item: T) => void;
  editPath: string;
  viewPath?: string; // Ruta para ver el detalle del elemento
  sort?: SortState;
  onSortChange?: (next: SortState) => void;
}

interface SortableRowProps<T> {
  item: T;
  columns: TableColumn<T>[];
  editPath: string;
  viewPath?: string;
  onDelete: (id: string) => void;
  onDuplicate?: (item: T) => void;
  canDuplicate: boolean;
  onToggleActive?: (item: T) => void;
  isDragDisabled: boolean;
}

function SortableRow<T extends { id: string }>({ 
  item, 
  columns,
  editPath,
  viewPath,
  onDelete,
  onDuplicate,
  canDuplicate,
  onToggleActive,
  isDragDisabled 
}: SortableRowProps<T>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: isDragDisabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow 
      ref={setNodeRef} 
      style={style} 
      className={`
        border-b border-black/5 transition-colors
        ${isDragging ? 'bg-gray-100 shadow-lg' : 'hover:bg-black/[0.02]'}
      `}
    >
      <TableCell className="w-12 px-3 py-3">
        <div 
          {...attributes} 
          {...listeners}
          className={`
            p-2 rounded-lg transition-all
            ${isDragDisabled 
              ? 'opacity-30 cursor-not-allowed' 
              : 'cursor-grab active:cursor-grabbing hover:bg-gray-100'
            }
          `}
        >
          <GripVertical className="h-5 w-5 text-gray-400" />
        </div>
      </TableCell>
      {columns.map((column) => (
        <TableCell key={column.key} className="px-4 py-3">
          {column.render(item)}
        </TableCell>
      ))}
      <TableCell className="text-right pr-4 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="rounded-full" title="Más acciones">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[200px] bg-white/90 shadow-lg ring-1 ring-black/10 border border-white/70 backdrop-blur"
          >
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {viewPath && (
              <DropdownMenuItem asChild>
                <Link href={`${viewPath}/${('slug' in item ? (item as any).slug : (item as any).id) || (item as any).id}`} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-4 w-4" />
                  Ver
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem asChild>
              <Link href={`${editPath}/${(item as any).id}`}>
                <Pencil className="h-4 w-4" />
                Editar
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!onDuplicate || !canDuplicate}
              onClick={() => {
                if (onDuplicate && canDuplicate) onDuplicate(item);
              }}
            >
              <Copy className="h-4 w-4" />
              Duplicar
            </DropdownMenuItem>
            {onToggleActive ? (
              <DropdownMenuItem onClick={() => onToggleActive(item)}>
                <Power className="h-4 w-4" />
                {(item as any).visible === true ? 'Desactivar' : 'Activar'}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete((item as any).id)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export default function DragDropTable<T extends { id: string }>({
  items: initialItems,
  collectionName,
  columns,
  onItemsChange,
  onDelete,
  onDuplicate,
  canDuplicate = true,
  onToggleActive,
  editPath,
  viewPath,
  sort,
  onSortChange,
}: DragDropTableProps<T>) {
  const [items, setItems] = useState(initialItems);
  const [originalItems, setOriginalItems] = useState(initialItems);
  const [saving, setSaving] = useState(false);
  const [dragMode, setDragMode] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Actualizar items cuando cambie el prop
  useEffect(() => {
    setItems(initialItems);
    setOriginalItems(initialItems);
  }, [initialItems]);

  const hasChanges = JSON.stringify(items.map(i => i.id)) !== JSON.stringify(originalItems.map(i => i.id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSave = async () => {
    // Verificar si realmente hay cambios
    if (!hasChanges) {
      toast.info('No hay cambios para guardar', {
        description: 'El orden ya está actualizado',
      });
      return;
    }

    setSaving(true);
    try {
      const batch = writeBatch(db);
      
      items.forEach((item, index) => {
        const itemRef = doc(db, collectionName, item.id);
        batch.update(itemRef, { orden: index + 1 });
      });

      await batch.commit();
      
      toast.success('Orden guardado correctamente', {
        description: `${items.length} elementos actualizados`,
      });
      
      setOriginalItems(items);
      onItemsChange(items);
      setDragMode(false);
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('Error al guardar orden');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setItems(originalItems);
    toast.info('Orden restaurado');
  };

  const handleSortClick = (key: string) => {
    if (!onSortChange) return;
    if (dragMode) return;

    const current: SortState = sort ?? { key: 'orden', direction: 'asc', mode: 'default' };
    const isSameKey = current.key === key;

    if (!isSameKey) {
      onSortChange({ key, direction: 'asc', mode: 'custom' });
      return;
    }

    if (current.mode === 'default') {
      onSortChange({ key, direction: 'desc', mode: 'custom' });
      return;
    }

    if (current.direction === 'asc') {
      onSortChange({ key, direction: 'desc', mode: 'custom' });
      return;
    }

    onSortChange({ key: 'orden', direction: 'asc', mode: 'default' });
  };

  const iconForColumn = (key: string, sortable?: boolean) => {
    if (!sortable || !onSortChange) return null;
    const current: SortState = sort ?? { key: 'orden', direction: 'asc', mode: 'default' };
    const isActive = current.key === key;

    if (isActive && current.mode === 'custom') {
      return current.direction === 'asc' ? (
        <ArrowUp className="h-3.5 w-3.5 text-gray-700" />
      ) : (
        <ArrowDown className="h-3.5 w-3.5 text-gray-700" />
      );
    }

    if (isActive && current.mode === 'default') {
      return <ArrowUp className="h-3.5 w-3.5 text-gray-400" />;
    }

    return <ArrowUpDown className="h-3.5 w-3.5 text-gray-300" />;
  };

  return (
    <div className="space-y-4">
      {/* Control de modo drag - Diseño mejorado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-white ring-1 ring-black/5 rounded-2xl">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant={dragMode ? 'default' : 'outline'}
            size="default"
            onClick={() => setDragMode(!dragMode)}
            className={`
              font-semibold transition-all
              ${dragMode 
                ? 'bg-black hover:bg-gray-800 text-white' 
                : 'ring-1 ring-black/10 hover:bg-gray-50'
              }
            `}
          >
            <ArrowUpDown className="mr-2 h-5 w-5" />
            {dragMode ? 'Modo reordenar activo' : 'Reordenar elementos'}
          </Button>
          
          {dragMode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg"
            >
              <GripVertical className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">
                Arrastra las filas para reordenar
              </span>
            </motion.div>
          )}
        </div>
        
        <AnimatePresence>
          {dragMode && hasChanges && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-2"
            >
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 font-medium px-3 py-1">
                <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                Cambios sin guardar
              </Badge>
              <Button
                variant="outline"
                size="default"
                onClick={handleReset}
                disabled={saving}
                className="hover:bg-gray-50"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Deshacer
              </Button>
              <Button
                size="default"
                onClick={handleSave}
                disabled={saving}
                className="bg-black hover:bg-gray-800 text-white"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar orden
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tabla con Drag & Drop - Diseño Profesional */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map(item => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <Table className="text-sm">
              <TableHeader className="[&_tr]:border-black/5">
                <TableRow className="border-black/5 hover:bg-transparent">
                  <TableHead className="w-12 px-3 text-gray-500">
                    {dragMode && <ArrowUpDown className="h-4 w-4 text-gray-400" />}
                  </TableHead>
                  {columns.map((column) => (
                    <TableHead key={column.key} className="px-4">
                      {column.sortable && onSortChange ? (
                        <button
                          type="button"
                          onClick={() => handleSortClick(column.key)}
                          disabled={dragMode}
                          className={`inline-flex items-center gap-2 text-left ${
                            dragMode ? 'cursor-not-allowed opacity-50' : 'hover:text-gray-900'
                          }`}
                          title={
                            dragMode
                              ? 'Desactiva reordenar para ordenar por columnas'
                              : 'Cambiar orden'
                          }
                        >
                          <span>{column.label}</span>
                          {iconForColumn(column.key, column.sortable)}
                        </button>
                      ) : (
                        column.label
                      )}
                    </TableHead>
                  ))}
                  <TableHead className="text-right pr-4">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 2} className="text-center py-8 text-gray-500">
                      No hay elementos
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <SortableRow<T>
                      key={item.id}
                      item={item}
                      columns={columns}
                      editPath={editPath}
                      viewPath={viewPath}
                      onDelete={onDelete}
                      onDuplicate={onDuplicate}
                      canDuplicate={canDuplicate}
                      onToggleActive={onToggleActive}
                      isDragDisabled={!dragMode}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
