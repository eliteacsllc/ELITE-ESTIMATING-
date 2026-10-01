import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEstimaticsCompletenessQuery } from './estimatics-completeness.js';
import type { Estimate } from '../domain/types.js';

const estimate: Estimate={
 id:'e1',tenantId:'t1',asset:{assetClass:'passenger_vehicle',year:2024,make:'Honda',model:'Accord',vin:'1HGCM82633A004352',jurisdiction:'MD'},
 locale:'en-US',currency:'USD',jurisdiction:'MD',status:'review',revision:1,createdAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z',
 subtotal:{amountMinor:0,currency:'USD'},tax:{amountMinor:0,currency:'USD'},total:{amountMinor:0,currency:'USD'},
 lines:[{id:'1',category:'body',component:'front radar sensor',operation:'replace',quantity:1,total:{amountMinor:0,currency:'USD'},procedureRefs:['oem-radar'],safetyCritical:true,humanApproved:true,provenance:[{provider:'OEM',retrievedAt:'2026-10-01T00:00:00Z',licenseClass:'licensed'}]}]
};
test('builds evidence lookup kinds from completeness findings',()=>{
 const q=buildEstimaticsCompletenessQuery(estimate);
 assert.equal(q.year,2024);assert.equal(q.make,'Honda');assert.ok(q.kinds?.includes('calibration'));assert.ok(q.kinds?.includes('scan'));
});
