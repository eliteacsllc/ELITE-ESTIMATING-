import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateAcv,ACV_METHOD_VERSION} from './acv-engine.js';
import {evaluateJurisdiction} from './jurisdiction.js';
import {evaluateValuationRelease} from './release-gate.js';

test('ACV engine keeps unsupported files in human review',()=>{
  const result=calculateAcv({
    subject:{year:2024,make:'Toyota',model:'Camry',mileage:12000},
    comparables:[
      {id:'a',price:30000,year:2024,make:'Toyota',model:'Camry',mileage:13000,source:'dealer',sourceUrl:'https://example.com/a',retrievedAt:'2026-09-25T00:00:00Z'},
      {id:'b',price:30500,year:2024,make:'Toyota',model:'Camry',mileage:11000,source:'dealer',sourceUrl:'https://example.com/b',retrievedAt:'2026-09-25T00:00:00Z'},
      {id:'c',price:30250,year:2024,make:'Toyota',model:'Camry',mileage:12500,source:'dealer',sourceUrl:'https://example.com/c',retrievedAt:'2026-09-25T00:00:00Z'}
    ]
  });
  assert.equal(result.methodVersion,ACV_METHOD_VERSION);
  assert.equal(result.reviewRequired,true);
  assert.ok(result.reviewReasons.includes('condition_review_incomplete'));
});

test('jurisdiction rules are versionable and source-governed',()=>{
  const d=evaluateJurisdiction({
    rule:{id:'md-v1',jurisdiction:'MD',effectiveFrom:'2026-01-01',claimTypes:['third_party'],allowsDiminishedValue:true,requiresLiabilityAcceptance:true,sourceRefs:['regulator-guidance'],reviewedBy:'legal',reviewedAt:'2026-09-25T00:00:00Z'},
    lossDate:'2026-09-01',
    claimType:'third_party',
    kind:'diminished_value',
    liabilityAccepted:true
  });
  assert.equal(d.applicable,true);
  assert.equal(d.reviewRequired,false);
});

test('release gate blocks files without jurisdiction governance',()=>{
  const result=calculateAcv({
    subject:{year:2024,make:'Toyota',model:'Camry'},
    comparables:[
      {id:'a',price:30000,year:2024,make:'Toyota',model:'Camry'},
      {id:'b',price:30100,year:2024,make:'Toyota',model:'Camry'},
      {id:'c',price:30200,year:2024,make:'Toyota',model:'Camry'}
    ]
  });
  const gate=evaluateValuationRelease({kind:'acv',subject:{year:2024,make:'Toyota',model:'Camry'},result,methodologyVersion:result.methodVersion});
  assert.equal(gate.status,'blocked');
  assert.ok(gate.reasons.includes('jurisdiction_rule_missing'));
});
