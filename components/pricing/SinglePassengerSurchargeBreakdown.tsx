'use client';

import { cn } from '@/lib/utils';
import { buildSinglePassengerSurchargeViewModel } from '@/lib/pricing/single-passenger-surcharge-view';

type SinglePassengerSurchargeBreakdownProps = {
  label: string;
  amountLabel: string;
  className?: string;
  tone?: 'default' | 'teal';
};

export default function SinglePassengerSurchargeBreakdown({
  label,
  amountLabel,
  className,
  tone = 'default',
}: SinglePassengerSurchargeBreakdownProps) {
  const isTeal = tone === 'teal';
  const viewModel = buildSinglePassengerSurchargeViewModel({
    applies: true,
    label,
    amountLabel,
  });

  if (!viewModel) return null;

  return (
    <div className={cn('space-y-1', className)}>
      {viewModel.rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-3">
          <span
            className={cn(
              'min-w-0 break-words',
              isTeal ? 'text-[#0E5F66]' : 'text-amber-900'
            )}
          >
            {row.label}
          </span>
          <span
            className={cn(
              'shrink-0 font-semibold',
              isTeal ? 'text-[#0E5F66]' : 'text-amber-900'
            )}
          >
            {row.amountLabel}
          </span>
        </div>
      ))}
    </div>
  );
}
