import test from 'node:test';
import assert from 'node:assert/strict';
import { ExternalEstimateImportService } from './external-estimate-import.js';
import { EstimatingService } from '../application/estimating-service.js';
import { InMemoryEstimateRepository } from '../persistence/memory.js';
import { InMemoryImportReceiptRepository } from './import-repository.js';
import type { Principal } from '../security/rbac.js';

const principal: Principal={userId:'estimator-1',tenantId:'tenant-1',roles:['tenant_admin']};

test('imports a governed CCC-style normalized estimate and is idempotent', async()=>{
 const estimates=new InMemoryEstimateRepository();
 const service=new ExternalEstimateImportService(new EstimatingService(estimates),estimates,new InMemoryImportReceiptRepository());
 const input={
  provider:'ccc' as const,sourceEstimateId:'CCC-123',asset:{assetClass:'passenger_vehicle' as const,vin:'1HGCM82633A004352'},
  currency:'USD',jurisdiction:'MD',
  lines:[{sourceLineId:'1',category:'body',component:'front radar sensor',operation:'replace',quantity:1,procedureRefs:['oem-radar'],safetyCritical:true,confidence:.9,provenance:[{provider:'customer-export',sourceId:'CCC-123:1',retrievedAt:'2026-10-01T00:00:00Z',licenseClass:'customer_provided' as const}]}]
 };
 const first=await service.import(principal,input);
 assert.equal(first.idempotent,false);
 assert.equal(first.estimate.lines[0]?.humanApproved,false);
 assert.ok(first.completeness.candidates.some(x=>x.code==='review:diagnostic_scan'));
 const second=await service.import(principal,input);
 assert.equal(second.idempotent,true);
 assert.equal(second.estimate.id,first.estimate.id);
});
