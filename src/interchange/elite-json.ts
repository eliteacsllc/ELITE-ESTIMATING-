import type { Estimate, EstimateLine } from '../domain/types.js';
import type { EstimateInterchangeAdapter, ImportEstimateResult } from '../connectors/contracts.js';

export type EliteEstimateEnvelope = {
  schema: 'elite-estimating/v1';
  exportedAt: string;
  estimate: Estimate;
};

export type EliteEstimateLinesEnvelope = {
  schema: 'elite-estimating-lines/v1';
  exportedAt: string;
  lines: EstimateLine[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseEliteEnvelope(payload: Uint8Array): EliteEstimateEnvelope | EliteEstimateLinesEnvelope {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(payload));
  if (!isRecord(parsed) || typeof parsed.schema !== 'string') throw new Error('unsupported_elite_interchange_payload');

  if (parsed.schema === 'elite-estimating/v1' && isRecord(parsed.estimate) && Array.isArray(parsed.estimate.lines)) {
    return parsed as unknown as EliteEstimateEnvelope;
  }
  if (parsed.schema === 'elite-estimating-lines/v1' && Array.isArray(parsed.lines)) {
    return parsed as unknown as EliteEstimateLinesEnvelope;
  }
  throw new Error('unsupported_elite_interchange_payload');
}

export class EliteJsonInterchangeAdapter implements EstimateInterchangeAdapter {
  readonly id = 'elite-json-v1';

  canImport(contentType: string, payload: Uint8Array): boolean {
    if (!contentType.includes('json')) return false;
    try {
      parseEliteEnvelope(payload);
      return true;
    } catch {
      return false;
    }
  }

  async import(payload: Uint8Array): Promise<ImportEstimateResult> {
    const parsed = parseEliteEnvelope(payload);
    if (parsed.schema === 'elite-estimating/v1') {
      return {
        sourceSystem: 'elite-estimating',
        sourceEstimateId: parsed.estimate.id,
        lines: parsed.estimate.lines,
        warnings: [],
      };
    }
    return {
      sourceSystem: 'elite-estimating',
      lines: parsed.lines,
      warnings: [],
    };
  }

  async export(lines: EstimateLine[]): Promise<Uint8Array> {
    const envelope: EliteEstimateLinesEnvelope = { schema: 'elite-estimating-lines/v1', exportedAt: new Date().toISOString(), lines };
    return new TextEncoder().encode(JSON.stringify(envelope));
  }

  exportEstimate(estimate: Estimate): Uint8Array {
    const envelope: EliteEstimateEnvelope = { schema: 'elite-estimating/v1', exportedAt: new Date().toISOString(), estimate };
    return new TextEncoder().encode(JSON.stringify(envelope));
  }
}
