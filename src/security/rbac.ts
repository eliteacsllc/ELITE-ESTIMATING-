export type Role = 'platform_admin' | 'tenant_admin' | 'estimator' | 'reviewer' | 'carrier' | 'appraiser' | 'read_only';

export type Action =
  | 'estimate:create'
  | 'estimate:read'
  | 'estimate:update'
  | 'estimate:approve'
  | 'estimate:void'
  | 'estimate:export'
  | 'provider:configure'
  | 'rules:configure';

export type Principal = {
  userId: string;
  tenantId: string;
  roles: Role[];
};

const grants: Record<Role, ReadonlySet<Action>> = {
  platform_admin: new Set<Action>(['estimate:create','estimate:read','estimate:update','estimate:approve','estimate:void','estimate:export','provider:configure','rules:configure']),
  tenant_admin: new Set<Action>(['estimate:create','estimate:read','estimate:update','estimate:approve','estimate:void','estimate:export','provider:configure','rules:configure']),
  estimator: new Set<Action>(['estimate:create','estimate:read','estimate:update','estimate:export']),
  reviewer: new Set<Action>(['estimate:read','estimate:update','estimate:approve','estimate:export']),
  carrier: new Set<Action>(['estimate:read','estimate:approve','estimate:export','rules:configure']),
  appraiser: new Set<Action>(['estimate:create','estimate:read','estimate:update','estimate:export']),
  read_only: new Set<Action>(['estimate:read']),
};

export function authorize(principal: Principal, action: Action, resourceTenantId: string): void {
  if (!principal.roles.includes('platform_admin') && principal.tenantId !== resourceTenantId) {
    throw new Error('cross_tenant_access_denied');
  }
  if (!principal.roles.some((role) => grants[role].has(action))) {
    throw new Error('action_not_permitted');
  }
}
