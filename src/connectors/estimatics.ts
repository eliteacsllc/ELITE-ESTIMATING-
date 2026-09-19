import type { ProviderRecord } from './contracts.js';

export const ESTIMATICS_SCHEMA_VERSION = 'elite.repair-knowledge.v1';

export type EstimaticsCitation = {
  source_id: string;
  document_version: string | null;
  content_hash: string;
  retrieved_at: string;
  license_class: 'public' | 'licensed_exportable';
  effective_to: string | null;
};

export type EstimaticsKnowledgeItem = {
  record_id: string;
  kind: string;
  title: string;
  fingerprint: string;
  safety_domains: string[];
  status: 'human_review_required' | 'approved_reference_not_repair_authorization';
  citations: EstimaticsCitation[];
};

export type EstimaticsEnvelope = {
  schema_version: string;
  consumer: string;
  tenant_id: string;
  request_id: string;
  query: Record<string, unknown>;
  items: EstimaticsKnowledgeItem[];
  blocked_record_ids: string[];
  warnings: string[];
  source_receipt_digest: string;
  failure_mode: string;
  requires_human_review: boolean;
  envelope_digest: string;
};

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`invalid_estimatics_${field}`);
  return value;
}

export function validateEstimaticsEnvelope(input: unknown, tenantId: string): EstimaticsEnvelope {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid_estimatics_envelope');
  const value = input as EstimaticsEnvelope;
  if (value.schema_version !== ESTIMATICS_SCHEMA_VERSION) throw new Error('unsupported_estimatics_schema');
  if (value.consumer !== 'elite-estimating') throw new Error('estimatics_consumer_mismatch');
  if (requiredString(value.tenant_id, 'tenant_id') !== tenantId) throw new Error('estimatics_tenant_mismatch');
  requiredString(value.request_id, 'request_id');
  requiredString(value.source_receipt_digest, 'source_receipt_digest');
  requiredString(value.envelope_digest, 'envelope_digest');
  if (!Array.isArray(value.items) || !Array.isArray(value.blocked_record_ids) || !Array.isArray(value.warnings)) {
    throw new Error('invalid_estimatics_collections');
  }
  for (const item of value.items) {
    requiredString(item.record_id, 'record_id');
    requiredString(item.fingerprint, 'fingerprint');
    if (!Array.isArray(item.citations) || item.citations.length === 0) throw new Error('estimatics_missing_citations');
    for (const citation of item.citations) {
      requiredString(citation.source_id, 'source_id');
      requiredString(citation.content_hash, 'content_hash');
      requiredString(citation.retrieved_at, 'retrieved_at');
      if (!['public', 'licensed_exportable'].includes(citation.license_class)) {
        throw new Error('estimatics_non_exportable_source');
      }
    }
  }
  return value;
}

export function estimaticsEnvelopeToProviderRecords(
  input: unknown,
  tenantId: string,
): ProviderRecord<EstimaticsKnowledgeItem>[] {
  const envelope = validateEstimaticsEnvelope(input, tenantId);
  return envelope.items.map((item) => ({
    value: item,
    provenance: {
      provider: 'elite-estimatics',
      sourceId: item.record_id,
      retrievedAt: item.citations.reduce((latest, citation) =>
        citation.retrieved_at > latest ? citation.retrieved_at : latest, item.citations[0].retrieved_at),
      licenseClass: item.citations.some((citation) => citation.license_class === 'licensed_exportable') ? 'licensed' : 'public',
      confidence: item.status === 'human_review_required' ? 0.5 : 1,
    },
  }));
}

export type EstimaticsDecision = {
  usableForAutomation: boolean;
  requiresHumanReview: boolean;
  blocked: boolean;
  reasons: string[];
};

export function assessEstimaticsEnvelope(input: unknown, tenantId: string): EstimaticsDecision {
  const envelope = validateEstimaticsEnvelope(input, tenantId);
  const reasons = [...envelope.warnings];
  if (envelope.blocked_record_ids.length) reasons.push('blocked_knowledge_records');
  if (envelope.requires_human_review) reasons.push('human_review_required');
  return {
    usableForAutomation: !envelope.requires_human_review && envelope.blocked_record_ids.length === 0,
    requiresHumanReview: envelope.requires_human_review,
    blocked: envelope.blocked_record_ids.length > 0,
    reasons: [...new Set(reasons)],
  };
}
