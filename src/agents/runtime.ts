import {
  assertFabricExecutionTicket,
  harmonizeFabricCandidates,
  type FabricAgentSlot,
  type FabricCandidate,
  type FabricDecision,
  type FabricExecutionPlan,
} from './fabric.js';

export type AgentExecutionInput = {
  payload: unknown;
  tenantId: string;
  estimateId: string;
  revision: number;
  feature: FabricExecutionPlan['feature'];
  ticketChecksum: string;
  signal: AbortSignal;
};

export type AgentExecutionOutput = {
  outputKey: string;
  confidence: number;
  evidenceRefs: string[];
  sourceFamilies?: string[];
  safetyVeto?: boolean;
};

export type AgentExecutor = {
  agentId: string;
  implementationFamily: string;
  sourceFamilies: string[];
  execute(input: AgentExecutionInput): Promise<AgentExecutionOutput>;
};

export type AgentMeshRuntimeEvent = {
  type: 'started' | 'completed' | 'failed' | 'hedged' | 'deadline';
  agentId?: string;
  elapsedMs: number;
  detail?: string;
};

export type AgentMeshExecutionResult = {
  decision: FabricDecision;
  candidates: FabricCandidate[];
  launchedAgents: string[];
  elapsedMs: number;
  deadlineExceeded: boolean;
};

export class AgentExecutorRegistry {
  private readonly executors = new Map<string, AgentExecutor>();

  register(executor: AgentExecutor): void {
    const agentId = executor.agentId.trim();
    if (!agentId) throw new Error('agent_executor_id_required');
    if (this.executors.has(agentId)) throw new Error(`agent_executor_already_registered:${agentId}`);
    const implementationFamily = executor.implementationFamily.trim();
    if (!implementationFamily) throw new Error('agent_executor_implementation_family_required');
    const sourceFamilies = [...new Set(executor.sourceFamilies.map(value => value.trim()).filter(Boolean))];
    this.executors.set(agentId, { ...executor, agentId, implementationFamily, sourceFamilies });
  }

  get(agentId: string): AgentExecutor | undefined {
    return this.executors.get(agentId);
  }

  list(): AgentExecutor[] {
    return [...this.executors.values()];
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
}

export class AgentMeshRuntime {
  constructor(
    private readonly registry: AgentExecutorRegistry,
    private readonly onEvent: (event: AgentMeshRuntimeEvent) => void = () => undefined,
  ) {}

  async execute(plan: FabricExecutionPlan, payload: unknown, nowMs = Date.now()): Promise<AgentMeshExecutionResult> {
    assertFabricExecutionTicket(plan.ticket, {
      tenantId: plan.ticket.tenantId,
      estimateId: plan.ticket.estimateId,
      revision: plan.ticket.revision,
      feature: plan.feature,
      superAgent: plan.superAgent.id,
      allowedAgents: plan.ticket.allowedAgents,
      criticality: plan.criticality,
      expiresAt: plan.ticket.expiresAt,
    }, nowMs);

    const startedAt = Date.now();
    const controller = new AbortController();
    const candidates: FabricCandidate[] = [];
    const launchedAgents: string[] = [];
    const tasks: Promise<FabricCandidate>[] = [];
    let deadlineExceeded = false;
    let deadlineHandle: ReturnType<typeof setTimeout> | undefined;

    const emit = (event: Omit<AgentMeshRuntimeEvent, 'elapsedMs'>): void => {
      this.onEvent({ ...event, elapsedMs: Date.now() - startedAt });
    };

    const deadlinePromise = new Promise<void>(resolve => {
      deadlineHandle = setTimeout(() => {
        deadlineExceeded = true;
        controller.abort(new Error('agent_mesh_deadline_exceeded'));
        emit({ type: 'deadline', detail: 'hard_deadline_exceeded' });
        resolve();
      }, plan.hardDeadlineMs);
    });

    const runSlot = async (slot: FabricAgentSlot): Promise<FabricCandidate> => {
      const executor = this.registry.get(slot.agentId);
      const started = Date.now();
      launchedAgents.push(slot.agentId);
      emit({ type: 'started', agentId: slot.agentId });
      if (!executor) {
        const missing: FabricCandidate = {
          agentId: slot.agentId,
          implementationFamily: slot.implementationFamily,
          outputKey: '',
          confidence: 0,
          evidenceRefs: [],
          sourceFamilies: slot.sourceFamilies,
          latencyMs: Date.now() - started,
          ticketChecksum: plan.ticket.checksum,
          error: 'agent_executor_unavailable',
        };
        emit({ type: 'failed', agentId: slot.agentId, detail: missing.error });
        return missing;
      }
      if (!plan.ticket.allowedAgents.includes(executor.agentId)) {
        const denied: FabricCandidate = {
          agentId: executor.agentId,
          implementationFamily: executor.implementationFamily,
          outputKey: '',
          confidence: 0,
          evidenceRefs: [],
          sourceFamilies: executor.sourceFamilies,
          latencyMs: Date.now() - started,
          ticketChecksum: plan.ticket.checksum,
          error: 'agent_executor_not_allowed_by_ticket',
        };
        emit({ type: 'failed', agentId: executor.agentId, detail: denied.error });
        return denied;
      }
      try {
        const output = await executor.execute({
          payload,
          tenantId: plan.ticket.tenantId,
          estimateId: plan.ticket.estimateId,
          revision: plan.ticket.revision,
          feature: plan.feature,
          ticketChecksum: plan.ticket.checksum,
          signal: controller.signal,
        });
        const outputKey = output.outputKey.trim();
        if (!outputKey) throw new Error('agent_output_key_required');
        const sourceFamilies = [...new Set([...(output.sourceFamilies ?? []), ...executor.sourceFamilies].map(value => value.trim()).filter(Boolean))];
        const candidate: FabricCandidate = {
          agentId: executor.agentId,
          implementationFamily: executor.implementationFamily,
          outputKey,
          confidence: clamp01(output.confidence),
          evidenceRefs: [...new Set(output.evidenceRefs.filter(Boolean))],
          sourceFamilies,
          latencyMs: Date.now() - started,
          ticketChecksum: plan.ticket.checksum,
          ...(output.safetyVeto !== undefined ? { safetyVeto: output.safetyVeto } : {}),
        };
        emit({ type: 'completed', agentId: executor.agentId });
        return candidate;
      } catch (error) {
        const detail = controller.signal.aborted ? 'agent_execution_aborted' : error instanceof Error ? error.message : 'agent_execution_failed';
        const failed: FabricCandidate = {
          agentId: executor.agentId,
          implementationFamily: executor.implementationFamily,
          outputKey: '',
          confidence: 0,
          evidenceRefs: [],
          sourceFamilies: executor.sourceFamilies,
          latencyMs: Date.now() - started,
          ticketChecksum: plan.ticket.checksum,
          error: detail,
        };
        emit({ type: 'failed', agentId: executor.agentId, detail });
        return failed;
      }
    };

    const launch = (slot: FabricAgentSlot): Promise<FabricCandidate> => {
      const task = runSlot(slot).then(candidate => {
        candidates.push(candidate);
        return candidate;
      });
      tasks.push(task);
      return task;
    };

    try {
      const primaryPromise = launch(plan.primary);
      const first = await Promise.race([
        primaryPromise.then(candidate => ({ kind: 'primary' as const, candidate })),
        wait(plan.hedgeAfterMs).then(() => ({ kind: 'hedge' as const })),
        deadlinePromise.then(() => ({ kind: 'deadline' as const })),
      ]);

      let shadowsLaunched = false;
      const launchShadows = (detail: string): void => {
        if (shadowsLaunched || !plan.shadows.length) return;
        shadowsLaunched = true;
        emit({ type: 'hedged', detail });
        plan.shadows.forEach(launch);
      };

      if (first.kind === 'primary') {
        const primarySucceeded = !first.candidate.error && Boolean(first.candidate.outputKey);
        if (primarySucceeded && plan.minimumIndependentImplementations <= 1 && !first.candidate.safetyVeto) {
          const decision = harmonizeFabricCandidates(plan, candidates);
          return { decision, candidates: [...candidates], launchedAgents: [...new Set(launchedAgents)], elapsedMs: Date.now() - startedAt, deadlineExceeded };
        }
        launchShadows(primarySucceeded ? 'independent_quorum_required' : 'primary_failed');
      } else if (first.kind === 'hedge') {
        launchShadows('hedge_delay_elapsed');
      }

      await Promise.race([
        Promise.all(tasks).then(() => undefined),
        deadlinePromise,
      ]);

      const decision = harmonizeFabricCandidates(plan, candidates);
      return { decision, candidates: [...candidates], launchedAgents: [...new Set(launchedAgents)], elapsedMs: Date.now() - startedAt, deadlineExceeded };
    } finally {
      if (deadlineHandle) clearTimeout(deadlineHandle);
      controller.abort();
    }
  }
}
