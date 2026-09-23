'use client';

import { useState } from 'react';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, X, Check, Pencil } from 'lucide-react';

interface SortableItemProps {
  id: string;
  item: string;
  index: number;
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  isEditing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
}

function SortableItem({
  id,
  item,
  index,
  onEdit,
  onRemove,
  isEditing,
  editValue,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 bg-gray-50 p-2.5 rounded-lg group hover:bg-gray-100 transition-colors"
    >
      {/* Drag Handle */}
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing mt-1 text-gray-400 hover:text-gray-600 transition-colors"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Content - Editable or Display */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex gap-2">
            <Input
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onSaveEdit();
                } else if (e.key === 'Escape') {
                  onCancelEdit();
                }
              }}
              className="text-base"
              autoFocus
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSaveEdit}
              className="shrink-0"
            >
              <Check className="h-4 w-4 text-green-600" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancelEdit}
              className="shrink-0"
            >
              <X className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        ) : (
          <span className="text-base break-words">{item}</span>
        )}
      </div>

      {/* Action Buttons */}
      {!isEditing && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(index)}
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            title="Eliminar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface EditableListProps {
  items: string[];
  onItemsChange: (items: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
}

export default function EditableList({
  items,
  onItemsChange,
  placeholder = 'Agregar nuevo ítem...',
  emptyMessage = 'No hay ítems agregados',
}: EditableListProps) {
  const [newItem, setNewItem] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const addItem = () => {
    if (newItem.trim()) {
      onItemsChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(items[index]);
  };

  const saveEdit = () => {
    if (editingIndex !== null && editValue.trim()) {
      const updatedItems = [...items];
      updatedItems[editingIndex] = editValue.trim();
      onItemsChange(updatedItems);
      setEditingIndex(null);
      setEditValue('');
    }
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditValue('');
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((_, i) => `item-${i}` === active.id);
      const newIndex = items.findIndex((_, i) => `item-${i}` === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onItemsChange(arrayMove(items, oldIndex, newIndex));
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Input para agregar nuevo ítem */}
      <div className="flex gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}
        />
        <Button
          type="button"
          onClick={addItem}
          variant="outline"
          className="shrink-0"
        >
          Agregar
        </Button>
      </div>

      {/* Lista de ítems con drag & drop */}
      {items.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((_, i) => `item-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {items.map((item, index) => (
                <SortableItem
                  key={`item-${index}`}
                  id={`item-${index}`}
                  item={item}
                  index={index}
                  onEdit={startEdit}
                  onRemove={removeItem}
                  isEditing={editingIndex === index}
                  editValue={editValue}
                  onEditChange={setEditValue}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="text-base text-gray-500 text-center py-4 border border-dashed border-gray-300 rounded-lg">
          {emptyMessage}
        </div>
      )}

      {items.length > 0 && (
        <p className="text-sm text-gray-500">
          💡 Arrastra los ítems para reordenarlos, haz clic en el lápiz para editar
        </p>
      )}
    </div>
  );
}

