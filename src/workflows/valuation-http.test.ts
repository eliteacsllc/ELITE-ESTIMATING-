import test from 'node:test';
import assert from 'node:assert/strict';
import { handleEstimateWorkflowHttp } from './http.js';

const actor={userId:'adjuster@example.com',tenantId:'tenant-a',roles:['adjuster']} as never;

test('routes authenticated valuation request before estimate workflow paths',async()=>{
  let sent:{status:number;body:any}|null=null;
  const handled=await handleEstimateWorkflowHttp({
    req:{method:'POST'} as never,
    res:{} as never,
    actor,
    parts:['v1','valuations'],
    service:{} as never,
    send:(_res,status,body)=>{sent={status,body};},
    json:async()=>({
      kind:'market_value',
      claimId:'clm_1',
      subject:{year:2022,make:'Ford',model:'F-150',mileage:40000},
      comparables:[
        {id:'c1',price:40000,mileage:42000,year:2022,make:'Ford',model:'F-150',source:'dealer',sourceUrl:'https://example.com/c1',retrievedAt:'2026-09-16T00:00:00Z'},
        {id:'c2',price:42000,mileage:39000,year:2022,make:'Ford',model:'F-150',source:'dealer',sourceUrl:'https://example.com/c2',retrievedAt:'2026-09-16T00:00:00Z'}
      ],
      policy:{mileageRatePerMile:0.1}
    })
  });
  assert.equal(handled,true);
  assert.equal(sent?.status,200);
  assert.ok(sent?.body?.result?.indicatedValue>0);
  assert.equal(sent?.body?.revision?.claimId,'clm_1');
});
