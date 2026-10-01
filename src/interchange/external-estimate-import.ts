import { createHash } from 'node:crypto';
import type { EstimatingService } from '../application/estimating-service.js';
import type { AssetIdentity, Estimate } from '../domain/types.js';
import type { EstimateRepository } from '../persistence/repository.js';
import type { Principal } from '../security/rbac.js';
import type { ImportReceiptRepository } from './import-repository.js';
import { normalizeEstimateProposal, type ExternalEstimateLine, type NormalizationIssue } from '../intelligence/estimate-normalization.js';
import { buildEstimateCompletenessReview, type EstimateCompletenessReview } from '../intelligence/estimate-completeness.js';

export type ExternalEstimateProvider = 'ccc' | 'mitchell' | 'audatex' | 'other';

export type ExternalEstimateImportInput = {
  provider: ExternalEstimateProvider;
  sourceEstimateId: string;
  claimId?: string;
  asset: AssetIdentity;
  locale?: string;
  currency: string;
  jurisdiction: string;
  lines: ExternalEstimateLine[];
};

export type ExternalEstimateImportResult = {
  estimate: Estimate;
  provider: ExternalEstimateProvider;
  idempotent: boolean;
  normalizationIssues: NormalizationIssue[];
  readyForHumanReview: boolean;
  completeness: EstimateCompletenessReview;
};

function deterministicUuid(value: string): string {
  const bytes = Buffer.from(createHash('sha256').update(value).digest().subarray(0, 16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export class ExternalEstimateImportService {
  constructor(
    private readonly estimating: EstimatingService,
    private readonly estimates: EstimateRepository,
    private readonly receipts: ImportReceiptRepository,
  ) {}

  async import(principal: Principal, input: ExternalEstimateImportInput): Promise<ExternalEstimateImportResult> {
    if (!['ccc','mitchell','audatex','other'].includes(input.provider)) throw new Error('unsupported_external_estimate_provider');
    const sourceEstimateId = input.sourceEstimateId?.trim();
    if (!sourceEstimateId || sourceEstimateId.length > 160) throw new Error('invalid_source_estimate_id');
    if (!input.asset || typeof input.asset !== 'object') throw new Error('asset_required');
    if (!input.currency?.trim()) throw new Error('currency_required');
    if (!input.jurisdiction?.trim()) throw new Error('jurisdiction_required');
    if (!Array.isArray(input.lines)) throw new Error('lines_array_required');

    const sourceSystem = `external-${input.provider}`;
    const existingReceipt = await this.receipts.get(principal.tenantId, sourceSystem, sourceEstimateId);
    if (existingReceipt) {
      const existing = await this.estimates.getById(principal.tenantId, existingReceipt.localEstimateId);
      if (!existing) throw new Error('import_receipt_orphaned');
      return {
        estimate: existing,
        provider: input.provider,
        idempotent: true,
        normalizationIssues: [],
        readyForHumanReview: true,
        completeness: buildEstimateCompletenessReview(existing),
      };
    }

    const localId = deterministicUuid(`${principal.tenantId}:${sourceSystem}:${sourceEstimateId}`);
    let estimate = await this.estimates.getById(principal.tenantId, localId);
    let idempotent = Boolean(estimate);

    const normalized = normalizeEstimateProposal({
      tenantId: principal.tenantId,
      estimateId: localId,
      currency: input.currency,
      lines: input.lines,
    });

    if (!estimate) {
      estimate = await this.estimating.create(principal, {
        id: localId,
        tenantId: principal.tenantId,
        ...(input.claimId?.trim() ? { claimId: input.claimId.trim() } : {}),
        asset: structuredClone(input.asset),
        locale: input.locale?.trim() || 'en-US',
        currency: input.currency,
        jurisdiction: input.jurisdiction,
      });
      if (normalized.lines.length) estimate = await this.estimating.replaceLines(principal, estimate.id, normalized.lines);
    }

    const receipt = await this.receipts.save({
      tenantId: principal.tenantId,
      sourceSystem,
      sourceEstimateId,
      localEstimateId: estimate.id,
      importedAt: new Date().toISOString(),
    });

    if (receipt.localEstimateId !== estimate.id) {
      const winner = await this.estimates.getById(principal.tenantId, receipt.localEstimateId);
      if (!winner) throw new Error('import_receipt_orphaned');
      estimate = winner;
      idempotent = true;
    }

    return {
      estimate,
      provider: input.provider,
      idempotent,
      normalizationIssues: normalized.issues,
      readyForHumanReview: normalized.readyForHumanReview,
      completeness: buildEstimateCompletenessReview(estimate),
    };
  }
}
