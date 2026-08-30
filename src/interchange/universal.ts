import type { EstimateInterchangeAdapter, ImportEstimateResult } from '../connectors/contracts.js';

export type InterchangeFormatDescriptor = {
  id: string;
  label: string;
  contentTypes: string[];
  proprietary: boolean;
  requiresLicense: boolean;
};

export class UniversalInterchangeRegistry {
  private readonly adapters = new Map<string, EstimateInterchangeAdapter>();
  private readonly descriptors = new Map<string, InterchangeFormatDescriptor>();

  register(descriptor: InterchangeFormatDescriptor, adapter?: EstimateInterchangeAdapter): void {
    if (this.descriptors.has(descriptor.id)) throw new Error(`interchange_format_duplicate:${descriptor.id}`);
    this.descriptors.set(descriptor.id, descriptor);
    if (adapter) this.adapters.set(descriptor.id, adapter);
  }

  formats(): InterchangeFormatDescriptor[] {
    return [...this.descriptors.values()];
  }

  async import(contentType: string, payload: Uint8Array, licensedFormatIds: ReadonlySet<string> = new Set()): Promise<ImportEstimateResult> {
    const matches = [...this.descriptors.values()].filter(format => format.contentTypes.some(type => contentType.includes(type)));
    for (const format of matches) {
      if (format.requiresLicense && !licensedFormatIds.has(format.id)) continue;
      const adapter = this.adapters.get(format.id);
      if (adapter?.canImport(contentType, payload)) return adapter.import(payload);
    }
    throw new Error('interchange_no_authorized_adapter');
  }

  activation(formatId: string, licensedFormatIds: ReadonlySet<string> = new Set()): 'ready' | 'license_required' | 'adapter_required' {
    const descriptor = this.descriptors.get(formatId);
    if (!descriptor) throw new Error('interchange_format_unknown');
    if (descriptor.requiresLicense && !licensedFormatIds.has(formatId)) return 'license_required';
    if (!this.adapters.has(formatId)) return 'adapter_required';
    return 'ready';
  }
}

export const STANDARD_INTERCHANGE_FORMATS: InterchangeFormatDescriptor[] = [
  { id: 'elite-json-v1', label: 'Elite Estimating JSON', contentTypes: ['application/json'], proprietary: false, requiresLicense: false },
  { id: 'cieca-bms', label: 'CIECA BMS', contentTypes: ['application/xml', 'text/xml'], proprietary: false, requiresLicense: false },
  { id: 'licensed-ccc', label: 'CCC authorized interchange', contentTypes: ['application/octet-stream'], proprietary: true, requiresLicense: true },
  { id: 'licensed-mitchell', label: 'Mitchell authorized interchange', contentTypes: ['application/octet-stream'], proprietary: true, requiresLicense: true },
  { id: 'licensed-solera', label: 'Solera authorized interchange', contentTypes: ['application/octet-stream'], proprietary: true, requiresLicense: true },
];
