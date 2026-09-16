import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemandLetter} from './demand-letter.js';
import {createValuationRevision} from './revisions.js';

test('creates human-review demand draft from governed valuation revision',()=>{
  const revision=createValuationRevision({
    kind:'market_value',
    createdBy:'appraiser@example.com',
    reason:'carrier_counter',
    result:{
      adjustedComparables:[],
      selectedComparableIds:['c1'],
      comparableAverage:32500,
      weightedBookAverage:null,
      preTaxValue:32500,
      tax:0,
      fixedFees:0,
      indicatedValue:32500,
      confidence:91,
      evidence:[],
    },
  });
  const letter=createDemandLetter({claimantName:'Jane Doe',insurerName:'Example Carrier',claimNumber:'CLM-1',vehicleDescription:'2022 Ford F-150',lossDate:'2026-09-01',valuation:revision});
  assert.match(letter,/\$32,500\.00/);
  assert.match(letter,/human review/i);
  assert.match(letter,/Claim CLM-1/);
});
