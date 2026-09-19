import { Pool } from 'pg';

export type ClaimsHandoffContext = {
  tenantId:string; inspectionId:string; claimId:string; assignmentId:string; estimateId:string;
  inspectionType:string; evidenceIds:string[]; findings:Record<string,unknown>; correlationId:string;
  sourceEventId:string; receivedAt:string;
};

export interface ClaimsHandoffContextRepository {
  get(tenantId:string,inspectionId:string):Promise<ClaimsHandoffContext|null>;
  save(context:ClaimsHandoffContext):Promise<ClaimsHandoffContext>;
}

export class InMemoryClaimsHandoffContextRepository implements ClaimsHandoffContextRepository {
  private readonly rows=new Map<string,ClaimsHandoffContext>();
  private key(t:string,i:string){return `${t}:${i}`;}
  async get(t:string,i:string){const v=this.rows.get(this.key(t,i));return v?structuredClone(v):null;}
  async save(c:ClaimsHandoffContext){const k=this.key(c.tenantId,c.inspectionId),existing=this.rows.get(k);if(existing)return structuredClone(existing);this.rows.set(k,structuredClone(c));return structuredClone(c);}
}

export class PostgresClaimsHandoffContextRepository implements ClaimsHandoffContextRepository {
  private readonly pool:Pool;
  constructor(connectionString:string){this.pool=new Pool({connectionString,max:4,idleTimeoutMillis:30000,connectionTimeoutMillis:5000});}
  async get(tenantId:string,inspectionId:string):Promise<ClaimsHandoffContext|null>{
    const r=await this.pool.query(`SELECT * FROM claims_handoff_context WHERE tenant_id=$1 AND inspection_id=$2 LIMIT 1`,[tenantId,inspectionId]);
    if(!r.rowCount)return null;const x=r.rows[0]!;
    return {tenantId:String(x.tenant_id),inspectionId:String(x.inspection_id),claimId:String(x.claim_id),assignmentId:String(x.assignment_id),estimateId:String(x.estimate_id),inspectionType:String(x.inspection_type),evidenceIds:Array.isArray(x.evidence_ids)?x.evidence_ids:[],findings:x.findings??{},correlationId:String(x.correlation_id),sourceEventId:String(x.source_event_id),receivedAt:new Date(x.received_at).toISOString()};
  }
  async save(c:ClaimsHandoffContext):Promise<ClaimsHandoffContext>{
    await this.pool.query(`INSERT INTO claims_handoff_context(tenant_id,inspection_id,claim_id,assignment_id,estimate_id,inspection_type,evidence_ids,findings,correlation_id,source_event_id,received_at)
    VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11)
    ON CONFLICT(tenant_id,inspection_id) DO NOTHING`,[c.tenantId,c.inspectionId,c.claimId,c.assignmentId,c.estimateId,c.inspectionType,JSON.stringify(c.evidenceIds),JSON.stringify(c.findings),c.correlationId,c.sourceEventId,c.receivedAt]);
    return (await this.get(c.tenantId,c.inspectionId))??c;
  }
  async health(){const r=await this.pool.query('SELECT 1 AS ok');return r.rows[0]?.ok===1;}
  async close(){await this.pool.end();}
}
