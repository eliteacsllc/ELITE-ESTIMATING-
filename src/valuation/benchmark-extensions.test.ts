import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeRepairEstimate} from './repair-estimate-analysis.js';
import {assetSearchPolicy,normalizeMultiAssetSubject} from './multi-asset.js';
import {redoValuationWithWiderSearch} from './redo.js';
import {createValuationRevision} from './revisions.js';
import type {ComparableProvider} from './provider.js';

test('analyzes repair estimate without auto-finalizing diminished value',()=>{
  const result=analyzeRepairEstimate({
    vehiclePreLossValue:40000,
    lines:[
      {description:'Replace left quarter panel',category:'body',operation:'replace',partsAmount:1800,laborAmount:1200},
      {description:'Frame rail repair',category:'frame',operation:'repair',laborAmount:2200,structural:true},
      {description:'ADAS camera calibration',category:'electrical',operation:'inspect',laborAmount:400,safetySystem:true},
    ],
  });
  assert.equal(result.severity,'severe');
  assert.ok(result.marketDamageAdjustmentSuggestion>0);
  assert.ok(result.reasons.length>=2);
});

test('uses wider market policies for specialty asset classes',()=>{
  assert.equal(assetSearchPolicy('heavy_equipment').mileageMetric,'hours');
  assert.ok(assetSearchPolicy('rv').initialRadiusMiles>assetSearchPolicy('passenger_auto').initialRadiusMiles);
  const normalized=normalizeMultiAssetSubject({assetClass:'heavy_equipment',manufacturer:'Caterpillar',series:'320',hours:4200});
  assert.equal(normalized.make,'Caterpillar');
  assert.equal(normalized.mileage,4200);
});

test('redo creates a superseding valuation revision from broader search',async()=>{
  const provider:ComparableProvider={
    name:'test-provider',
    async search(request){
      return {provider:'test-provider',searchedAt:new Date().toISOString(),radiusMiles:request.radiusMiles,comparables:[
        {id:'a',price:30000,mileage:50000,year:2021,make:'Ford',model:'F-150'},
        {id:'b',price:31000,mileage:49000,year:2021,make:'Ford',model:'F-150'},
      ]};
    },
  };
  const prior=createValuationRevision({kind:'market_value',createdBy:'u1',reason:'initial',result:{
    adjustedComparables:[],selectedComparableIds:['old'],comparableAverage:28000,weightedBookAverage:null,preTaxValue:28000,tax:0,fixedFees:0,indicatedValue:28000,confidence:60,evidence:[]
  }});
  const out=await redoValuationWithWiderSearch({priorRevision:prior,provider,subject:{year:2021,make:'Ford',model:'F-150',mileage:50000},requestedBy:'u2',startRadiusMiles:50,targetCount:2});
  assert.equal(out.revision.supersedesId,prior.id);
  assert.equal(out.search.radiusMiles,50);
  assert.ok(out.result.indicatedValue>0);
});
