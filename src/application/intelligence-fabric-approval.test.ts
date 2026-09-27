import test from 'node:test';
import assert from 'node:assert/strict';
import { IntelligenceFabricClient } from '../intelligence/intelligence-fabric-client.js';

test('estimate release preflight carries human-approval requirement', async () => {
  let request:any;
  const client=new IntelligenceFabricClient({
    baseUrl:'https://blackbox.example',apiKey:'secret',tenantId:'tenant-a',
    fetchImpl:async(_url,init)=>{
      request=JSON.parse(String(init?.body));
      return new Response(JSON.stringify({allowed:true,supported:true,requiresHumanApproval:true,reasons:[]}),{status:200,headers:{'content-type':'application/json'}});
    }
  });
  const decision=await client.preflight({requestId:'r1',subjectId:'estimate-1',domain:'estimating',capability:'estimate.release',actorId:'reviewer-1',input:{},requiresHumanApproval:true});
  assert.equal(request.capability,'estimate.release');
  assert.equal(request.requiresHumanApproval,true);
  assert.equal(decision.supported,true);
});
