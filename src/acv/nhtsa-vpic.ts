import type { VinProvider } from "./providers.js";
import type { VehicleIdentity } from "./types.js";

interface VpicResult {
  Variable?: string;
  Value?: string | null;
}

interface VpicResponse {
  Results?: VpicResult[];
}

function valueFor(results: VpicResult[], variable: string): string | undefined {
  const value = results.find((item) => item.Variable === variable)?.Value?.trim();
  return value || undefined;
}

export class NhtsaVpicProvider implements VinProvider {
  readonly name = "NHTSA vPIC";

  async decode(vin: string): Promise<VehicleIdentity> {
    const normalized = vin.trim().toUpperCase();
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(normalized)) throw new Error("VIN must be a valid 17-character VIN");

    const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${encodeURIComponent(normalized)}?format=json`);
    if (!response.ok) throw new Error(`NHTSA vPIC returned HTTP ${response.status}`);
    const body = (await response.json()) as { Results?: Record<string, string | null>[] };
    const row = body.Results?.[0];
    if (!row) throw new Error("NHTSA vPIC returned no VIN data");

    const year = row.ModelYear ? Number(row.ModelYear) : undefined;
    return {
      vin: normalized,
      year: Number.isFinite(year) ? year : undefined,
      make: row.Make || undefined,
      model: row.Model || undefined,
      trim: row.Trim || row.Series || undefined,
      bodyStyle: row.BodyClass || undefined,
      engine: [row.EngineCylinders, row.DisplacementL, row.EngineModel].filter(Boolean).join(" / ") || undefined,
      drivetrain: row.DriveType || undefined,
      transmission: row.TransmissionStyle || undefined,
      fuelType: row.FuelTypePrimary || undefined,
      doors: row.Doors ? Number(row.Doors) : undefined,
      options: [],
    };
  }
}
