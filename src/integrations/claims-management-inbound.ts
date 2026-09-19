import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AssetIdentity } from '../domain/types.js';

export type ClaimsEstimatingReadyEnvelope = {
  id: string;
  event_type: 'claim.estimating.ready.v1';
  tenant_id: string;
  data: {
    claim_id: string;
    detail: {
      schema: 'claim.estimating.ready.v1';
      tenant_id: string;
      claim_id: string;
      assignment_id: string;
      inspection_id: string;
      inspection_type: string;
      evidence_ids: string[];
      findings: Record<string, unknown>;
      asset: AssetIdentity;
      correlation_id: string;
    };
  };
  sent_at: string;
};

function clean(value: unknown, max = 240): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function verifyClaimsManagementSignature(secret: string, raw: string, header: string): boolean {
  if (secret.length < 32) return false;
  const suppliedHex = clean(header, 200).replace(/^sha256=/i, '');
  if (!/^[0-9a-f]{64}$/i.test(suppliedHex)) return false;
  const supplied = Buffer.from(suppliedHex, 'hex');
  const expected = Buffer.from(createHmac('sha256', secret).update(raw).digest('hex'), 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function parseClaimsEstimatingReady(raw: string): ClaimsEstimatingReadyEnvelope {
  let body: unknown;
  try { body = JSON.parse(raw); } catch { throw new Error('invalid_claims_webhook_json'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_claims_webhook');
  const envelope = body as Partial<ClaimsEstimatingReadyEnvelope>;
  if (envelope.event_type !== 'claim.estimating.ready.v1') throw new Error('unsupported_claims_event');
  if (!clean(envelope.id) || !clean(envelope.tenant_id) || !clean(envelope.sent_at)) throw new Error('claims_envelope_fields_required');
  if (!Number.isFinite(Date.parse(envelope.sent_at!))) throw new Error('invalid_claims_sent_at');
  const data = envelope.data;
  if (!data || typeof data !== 'object') throw new Error('claims_data_required');
  const detail = data.detail;
  if (!detail || detail.schema !== 'claim.estimating.ready.v1') throw new Error('invalid_estimating_ready_schema');
  if (clean(detail.tenant_id) !== clean(envelope.tenant_id)) throw new Error('claims_tenant_mismatch');
  if (clean(detail.claim_id) !== clean(data.claim_id)) throw new Error('claims_claim_mismatch');
  if (!clean(detail.assignment_id) || !clean(detail.inspection_id) || !clean(detail.correlation_id)) throw new Error('inspection_identity_required');
  if (!Array.isArray(detail.evidence_ids) || detail.evidence_ids.length === 0 || detail.evidence_ids.length > 250) throw new Error('claims_evidence_required');
  if (new Set(detail.evidence_ids).size !== detail.evidence_ids.length) throw new Error('duplicate_claims_evidence');
  if (!detail.asset || typeof detail.asset !== 'object' || !clean(detail.asset.assetClass, 60)) throw new Error('claims_asset_required');
  return envelope as ClaimsEstimatingReadyEnvelope;
}

export function claimsEventIdempotencyKey(envelope: ClaimsEstimatingReadyEnvelope): string {
  return `claims:${envelope.tenant_id}:${envelope.data.detail.inspection_id}`;
}
