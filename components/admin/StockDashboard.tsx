'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Clock, Database, Plus } from 'lucide-react';
import type { Paquete } from '@/types';
import type { StockMovement } from '@/lib/stock';

type StockSummary = {
  baseCapacity: number;
  available: number;
  movements: StockMovement[];
};

type Props = {
  paquetes: Paquete[];
};

const movementTypes = [
  { value: 'entrada', label: 'Entrada (suma de cupos)' },
  { value: 'salida', label: 'Salida (descuento de cupos)' },
  { value: 'reserva', label: 'Reserva (salida automática)' },
  { value: 'ajuste', label: 'Ajuste manual' },
] as const;

export default function StockDashboard({ paquetes }: Props) {
  const { user } = useAuth();
  const [selectedPackageId, setSelectedPackageId] = useState<string>(
    paquetes[0]?.id ?? ''
  );
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [movementType, setMovementType] = useState<StockMovement['type']>('entrada');
  const [movementQuantity, setMovementQuantity] = useState(0);
  const [movementNote, setMovementNote] = useState('');
  const [submittingMovement, setSubmittingMovement] = useState(false);

  const paquete = useMemo(
    () => paquetes.find((item) => item.id === selectedPackageId) ?? null,
    [paquetes, selectedPackageId]
  );

  const fetchStockInfo = async () => {
    if (!user || !selectedPackageId || !date) return;
    setStockLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `/api/admin/stock?packageId=${selectedPackageId}&date=${date}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? 'No pudimos cargar el stock');
      }
      const data = await response.json();
      setStockSummary(data);
    } catch (error) {
      console.error('[StockDashboard] Error cargando stock:', error);
      toast.error('No pudimos cargar el stock');
    } finally {
      setStockLoading(false);
    }
  };

  useEffect(() => {
    fetchStockInfo();
  }, [selectedPackageId, date, user]);

  const handleRegisterMovement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !selectedPackageId || !date) return;
    setSubmittingMovement(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          packageId: selectedPackageId,
          date,
          type: movementType,
          quantity: movementQuantity,
          note: movementNote,
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error ?? 'No pudimos registrar el movimiento');
      }
      toast.success('Movimiento registrado');
      setMovementQuantity(0);
      setMovementNote('');
      await fetchStockInfo();
    } catch (error) {
      console.error('[StockDashboard] Error guardando movimiento:', error);
      toast.error('No pudimos guardar el movimiento');
    } finally {
      setSubmittingMovement(false);
    }
  };

  const availableLabel = stockSummary ? (
    <span className="text-lg font-semibold text-gray-900">
      {stockSummary.available} disponible
    </span>
  ) : (
    <span className="text-sm text-gray-500">Seleccioná experiencia y fecha</span>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-gray-900">Stock y cupos</h1>
        <p className="text-sm text-gray-500">Administra movimientos e inventario.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-4">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Paquete</Label>
                <Select
                  value={selectedPackageId}
                  onValueChange={(value) => setSelectedPackageId(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccioná un paquete" />
                  </SelectTrigger>
                  <SelectContent>
                    {paquetes.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Fecha</Label>
                <Input value={date} onChange={(event) => setDate(event.target.value)} type="date" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Database className="h-4 w-4" />
              {stockSummary ? (
                <>
                  Base: {stockSummary.baseCapacity} • {availableLabel}
                </>
              ) : (
                'Cargando stock...'
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              Últimos movimientos: {stockSummary?.movements.length ?? '—'}
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" onClick={fetchStockInfo} disabled={stockLoading}>
                {stockLoading ? 'Actualizando...' : 'Actualizar datos'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">
              Estado actual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-center">
              {stockLoading ? (
                <span className="text-sm text-gray-500">Cargando...</span>
              ) : stockSummary ? (
                <>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Disponible</p>
                  <p className="text-3xl font-bold text-gray-900">{stockSummary.available}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500">Seleccioná filtros para ver datos</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-900">
            Registrar movimiento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleRegisterMovement}>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={movementType} onValueChange={(value) => setMovementType(value as StockMovement['type'])}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {movementTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  value={movementQuantity}
                  onChange={(event) => setMovementQuantity(Number(event.target.value))}
                  min={-999}
                  step={1}
                />
              </div>
              <div className="space-y-1">
                <Label>Nota</Label>
                <Input
                  value={movementNote}
                  onChange={(event) => setMovementNote(event.target.value)}
                  placeholder="Explicación breve"
                />
              </div>
            </div>
            <Button type="submit" disabled={submittingMovement || !movementQuantity}>
              <Plus className="mr-2 h-4 w-4" />
              {submittingMovement ? 'Registrando...' : 'Guardar movimiento'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-900">Historial reciente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {stockSummary?.movements?.length ? (
            stockSummary.movements.map((movement) => (
              <div
                key={movement.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white/80 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{movement.type}</p>
                  <p className="text-xs text-gray-500">{movement.note ?? 'Sin nota'}</p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {movement.quantity > 0 ? '+' : ''}
                  {movement.quantity}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">Sin movimientos registrados.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
