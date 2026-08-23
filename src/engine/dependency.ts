export type OperationDependency = {
  operationId: string;
  requires?: string[];
  includes?: string[];
  excludes?: string[];
  triggers?: string[];
  reason?: string;
  sourceRefs: string[];
};

export type DependencyAudit = {
  missingRequired: string[];
  conflicting: string[];
  triggered: string[];
};

export function auditDependencies(selected: string[], rules: OperationDependency[]): DependencyAudit {
  const chosen = new Set(selected);
  const missingRequired = new Set<string>();
  const conflicting = new Set<string>();
  const triggered = new Set<string>();

  for (const rule of rules) {
    if (!chosen.has(rule.operationId)) continue;

    for (const requirement of rule.requires ?? []) {
      if (!chosen.has(requirement)) missingRequired.add(requirement);
    }
    for (const included of rule.includes ?? []) {
      if (chosen.has(included)) conflicting.add(`${included} is included in ${rule.operationId}`);
    }
    for (const excluded of rule.excludes ?? []) {
      if (chosen.has(excluded)) conflicting.add(`${excluded} conflicts with ${rule.operationId}`);
    }
    for (const trigger of rule.triggers ?? []) triggered.add(trigger);
  }

  return {
    missingRequired: [...missingRequired],
    conflicting: [...conflicting],
    triggered: [...triggered]
  };
}
