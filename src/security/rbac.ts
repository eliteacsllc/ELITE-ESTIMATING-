export type Role = 'platform_admin' | 'tenant_admin' | 'estimator' | 'reviewer' | 'carrier' | 'appraiser' | 'read_only';

export type Action =
  | 'estimate:create'
  | 'estimate:read'
  | 'estimate:update'
  | 'estimate:approve'
  | 'estimate:void'
  | 'estimate:export'
  | 'evidence:create'
  | 'evidence:read'
  | 'supplement:create'
  | 'supplement:update'
  | 'supplement:submit'
  | 'supplement:approve'
  | 'provider:configure'
  | 'rules:configure'
  | 'features:configure';

export type Principal = {
  userId: string;
  tenantId: string;
  roles: Role[];
};

const allActions: Action[] = ['estimate:create','estimate:read','estimate:update','estimate:approve','estimate:void','estimate:export','evidence:create','evidence:read','supplement:create','supplement:update','supplement:submit','supplement:approve','provider:configure','rules:configure','features:configure'];

const grants: Record<Role, ReadonlySet<Action>> = {
  platform_admin: new Set<Action>(allActions),
  tenant_admin: new Set<Action>(allActions),
  estimator: new Set<Action>(['estimate:create','estimate:read','estimate:update','estimate:export','evidence:create','evidence:read','supplement:create','supplement:update','supplement:submit']),
  reviewer: new Set<Action>(['estimate:read','estimate:update','estimate:approve','estimate:export','evidence:read','supplement:create','supplement:update','supplement:submit','supplement:approve']),
  carrier: new Set<Action>(['estimate:read','estimate:approve','estimate:export','evidence:read','supplement:approve','rules:configure']),
  appraiser: new Set<Action>(['estimate:create','estimate:read','estimate:update','estimate:export','evidence:create','evidence:read','supplement:create','supplement:update','supplement:submit']),
  read_only: new Set<Action>(['estimate:read','evidence:read']),
};

export function authorize(principal: Principal, action: Action, resourceTenantId: string): void {
  if (!principal.roles.includes('platform_admin') && principal.tenantId !== resourceTenantId) {
    throw new Error('cross_tenant_access_denied');
  }
  if (!principal.roles.some((role) => grants[role].has(action))) {
    throw new Error('action_not_permitted');
  }
}
