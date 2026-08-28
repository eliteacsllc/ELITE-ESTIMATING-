import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFabricExecutionPlan, type AgentHealthSnapshot } from './fabric.js';
import { AgentExecutorRegistry, AgentMeshRuntime, type AgentExecutor } from './runtime.js';

function health(entries: Array<[string,string,string[]]>): ReadonlyMap<string, AgentHealthSnapshot> {
  return new Map(entries.map(([agentId,implementationFamily,sourceFamilies]) => [agentId, {
    agentId,
    successRate: 0.99,
    trustScore: 0.95,
    p95LatencyMs: 50,
    consecutiveFailures: 0,
    circuit: 'closed' as const,
    implementationFamily,
    sourceFamilies,
  }]));
}

function executor(agentId:string, implementationFamily:string, sourceFamilies:string[], outputKey:string, options:{delayMs?:number;fail?:boolean;safetyVeto?:boolean}={}):AgentExecutor {
  return {
    agentId,
    implementationFamily,
    sourceFamilies,
    async execute({signal}) {
      if (options.delayMs) await new Promise<void>((resolve,reject)=>{
        const timer=setTimeout(resolve,options.delayMs);
        signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('aborted'))},{once:true});
      });
      if (options.fail) throw new Error('synthetic_failure');
      return { outputKey, confidence:.94, evidenceRefs:[`evidence:${agentId}`], sourceFamilies, ...(options.safetyVeto!==undefined?{safetyVeto:options.safetyVeto}:{}) };
    }
  };
}

test('fast routine primary completes without unnecessary shadow work',async()=>{
  const snapshots=health([
    ['pricing','pricing-a',['motor']],
    ['parts-sourcing','parts-b',['parts-network']],
    ['carrier-rules','carrier-c',['carrier']],
    ['estimate-audit','audit-d',['internal']],
    ['oem-procedure','oem-e',['oem']],
  ]);
  const plan=buildFabricExecutionPlan({tenantId:'tenant-a',estimateId:'estimate-a',revision:1,feature:'parts_optimizer',criticality:'routine',utilization:.2,health:snapshots,nowMs:Date.now()});
  const registry=new AgentExecutorRegistry();
  registry.register(executor(plan.primary.agentId,plan.primary.implementationFamily,['motor'],'use-oem'));
  for(const shadow of plan.shadows) registry.register(executor(shadow.agentId,shadow.implementationFamily,['parts-network'],'use-oem'));
  const result=await new AgentMeshRuntime(registry).execute(plan,{part:'bumper'});
  assert.equal(result.decision.disposition,'candidate');
  assert.equal(result.decision.selectedOutputKey,'use-oem');
  assert.deepEqual(result.launchedAgents,[plan.primary.agentId]);
  assert.equal(result.decision.automaticFinalMutationAllowed,false);
});

test('safety-critical execution obtains independent implementation and source quorum',async()=>{
  const snapshots=health([
    ['oem-procedure','oem-engine',['oem']],
    ['adas-safety','adas-engine',['adas-provider']],
    ['compliance','compliance-engine',['regulatory']],
    ['estimate-audit','audit-engine',['internal']],
  ]);
  const plan=buildFabricExecutionPlan({tenantId:'tenant-a',estimateId:'estimate-a',revision:2,feature:'oem_procedures',criticality:'safety_critical',utilization:.95,health:snapshots,nowMs:Date.now()});
  const registry=new AgentExecutorRegistry();
  [plan.primary,...plan.shadows].forEach((slot,index)=>registry.register(executor(slot.agentId,slot.implementationFamily,[index===0?'oem':'independent-source'],'replace')));
  const result=await new AgentMeshRuntime(registry).execute(plan,{operation:'rail-section'});
  assert.ok(result.launchedAgents.length>=2);
  assert.ok(result.decision.independentImplementations>=2);
  assert.ok(result.decision.sourceDiversity>=2);
  assert.equal(result.decision.selectedOutputKey,'replace');
  assert.notEqual(result.decision.disposition,'reject');
  assert.equal(result.decision.humanApprovalRequired,true);
});

test('primary failure triggers redundant shadow execution',async()=>{
  const snapshots=health([
    ['pricing','pricing-a',['market']],
    ['parts-sourcing','parts-b',['parts']],
    ['carrier-rules','carrier-c',['carrier']],
    ['estimate-audit','audit-d',['internal']],
    ['oem-procedure','oem-e',['oem']],
  ]);
  const plan=buildFabricExecutionPlan({tenantId:'tenant-a',estimateId:'estimate-a',revision:3,feature:'parts_optimizer',criticality:'routine',utilization:.1,health:snapshots,nowMs:Date.now()});
  const registry=new AgentExecutorRegistry();
  registry.register(executor(plan.primary.agentId,plan.primary.implementationFamily,['market'],'unused',{fail:true}));
  for(const shadow of plan.shadows) registry.register(executor(shadow.agentId,shadow.implementationFamily,['parts'],'alternate'));
  const result=await new AgentMeshRuntime(registry).execute(plan,{});
  assert.ok(result.launchedAgents.length>1);
  assert.equal(result.decision.selectedOutputKey,'alternate');
  assert.ok(result.candidates.some(candidate=>candidate.error==='synthetic_failure'));
});

test('hard deadline preserves completed shadow candidates while aborting a hung primary',async()=>{
  const snapshots=health([
    ['pricing','pricing-a',['market']],
    ['parts-sourcing','parts-b',['parts']],
    ['carrier-rules','carrier-c',['carrier']],
    ['estimate-audit','audit-d',['internal']],
    ['oem-procedure','oem-e',['oem']],
  ]);
  const base=buildFabricExecutionPlan({tenantId:'tenant-a',estimateId:'estimate-a',revision:4,feature:'parts_optimizer',criticality:'routine',utilization:.95,health:snapshots,nowMs:Date.now()});
  const plan={...base,hedgeAfterMs:5,hardDeadlineMs:40};
  const registry=new AgentExecutorRegistry();
  registry.register(executor(plan.primary.agentId,plan.primary.implementationFamily,['market'],'slow',{delayMs:200}));
  for(const shadow of plan.shadows) registry.register(executor(shadow.agentId,shadow.implementationFamily,['parts'],'fast',{delayMs:5}));
  const result=await new AgentMeshRuntime(registry).execute(plan,{});
  assert.equal(result.deadlineExceeded,true);
  assert.ok(result.candidates.some(candidate=>candidate.outputKey==='fast'));
});

test('expired execution tickets fail closed before launching an executor',async()=>{
  const snapshots=health([
    ['pricing','pricing-a',['market']],
    ['parts-sourcing','parts-b',['parts']],
    ['carrier-rules','carrier-c',['carrier']],
    ['estimate-audit','audit-d',['internal']],
    ['oem-procedure','oem-e',['oem']],
  ]);
  const now=Date.now();
  const plan=buildFabricExecutionPlan({tenantId:'tenant-a',estimateId:'estimate-a',revision:5,feature:'parts_optimizer',criticality:'routine',utilization:.1,health:snapshots,nowMs:now,ticketTtlMs:1});
  const registry=new AgentExecutorRegistry();
  registry.register(executor(plan.primary.agentId,plan.primary.implementationFamily,['market'],'x'));
  await assert.rejects(()=>new AgentMeshRuntime(registry).execute(plan,{},Date.parse(plan.ticket.expiresAt)+1),/fabric_ticket_expired/);
});
