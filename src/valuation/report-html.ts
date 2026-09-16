import type { ReportPacket } from './report-packet.js';

const ESCAPE_MAP:Record<string,string>={"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"};
const esc=(value:unknown)=>String(value??'').replace(/[&<>"']/g,ch=>ESCAPE_MAP[ch]??ch);
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n)||0);

export function renderValuationReportHtml(packet:ReportPacket):string{
  const title=packet.reportType==='diminished_value'?'Diminished Value Report':'Fair Market Value Report';
  const rows=packet.comparables.map(c=>`<tr><td>${esc(c.id)}</td><td>${money(c.price)}</td><td>${money(c.adjustedPrice)}</td><td>${esc(c.matchScore)}</td><td>${esc(c.source||'')}</td></tr>`).join('');
  const methods=packet.methodology.map(m=>`<li>${esc(m)}</li>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;max-width:960px;margin:40px auto;padding:0 24px;color:#111}h1,h2{margin-bottom:8px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0}.card{border:1px solid #ccc;border-radius:8px;padding:12px}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #ddd;padding:8px;text-align:left}small{color:#555}@media print{body{margin:0;max-width:none}.no-print{display:none}}</style></head><body><h1>${esc(title)}</h1><small>Generated ${esc(packet.generatedAt)}</small><h2>Subject</h2><p>${esc([packet.subject.year,packet.subject.make,packet.subject.model,packet.subject.trim].filter(Boolean).join(' '))}</p><div class="summary"><div class="card"><strong>Indicated Value</strong><br>${money(packet.summary.indicatedValue)}</div><div class="card"><strong>Confidence</strong><br>${esc(packet.summary.confidence)}%</div><div class="card"><strong>Review</strong><br>${packet.summary.reviewRequired?'Required':'Eligible for approval'}</div></div><h2>Comparables</h2><table><thead><tr><th>ID</th><th>Listed</th><th>Adjusted</th><th>Match</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table><h2>Methodology</h2><ol>${methods}</ol><h2>Disclosure</h2><p>${esc(packet.disclosure)}</p></body></html>`;
}
