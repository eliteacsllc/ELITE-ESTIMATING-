import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { claimsEventIdempotencyKey, parseClaimsEstimatingReady, verifyClaimsManagementSignature } from './claims-management-inbound.js';

const payload = {
  id:'evt_1',
  event_type:'claim.estimating.ready.v1',
  tenant_id:'tenant-a',
  data:{
    claim_id:'claim-1',
    detail:{
      schema:'claim.estimating.ready.v1',
      tenant_id:'tenant-a',
      claim_id:'claim-1',
      assignment_id:'assignment-1',
      inspection_id:'inspection-1',
      inspection_type:'original',
      evidence_ids:['doc-1'],
      findings:{damage:['front']},
      asset:{assetClass:'passenger_vehicle',vin:'1HGCV1F34NA123456'},
      correlation_id:'inspection-1'
    }
  },
  sent_at:'2026-09-19T15:00:00.000Z'
};

test('verifies Claims Management HMAC exactly',()=>{
 const secret='x'.repeat(32), raw=JSON.stringify(payload);
 const signature='sha256='+createHmac('sha256',secret).update(raw).digest('hex');
 assert.equal(verifyClaimsManagementSignature(secret,raw,signature),true);
 assert.equal(verifyClaimsManagementSignature(secret,raw,'sha256='+'0'.repeat(64)),false);
});

test('validates estimating-ready tenant, claim, evidence and asset identity',()=>{
 const parsed=parseClaimsEstimatingReady(JSON.stringify(payload));
 assert.equal(parsed.data.detail.inspection_id,'inspection-1');
 assert.equal(claimsEventIdempotencyKey(parsed),'claims:tenant-a:inspection-1');
 const bad=structuredClone(payload); bad.data.detail.tenant_id='tenant-b';
 assert.throws(()=>parseClaimsEstimatingReady(JSON.stringify(bad)),/claims_tenant_mismatch/);
});
