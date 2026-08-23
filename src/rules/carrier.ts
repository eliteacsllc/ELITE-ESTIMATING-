import type { Estimate } from '../domain/types.js';

export type CarrierRule = {
  id: string;
  description: string;
  severity: 'info' | 'warning' | 'block';
  applies: (estimate: Estimate) => boolean;
  message: string;
};

export type RuleFinding = {
  ruleId: string;
  severity: CarrierRule['severity'];
  message: string;
};

export function evaluateCarrierRules(estimate: Estimate, rules: CarrierRule[]): RuleFinding[] {
  return rules
    .filter((rule) => rule.applies(estimate))
    .map((rule) => ({ ruleId: rule.id, severity: rule.severity, message: rule.message }));
}

export function assertNoBlockingFindings(findings: RuleFinding[]): void {
  const blocking = findings.filter((finding) => finding.severity === 'block');
  if (blocking.length > 0) {
    throw new Error(`carrier_rules_blocked:${blocking.map((finding) => finding.ruleId).join(',')}`);
  }
}
