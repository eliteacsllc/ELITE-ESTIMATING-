import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InMemoryEstimaticsEvidenceReceiptRepository,
  pinEstimaticsEvidence,
} from './estimatics-receipts.js';

const envelope={
 schema_version:'elite.repair-knowledge.v1',consumer:'elite-estimating',tenant_id:'tenant-a',request_id:'req-1',
 query:{year:2024,make:'Example'},items:[{record_id:'r1',kind:'procedure',title:'Reference',fingerprint:'fp',
 safety_domains:['general'],status:'approved_reference_not_repair_authorization',citations:[{source_id:'s1',document_version:'v1',
 content_hash:'hash',retrieved_at:'2026-09-19T15:00:00+00:00',license_class:'public',effective_to:null}]}],
 blocked_record_ids:[],warnings:[],source_receipt_digest:'source-receipt',failure_mode:'fail_closed',
 requires_human_review:false,envelope_digest:'envelope-digest'
};

test('pins Estimatics evidence to claim inspection and estimate identities',()=>{
 const receipt=pinEstimaticsEvidence(envelope,'tenant-a',{
  claimId:'claim-1',assignmentId:'assignment-1',inspectionId:'inspection-1',estimateId:'estimate-1',correlationId:'inspection-1'
 });
 assert.equal(receipt.estimateId,'estimate-1');
 assert.equal(receipt.inspectionId,'inspection-1');
 assert.equal(receipt.recordRefs[0].fingerprint,'fp');
 assert.equal(receipt.sourceReceiptDigest,'source-receipt');
});

test('receipt repository is tenant and estimate scoped and idempotent',async()=>{
 const repo=new InMemoryEstimaticsEvidenceReceiptRepository();
 const receipt=pinEstimaticsEvidence(envelope,'tenant-a',{estimateId:'estimate-1',correlationId:'inspection-1'});
 await repo.save(receipt);await repo.save(receipt);
 assert.equal((await repo.listByEstimate('tenant-a','estimate-1')).length,1);
 assert.equal((await repo.listByEstimate('tenant-b','estimate-1')).length,0);
});

test('receipt requires estimate and correlation identity',()=>{
 assert.throws(()=>pinEstimaticsEvidence(envelope,'tenant-a',{estimateId:'',correlationId:'inspection-1'}),/trace_identity/);
});
