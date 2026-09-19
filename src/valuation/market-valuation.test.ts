import test from 'node:test';
import assert from 'node:assert/strict';
import {adjustComparable,calculateMarketValuation,suggestSearchRadius,weightedAverage} from './market-valuation.js';

test('adjusts mileage, options, equipment and depreciation',()=>{
  const adjusted=adjustComparable(
    {mileage:40000,year:2022,make:'Ford',model:'F-150',trim:'Lariat',options:['sunroof'],equipment:['bedliner']},
    {id:'c1',price:40000,mileage:50000,year:2022,make:'Ford',model:'F-150',trim:'Lariat',options:[],equipment:[],distanceMiles:25},
    {mileageRatePerMile:0.10,optionValues:{sunroof:800},equipmentValues:{bedliner:300},depreciationPercent:1}
  );
  assert.equal(adjusted.adjustments.mileage,1000);
  assert.equal(adjusted.adjustments.options,800);
  assert.equal(adjusted.adjustments.equipment,300);
  assert.equal(adjusted.adjustments.depreciation,-400);
  assert.equal(adjusted.adjustedPrice,41700);
  assert.ok(adjusted.matchScore>90);
});

test('blends selected comparables with weighted book sources and fees',()=>{
  const result=calculateMarketValuation({
    subject:{mileage:40000,year:2022,make:'Ford',model:'F-150',trim:'Lariat'},
    comparables:[
      {id:'a',price:40000,mileage:42000,year:2022,make:'Ford',model:'F-150',trim:'Lariat',source:'dealer-a',sourceUrl:'https://example.com/a',retrievedAt:'2026-09-16T00:00:00Z'},
      {id:'b',price:42000,mileage:39000,year:2022,make:'Ford',model:'F-150',trim:'Lariat',source:'dealer-b',sourceUrl:'https://example.com/b',retrievedAt:'2026-09-16T00:00:00Z'}
    ],
    bookSources:[{name:'licensed-guide-a',value:41000,weight:2},{name:'licensed-guide-b',value:43000,weight:1}],
    policy:{mileageRatePerMile:0.10,taxPercent:6,fixedFees:350},
    blendBookWeight:0.25
  });
  assert.equal(result.selectedComparableIds.length,2);
  assert.equal(result.weightedBookAverage,41666.67);
  assert.ok(result.indicatedValue>result.preTaxValue);
  assert.ok(result.confidence>70);
  assert.equal(result.evidence.length,4);
});

test('auto expansion grows radius only until target volume is met',()=>{
  assert.equal(suggestSearchRadius(2,25,6),50);
  assert.equal(suggestSearchRadius(3,100,6),200);
  assert.equal(suggestSearchRadius(6,100,6),100);
  assert.equal(suggestSearchRadius(0,400,6,500),500);
});

test('weightedAverage rejects unusable inputs',()=>{
  assert.equal(weightedAverage([]),null);
  assert.equal(weightedAverage([{name:'a',value:100,weight:0}]),null);
  assert.equal(weightedAverage([{name:'a',value:100,weight:1},{name:'b',value:200,weight:3}]),175);
});
