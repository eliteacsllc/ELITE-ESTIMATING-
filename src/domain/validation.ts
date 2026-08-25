import type { AssetClass, AssetIdentity, EstimateLine } from './types.js';

const assetClasses = new Set<AssetClass>([
  'passenger_vehicle','commercial_vehicle','tractor_trailer','heavy_equipment','motorcycle','atv_utv','rv','marine',
  'ambulance_emergency','crane_specialty','residential_property','commercial_property','contents','other',
]);

const operations = new Set<EstimateLine['operation']>([
  'repair','replace','remove_install','remove_replace','refinish','blend','inspect','scan','calibrate','measure','clean',
  'demolish','install','detach_reset','other',
]);

const guideSources = new Set(['motor_gte','motor_raced','oem_procedure','other']);
const partBases = new Set(['new_oem','recycled_assembly','aftermarket','repaired_existing','none']);
const workTimeBases = new Set(['database','footnote','estimator_override','manual_entry']);

export function validateAssetIdentity(asset: AssetIdentity): string[] {
  const errors: string[] = [];
  if (!asset || !assetClasses.has(asset.assetClass)) errors.push('unsupported_asset_class');
  if (asset.year !== undefined && (!Number.isInteger(asset.year) || asset.year < 1800 || asset.year > 2200)) errors.push('invalid_asset_year');
  if (asset.vin && !/^[A-HJ-NPR-Z0-9]{5,25}$/i.test(asset.vin)) errors.push('invalid_vin_format');
  if (asset.serialNumber && asset.serialNumber.length > 100) errors.push('serial_number_too_long');
  return errors;
}

export function validateCurrency(currency: string): string[] {
  return /^[A-Z]{3}$/.test(currency) ? [] : ['currency_must_be_iso_4217_code'];
}

export function validateJurisdiction(jurisdiction: string): string[] {
  const value = jurisdiction.trim();
  if (value.length < 2 || value.length > 80) return ['invalid_jurisdiction'];
  return [];
}

export function validateEstimateLineInput(line: EstimateLine, estimateCurrency: string): string[] {
  const errors: string[] = [];
  if (!line.id || line.id.length > 100) errors.push('invalid_line_id');
  if (!line.component?.trim() || line.component.length > 300) errors.push(`invalid_component:${line.id || 'unknown'}`);
  if (!operations.has(line.operation)) errors.push(`invalid_operation:${line.id || 'unknown'}`);
  if (!Number.isFinite(line.quantity) || line.quantity < 0 || line.quantity > 1_000_000) errors.push(`invalid_quantity:${line.id || 'unknown'}`);
  if (line.laborHours !== undefined && (!Number.isFinite(line.laborHours) || line.laborHours < 0 || line.laborHours > 100_000)) errors.push(`invalid_labor_hours:${line.id}`);
  const monies = [line.total,line.laborRate,line.partOrMaterial,line.equipment,line.tax].filter((value) => value !== undefined);
  for (const value of monies) {
    if (!Number.isSafeInteger(value.amountMinor) || Math.abs(value.amountMinor) > 9_000_000_000_000) errors.push(`invalid_money_amount:${line.id}`);
    if (value.currency !== estimateCurrency) errors.push(`line_currency_mismatch:${line.id}`);
  }
  if (line.aiConfidence !== undefined && (!Number.isFinite(line.aiConfidence) || line.aiConfidence < 0 || line.aiConfidence > 1)) errors.push(`invalid_ai_confidence:${line.id}`);
  if (!Array.isArray(line.provenance)) errors.push(`invalid_provenance:${line.id}`);
  if (line.guide) {
    if (!guideSources.has(line.guide.source)) errors.push(`invalid_guide_source:${line.id}`);
    if (!partBases.has(line.guide.partBasis)) errors.push(`invalid_part_basis:${line.id}`);
    if (!workTimeBases.has(line.guide.workTimeBasis)) errors.push(`invalid_work_time_basis:${line.id}`);
    if (line.guide.revision !== undefined && line.guide.revision.length > 40) errors.push(`guide_revision_too_long:${line.id}`);
    if (line.guide.originalLaborHours !== undefined && (!Number.isFinite(line.guide.originalLaborHours) || line.guide.originalLaborHours < 0 || line.guide.originalLaborHours > 100_000)) errors.push(`invalid_original_labor_hours:${line.id}`);
    for (const values of [line.guide.footnoteRefs,line.guide.includedLineIds,line.guide.notIncludedLineIds,line.guide.requiredLineIds,line.guide.assemblyComponents]) {
      if (values && (values.length > 200 || values.some((value) => !value.trim() || value.length > 300))) errors.push(`invalid_guide_reference:${line.id}`);
    }
    if (line.guide.overrideReason !== undefined && (!line.guide.overrideReason.trim() || line.guide.overrideReason.length > 2000)) errors.push(`invalid_override_reason:${line.id}`);
  }
  return errors;
}

export function assertValid(errors: string[]): void {
  if (errors.length) throw new Error(`validation_failed:${errors.join('|')}`);
}
