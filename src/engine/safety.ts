import type { AssetIdentity, EstimateLine } from '../domain/types.js';

export type SafetyRequirement = {
  id: string;
  kind: 'pre_scan' | 'post_scan' | 'calibration' | 'measurement' | 'oem_procedure' | 'one_time_use' | 'structural_review';
  reason: string;
  mandatory: boolean;
};

export type SafetyRule = {
  id: string;
  assetClasses?: AssetIdentity['assetClass'][];
  componentPattern?: RegExp;
  operation?: EstimateLine['operation'][];
  requirements: Omit<SafetyRequirement, 'id'>[];
};

export function inferSafetyRequirements(asset: AssetIdentity, lines: EstimateLine[], rules: SafetyRule[]): SafetyRequirement[] {
  const results: SafetyRequirement[] = [];
  for (const line of lines) {
    for (const rule of rules) {
      if (rule.assetClasses && !rule.assetClasses.includes(asset.assetClass)) continue;
      if (rule.componentPattern && !rule.componentPattern.test(line.component)) continue;
      if (rule.operation && !rule.operation.includes(line.operation)) continue;
      for (const requirement of rule.requirements) {
        results.push({ id: `${rule.id}:${line.id}:${requirement.kind}`, ...requirement });
      }
    }
  }
  return [...new Map(results.map((item) => [item.id, item])).values()];
}

export const baselineVehicleSafetyRules: SafetyRule[] = [
  {
    id: 'adas-bumper-randr',
    assetClasses: ['passenger_vehicle','commercial_vehicle','tractor_trailer','rv','ambulance_emergency'],
    componentPattern: /(bumper|grille|windshield|mirror|radar|camera|sensor)/i,
    operation: ['replace','remove_install','remove_replace','repair'],
    requirements: [
      { kind: 'oem_procedure', reason: 'Potential sensor/ADAS interaction requires procedure verification.', mandatory: true },
      { kind: 'post_scan', reason: 'Electronic systems must be checked after affected repair operations.', mandatory: true },
      { kind: 'calibration', reason: 'Verify whether OEM calibration is required for affected ADAS components.', mandatory: true },
    ],
  },
  {
    id: 'structural-measurement',
    assetClasses: ['passenger_vehicle','commercial_vehicle','tractor_trailer','heavy_equipment','rv','ambulance_emergency','crane_specialty'],
    componentPattern: /(frame|rail|pillar|apron|unibody|cab structure|boom|chassis)/i,
    operation: ['repair','replace','measure'],
    requirements: [
      { kind: 'measurement', reason: 'Structural work requires dimensional verification.', mandatory: true },
      { kind: 'oem_procedure', reason: 'Structural repair must follow manufacturer procedure and limitations.', mandatory: true },
      { kind: 'structural_review', reason: 'Safety-critical structural work requires qualified human review.', mandatory: true },
    ],
  },
];
