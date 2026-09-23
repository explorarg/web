'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy as firestoreOrderBy, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  GripVertical, 
  Loader2,
  Save,
  RotateCcw,
  Sparkles
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

interface OrderItem {
  id: string;
  nombre?: string;
  titulo?: string;
  orden: number;
  activa?: boolean;
  visible?: boolean;
  destacada?: boolean;
  destacado?: boolean;
}

interface DragDropOrderManagerProps {
  collectionName: 'categorias' | 'paquetes' | string;
  currentId?: string;
  onOrdersChange?: (items: { id: string; orden: number }[]) => void;
  onPositionChange?: (position: number) => void; // ⭐ NUEVO: Callback para posición elegida
  newItemName?: string; // ⭐ NUEVO: Nombre del elemento que se está creando
  maxItems?: number;
  onlyDestacados?: boolean;
  hideSaveButton?: boolean; // ⭐ NUEVO: Si true, oculta botón de guardar (para creación)
}

// Componente de item arrastrable
function SortableItem({ 
  item, 
  isEditing, 
  isNew,
  index 
}: { 
  item: OrderItem; 
  isEditing: boolean;
  isNew: boolean;
  index: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const nombre = item.nombre || item.titulo || 'Sin nombre';
  const isDestacado = item.destacada || item.destacado;
  const isInactivo = item.activa === false || item.visible === false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 rounded-[12px] border p-3 transition-all
        ${isNew
          ? 'border-[#8EDCEB] bg-[#F0FDFF] text-[#0E7490] shadow-[0_8px_18px_rgba(14,165,198,0.12)]'
          : isEditing 
          ? 'border-[#0EA5C6] bg-[#ECFEFF] text-[#0F172A] shadow-[0_8px_18px_rgba(14,165,198,0.10)]' 
          : 'bg-white border-[#E5EAF0] hover:border-[#CFE0EF] hover:bg-[#FAFCFE]'
        }
        ${isDragging ? 'cursor-grabbing z-50' : 'cursor-grab'}
      `}
      {...attributes}
      {...listeners}
    >
      {/* Handle para drag */}
      <div className={`flex-shrink-0 ${isNew ? 'text-[#0EA5C6]' : isEditing ? 'text-[#0EA5C6]' : 'text-[#94A3B8]'}`}>
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Número de orden */}
      <div className={`
        flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold
        ${isNew || isEditing ? 'bg-white text-[#0F172A]' : 'bg-[#F1F5F9] text-[#475569]'}
      `}>
        {index + 1}
      </div>

      {/* Info del elemento */}
      <div className="flex-1 min-w-0">
        <p className={`truncate text-[13px] font-semibold ${isNew || isEditing ? 'text-[#0F172A]' : 'text-[#0F172A]'}`}>
          {isNew && <span className="mr-2">+</span>}
          {nombre}
          {isNew && <span className="ml-2 text-[11px] font-medium text-[#0E7490]">(nuevo)</span>}
          {isEditing && !isNew && <span className="ml-2 text-[11px] font-medium text-[#0E7490]">(editando)</span>}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {isDestacado && (
            <Badge className={`text-[10px] font-semibold ${
              isNew || isEditing 
                ? 'bg-white text-[#0F172A] hover:bg-white' 
                : 'bg-[#0F172A] text-white hover:bg-[#0F172A]'
            }`}>
              Destacado
            </Badge>
          )}
          {isInactivo && (
            <Badge variant="secondary" className="text-[10px] font-medium">
              Inactivo
            </Badge>
          )}
        </div>
      </div>

      {/* Indicador visual */}
      <div className={`h-1.5 w-1.5 rounded-full ${isNew || isEditing ? 'bg-[#0EA5C6]' : 'bg-[#CBD5E1]'}`} />
    </div>
  );
}

export default function DragDropOrderManager({
  collectionName,
  currentId,
  onOrdersChange,
  onPositionChange,
  newItemName,
  maxItems,
  onlyDestacados = false,
  hideSaveButton = false
}: DragDropOrderManagerProps) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [originalItems, setOriginalItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Determinar si es un elemento nuevo
  const isNewItem = !currentId && newItemName;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px de movimiento antes de activar drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const q = query(collection(db, collectionName), firestoreOrderBy('orden', 'asc'));
      const snapshot = await getDocs(q);
      let data = snapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data() 
      } as OrderItem));
      
      // Filtrar solo destacados si se indica
      if (onlyDestacados) {
        data = data.filter(item => item.destacado === true || item.destacada === true);
      }
      
      // ⭐ Agregar elemento nuevo si existe
      if (isNewItem && newItemName) {
        const newItem: OrderItem = {
          id: 'nuevo-temp',
          nombre: collectionName === 'categorias' ? newItemName : undefined,
          titulo: collectionName === 'paquetes' || collectionName === 'paquetes_f1' || collectionName === 'blog' ? newItemName : undefined,
          orden: data.length > 0 ? Math.max(...data.map(item => item.orden)) + 1 : 1,
        };
        data.push(newItem);
        
        // Notificar posición inicial (al final)
        if (onPositionChange) {
          onPositionChange(data.length);
        }
      }
      
      setItems(data);
      setOriginalItems(data);
      setHasChanges(false);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Error al cargar elementos');
    } finally {
      setLoading(false);
    }
  }, [collectionName, onlyDestacados, isNewItem, newItemName, onPositionChange]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // ⭐ Actualizar el nombre del elemento nuevo si cambia
  useEffect(() => {
    if (isNewItem && newItemName) {
      setItems((currentItems) => {
        const newItemIndex = currentItems.findIndex(item => item.id === 'nuevo-temp');
        if (newItemIndex !== -1) {
          const currentName = currentItems[newItemIndex].nombre || currentItems[newItemIndex].titulo;
          if (currentName !== newItemName) {
            const updatedItems = [...currentItems];
            updatedItems[newItemIndex] = {
              ...updatedItems[newItemIndex],
              nombre: collectionName === 'categorias' ? newItemName : updatedItems[newItemIndex].nombre,
              titulo: collectionName === 'paquetes' || collectionName === 'paquetes_f1' || collectionName === 'blog' ? newItemName : updatedItems[newItemIndex].titulo,
            };
            return updatedItems;
          }
        }
        return currentItems;
      });
    }
  }, [newItemName, isNewItem, collectionName]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over.id);
        
        const reordered = arrayMove(items, oldIndex, newIndex);
        setHasChanges(true);
        
        // ⭐ Notificar la nueva posición si es un elemento nuevo
        if (isNewItem && onPositionChange && active.id === 'nuevo-temp') {
          setTimeout(() => {
            onPositionChange(newIndex + 1); // +1 porque el orden empieza en 1
          }, 0);
        }
        
        return reordered;
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
      
      // Actualizar orden de todos los elementos (empezando desde 1)
      items.forEach((item, index) => {
        const itemRef = doc(db, collectionName, item.id);
        batch.update(itemRef, { orden: index + 1 });
      });

      await batch.commit();
      
      toast.success('Orden guardado correctamente', {
        description: `${items.length} elementos reordenados`,
      });
      
      setOriginalItems(items);
      setHasChanges(false);
      
      // Notificar cambios al padre si existe callback
      if (onOrdersChange) {
        onOrdersChange(items.map((item, index) => ({ 
          id: item.id, 
          orden: index + 1 
        })));
      }
    } catch (error) {
      console.error('Error saving order:', error);
      toast.error('Error al guardar orden');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setItems(originalItems);
    setHasChanges(false);
    toast.info('Orden restaurado');
  };

  if (loading) {
    return (
      <div className="rounded-[12px] border border-[#E5EAF0] bg-white p-4">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-[#94A3B8]" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[12px] border border-[#E5EAF0] bg-white">
      <div className="border-b border-[#EEF2F6] px-4 py-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[#0F172A]">
              <Sparkles className="h-4 w-4 text-[#0EA5C6]" />
              {onlyDestacados ? 'Orden de Destacados' : 'Orden de visualización'}
            </div>
            <p className="mt-1 text-[11px] text-[#94A3B8]">
              {onlyDestacados 
                ? 'Arrastra para ordenar los paquetes destacados en la homepage' 
                : 'Arrastra los elementos para cambiar su orden de aparición'
              }
            </p>
          </div>
          {maxItems && (
            <Badge variant="outline" className="border-[#E5EAF0] text-[10px] text-[#64748B]">
              Máximo {maxItems} destacados
            </Badge>
          )}
        </div>
      </div>
      <div className="space-y-4 px-4 py-4">
        {/* Lista Drag & Drop */}
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-medium text-[#64748B]">
              {items.length} {onlyDestacados ? (items.length === 1 ? 'destacado' : 'destacados') : (items.length === 1 ? 'elemento' : 'elementos')}
            </p>
            {hasChanges && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2"
              >
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-700">
                  Cambios sin guardar
                </Badge>
              </motion.div>
            )}
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="custom-scrollbar max-h-[420px] space-y-2 overflow-y-auto p-1">
                <AnimatePresence>
                  {items.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                    >
                      <SortableItem
                        item={item}
                        isEditing={item.id === currentId}
                        isNew={item.id === 'nuevo-temp'}
                        index={index}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Botones de Acción - Solo mostrar si no está oculto y hay cambios */}
        {!hideSaveButton && (
          <AnimatePresence>
            {hasChanges && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex items-center gap-2 border-t border-[#EEF2F6] pt-4"
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={saving}
                  className="flex-1 rounded-[10px] border-[#D7E3EF]"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Deshacer cambios
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-[10px] bg-[#0EA5C6] text-white hover:bg-[#0891B2]"
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
        )}
      </div>
    </div>
  );
}
