import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEstimateQaExport,confirmCondition} from './vehicle-condition.js';

test('condition suggestion remains editable but evidence-backed',()=>{
 const reviewed=confirmCondition({area:'interior',suggestedRating:'below_average',evidenceRefs:['photo:seat-1']},'appraiser-1','average','wear less severe on review');
 assert.equal(reviewed.suggestedRating,'below_average');
 assert.equal(reviewed.confirmedRating,'average');
 assert.equal(reviewed.reviewedBy,'appraiser-1');
});

test('estimate export is QA handoff and never final lock',()=>{
 const x=buildEstimateQaExport({estimateId:'e1',claimId:'c1',tenantId:'t1',revision:3,submittedBy:'writer-1',snapshotRef:'sha256:abc',condition:[],valuationEvidenceRefs:['acv:1','acv:1']});
 assert.equal(x.finalLockAllowed,false);
 assert.deepEqual(x.valuationEvidenceRefs,['acv:1']);
});
