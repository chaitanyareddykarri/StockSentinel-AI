import type { UserAccessState } from '@/types';

export interface RoleRoutingOptions {
  accessState?: UserAccessState | string | null;
  companyStatus?: 'PENDING_ONBOARDING' | 'ACTIVE' | 'SUSPENDED' | string | null;
  isPlatformAdmin?: boolean;
}

/**
 * Returns the appropriate dashboard or landing route based on user role and company status.
 *
 * Rules:
 * 1. PLATFORM_ADMIN -> /admin
 * 2. COMPANY_MANAGER with pending onboarding -> /onboarding
 * 3. COMPANY_MANAGER -> /stores
 * 4. STORE_MANAGER / Inventory roles -> /dashboard
 * 5. PENDING_ASSIGNMENT -> /access-status?status=pending
 * 6. SUSPENDED -> /access-status?status=suspended
 * 7. Default -> /dashboard
 */
export function getRoleDashboardPath(
  accessStateOrUser?: UserAccessState | string | RoleRoutingOptions | null,
  companyStatus?: string | null
): string {
  if (!accessStateOrUser) {
    return '/dashboard';
  }

  let role: string | undefined;
  let compStatus: string | undefined = companyStatus || undefined;

  if (typeof accessStateOrUser === 'object') {
    if (accessStateOrUser.isPlatformAdmin) {
      return '/admin';
    }
    role = accessStateOrUser.accessState || undefined;
    compStatus = compStatus || accessStateOrUser.companyStatus || undefined;
  } else {
    role = accessStateOrUser;
  }

  switch (role) {
    case 'PLATFORM_ADMIN':
      return '/admin';
    case 'COMPANY_MANAGER':
      if (compStatus === 'PENDING_ONBOARDING') {
        return '/onboarding';
      }
      return '/stores';
    case 'STORE_MANAGER':
    case 'INVENTORY_LEAD':
    case 'ASSOCIATE':
    case 'EVALUATOR':
      return '/dashboard';
    case 'PENDING_ASSIGNMENT':
      return '/access-status?status=pending';
    case 'SUSPENDED':
      return '/access-status?status=suspended';
    default:
      return '/dashboard';
  }
}

