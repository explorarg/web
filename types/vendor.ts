export type CommissionType = 'percent' | 'fixed';
export type CurrencyCode = 'ars' | 'brl' | 'usd';

export type Vendor = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  authUid?: string | null;
  mustChangePassword?: boolean | null;
  defaultCommission: {
    type: CommissionType;
    value: number;
    currency: CurrencyCode;
  };
  allowedPackages?: string[] | null;
  allowedExperiences?: string[] | null;
  paymentDetails?: {
    method?: string | null;
    account?: string | null;
  } | null;
  createdAt?: object;
  updatedAt?: object;
};

export type ReferralLink = {
  id: string;
  vendorId: string;
  code: string;
  packageId?: string | null;
  experienceId?: string | null;
  active: boolean;
  utm?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
  } | null;
  createdAt?: object;
  updatedAt?: object;

  // Frontend-only fields
  salesCount?: number;
  totalRevenue?: number;
  totalCommission?: number;
  experienceName?: string;
  experienceSlug?: string;
  revenueByCurrency?: Partial<Record<CurrencyCode, number>>;
  commissionByCurrency?: Partial<Record<CurrencyCode, number>>;
};
