import { Pool } from 'pg';
import { validateEstimaticsEnvelope, type EstimaticsEnvelope } from './estimatics.js';

export type EstimaticsTrace = {
  claimId?: string;
  assignmentId?: string;
  inspectionId?: string;
  estimateId: string;
  correlationId: string;
};

export type EstimaticsEvidenceReceipt = {
  tenantId: string;
  estimateId: string;
  correlationId: string;
  claimId?: string;
  assignmentId?: string;
  inspectionId?: string;
  requestId: string;
  consumer: string;
  schemaVersion: string;
  sourceReceiptDigest: string;
  envelopeDigest: string;
  recordRefs: Array<{recordId:string;fingerprint:string}>;
  blockedRecordIds: string[];
  requiresHumanReview: boolean;
};

export function pinEstimaticsEvidence(
  input: unknown,
  tenantId: string,
  trace: EstimaticsTrace,
): EstimaticsEvidenceReceipt {
  const envelope = validateEstimaticsEnvelope(input, tenantId);
  if (!trace.estimateId.trim() || !trace.correlationId.trim()) throw new Error('estimatics_trace_identity_required');
  return {
    tenantId,
    estimateId: trace.estimateId.trim(),
    correlationId: trace.correlationId.trim(),
    ...(trace.claimId?.trim()?{claimId:trace.claimId.trim()}:{}),
    ...(trace.assignmentId?.trim()?{assignmentId:trace.assignmentId.trim()}:{}),
    ...(trace.inspectionId?.trim()?{inspectionId:trace.inspectionId.trim()}:{}),
    requestId: envelope.request_id,
    consumer: envelope.consumer,
    schemaVersion: envelope.schema_version,
    sourceReceiptDigest: envelope.source_receipt_digest,
    envelopeDigest: envelope.envelope_digest,
    recordRefs: envelope.items.map(item=>({recordId:item.record_id,fingerprint:item.fingerprint})),
    blockedRecordIds: [...envelope.blocked_record_ids],
    requiresHumanReview: envelope.requires_human_review,
  };
}

export interface EstimaticsEvidenceReceiptRepository {
  save(receipt: EstimaticsEvidenceReceipt): Promise<EstimaticsEvidenceReceipt>;
  listByEstimate(tenantId:string,estimateId:string): Promise<EstimaticsEvidenceReceipt[]>;
}

export class InMemoryEstimaticsEvidenceReceiptRepository implements EstimaticsEvidenceReceiptRepository {
  private rows = new Map<string,EstimaticsEvidenceReceipt>();
  private key(r:EstimaticsEvidenceReceipt){return `${r.tenantId}:${r.estimateId}:${r.envelopeDigest}`;}
  async save(receipt:EstimaticsEvidenceReceipt){
    const key=this.key(receipt),existing=this.rows.get(key);
    if(existing) return structuredClone(existing);
    this.rows.set(key,structuredClone(receipt));
    return structuredClone(receipt);
  }
  async listByEstimate(tenantId:string,estimateId:string){
    return [...this.rows.values()].filter(r=>r.tenantId===tenantId&&r.estimateId===estimateId).map(r=>structuredClone(r));
  }
}

export class PostgresEstimaticsEvidenceReceiptRepository implements EstimaticsEvidenceReceiptRepository {
  private pool:Pool;
  constructor(connectionString:string){this.pool=new Pool({connectionString,max:4,idleTimeoutMillis:30000,connectionTimeoutMillis:5000});}
  async save(r:EstimaticsEvidenceReceipt){
    await this.pool.query(`INSERT INTO estimatics_evidence_receipts(
      tenant_id,estimate_id,correlation_id,claim_id,assignment_id,inspection_id,request_id,consumer,schema_version,
      source_receipt_digest,envelope_digest,record_refs,blocked_record_ids,requires_human_review
    ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13::jsonb,$14)
    ON CONFLICT(tenant_id,estimate_id,envelope_digest) DO NOTHING`,[
      r.tenantId,r.estimateId,r.correlationId,r.claimId??null,r.assignmentId??null,r.inspectionId??null,
      r.requestId,r.consumer,r.schemaVersion,r.sourceReceiptDigest,r.envelopeDigest,
      JSON.stringify(r.recordRefs),JSON.stringify(r.blockedRecordIds),r.requiresHumanReview
    ]);
    const rows=await this.listByEstimate(r.tenantId,r.estimateId);
    const saved=rows.find(x=>x.envelopeDigest===r.envelopeDigest);
    if(!saved) throw new Error('estimatics_receipt_persistence_failed');
    return saved;
  }
  async listByEstimate(tenantId:string,estimateId:string){
    const result=await this.pool.query(`SELECT * FROM estimatics_evidence_receipts
      WHERE tenant_id=$1 AND estimate_id=$2 ORDER BY created_at ASC`,[tenantId,estimateId]);
    return result.rows.map(x=>({
      tenantId:String(x.tenant_id),estimateId:String(x.estimate_id),correlationId:String(x.correlation_id),
      ...(x.claim_id?{claimId:String(x.claim_id)}:{}),...(x.assignment_id?{assignmentId:String(x.assignment_id)}:{}),
      ...(x.inspection_id?{inspectionId:String(x.inspection_id)}:{}),requestId:String(x.request_id),consumer:String(x.consumer),
      schemaVersion:String(x.schema_version),sourceReceiptDigest:String(x.source_receipt_digest),envelopeDigest:String(x.envelope_digest),
      recordRefs:Array.isArray(x.record_refs)?x.record_refs:[],blockedRecordIds:Array.isArray(x.blocked_record_ids)?x.blocked_record_ids:[],
      requiresHumanReview:Boolean(x.requires_human_review)
    }));
  }
  async close(){await this.pool.end();}
}
