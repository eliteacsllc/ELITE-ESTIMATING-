export type AssetClass =
  | 'passenger_vehicle'
  | 'commercial_vehicle'
  | 'tractor_trailer'
  | 'heavy_equipment'
  | 'motorcycle'
  | 'atv_utv'
  | 'rv'
  | 'marine'
  | 'ambulance_emergency'
  | 'crane_specialty'
  | 'residential_property'
  | 'commercial_property'
  | 'contents'
  | 'other';

export type Money = {
  amountMinor: number;
  currency: string;
};

export type SourceProvenance = {
  provider: string;
  sourceId?: string;
  retrievedAt: string;
  region?: string;
  licenseClass: 'owned' | 'licensed' | 'public' | 'customer_provided';
  confidence?: number;
};

export type AssetIdentity = {
  assetClass: AssetClass;
  vin?: string;
  serialNumber?: string;
  year?: number;
  make?: string;
  model?: string;
  configuration?: string;
  jurisdiction?: string;
};

export type EstimateOperation =
  | 'repair'
  | 'replace'
  | 'remove_install'
  | 'remove_replace'
  | 'refinish'
  | 'blend'
  | 'inspect'
  | 'scan'
  | 'calibrate'
  | 'measure'
  | 'clean'
  | 'demolish'
  | 'install'
  | 'detach_reset'
  | 'other';

export type EstimateLine = {
  id: string;
  category: string;
  component: string;
  operation: EstimateOperation;
  quantity: number;
  unit?: string;
  laborHours?: number;
  laborRate?: Money;
  partOrMaterial?: Money;
  equipment?: Money;
  tax?: Money;
  total: Money;
  procedureRefs?: string[];
  safetyCritical?: boolean;
  aiSuggested?: boolean;
  aiConfidence?: number;
  humanApproved: boolean;
  provenance: SourceProvenance[];
};

export type Estimate = {
  id: string;
  tenantId: string;
  claimId?: string;
  asset: AssetIdentity;
  locale: string;
  currency: string;
  jurisdiction: string;
  lines: EstimateLine[];
  subtotal: Money;
  tax: Money;
  total: Money;
  status: 'draft' | 'review' | 'approved' | 'supplement' | 'void';
  revision: number;
  createdAt: string;
  updatedAt: string;
};
