export async function submitHybridJob(job,context={}){
  const endpoint=process.env.ELITE_HYBRID_COMPUTE_ENDPOINT;
  if(!endpoint) return {status:'local-contract-only',job};
  const url=new URL(endpoint);
  if(url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1') throw new Error('hybrid compute endpoint must use HTTPS outside local development');
  const payload={...job,tenantId:context.tenantId||job.tenantId,projectId:context.projectId||job.projectId,actorId:context.actorId||job.actorId,sourceApp:'elite-estimating'};
  if(!payload.tenantId||!payload.projectId) throw new Error('tenantId and projectId required');
  const headers={'content-type':'application/json'};
  if(process.env.ELITE_HYBRID_COMPUTE_TOKEN) headers.authorization=`Bearer ${process.env.ELITE_HYBRID_COMPUTE_TOKEN}`;
  const res=await fetch(url,{method:'POST',headers,body:JSON.stringify(payload)});
  if(!res.ok) throw new Error(`hybrid compute returned ${res.status}`);
  return res.json();
}
