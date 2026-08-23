export type AgentRole = {
  id: string;
  purpose: string;
  requiredEvidence: boolean;
  canAutoApprove: boolean;
};

export const AGENTS: AgentRole[] = [
  { id: 'orchestrator', purpose: 'Routes estimating work, tools, providers, and approvals.', requiredEvidence: true, canAutoApprove: false },
  { id: 'damage-analysis', purpose: 'Interprets inspection evidence and proposes damaged components/areas.', requiredEvidence: true, canAutoApprove: false },
  { id: 'asset-identity', purpose: 'Resolves VIN, serial, build, trim, equipment, and configuration.', requiredEvidence: true, canAutoApprove: false },
  { id: 'oem-procedure', purpose: 'Finds source-backed repair procedures, position statements, and required operations.', requiredEvidence: true, canAutoApprove: false },
  { id: 'adas-safety', purpose: 'Detects scans, calibrations, restraint, structural, and EV/HV safety requirements.', requiredEvidence: true, canAutoApprove: false },
  { id: 'pricing', purpose: 'Normalizes labor, parts, materials, equipment, tax, and regional market prices.', requiredEvidence: true, canAutoApprove: false },
  { id: 'parts-sourcing', purpose: 'Ranks OEM, recycled, aftermarket, remanufactured, and specialty sourcing options by configured rules.', requiredEvidence: true, canAutoApprove: false },
  { id: 'property-scope', purpose: 'Builds property scopes, quantities, assemblies, depreciation, and code-upgrade candidates.', requiredEvidence: true, canAutoApprove: false },
  { id: 'estimate-audit', purpose: 'Finds omissions, duplication, overlap, inconsistent labor, unsupported operations, and math errors.', requiredEvidence: true, canAutoApprove: false },
  { id: 'carrier-rules', purpose: 'Evaluates tenant/carrier guidelines without overwriting source-backed safety requirements.', requiredEvidence: true, canAutoApprove: false },
  { id: 'compliance', purpose: 'Checks jurisdiction, data license, privacy, retention, disclosure, and audit requirements.', requiredEvidence: true, canAutoApprove: false },
  { id: 'fraud-anomaly', purpose: 'Flags anomalous estimate patterns for human review; never makes a fraud determination.', requiredEvidence: true, canAutoApprove: false },
  { id: 'supplement', purpose: 'Compares revisions, teardown discoveries, diagnostics, and invoices to generate supplement candidates.', requiredEvidence: true, canAutoApprove: false },
  { id: 'interoperability', purpose: 'Maps internal estimate data to supported industry/vendor interchange formats.', requiredEvidence: true, canAutoApprove: false },
  { id: 'quality-verification', purpose: 'Verifies final estimate completeness, source provenance, approvals, and export integrity.', requiredEvidence: true, canAutoApprove: false }
];

export function getAgent(id: string): AgentRole {
  const agent = AGENTS.find((item) => item.id === id);
  if (!agent) throw new Error(`Unknown agent: ${id}`);
  return agent;
}
