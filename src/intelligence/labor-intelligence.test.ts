import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeLaborDependencies, actionableLaborFindings } from './labor-intelligence.js';
import type { Estimate } from '../domain/types.js';

const estimate:Estimate={id:'e1',tenantId:'t1',asset:{assetClass:'passenger_vehicle'},locale:'en-US',currency:'USD',jurisdiction:'MD',lines:[{id:'1',category:'body',component:'quarter panel',operation:'replace',quantity:1,total:{amountMinor:10000,currency:'USD'},humanApproved:true,provenance:[{provider:'customer',retrievedAt:'2026-10-01T00:00:00Z',licenseClass:'customer_provided'}]}],subtotal:{amountMinor:10000,currency:'USD'},tax:{amountMinor:0,currency:'USD'},total:{amountMinor:10000,currency:'USD'},status:'draft',revision:1,createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z'};

test('flags missing dependent labor and suppresses included operation',()=>{
 const rules=[{id:'cavity',trigger:{operation:'replace' as const,componentIncludes:['quarter']},suggested:{category:'materials',component:'cavity wax',operation:'install' as const,laborHours:0.3},disposition:'required' as const,rationale:'Quarter panel replacement may require corrosion protection.',evidenceNeeds:['oem_procedure' as const],authoritativeRefs:['OEM corrosion protection procedure']}];
 const first=analyzeLaborDependencies(estimate,rules);
 assert.equal(first[0]?.disposition,'required');
 assert.equal(actionableLaborFindings(first).length,1);
 const withLine={...estimate,lines:[...estimate.lines,{...estimate.lines[0]!,id:'2',category:'materials',component:'cavity wax',operation:'install' as const}]};
 assert.equal(analyzeLaborDependencies(withLine,rules)[0]?.disposition,'already_included');
});
