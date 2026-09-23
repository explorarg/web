export type SinglePassengerSurchargeViewInput = {
  applies: boolean;
  label: string;
  amountLabel: string;
};

export type SinglePassengerSurchargeViewModel = {
  rows: Array<{
    label: string;
    amountLabel: string;
  }>;
};

export function buildSinglePassengerSurchargeViewModel(
  input: SinglePassengerSurchargeViewInput
): SinglePassengerSurchargeViewModel | null {
  if (!input.applies) return null;

  return {
    rows: [
      {
        label: input.label,
        amountLabel: input.amountLabel,
      },
    ],
  };
}
