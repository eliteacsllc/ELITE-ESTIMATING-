import { buildEstimateQaHandoff, type ClaimEstimateSnapshot, type ValuationEvidence } from "./claims-platform.js";

export type ClaimsPlatformClientConfig = {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export class ClaimsPlatformClient {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly config: ClaimsPlatformClientConfig) {
    if (!config.baseUrl) throw new Error("claims_platform_url_required");
    if (!config.token || config.token.length < 32) throw new Error("claims_platform_token_required");
    this.fetchImpl=config.fetchImpl ?? fetch;
  }

  async sendEstimateSnapshot(snapshot: ClaimEstimateSnapshot): Promise<{delivered:true}> {
    const event=buildEstimateQaHandoff(snapshot);
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),this.config.timeoutMs ?? 15_000);
    try{
      const response=await this.fetchImpl(this.config.baseUrl.replace(/\/$/,"")+"/api/claims-platform/events",{
        method:"POST",
        headers:{
          "content-type":"application/json",
          "authorization":`Bearer ${this.config.token}`,
          "x-tenant-id":snapshot.tenantId
        },
        body:JSON.stringify(event),
        signal:controller.signal
      });
      if(!response.ok){
        const body=(await response.text()).slice(0,1000);
        throw new Error(`claims_platform_delivery_failed:${response.status}:${body}`);
      }
      return {delivered:true};
    }finally{clearTimeout(timer)}
  }
}

export function claimsPlatformClientFromEnv(): ClaimsPlatformClient | null {
  const baseUrl=process.env.CLAIMS_PLATFORM_URL?.trim()||process.env.CLAIMS_MANAGEMENT_URL?.trim()||"";
  const token=process.env.CLAIMS_PLATFORM_EVENT_TOKEN?.trim()||"";
  if(!baseUrl||!token)return null;
  return new ClaimsPlatformClient({baseUrl,token});
}

export function normalizeValuationEvidence(value: unknown): ValuationEvidence[] {
  if(!Array.isArray(value))return [];
  return value.slice(0,100).map((item:any)=>({
    id:String(item?.id||item?.evidenceRef||"").trim(),
    kind:String(item?.kind||"other").trim() as ValuationEvidence["kind"],
    provider:String(item?.provider||item?.source||"").trim(),
    sourceRecordId:item?.sourceRecordId?String(item.sourceRecordId).trim():undefined,
    retrievedAt:String(item?.retrievedAt||item?.observedAt||new Date().toISOString()),
    region:item?.region?String(item.region).trim():undefined,
    licenseClass:String(item?.licenseClass||"internal") as ValuationEvidence["licenseClass"],
    confidence:Number(item?.confidence??1)
  }));
}
