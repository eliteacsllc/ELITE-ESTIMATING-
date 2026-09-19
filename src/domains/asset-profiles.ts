import type { AssetClass } from '../domain/types.js';

export type AssetProfileSection = {
  id: string;
  label: string;
  requiredFields: string[];
  optionalFields: string[];
};

export type AssetDomainProfile = {
  id: 'heavy_equipment' | 'rv' | 'marine' | 'machinery';
  assetClasses: readonly AssetClass[];
  sections: AssetProfileSection[];
  riskFlags: string[];
};

const section = (
  id: string,
  label: string,
  requiredFields: string[],
  optionalFields: string[] = [],
): AssetProfileSection => ({ id, label, requiredFields, optionalFields });

export const ASSET_DOMAIN_PROFILES: ReadonlyArray<AssetDomainProfile> = [
  {
    id: 'heavy_equipment',
    assetClasses: ['heavy_equipment','agricultural_equipment','material_handling_equipment','crane_specialty'],
    sections: [
      section('identity','Identity & Configuration',['serialNumber','make','model'],['year','assetTag','configuration']),
      section('usage','Hours / Meter / Duty Cycle',[],['operatingHours','meterReading','meterUnit','attributes.dutyCycle']),
      section('attachments','Attachments & Implements',[],['attributes.attachments','attributes.quickCoupler','attributes.auxHydraulics']),
      section('powertrain','Engine / Powertrain',[],['attributes.engine','attributes.transmission','attributes.finalDrive']),
      section('hydraulics','Hydraulics',[],['attributes.pumps','attributes.valves','attributes.cylinders']),
      section('running-gear','Tracks / Tires / Undercarriage',[],['attributes.tracks','attributes.tires','attributes.undercarriage']),
      section('structure','Frame / Boom / Chassis / Structure',[],['attributes.structure','attributes.boom','attributes.frame']),
      section('operator-station','Cab / Controls / Safety Systems',[],['attributes.cab','attributes.controls','attributes.safetySystems']),
      section('electrical','Electrical / Telematics',[],['attributes.electrical','attributes.telematics']),
      section('mobilization','Mobilization / Transport / Access',[],['attributes.transport','attributes.fieldAccess','attributes.craneSupport']),
      section('valuation','Condition / Market / Repair-v-Replace',[],['attributes.condition','attributes.market','attributes.replacementCost']),
    ],
    riskFlags: ['lifting','hydraulic_pressure','high_voltage','stored_energy','field_access','load_bearing_structure'],
  },
  {
    id: 'rv',
    assetClasses: ['rv'],
    sections: [
      section('identity','VIN / Chassis / Coach Identity',['vin','make','model'],['year','configuration','serialNumber']),
      section('chassis','Chassis / Powertrain',[],['attributes.chassis','attributes.engine','attributes.drivetrain']),
      section('coach-structure','Coach / Roof / Walls / Floor',[],['attributes.roof','attributes.walls','attributes.floor','attributes.moisture']),
      section('electrical','12V / 120V / Shore / Generator',[],['attributes.electrical','attributes.generator','attributes.inverter']),
      section('lp-gas','LP Gas System',[],['attributes.lpGas']),
      section('plumbing','Fresh / Gray / Black Water',[],['attributes.plumbing','attributes.tanks']),
      section('hvac','HVAC / Appliances',[],['attributes.hvac','attributes.appliances']),
      section('slideouts','Slide-outs / Awnings / Leveling',[],['attributes.slideouts','attributes.awnings','attributes.leveling']),
      section('interior','Interior / Cabinetry / Finishes',[],['attributes.interior','attributes.cabinetry']),
      section('valuation','Condition / Market / Repair-v-Replace',[],['attributes.condition','attributes.market','attributes.replacementCost']),
    ],
    riskFlags: ['lp_gas','120v','water_intrusion','roof_structure','generator','chassis_coach_boundary'],
  },
  {
    id: 'marine',
    assetClasses: ['marine'],
    sections: [
      section('identity','HIN / Vessel / Engine Identity',[],['hin','serialNumber','make','model','year','configuration']),
      section('hull','Hull / Deck / Structural Grid',[],['attributes.hull','attributes.deck','attributes.stringers','attributes.transom']),
      section('propulsion','Engine / Drive / Propulsion',[],['attributes.engine','attributes.drive','attributes.propeller']),
      section('fuel-steering','Fuel / Steering / Controls',[],['attributes.fuel','attributes.steering','attributes.controls']),
      section('electrical','Electrical / Batteries / Charging',[],['attributes.electrical','attributes.batteries','attributes.charging']),
      section('navigation','Navigation / Electronics',[],['attributes.navigation','attributes.electronics']),
      section('plumbing','Bilge / Plumbing / Sanitation',[],['attributes.bilge','attributes.plumbing','attributes.sanitation']),
      section('rigging','Rigging / Sail / Deck Hardware',[],['attributes.rigging','attributes.sails','attributes.deckHardware']),
      section('haul','Haul-out / Storage / Trailer / Access',[],['attributes.haulOut','attributes.storage','attributes.trailer']),
      section('valuation','Condition / Market / Repair-v-Replace',[],['attributes.condition','attributes.market','attributes.replacementCost']),
    ],
    riskFlags: ['fuel','bilge','water_intrusion','hull_structure','shore_power','haul_out','sea_trial'],
  },
  {
    id: 'machinery',
    assetClasses: ['industrial_machinery'],
    sections: [
      section('identity','Nameplate / Serial / Asset Identity',['serialNumber','make','model'],['year','assetTag','configuration']),
      section('operating-profile','Hours / Cycles / Capacity / Duty',[],['operatingHours','meterReading','meterUnit','attributes.cycles','attributes.capacity','attributes.dutyCycle']),
      section('installation','Foundation / Anchoring / Utilities',[],['attributes.foundation','attributes.anchoring','attributes.utilities']),
      section('mechanical','Mechanical / Drive Systems',[],['attributes.motor','attributes.gearbox','attributes.bearings','attributes.drive']),
      section('fluid-power','Hydraulics / Pneumatics',[],['attributes.hydraulics','attributes.pneumatics']),
      section('controls','Electrical / Controls / PLC / HMI',[],['attributes.electrical','attributes.plc','attributes.hmi','attributes.controls']),
      section('tooling','Tooling / Fixtures / Consumables',[],['attributes.tooling','attributes.fixtures']),
      section('safety','Guarding / Interlocks / Safety Systems',[],['attributes.guarding','attributes.interlocks','attributes.safetySystems']),
      section('precision','Calibration / Alignment / Metrology',[],['attributes.calibration','attributes.alignment','attributes.metrology']),
      section('rigging','Freight / Rigging / Removal / Reinstallation',[],['attributes.freight','attributes.rigging','attributes.reinstallation']),
      section('commissioning','Startup / Commissioning / Acceptance Testing',[],['attributes.commissioning','attributes.acceptanceTest']),
      section('downtime','Downtime / Production Impact Evidence',[],['attributes.downtime','attributes.productionImpact']),
      section('valuation','Condition / Market / Replacement / Obsolescence',[],['attributes.condition','attributes.market','attributes.replacementCost','attributes.obsolescence']),
    ],
    riskFlags: ['lockout_tagout','stored_energy','guarding','precision_alignment','rigging','commissioning','production_impact'],
  },
];

export function profileForAssetClass(assetClass: AssetClass): AssetDomainProfile | undefined {
  return ASSET_DOMAIN_PROFILES.find(profile => profile.assetClasses.includes(assetClass));
}
