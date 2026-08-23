import { createHash } from 'node:crypto';
import type { EstimatingService } from '../application/estimating-service.js';
import type { Estimate, EstimateLine } from '../domain/types.js';
import type { EstimateRepository } from '../persistence/repository.js';
import type { Principal } from '../security/rbac.js';
import type { EliteEstimateEnvelope } from './elite-json.js';
import type { ImportReceiptRepository } from './import-repository.js';

function deterministicUuid(value: string): string {
  const bytes = Buffer.from(createHash('sha256').update(value).digest().subarray(0, 16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeImportedLines(lines: EstimateLine[]): EstimateLine[] {
  return lines.map((line) => ({
    ...structuredClone(line),
    humanApproved: false,
    provenance: line.provenance.map((source) => ({ ...source })),
  }));
}

export class EstimateImportService {
  constructor(
    private readonly estimating: EstimatingService,
    private readonly estimates: EstimateRepository,
    private readonly receipts: ImportReceiptRepository,
  ) {}

  async importElite(principal: Principal, envelope: EliteEstimateEnvelope): Promise<{ estimate: Estimate; idempotent: boolean }> {
    if (envelope.schema !== 'elite-estimating/v1' || !envelope.estimate) throw new Error('unsupported_elite_interchange_payload');
    const source = envelope.estimate;
    if (!source.id || source.id.length > 160) throw new Error('invalid_source_estimate_id');
    const sourceSystem = 'elite-estimating';

    const receipt = await this.receipts.get(principal.tenantId, sourceSystem, source.id);
    if (receipt) {
      const existing = await this.estimates.getById(principal.tenantId, receipt.localEstimateId);
      if (!existing) throw new Error('import_receipt_orphaned');
      return { estimate: existing, idempotent: true };
    }

    const localId = deterministicUuid(`${principal.tenantId}:${sourceSystem}:${source.id}`);
    let local = await this.estimates.getById(principal.tenantId, localId);
    let idempotent = Boolean(local);

    if (!local) {
      try {
        local = await this.estimating.create(principal, {
          id: localId,
          tenantId: principal.tenantId,
          ...(source.claimId ? { claimId: source.claimId } : {}),
          asset: structuredClone(source.asset),
          locale: source.locale || 'en-US',
          currency: source.currency,
          jurisdiction: source.jurisdiction,
        });
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'estimate_already_exists') throw error;
        local = await this.estimates.getById(principal.tenantId, localId);
        if (!local) throw new Error('import_idempotency_resolution_failed');
        idempotent = true;
      }
      if (!idempotent && source.lines.length) local = await this.estimating.replaceLines(principal, local.id, normalizeImportedLines(source.lines));
    }

    const savedReceipt = await this.receipts.save({
      tenantId: principal.tenantId,
      sourceSystem,
      sourceEstimateId: source.id,
      localEstimateId: local.id,
      importedAt: new Date().toISOString(),
    });
    if (savedReceipt.localEstimateId !== local.id) {
      const winner = await this.estimates.getById(principal.tenantId, savedReceipt.localEstimateId);
      if (!winner) throw new Error('import_receipt_orphaned');
      return { estimate: winner, idempotent: true };
    }
    return { estimate: local, idempotent };
  }
}
