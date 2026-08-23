import type { Estimate, EstimateLine } from '../domain/types.js';
import type { EstimateInterchangeAdapter, ImportEstimateResult } from '../connectors/contracts.js';

export type EliteEstimateEnvelope = {
  schema: 'elite-estimating/v1';
  exportedAt: string;
  estimate: Estimate;
};

export class EliteJsonInterchangeAdapter implements EstimateInterchangeAdapter {
  readonly id = 'elite-json-v1';

  canImport(contentType: string, payload: Uint8Array): boolean {
    if (!contentType.includes('json')) return false;
    try {
      const parsed = JSON.parse(new TextDecoder().decode(payload)) as Partial<EliteEstimateEnvelope>;
      return parsed.schema === 'elite-estimating/v1' && Boolean(parsed.estimate);
    } catch {
      return false;
    }
  }

  async import(payload: Uint8Array): Promise<ImportEstimateResult> {
    const parsed = JSON.parse(new TextDecoder().decode(payload)) as EliteEstimateEnvelope;
    if (parsed.schema !== 'elite-estimating/v1' || !parsed.estimate) throw new Error('unsupported_elite_interchange_payload');
    return {
      sourceSystem: 'elite-estimating',
      sourceEstimateId: parsed.estimate.id,
      lines: parsed.estimate.lines,
      warnings: [],
    };
  }

  async export(lines: EstimateLine[]): Promise<Uint8Array> {
    return new TextEncoder().encode(JSON.stringify({ schema: 'elite-estimating-lines/v1', exportedAt: new Date().toISOString(), lines }));
  }

  exportEstimate(estimate: Estimate): Uint8Array {
    const envelope: EliteEstimateEnvelope = { schema: 'elite-estimating/v1', exportedAt: new Date().toISOString(), estimate };
    return new TextEncoder().encode(JSON.stringify(envelope));
  }
}
