'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import type { ComponentProps } from 'react';

/** Formatea un número con separador de miles (es-AR: 120.000). */
function formatWithThousands(n: number): string {
  if (Number.isNaN(n) || n === 0) return n === 0 ? '0' : '';
  return n.toLocaleString('es-AR', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

/** Parsea un string con posibles puntos/comas a número (solo dígitos). */
function parseAmount(s: string): number {
  const digits = s.replace(/\D/g, '');
  if (digits === '') return 0;
  return Math.max(0, parseInt(digits, 10) || 0);
}

type FormattedAmountInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
};

/**
 * Input que muestra el monto con puntos (ej. 120.000) sin alterar el valor numérico enviado.
 */
export function FormattedAmountInput({
  value,
  onChange,
  min = 0,
  max,
  className,
  placeholder = '0',
  ...rest
}: FormattedAmountInputProps) {
  const [display, setDisplay] = useState(() => formatWithThousands(value));
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) setDisplay(formatWithThousands(value));
  }, [value]);

  const handleFocus = () => {
    isFocused.current = true;
    setDisplay(String(value));
  };

  const handleBlur = () => {
    isFocused.current = false;
    const parsed = parseAmount(display);
    const clamped = max != null ? Math.min(max, Math.max(min, parsed)) : Math.max(min, parsed);
    onChange(clamped);
    setDisplay(formatWithThousands(clamped));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplay(raw);
    const parsed = parseAmount(raw);
    const clamped = max != null ? Math.min(max, Math.max(min, parsed)) : Math.max(min, parsed);
    onChange(clamped);
  };

  return (
    <Input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      {...rest}
    />
  );
}
