import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {MemoryClaimsInspectionInbox,parseClaimsInspectionEvent,verifyClaimsWebhook} from './claims-inspection.js';
const body=JSON.stringify({id:'evt1',event_type:'inspection.ready_for_estimating',tenant_id:'t1',data:{claim_id:'c1',detail:{inspection_id:'i1',assignment_id:'a1',package_sha256:'a'.repeat(64)}},sent_at:'2026-09-19T16:00:00Z'});
test('verifies claims webhook signature',()=>{const secret='x'.repeat(32),sig='sha256='+createHmac('sha256',secret).update(body).digest('hex');assert.equal(verifyClaimsWebhook(secret,body,sig),true);assert.equal(verifyClaimsWebhook(secret,body,sig+'0'),false)});
test('parses governed estimating-ready event',()=>assert.equal(parseClaimsInspectionEvent(body).data.detail.inspection_id,'i1'));
test('inbox is idempotent',async()=>{const q=new MemoryClaimsInspectionInbox(),e=parseClaimsInspectionEvent(body);assert.equal((await q.accept(e,'k1')).replayed,false);assert.equal((await q.accept(e,'k1')).replayed,true)});
