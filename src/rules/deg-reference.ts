export type DegRuleAction = 'require_separate_line' | 'manual_evaluation' | 'prevent_duplicate' | 'display_reference' | 'require_note_review';

export type DegReferenceRule = {
  id: string;
  provider: 'CCC_MOTOR' | 'AUDATEX' | 'MITCHELL' | 'GENERAL';
  title: string;
  sourceUrl: string;
  inquiryId?: string;
  publishedAt?: string;
  effectiveModelYearFrom?: number;
  tags: string[];
  action: DegRuleAction;
  summary: string;
};

// Derived factual/indexing metadata only. Do not store copied DEG articles or proprietary P-page tables here.
export const DEG_REFERENCE_RULES: DegReferenceRule[] = [
  {
    id: 'deg-ccc-footnote-inclusion-review',
    provider: 'CCC_MOTOR',
    title: 'CCC labor note and Guide inclusion review',
    sourceUrl: 'https://degweb.org/ccc-motor-pathways/',
    tags: ['footnote', 'included', 'not-included', 'ccc'],
    action: 'require_note_review',
    summary: 'Review vehicle-specific CCC labor notes/footnotes and MOTOR included/not-included guidance before deciding whether related operations require separate labor.',
  },
  {
    id: 'deg-ccc-blank-labor-manual-evaluation',
    provider: 'CCC_MOTOR',
    title: 'CCC blank labor field',
    sourceUrl: 'https://degweb.org/ccc-motor-pathways/',
    tags: ['blank-labor', 'manual-entry', 'ccc'],
    action: 'manual_evaluation',
    summary: 'A blank labor field may represent a not-included operation without an assigned database labor value; estimator evaluation and documented manual labor may be needed.',
  },
  {
    id: 'deg-ccc-radiator-support-2027',
    provider: 'CCC_MOTOR',
    title: 'Radiator support mechanical components',
    sourceUrl: 'https://degweb.org/estimate-tip-radiator-supports-mechanical-components/',
    publishedAt: '2026-08-21',
    effectiveModelYearFrom: 2027,
    tags: ['radiator-support', 'mechanical', 'r&i', 'r&r'],
    action: 'require_separate_line',
    summary: 'For 2027+ vehicles, attached mechanical component R&I/R&R is not automatically included in radiator-support replacement labor and should be evaluated as separate operations using current labor notes.',
  },
  {
    id: 'deg-ccc-weld-zone-41711',
    provider: 'CCC_MOTOR',
    title: 'Adjacent weld-zone repair/refinish',
    sourceUrl: 'https://degweb.org/estimate-tip-cccone-web-welded-seams-weld-zone-repair-and-refinish/',
    inquiryId: '41711',
    publishedAt: '2026-08-02',
    tags: ['weld', 'quarter-panel', 'refinish', 'adjacent-panel'],
    action: 'manual_evaluation',
    summary: 'Published replacement time may address finishing the replacement-panel seam while repair/refinish of damage to adjacent attaching-panel weld zones requires case-specific evaluation.',
  },
];

export function findDegReferenceRules(input: { provider?: DegReferenceRule['provider']; modelYear?: number; text?: string }): DegReferenceRule[] {
  const text = input.text?.toLowerCase().trim();
  return DEG_REFERENCE_RULES.filter((rule) => {
    if (input.provider && rule.provider !== input.provider && rule.provider !== 'GENERAL') return false;
    if (rule.effectiveModelYearFrom && input.modelYear && input.modelYear < rule.effectiveModelYearFrom) return false;
    if (text && ![rule.title, rule.summary, ...rule.tags].some((value) => value.toLowerCase().includes(text))) return false;
    return true;
  });
}
