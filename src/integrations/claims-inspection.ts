import { createHmac, timingSafeEqual } from 'node:crypto';
import { Pool } from 'pg';
import type { AssetIdentity } from '../domain/types.js';

export type ClaimsInspectionEvent = {
  id: string;
  event_type: 'inspection.ready_for_estimating';
  tenant_id: string;
  data: {
    claim_id: string;
    detail: {
      inspection_id: string;
      assignment_id?: string;
      package_sha256: string;
      estimating_payload: {
        schema: 'claims-inspection-estimating/v1';
        inspection_type: 'automotive'|'property';
        service_requested: string;
        asset: AssetIdentity;
        evidence_refs: Array<{documentId:string;sha256:string;type:string;source:string}>;
        findings: Array<Record<string,unknown>>;
      };
    };
    created_at?: string;
  };
  sent_at: string;
};

export type ClaimsInspectionInboxRow = {
  eventId:string; tenantId:string; claimId:string; inspectionId:string; assignmentId?:string;
  packageSha256:string; idempotencyKey:string; status:'queued'|'processed'|'rejected'; estimateId?:string;
};

const SHA=/^[a-f0-9]{64}$/i;
const text=(v:unknown,n=240)=>String(v??'').trim().slice(0,n);

export function verifyClaimsWebhook(secret:string,raw:string,signature:string):boolean {
  if(secret.length<32 || !signature.startsWith('sha256=')) return false;
  const expected=Buffer.from('sha256='+createHmac('sha256',secret).update(raw).digest('hex'));
  const supplied=Buffer.from(signature);
  return expected.length===supplied.length && timingSafeEqual(expected,supplied);
}

export function parseClaimsInspectionEvent(raw:string):ClaimsInspectionEvent {
  const b=JSON.parse(raw) as Partial<ClaimsInspectionEvent>;
  if(b.event_type!=='inspection.ready_for_estimating') throw new Error('unsupported_claims_event');
  if(!text(b.id)||!text(b.tenant_id)||!text(b.sent_at)) throw new Error('claims_event_fields_required');
  const d=b.data, detail=d?.detail;
  if(!d || !text(d.claim_id) || !detail || !text(detail.inspection_id)) throw new Error('claims_inspection_fields_required');
  if(!SHA.test(text(detail.package_sha256,64))) throw new Error('invalid_package_sha256');
  const payload=detail.estimating_payload;
  if(!payload||payload.schema!=='claims-inspection-estimating/v1'||!payload.asset||!text(payload.asset.assetClass,60)) throw new Error('claims_estimating_payload_required');
  if(!Array.isArray(payload.evidence_refs)||payload.evidence_refs.some(ref=>!text(ref?.documentId)||!SHA.test(text(ref?.sha256,64)))) throw new Error('invalid_claims_evidence_refs');
  if(!Array.isArray(payload.findings)) throw new Error('invalid_claims_findings');
  if(!Number.isFinite(Date.parse(String(b.sent_at)))) throw new Error('invalid_sent_at');
  return b as ClaimsInspectionEvent;
}

export interface ClaimsInspectionInbox {
  accept(event:ClaimsInspectionEvent,idempotencyKey:string):Promise<{replayed:boolean;row:ClaimsInspectionInboxRow}>;
  markProcessed(tenantId:string,idempotencyKey:string,estimateId:string):Promise<ClaimsInspectionInboxRow>;
}
export class MemoryClaimsInspectionInbox implements ClaimsInspectionInbox {
  private rows=new Map<string,ClaimsInspectionInboxRow>();
  async accept(event:ClaimsInspectionEvent,idempotencyKey:string){
    const key=event.tenant_id+':'+idempotencyKey, old=this.rows.get(key);
    if(old) return {replayed:true,row:structuredClone(old)};
    const row:ClaimsInspectionInboxRow={eventId:event.id,tenantId:event.tenant_id,claimId:event.data.claim_id,inspectionId:event.data.detail.inspection_id,...(event.data.detail.assignment_id?{assignmentId:event.data.detail.assignment_id}:{}),packageSha256:event.data.detail.package_sha256,idempotencyKey,status:'queued'};
    this.rows.set(key,row); return {replayed:false,row:structuredClone(row)};
  }
  async markProcessed(tenantId:string,idempotencyKey:string,estimateId:string){
    const key=tenantId+':'+idempotencyKey,row=this.rows.get(key); if(!row) throw new Error('claims_inbox_not_found');
    const updated:ClaimsInspectionInboxRow={...row,status:'processed',estimateId}; this.rows.set(key,updated); return structuredClone(updated);
  }
}
export class PostgresClaimsInspectionInbox implements ClaimsInspectionInbox {
  private pool:Pool;
  constructor(connectionString:string){this.pool=new Pool({connectionString,max:4,idleTimeoutMillis:30000,connectionTimeoutMillis:5000});}
  async accept(event:ClaimsInspectionEvent,idempotencyKey:string){
    const args=[event.id,event.tenant_id,event.data.claim_id,event.data.detail.inspection_id,event.data.detail.assignment_id??null,event.data.detail.package_sha256,idempotencyKey,JSON.stringify(event)];
    const insert=await this.pool.query(`INSERT INTO claims_inspection_inbox(event_id,tenant_id,claim_id,inspection_id,assignment_id,package_sha256,idempotency_key,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT (tenant_id,idempotency_key) DO NOTHING RETURNING *`,args);
    const raw=insert.rows[0]??(await this.pool.query('SELECT * FROM claims_inspection_inbox WHERE tenant_id=$1 AND idempotency_key=$2',[event.tenant_id,idempotencyKey])).rows[0];
    if(!raw) throw new Error('claims_inbox_persistence_failed');
    if(raw.event_id!==event.id || raw.package_sha256!==event.data.detail.package_sha256) throw new Error('claims_inbox_replay_conflict');
    const row:ClaimsInspectionInboxRow={eventId:raw.event_id,tenantId:raw.tenant_id,claimId:raw.claim_id,inspectionId:raw.inspection_id,...(raw.assignment_id?{assignmentId:raw.assignment_id}:{}),packageSha256:raw.package_sha256,idempotencyKey:raw.idempotency_key,status:raw.status,...(raw.estimate_id?{estimateId:String(raw.estimate_id)}:{})};
    return {replayed:insert.rowCount===0,row};
  }
  async markProcessed(tenantId:string,idempotencyKey:string,estimateId:string){
    const result=await this.pool.query(`UPDATE claims_inspection_inbox SET status='processed',processed_at=NOW(),estimate_id=$3 WHERE tenant_id=$1 AND idempotency_key=$2 AND status IN ('queued','processed') RETURNING *`,[tenantId,idempotencyKey,estimateId]);
    const raw=result.rows[0]; if(!raw) throw new Error('claims_inbox_not_found');
    if(raw.estimate_id!==estimateId) throw new Error('claims_inbox_estimate_conflict');
    return {eventId:raw.event_id,tenantId:raw.tenant_id,claimId:raw.claim_id,inspectionId:raw.inspection_id,...(raw.assignment_id?{assignmentId:raw.assignment_id}:{}),packageSha256:raw.package_sha256,idempotencyKey:raw.idempotency_key,status:raw.status,estimateId:String(raw.estimate_id)};
  }
}
