import type { ValuationRevision } from './revisions.js';

export type DemandLetterInput = {
  claimantName?: string;
  insurerName?: string;
  claimNumber?: string;
  vehicleDescription?: string;
  lossDate?: string;
  valuation: ValuationRevision;
  requestedAmount?: number;
  responseDeadlineDays?: number;
  senderName?: string;
  senderCompany?: string;
};

const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);

export function createDemandLetter(input:DemandLetterInput):string{
  if(!input.valuation) throw new Error('valuation_revision_required');
  const result=input.valuation.result as Record<string,unknown>;
  const indicated=Number(result.indicatedValue ?? result.acv ?? result.diminishedValue ?? 0);
  if(!Number.isFinite(indicated)||indicated<=0) throw new Error('valid_valuation_required');
  const requested=Number(input.requestedAmount ?? indicated);
  const days=Math.max(1,Math.min(60,Number(input.responseDeadlineDays ?? 14)));
  const claimant=input.claimantName||'Claimant';
  const insurer=input.insurerName||'Insurance Carrier';
  const claim=input.claimNumber||'N/A';
  const vehicle=input.vehicleDescription||'subject vehicle';
  const loss=input.lossDate||'the reported loss date';
  const sender=[input.senderName,input.senderCompany].filter(Boolean).join(' — ')||'Authorized Appraiser/Representative';

  return [
    `Re: ${claimant} — Claim ${claim}`,
    '',
    `To ${insurer}:`,
    '',
    `This correspondence presents the documented valuation for the ${vehicle} arising from the loss dated ${loss}.`,
    `The current governed valuation revision (${input.valuation.id}) supports an indicated amount of ${money(indicated)}. The requested resolution amount is ${money(requested)}.`,
    '',
    'The valuation is supported by the attached comparable-vehicle evidence, adjustment calculations, source provenance, and report packet. Any response or countervaluation should identify the specific comparable, adjustment, condition, equipment, mileage, fee, tax, or source item being disputed so the record can be revised transparently rather than overwritten.',
    '',
    `Please provide a written response within ${days} days. This draft is intended for human review before transmission and does not itself constitute legal advice or an executed settlement demand.`,
    '',
    sender,
  ].join('\n');
}
