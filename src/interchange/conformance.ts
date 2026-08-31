import type { EstimateInterchangeAdapter } from '../connectors/contracts.js';
import type { EstimateLine } from '../domain/types.js';

export type InterchangeConformanceResult = {
  adapterId: string;
  green: boolean;
  blockers: string[];
  exportedBytes: number;
  importedLineCount: number;
};

function semanticKey(line: EstimateLine): string {
  return [
    line.category.trim().toLowerCase(),
    line.component.trim().toLowerCase(),
    line.operation,
    line.quantity,
    line.total.amountMinor,
    line.total.currency.toUpperCase(),
    line.safetyCritical === true ? 'safety' : 'standard',
  ].join('|');
}

export async function certifyInterchangeAdapter(input: {
  adapter: EstimateInterchangeAdapter;
  contentType: string;
  fixture: EstimateLine[];
  minimumSemanticRetention?: number;
}): Promise<InterchangeConformanceResult> {
  const blockers: string[] = [];
  const minimumRetention = input.minimumSemanticRetention ?? 1;
  if (!Number.isFinite(minimumRetention) || minimumRetention <= 0 || minimumRetention > 1) throw new Error('interchange_retention_threshold_invalid');
  if (!input.adapter.id.trim()) blockers.push('adapter_id_required');
  if (input.fixture.length === 0) blockers.push('fixture_required');

  let exported = new Uint8Array();
  let importedLineCount = 0;
  if (!blockers.length) {
    try {
      exported = await input.adapter.export(input.fixture);
      if (exported.byteLength === 0) blockers.push('export_empty');
      if (!input.adapter.canImport(input.contentType, exported)) blockers.push('round_trip_not_recognized');
      if (!blockers.includes('round_trip_not_recognized')) {
        const imported = await input.adapter.import(exported);
        importedLineCount = imported.lines.length;
        const sourceKeys = new Set(input.fixture.map(semanticKey));
        const retained = imported.lines.filter(line => sourceKeys.has(semanticKey(line))).length;
        const retention = sourceKeys.size === 0 ? 0 : retained / sourceKeys.size;
        if (retention < minimumRetention) blockers.push(`semantic_retention_below_threshold:${retention.toFixed(4)}`);
        if (imported.warnings.some(warning => /safety|procedure|calibrat|scan/i.test(warning))) blockers.push('safety_semantics_warning');
      }
    } catch (error) {
      blockers.push(`adapter_exception:${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { adapterId: input.adapter.id, green: blockers.length === 0, blockers, exportedBytes: exported.byteLength, importedLineCount };
}
