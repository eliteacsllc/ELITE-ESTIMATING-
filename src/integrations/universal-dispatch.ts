export type DispatchChannel = 'api' | 'webhook' | 'secure_link' | 'interchange_file' | 'manual_portal';

export type DispatchRecipient = {
  id: string;
  channels: DispatchChannel[];
  supportedFormats: string[];
  regions: string[];
  requiresEnrollment?: boolean;
};

export type DispatchRequest = {
  recipient: DispatchRecipient;
  market: string;
  preferredFormats: string[];
  allowManualFallback: boolean;
};

export type DispatchPlan = {
  channel: DispatchChannel;
  format: string | null;
  automated: boolean;
  blockers: string[];
};

const priority: DispatchChannel[] = ['api','webhook','secure_link','interchange_file','manual_portal'];

export function planUniversalDispatch(request: DispatchRequest): DispatchPlan {
  const { recipient } = request;
  if (!recipient.regions.includes('*') && !recipient.regions.includes(request.market)) {
    return { channel: 'manual_portal', format: null, automated: false, blockers: ['recipient_market_unsupported'] };
  }
  if (recipient.requiresEnrollment) {
    return { channel: 'manual_portal', format: null, automated: false, blockers: ['recipient_enrollment_required'] };
  }

  const format = request.preferredFormats.find(candidate => recipient.supportedFormats.includes(candidate)) ?? null;
  const available = priority.find(channel => recipient.channels.includes(channel) && (channel !== 'manual_portal' || request.allowManualFallback));
  if (!available) return { channel: 'manual_portal', format, automated: false, blockers: ['no_dispatch_channel'] };
  if ((available === 'api' || available === 'webhook' || available === 'interchange_file') && !format) {
    if (recipient.channels.includes('secure_link')) return { channel: 'secure_link', format: null, automated: true, blockers: [] };
    if (request.allowManualFallback && recipient.channels.includes('manual_portal')) return { channel: 'manual_portal', format: null, automated: false, blockers: ['compatible_interchange_format_required'] };
    return { channel: available, format: null, automated: false, blockers: ['compatible_interchange_format_required'] };
  }
  return { channel: available, format, automated: available !== 'manual_portal', blockers: [] };
}
