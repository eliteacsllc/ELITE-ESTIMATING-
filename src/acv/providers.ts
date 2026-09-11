import type {
  ComparableVehicle,
  GuideValue,
  LossVehicle,
  PhotoConditionSignal,
  SalvageBid,
  VehicleIdentity,
} from "./types.js";

export interface VinProvider {
  name: string;
  decode(vin: string): Promise<VehicleIdentity>;
}

export interface MarketProvider {
  name: string;
  findComparables(vehicle: LossVehicle): Promise<ComparableVehicle[]>;
}

export interface GuideProvider {
  name: string;
  getGuideValues(vehicle: LossVehicle): Promise<GuideValue[]>;
}

export interface SalvageProvider {
  name: string;
  getSalvageBids(vehicle: LossVehicle): Promise<SalvageBid[]>;
}

export interface PhotoConditionProvider {
  name: string;
  evaluate(vehicle: LossVehicle): Promise<PhotoConditionSignal[]>;
}

export interface AcvProviders {
  vin: VinProvider[];
  market: MarketProvider[];
  guides: GuideProvider[];
  salvage: SalvageProvider[];
  photos: PhotoConditionProvider[];
}

export async function collectFromProviders<T>(
  providers: { name: string }[],
  run: (provider: { name: string }) => Promise<T[]>,
): Promise<{ data: T[]; warnings: string[] }> {
  const settled = await Promise.allSettled(providers.map((provider) => run(provider)));
  const data: T[] = [];
  const warnings: string[] = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") data.push(...result.value);
    else warnings.push(`${providers[index]?.name ?? "unknown provider"}: ${String(result.reason)}`);
  });

  return { data, warnings };
}
