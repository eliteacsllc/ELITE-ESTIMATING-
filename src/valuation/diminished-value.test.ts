import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateDiminishedValue} from './diminished-value.js';

test('calculates diminished value with evidence-backed damage adjustments',()=>{
  const result=calculateDiminishedValue({
    subject:{mileage:30000,year:2023,make:'Lexus',model:'GX'},
    comparables:[
      {id:'c1',price:60000,mileage:31000,year:2023,make:'Lexus',model:'GX',source:'dealer',sourceUrl:'https://example.com/1',retrievedAt:'2026-09-16T00:00:00Z'},
      {id:'c2',price:62000,mileage:29000,year:2023,make:'Lexus',model:'GX',source:'dealer',sourceUrl:'https://example.com/2',retrievedAt:'2026-09-16T00:00:00Z'}
    ],
    policy:{mileageRatePerMile:0.08},
    damageAdjustments:[
      {label:'accident-history market penalty',amount:5000,source:'market-study'},
      {label:'structural repair stigma',amount:2500,evidenceId:'estimate-1'}
    ],
    postLossMarketEvidence:54000
  });
  assert.ok(result.preLoss.indicatedValue>0);
  assert.ok(result.diminishedValue>0);
  assert.ok(result.postLossIndicatedValue<result.preLoss.indicatedValue);
  assert.ok(result.confidence>=75);
  assert.equal(result.reviewRequired,false);
});

test('requires review when damage support is weak',()=>{
  const result=calculateDiminishedValue({
    subject:{year:2020,make:'Honda',model:'Accord'},
    comparables:[{id:'c1',price:20000,year:2020,make:'Honda',model:'Accord'}],
    damageAdjustments:[{label:'unsupported',amount:1500}]
  });
  assert.equal(result.reviewRequired,true);
});
