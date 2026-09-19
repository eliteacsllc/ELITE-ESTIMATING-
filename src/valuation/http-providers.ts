import type { ComparableProvider, ComparableSearchRequest, ComparableSearchResult } from './provider.js';
import type { ComparableEvidenceCaptureProvider, ComparableEvidenceCaptureRequest, ComparableEvidenceCaptureResult } from './evidence-capture.js';
import { validateComparableEvidenceCapture } from './evidence-capture.js';

function normalizeBase(baseUrl:string):string{
  const value=String(baseUrl||'').trim().replace(/\/+$/,'');
  if(!/^https:\/\//i.test(value)&&!/^http:\/\/localhost(?::\d+)?$/i.test(value))throw new Error('provider_url_invalid');
  return value;
}

async function readJson(response:Response):Promise<Record<string,unknown>>{
  try{return await response.json() as Record<string,unknown>}catch{throw new Error('provider_invalid_json')}
}

export class CanonicalHttpComparableProvider implements ComparableProvider{
  readonly name:string;
  private readonly baseUrl:string;
  private readonly token:string;
  constructor(input:{name:string;baseUrl:string;token:string}){
    this.name=input.name.trim()||'canonical-http-comparable-provider';
    this.baseUrl=normalizeBase(input.baseUrl);
    this.token=input.token.trim();
    if(!this.token)throw new Error('provider_token_required');
  }
  async search(request:ComparableSearchRequest):Promise<ComparableSearchResult>{
    const response=await fetch(`${this.baseUrl}/comparables/search`,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${this.token}`},body:JSON.stringify(request)});
    const payload=await readJson(response);
    if(!response.ok)throw new Error(`comparable_provider_rejected:${response.status}`);
    if(!Array.isArray(payload.comparables))throw new Error('comparable_provider_invalid_response');
    return {
      provider:String(payload.provider||this.name),
      searchedAt:String(payload.searchedAt||new Date().toISOString()),
      radiusMiles:Number(payload.radiusMiles??request.radiusMiles),
      comparables:payload.comparables as never,
      sourceRequestId:typeof payload.sourceRequestId==='string'?payload.sourceRequestId:undefined,
    };
  }
}

export class CanonicalHttpEvidenceCaptureProvider implements ComparableEvidenceCaptureProvider{
  readonly name:string;
  private readonly baseUrl:string;
  private readonly token:string;
  constructor(input:{name:string;baseUrl:string;token:string}){
    this.name=input.name.trim()||'canonical-http-evidence-capture';
    this.baseUrl=normalizeBase(input.baseUrl);
    this.token=input.token.trim();
    if(!this.token)throw new Error('provider_token_required');
  }
  async capture(request:ComparableEvidenceCaptureRequest):Promise<ComparableEvidenceCaptureResult>{
    const response=await fetch(`${this.baseUrl}/evidence/capture`,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${this.token}`},body:JSON.stringify(request)});
    const payload=await readJson(response);
    if(!response.ok)throw new Error(`evidence_capture_provider_rejected:${response.status}`);
    return validateComparableEvidenceCapture({
      comparableId:String(payload.comparableId||request.comparableId),
      sourceUrl:String(payload.sourceUrl||request.sourceUrl),
      capturedAt:String(payload.capturedAt||new Date().toISOString()),
      contentType:String(payload.contentType||''),
      storageKey:String(payload.storageKey||''),
      sha256:String(payload.sha256||''),
      provider:String(payload.provider||this.name),
    });
  }
}
