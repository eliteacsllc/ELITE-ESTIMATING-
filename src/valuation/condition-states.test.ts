import { describe, expect, it } from 'vitest';
import { auditConditionState, conditionValueDeltas, validateConditionSequence, type ConditionStateRecord } from './condition-states.js';

const records: ConditionStateRecord[] = [
  {
    state:'post_loss_pre_repair',
    effectiveDate:'2026-04-01',
    evidence:[{id:'roof-photo',state:'post_loss_pre_repair',category:'structural',description:'Deteriorated roof substrate',strength:'photo',verified:true}],
    repairExpenditures:[{id:'roof',description:'Roof restoration',amount:9195,category:'restoration',verified:true,evidenceIds:['roof-invoice']}],
  },
  {
    state:'post_repair_as_is',
    effectiveDate:'2026-09-01',
    evidence:[{id:'current-photo',state:'post_repair_as_is',category:'market',description:'Current condition photos',strength:'photo',verified:true}],
    unresolvedDefects:[{id:'abs',label:'ABS warning remains illuminated',category:'safety',status:'diagnosis_pending'}],
  },
  {
    state:'corrected_operational',
    effectiveDate:'2026-09-01',
    evidence:[{id:'scenario',state:'corrected_operational',category:'market',description:'Hypothetical corrected-condition scenario',strength:'third_party_report',verified:true}],
  },
];

describe('condition state valuation',()=>{
  it('keeps repair spend separate from market-value recovery',()=>{
    expect(auditConditionState(records[0]).verifiedRepairSpend).toBe(9195);
    expect(conditionValueDeltas({
      post_loss_pre_repair:25000,
      post_repair_as_is:48000,
      corrected_operational:62000,
    })).toEqual({
      repairRecovery:23000,
      remainingValueGap:14000,
      totalRestorationPotential:37000,
      residualDiminishedValue:null,
    });
  });

  it('requires the before/current/corrected sequence',()=>{
    expect(validateConditionSequence(records)).toEqual([]);
    expect(validateConditionSequence(records.slice(0,2))).toContain('corrected_operational_state_missing');
  });

  it('computes residual DV only from pre-loss undamaged to post-repair as-is',()=>{
    expect(conditionValueDeltas({
      pre_loss_undamaged:65000,
      post_loss_pre_repair:25000,
      post_repair_as_is:58000,
      corrected_operational:62000,
    }).residualDiminishedValue).toBe(7000);
  });
});
