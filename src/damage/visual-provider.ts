import type { AssetIdentity, SourceProvenance } from '../domain/types.js';
import type { DamageObservation } from './proposal.js';

export type VisualEvidenceInput = {
  evidenceId: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'video/mp4';
  sha256: string;
  capturedAt?: string;
  view?: string;
};

export type VisualAnalysisRequest = {
  tenantId: string;
  estimateId: string;
  asset: AssetIdentity;
  evidence: VisualEvidenceInput[];
};

export type VisualAnalysisResult = {
  providerId: string;
  modelId: string;
  modelVersion: string;
  analyzedAt: string;
  observations: DamageObservation[];
  warnings: string[];
};

export type VisualIntelligenceProvider = {
  readonly id: string;
  readonly deployment: 'local' | 'private_cloud' | 'public_cloud' | 'black_box';
  supports(asset: AssetIdentity): boolean;
  health(): Promise<{ ok: boolean; version: string }>;
  analyze(request: VisualAnalysisRequest): Promise<VisualAnalysisResult>;
};

export type VisualProviderCertification = {
  providerId: string;
  green: boolean;
  blockers: string[];
  observationCount: number;
};

function validHash(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

function provenanceMatchesProvider(providerId: string, provenance: SourceProvenance[]): boolean {
  return provenance.some(source => source.provider === providerId && Number.isFinite(source.confidence ?? 1));
}

export async function certifyVisualProvider(provider: VisualIntelligenceProvider, request: VisualAnalysisRequest): Promise<VisualProviderCertification> {
  const blockers: string[] = [];
  if (!provider.id.trim()) blockers.push('visual_provider_id_required');
  if (!request.tenantId.trim() || !request.estimateId.trim()) blockers.push('visual_request_scope_required');
  if (!request.evidence.length) blockers.push('visual_evidence_required');
  if (request.evidence.some(item => !item.evidenceId.trim() || !validHash(item.sha256))) blockers.push('visual_evidence_integrity_invalid');
  if (!provider.supports(request.asset)) blockers.push('visual_asset_unsupported');

  let observationCount = 0;
  if (!blockers.length) {
    try {
      const health = await provider.health();
      if (!health.ok || !health.version.trim()) blockers.push('visual_provider_unhealthy');
      if (!blockers.includes('visual_provider_unhealthy')) {
        const result = await provider.analyze(request);
        observationCount = result.observations.length;
        if (result.providerId !== provider.id) blockers.push('visual_provider_identity_mismatch');
        if (!result.modelId.trim() || !result.modelVersion.trim()) blockers.push('visual_model_identity_required');
        if (!Number.isFinite(Date.parse(result.analyzedAt))) blockers.push('visual_analysis_timestamp_invalid');
        const ids = new Set<string>();
        for (const observation of result.observations) {
          if (!observation.id.trim() || ids.has(observation.id)) blockers.push('visual_observation_id_invalid');
          ids.add(observation.id);
          if (!Number.isFinite(observation.confidence) || observation.confidence < 0 || observation.confidence > 1) blockers.push('visual_confidence_invalid');
          if (!provenanceMatchesProvider(provider.id, observation.provenance)) blockers.push('visual_observation_provenance_missing');
        }
        if (result.warnings.some(warning => /fabricat|unsupported safety|procedure inferred/i.test(warning))) blockers.push('visual_unsafe_warning');
      }
    } catch (error) {
      blockers.push(`visual_provider_exception:${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { providerId: provider.id, green: blockers.length === 0, blockers: [...new Set(blockers)], observationCount };
}
