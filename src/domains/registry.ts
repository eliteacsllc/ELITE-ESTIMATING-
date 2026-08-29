import type { AssetClass, AssetIdentity, EstimateOperation } from '../domain/types.js';
import type { ProviderCapability } from '../connectors/contracts.js';

export type EstimatingDomainId =
  | 'collision'
  | 'property'
  | 'commercial_truck'
  | 'heavy_equipment'
  | 'powersports'
  | 'rv'
  | 'marine'
  | 'contents'
  | 'specialty';

export type DomainChecklistItem = {
  id: string;
  required: boolean;
  reason: string;
};

export type DomainEstimatePlan = {
  domain: EstimatingDomainId;
  assetClass: AssetClass;
  allowedOperations: EstimateOperation[];
  providerCapabilities: ProviderCapability[];
  checklist: DomainChecklistItem[];
};

export interface EstimatingDomainAdapter {
  readonly id: EstimatingDomainId;
  supports(asset: AssetIdentity): boolean;
  plan(asset: AssetIdentity): DomainEstimatePlan;
}

const vehicleOps: EstimateOperation[] = ['repair','replace','remove_install','remove_replace','refinish','blend','inspect','scan','calibrate','measure','clean','other'];
const propertyOps: EstimateOperation[] = ['repair','replace','inspect','measure','clean','demolish','install','detach_reset','other'];
const contentsOps: EstimateOperation[] = ['repair','replace','inspect','clean','other'];

function checklist(...items: Array<[string, string]>): DomainChecklistItem[] {
  return items.map(([id, reason]) => ({ id, required: true, reason }));
}

class StaticDomainAdapter implements EstimatingDomainAdapter {
  constructor(
    readonly id: EstimatingDomainId,
    private readonly assetClasses: AssetClass[],
    private readonly allowedOperations: EstimateOperation[],
    private readonly providerCapabilities: ProviderCapability[],
    private readonly domainChecklist: DomainChecklistItem[],
  ) {}

  supports(asset: AssetIdentity): boolean { return this.assetClasses.includes(asset.assetClass); }

  plan(asset: AssetIdentity): DomainEstimatePlan {
    if (!this.supports(asset)) throw new Error(`domain_not_applicable:${this.id}:${asset.assetClass}`);
    return {
      domain: this.id,
      assetClass: asset.assetClass,
      allowedOperations: [...this.allowedOperations],
      providerCapabilities: [...this.providerCapabilities],
      checklist: this.domainChecklist.map(item => ({ ...item })),
    };
  }
}

export const DOMAIN_ADAPTERS: ReadonlyArray<EstimatingDomainAdapter> = [
  new StaticDomainAdapter('collision', ['passenger_vehicle','commercial_vehicle','ambulance_emergency'], vehicleOps,
    ['asset_identity','build_configuration','parts','labor_times','materials','oem_procedures','adas_requirements','diagnostics','market_pricing','valuation','safety_recalls'],
    checklist(['blueprint','complete damage discovery and blueprint'],['oem','identify applicable OEM procedures'],['parts','validate part source and configuration'],['safety','resolve structural/restraint/ADAS/EV-HV requirements'],['qc','define post-repair validation'])),
  new StaticDomainAdapter('commercial_truck', ['commercial_vehicle','tractor_trailer','ambulance_emergency'], vehicleOps,
    ['asset_identity','build_configuration','parts','labor_times','labor_rates','materials','oem_procedures','diagnostics','market_pricing','valuation','safety_recalls'],
    checklist(['configuration','capture chassis/body/upfit configuration'],['heavy_parts','validate heavy-duty part and assembly source'],['procedures','resolve OEM/body-builder procedures'],['sublet','identify towing/alignment/frame/sublet work'],['qc','define functional and road-test validation'])),
  new StaticDomainAdapter('heavy_equipment', ['heavy_equipment','crane_specialty'], vehicleOps,
    ['asset_identity','parts','labor_times','labor_rates','materials','oem_procedures','diagnostics','market_pricing','valuation'],
    checklist(['serial','validate serial/model/configuration'],['attachments','inventory attachments and implements'],['field','capture field-access/mobilization requirements'],['safety','resolve lifting/hydraulic/electrical safety requirements'],['valuation','validate repair-vs-replace economics'])),
  new StaticDomainAdapter('powersports', ['motorcycle','atv_utv'], vehicleOps,
    ['asset_identity','build_configuration','parts','labor_times','materials','oem_procedures','diagnostics','market_pricing','valuation','safety_recalls'],
    checklist(['identity','validate VIN/model/trim'],['safety','inspect frame/forks/wheels/brakes/controls'],['procedures','resolve OEM procedures'],['parts','validate configured parts'],['qc','define functional road/operation check'])),
  new StaticDomainAdapter('rv', ['rv'], [...vehicleOps,'install','detach_reset'],
    ['asset_identity','build_configuration','parts','labor_times','labor_rates','materials','oem_procedures','diagnostics','property_pricing','market_pricing','valuation','safety_recalls'],
    checklist(['chassis','separate chassis and coach/body systems'],['utilities','inspect electrical/LP/water/HVAC systems'],['structure','inspect roof/walls/floor and moisture intrusion'],['parts','validate manufacturer-specific components'],['qc','define system leak/function tests'])),
  new StaticDomainAdapter('marine', ['marine'], [...vehicleOps,'install','detach_reset'],
    ['asset_identity','parts','labor_times','labor_rates','materials','oem_procedures','diagnostics','market_pricing','valuation'],
    checklist(['identity','validate HIN/serial/engine/drive configuration'],['structure','inspect hull/deck/stringer/transom structure'],['systems','inspect propulsion/electrical/fuel/steering systems'],['haul','identify haul-out/storage/sublet requirements'],['qc','define leak/function/water-test validation'])),
  new StaticDomainAdapter('property', ['residential_property','commercial_property'], propertyOps,
    ['materials','labor_rates','market_pricing','property_pricing','weather_catastrophe','codes_regulations'],
    checklist(['measure','capture rooms/openings/surfaces/roof geometry'],['cause','document cause and damage boundaries'],['code','identify jurisdictional code requirements'],['detach','identify detach/reset and access operations'],['waste','apply waste/yield only with documented basis'],['qc','define completion and moisture/function validation'])),
  new StaticDomainAdapter('contents', ['contents'], contentsOps,
    ['market_pricing','valuation'],
    checklist(['inventory','identify each item with evidence'],['condition','document pre-loss/observed condition'],['restore','determine clean/repair/replace disposition'],['valuation','document replacement/actual-value basis'],['evidence','retain source and comparable evidence'])),
  new StaticDomainAdapter('specialty', ['other','crane_specialty','ambulance_emergency'], [...vehicleOps,'install','detach_reset'],
    ['asset_identity','parts','labor_times','labor_rates','materials','oem_procedures','diagnostics','market_pricing','valuation','codes_regulations','safety_recalls'],
    checklist(['configuration','fully describe custom configuration'],['specialty','identify specialty manufacturer/upfitter procedures'],['safety','resolve equipment-specific safety requirements'],['sublet','identify specialty vendor/sublet work'],['qc','define functional/load/operation validation'])),
];

export function domainForAsset(asset: AssetIdentity, preferred?: EstimatingDomainId): EstimatingDomainAdapter {
  if (preferred) {
    const selected = DOMAIN_ADAPTERS.find(adapter => adapter.id === preferred);
    if (!selected) throw new Error(`unknown_domain:${preferred}`);
    if (!selected.supports(asset)) throw new Error(`domain_not_applicable:${preferred}:${asset.assetClass}`);
    return selected;
  }
  const matches = DOMAIN_ADAPTERS.filter(adapter => adapter.supports(asset));
  if (matches.length === 0) throw new Error(`no_estimating_domain:${asset.assetClass}`);
  return matches[0]!;
}
