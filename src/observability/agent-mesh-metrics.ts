import type { MeshCriticality, MeshDisposition } from '../agents/mesh.js';

const durationBucketsMs = [50, 100, 250, 500, 1000, 2500, 5000] as const;

export type AgentMeshMetricEvent = {
  criticality: MeshCriticality;
  disposition: MeshDisposition;
  durationMs: number;
  consensusRatio: number;
  disagreementCount: number;
  safetyVetoCount: number;
  failedAgentCount: number;
  shadowHedged: boolean;
  quarantined: boolean;
};

function key(parts: string[]): string { return parts.join('|'); }
function increment(map: Map<string, number>, metricKey: string, amount = 1): void { map.set(metricKey, (map.get(metricKey) ?? 0) + amount); }
function boundedRatio(value: number): number { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); }
function boundedDuration(value: number): number { return Math.max(0, Number.isFinite(value) ? value : 0); }

export class AgentMeshMetrics {
  private readonly executions = new Map<string, number>();
  private readonly disagreements = new Map<string, number>();
  private readonly safetyVetoes = new Map<string, number>();
  private readonly failures = new Map<string, number>();
  private readonly hedges = new Map<string, number>();
  private readonly quarantines = new Map<string, number>();
  private readonly durationCounts = new Map<string, number[]>();
  private readonly durationTotals = new Map<string, number>();
  private readonly durationSums = new Map<string, number>();
  private readonly consensusTotals = new Map<string, number>();
  private readonly consensusSums = new Map<string, number>();

  record(event: AgentMeshMetricEvent): void {
    const criticality = event.criticality;
    const disposition = event.disposition;
    const durationMs = boundedDuration(event.durationMs);
    increment(this.executions, key([criticality, disposition]));
    if (event.disagreementCount > 0) increment(this.disagreements, criticality, event.disagreementCount);
    if (event.safetyVetoCount > 0) increment(this.safetyVetoes, criticality, event.safetyVetoCount);
    if (event.failedAgentCount > 0) increment(this.failures, criticality, event.failedAgentCount);
    if (event.shadowHedged) increment(this.hedges, criticality);
    if (event.quarantined) increment(this.quarantines, criticality);

    const counts = this.durationCounts.get(criticality) ?? durationBucketsMs.map(() => 0);
    durationBucketsMs.forEach((bucket, index) => {
      if (durationMs <= bucket) counts[index] = (counts[index] ?? 0) + 1;
    });
    this.durationCounts.set(criticality, counts);
    increment(this.durationTotals, criticality);
    increment(this.durationSums, criticality, durationMs / 1000);
    increment(this.consensusTotals, criticality);
    increment(this.consensusSums, criticality, boundedRatio(event.consensusRatio));
  }

  renderPrometheus(): string {
    const lines: string[] = [
      '# HELP elite_agent_mesh_executions_total Agent Mesh executions by criticality and disposition.',
      '# TYPE elite_agent_mesh_executions_total counter'
    ];
    for (const [metricKey, value] of [...this.executions.entries()].sort()) {
      const [criticality, disposition] = metricKey.split('|') as [string, string];
      lines.push(`elite_agent_mesh_executions_total{criticality="${criticality}",disposition="${disposition}"} ${value}`);
    }
    const counters: Array<[string, string, Map<string, number>]> = [
      ['elite_agent_mesh_disagreements_total', 'Agent output disagreements requiring reconciliation.', this.disagreements],
      ['elite_agent_mesh_safety_vetoes_total', 'Safety vetoes raised by governed agents.', this.safetyVetoes],
      ['elite_agent_mesh_agent_failures_total', 'Agent execution failures observed by the mesh.', this.failures],
      ['elite_agent_mesh_shadow_hedges_total', 'Shadow-agent hedges launched for redundancy or latency.', this.hedges],
      ['elite_agent_mesh_quarantines_total', 'Mesh executions sent to quarantine.', this.quarantines]
    ];
    for (const [name, help, values] of counters) {
      lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} counter`);
      for (const [criticality, value] of [...values.entries()].sort()) lines.push(`${name}{criticality="${criticality}"} ${value}`);
    }

    lines.push('# HELP elite_agent_mesh_duration_seconds Agent Mesh execution duration by criticality.', '# TYPE elite_agent_mesh_duration_seconds histogram');
    for (const [criticality, counts] of [...this.durationCounts.entries()].sort()) {
      durationBucketsMs.forEach((bucket, index) => lines.push(`elite_agent_mesh_duration_seconds_bucket{criticality="${criticality}",le="${bucket / 1000}"} ${counts[index] ?? 0}`));
      const count = this.durationTotals.get(criticality) ?? 0;
      const sum = this.durationSums.get(criticality) ?? 0;
      lines.push(`elite_agent_mesh_duration_seconds_bucket{criticality="${criticality}",le="+Inf"} ${count}`);
      lines.push(`elite_agent_mesh_duration_seconds_sum{criticality="${criticality}"} ${sum}`);
      lines.push(`elite_agent_mesh_duration_seconds_count{criticality="${criticality}"} ${count}`);
    }

    lines.push('# HELP elite_agent_mesh_consensus_ratio Agent Jury/mesh consensus ratio by criticality.', '# TYPE elite_agent_mesh_consensus_ratio summary');
    for (const [criticality, count] of [...this.consensusTotals.entries()].sort()) {
      lines.push(`elite_agent_mesh_consensus_ratio_sum{criticality="${criticality}"} ${this.consensusSums.get(criticality) ?? 0}`);
      lines.push(`elite_agent_mesh_consensus_ratio_count{criticality="${criticality}"} ${count}`);
    }
    return lines.join('\n') + '\n';
  }
}
