'use client';

import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, query, orderBy as firestoreOrderBy, writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  GripVertical, 
  ArrowUp, 
  ArrowDown, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';

interface OrderItem {
  id: string;
  nombre: string;
  orden: number;
  activa?: boolean;
  visible?: boolean;
  destacada?: boolean;
  destacado?: boolean;
}

interface OrderManagerProps {
  collectionName: 'categorias' | 'paquetes';
  currentId?: string;
  currentOrder: number;
  onOrderChange: (newOrder: number) => void;
  label?: string;
  description?: string;
}

export default function OrderManager({
  collectionName,
  currentId,
  currentOrder,
  onOrderChange,
  label = 'Orden de visualización',
  description = 'Menor número aparece primero'
}: OrderManagerProps) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [suggestedOrder, setSuggestedOrder] = useState<number>(0);
  const [hasConflict, setHasConflict] = useState(false);
  const [reordering, setReordering] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const q = query(collection(db, collectionName), firestoreOrderBy('orden', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ 
        id: doc.id, 
        ...doc.data() 
      } as OrderItem));
      
      setItems(data);
      
      // Calcular orden sugerido (siguiente disponible, empezando desde 1)
      if (!currentId) {
        const maxOrder = data.length > 0 ? Math.max(...data.map(item => item.orden)) : 0;
        setSuggestedOrder(maxOrder + 1);
        onOrderChange(maxOrder + 1);
        
        // Auto-expandir visualizador si hay elementos existentes
        if (data.length > 0) {
          setShowVisualizer(true);
        }
      }
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Error al cargar elementos');
    } finally {
      setLoading(false);
    }
  }, [collectionName, currentId, onOrderChange]);

  const checkForConflicts = useCallback(() => {
    const conflict = items.some(item => 
      item.id !== currentId && item.orden === currentOrder
    );
    setHasConflict(conflict);
  }, [items, currentId, currentOrder]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    checkForConflicts();
  }, [checkForConflicts]);

  const handleAutoReorder = async () => {
    setReordering(true);
    try {
      const batch = writeBatch(db);
      
      // Obtener todos los elementos y crear un nuevo arreglo con el elemento actual
      const allItems = [...items];
      
      // Si estamos editando, actualizar el orden del elemento actual
      if (currentId) {
        const currentIndex = allItems.findIndex(item => item.id === currentId);
        if (currentIndex !== -1) {
          allItems[currentIndex] = { ...allItems[currentIndex], orden: currentOrder };
        }
      }
      
      // Ordenar todos los elementos por su orden actual
      allItems.sort((a, b) => {
        // Si tienen el mismo orden, priorizar el elemento actual
        if (a.orden === b.orden) {
          if (a.id === currentId) return -1;
          if (b.id === currentId) return 1;
          return 0;
        }
        return a.orden - b.orden;
      });
      
      // Contar cuántos elementos se actualizarán
      let updatedCount = 0;
      
      // Renumerar secuencialmente desde 1
      allItems.forEach((item, index) => {
        const newOrder = index + 1; // Empezar desde 1
        if (item.orden !== newOrder) {
          const itemRef = doc(db, collectionName, item.id);
          batch.update(itemRef, { orden: newOrder });
          updatedCount++;
        }
      });

      if (updatedCount === 0) {
        toast.info('El orden ya está correcto', {
          description: 'No hay elementos para reorganizar',
        });
      } else {
        await batch.commit();
        toast.success(`✅ ${updatedCount} elemento${updatedCount > 1 ? 's' : ''} reorganizado${updatedCount > 1 ? 's' : ''}`, {
          description: `Orden secuencial: 1, 2, 3, 4... hasta ${allItems.length}`,
        });
      }
      
      await fetchItems();
      setHasConflict(false);
    } catch (error) {
      console.error('Error reordering:', error);
      toast.error('Error al reordenar elementos');
    } finally {
      setReordering(false);
    }
  };

  const getPreviewItems = () => {
    const previewItems = [...items];
    
    // Si estamos editando, actualizar el elemento actual
    if (currentId) {
      const currentIndex = previewItems.findIndex(item => item.id === currentId);
      if (currentIndex !== -1) {
        previewItems[currentIndex] = { ...previewItems[currentIndex], orden: currentOrder };
      }
    } else {
      // Si es nuevo, agregarlo con un indicador visual
      previewItems.push({
        id: 'nuevo',
        nombre: '✨ Nuevo elemento (en creación)',
        orden: currentOrder,
      });
    }

    // Ordenar por número de orden
    return previewItems.sort((a, b) => {
      if (a.orden === b.orden) {
        // Si tienen el mismo orden, priorizar el nuevo elemento
        if (a.id === 'nuevo') return -1;
        if (b.id === 'nuevo') return 1;
        return 0;
      }
      return a.orden - b.orden;
    });
  };

  const moveUp = () => {
    if (currentOrder > 1) {
      onOrderChange(currentOrder - 1);
    }
  };

  const moveDown = () => {
    onOrderChange(currentOrder + 1);
  };

  const useSuggestedOrder = () => {
    onOrderChange(suggestedOrder);
    toast.success(`Orden establecido en ${suggestedOrder}`);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Si es un elemento nuevo y no hay otros elementos, mostrar versión simplificada
  if (!currentId && items.length === 0) {
    return (
      <Card className="border-2">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-base font-medium text-green-900 mb-1">
                  Primer elemento
                </p>
                <p className="text-sm text-green-700">
                  Este será el primer elemento en la lista. Se guardará automáticamente con orden 1.
                </p>
              </div>
            </div>
          </div>
          
          {/* Preview del primer elemento */}
          <div className="pt-2">
            <Label className="text-base font-medium text-gray-700 block mb-3">
              Vista previa
            </Label>
            <div className="bg-black text-white rounded-lg p-4 flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-black font-bold">
                1
              </div>
              <div className="flex-1">
                <p className="font-medium">✨ Nuevo elemento (en creación)</p>
              </div>
              <GripVertical className="h-5 w-5 text-white/50" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input de Orden con Controles */}
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="orden" className="text-base font-medium mb-1.5 block">
                Posición en el orden
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="orden"
                  type="number"
                  value={currentOrder}
                  onChange={(e) => onOrderChange(parseInt(e.target.value) || 1)}
                  min={1}
                  className={`text-base font-semibold ${hasConflict ? 'border-amber-500' : ''}`}
                />
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={moveUp}
                    disabled={currentOrder === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={moveDown}
                    className="h-8 w-8 p-0"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {!currentId && suggestedOrder !== currentOrder && (
              <Button
                type="button"
                variant="outline"
                onClick={useSuggestedOrder}
                className="mb-0.5"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Usar sugerido ({suggestedOrder})
              </Button>
            )}
          </div>

          <p className="text-sm text-gray-500">{description}</p>

          {/* Alerta de Conflicto */}
          {hasConflict && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-3 bg-amber-50 border-2 border-amber-200 rounded-lg"
            >
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="text-base font-medium text-amber-900">
                  Ya existe un elemento en esta posición
                </p>
                <p className="text-sm text-amber-700">
                  Al reorganizar, todos los elementos se numerarán secuencialmente: 1, 2, 3, 4... sin saltos ni duplicados.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAutoReorder}
                  disabled={reordering}
                  className="mt-2 border-amber-300 hover:bg-amber-100"
                >
                  {reordering ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Reordenando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-3 w-3" />
                      Reorganizar secuencialmente (1, 2, 3, 4...)
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* Estado OK */}
          {!hasConflict && currentOrder === suggestedOrder && !currentId && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 bg-green-50 border-2 border-green-200 rounded-lg"
            >
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-base font-medium text-green-900">
                Orden óptimo - Se agregará al final de la lista
              </p>
            </motion.div>
          )}
          
          {/* Ayuda para nuevo elemento */}
          {!currentId && items.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-3 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg"
            >
              <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-base font-medium text-blue-900 mb-1">
                  Nuevo elemento
                </p>
                <p className="text-sm text-blue-700">
                  Ajusta el número de orden para posicionar este elemento donde quieras. 
                  El elemento marcado con ✨ es el que estás creando.
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Visualizador de Orden - Siempre visible para nuevos elementos */}
        <div className="pt-4 border-t space-y-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowVisualizer(!showVisualizer)}
              className="flex-1 justify-between"
            >
              <span className="flex items-center gap-2">
                <GripVertical className="h-4 w-4" />
                Vista previa del orden
              </span>
              <Badge variant="secondary">
                {items.length + (currentId ? 0 : 1)} elementos
              </Badge>
            </Button>
            
            {items.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoReorder}
                disabled={reordering}
                title="Reorganizar todos los elementos secuencialmente"
                className="px-3"
              >
                {reordering ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>

          {/* Auto-expandir para nuevos elementos */}
          {(showVisualizer || (!currentId && items.length > 0)) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-2 max-h-96 overflow-y-auto p-4 bg-gray-50 rounded-lg border-2 border-gray-200"
            >
              {getPreviewItems().map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                    item.id === currentId || item.id === 'nuevo'
                      ? 'bg-gradient-to-r from-black to-gray-800 text-white border-black shadow-lg scale-[1.02]'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                    item.id === currentId || item.id === 'nuevo'
                      ? 'bg-white text-black'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {item.orden}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${
                      item.id === currentId || item.id === 'nuevo' ? 'text-white' : 'text-gray-900'
                    }`}>
                      {item.nombre}
                      {item.id === currentId && ' (editando)'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {(item.destacada || item.destacado) && (
                        <Badge className="text-sm bg-white/20 text-white border-white/30">
                          Destacado
                        </Badge>
                      )}
                      {(item.activa === false || item.visible === false) && (
                        <Badge variant="secondary" className="text-sm">
                          Inactivo
                        </Badge>
                      )}
                    </div>
                  </div>
                  <GripVertical className={`h-5 w-5 ${
                    item.id === currentId || item.id === 'nuevo' ? 'text-white/50' : 'text-gray-400'
                  }`} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

