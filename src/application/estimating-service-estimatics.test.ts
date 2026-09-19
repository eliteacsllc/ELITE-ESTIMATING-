import test from 'node:test';
import assert from 'node:assert/strict';
import { EstimatingService } from './estimating-service.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import { MemoryLifecycleSink } from '../integrations/outbox.js';
import { InMemoryEstimaticsEvidenceReceiptRepository, pinEstimaticsEvidence } from '../connectors/estimatics-receipts.js';
import type { EstimateLine } from '../domain/types.js';
import type { Principal } from '../security/rbac.js';

const estimator:Principal={userId:'u1',tenantId:'tenant-a',roles:['estimator']};
const reviewer:Principal={userId:'u2',tenantId:'tenant-a',roles:['reviewer']};

const envelope=(changes:Record<string,unknown>={})=>({
 schema_version:'elite.repair-knowledge.v1',consumer:'elite-estimating',tenant_id:'tenant-a',request_id:'req-1',
 query:{year:2024,make:'Example'},items:[{record_id:'r1',kind:'procedure',title:'Reference',fingerprint:'fp',
 safety_domains:['structural'],status:'approved_reference_not_repair_authorization',citations:[{source_id:'s1',document_version:'v1',
 content_hash:'hash',retrieved_at:'2026-09-19T15:00:00+00:00',license_class:'public',effective_to:null}]}],
 blocked_record_ids:[],warnings:[],source_receipt_digest:'source-receipt',failure_mode:'fail_closed',
 requires_human_review:false,envelope_digest:'envelope-digest',...changes
});

function safetyLine():EstimateLine{return {
 id:'line-1',category:'structure',component:'rail',operation:'repair',quantity:1,laborHours:2,
 laborRate:{amountMinor:7500,currency:'USD'},total:{amountMinor:0,currency:'USD'},humanApproved:true,
 safetyCritical:true,procedureRefs:['ESTIMATICS:r1'],
 provenance:[{provider:'elite-estimatics',sourceId:'r1',retrievedAt:'2026-09-19T15:00:00+00:00',licenseClass:'public'}]
};}

function repairPlan(){return {
 damageDiscoveryComplete:true,teardownBlueprintComplete:true,hiddenDamageReviewed:true,partsIdentified:true,
 oneTimeUseItemsIdentified:true,oemProceduresReviewed:true,structuralRequirementsResolved:true,adasRequirementsResolved:true,
 evHvRequirementsResolved:true,requiredToolsEquipmentConfirmed:true,technicianCapabilityConfirmed:true,subletOperationsIdentified:true,
 preRepairScanResolved:true,calibrationPlanResolved:true,postRepairScanResolved:true,finalQcPlanResolved:true,
 testDriveOrFunctionalValidationResolved:true
};}

async function setup(){
 const lifecycle=new MemoryLifecycleSink(),receipts=new InMemoryEstimaticsEvidenceReceiptRepository();
 const service=new EstimatingService(new InMemoryEstimateRepository(),[],undefined,lifecycle,receipts);
 const estimate=await service.create(estimator,{tenantId:'tenant-a',claimId:'claim-1',asset:{assetClass:'passenger_vehicle'},locale:'en-US',currency:'USD',jurisdiction:'US'});
 await service.replaceLines(estimator,estimate.id,[safetyLine()]);
 await service.replaceRepairPlan(estimator,estimate.id,repairPlan());
 return {service,lifecycle,receipts,estimate};
}

test('safety/procedure approval requires pinned Estimatics receipt',async()=>{
 const {service,estimate}=await setup();
 await assert.rejects(()=>service.approve(reviewer,estimate.id),/estimatics_evidence_required/);
});

test('blocked or human-review Estimatics receipt blocks approval',async()=>{
 const a=await setup();
 await a.receipts.save(pinEstimaticsEvidence(envelope({blocked_record_ids:['r1']}),'tenant-a',{estimateId:a.estimate.id,claimId:'claim-1',inspectionId:'inspection-1',correlationId:'inspection-1'}));
 await assert.rejects(()=>a.service.approve(reviewer,a.estimate.id),/estimatics_knowledge_blocked/);
 const b=await setup();
 await b.receipts.save(pinEstimaticsEvidence(envelope({requires_human_review:true,envelope_digest:'review-digest'}),'tenant-a',{estimateId:b.estimate.id,claimId:'claim-1',inspectionId:'inspection-1',correlationId:'inspection-1'}));
 await assert.rejects(()=>b.service.approve(reviewer,b.estimate.id),/estimatics_human_review_required/);
});

test('approved estimate lifecycle carries pinned Estimatics evidence receipt',async()=>{
 const {service,lifecycle,receipts,estimate}=await setup();
 await receipts.save(pinEstimaticsEvidence(envelope(),'tenant-a',{estimateId:estimate.id,claimId:'claim-1',assignmentId:'assignment-1',inspectionId:'inspection-1',correlationId:'inspection-1'}));
 const approved=await service.approve(reviewer,estimate.id);
 assert.equal(approved.status,'approved');
 const event=lifecycle.events.find(e=>e.topic==='estimate.approved');
 assert.ok(event);
 const evidence=event!.payload.estimaticsEvidence as Record<string,unknown>;
 assert.equal(evidence.envelopeDigest,'envelope-digest');
 assert.equal(evidence.inspectionId,'inspection-1');
 assert.equal(evidence.correlationId,'inspection-1');
});
