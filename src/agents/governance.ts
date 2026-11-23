import type { FabricExecutionPlan } from './fabric.js';

export type EstimatingAgentGovernanceDecision = {
  decision: 'allow' | 'require_approval' | 'deny';
  reason: string;
};

export type EstimatingAgentGovernanceRequest = {
  tenantId: string;
  estimateId: string;
  revision: number;
  agentId: string;
  superAgentId: string;
  feature: FabricExecutionPlan['feature'];
  criticality: FabricExecutionPlan['criticality'];
  ticketChecksum: string;
};

export interface EstimatingAgentGovernanceEnforcer {
  evaluate(request: EstimatingAgentGovernanceRequest): Promise<EstimatingAgentGovernanceDecision>;
}

export class LocalEstimatingAgentGovernance implements EstimatingAgentGovernanceEnforcer {
  constructor(private frozen = false) {}

  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
  }

  async evaluate(request: EstimatingAgentGovernanceRequest): Promise<EstimatingAgentGovernanceDecision> {
    if (!request.tenantId || !request.estimateId || !request.agentId || !request.ticketChecksum) {
      return { decision: 'deny', reason: 'agent_governance_identity_required' };
    }
    if (this.frozen) return { decision: 'deny', reason: 'tenant_governance_frozen' };

    // The estimating mesh is computation/recommendation only. Final mutation is
    // separately disabled by the control plane, so governed compute may proceed.
    return { decision: 'allow', reason: 'governed_compute_allowed' };
  }
}
