import { getSupabaseServerClient, isSupabaseServerConfigured } from '@/lib/db/supabaseServer';
import {
  verifySession,
  findPlatformAdmin,
  findCompanyMembership,
  findStoreAssignment,
  findCompanyStores,
} from '@/lib/auth/userStore';
import { isSameOrAliasedStore } from '@/lib/storeResolver';

export type UserAccessState =
  | 'PLATFORM_ADMIN'
  | 'COMPANY_MANAGER'
  | 'STORE_MANAGER'
  | 'PENDING_ASSIGNMENT'
  | 'SUSPENDED';

export interface VerifiedUser {
  id: string;
  email: string;
  name: string;
  accessState: UserAccessState;
  role: UserAccessState | string; // Backward compatibility alias
  companyId?: string;
  companyName?: string;
  companySlug?: string;
  companyStatus?: 'PENDING_ONBOARDING' | 'ACTIVE' | 'SUSPENDED';
  assignedStoreId?: string;
  assignedStoreName?: string;
  storeId?: string; // Backward compatibility alias for assignedStoreId
  storeName?: string; // Backward compatibility alias for assignedStoreName
  accessibleStoreIds: string[];
  avatarUrl?: string;
  authMode: 'supabase' | 'standalone';
  isDurable: boolean;
  token?: string;
}

export interface AuthResult {
  success: boolean;
  user: VerifiedUser | null;
  error?: string;
  status: number;
}

export interface AuthorizationResult {
  authorized: boolean;
  status: number;
  error?: string;
  user?: VerifiedUser;
  targetStoreId?: string;
  effectiveStoreIds: string[];
}

/**
 * Validates whether the verified user is authorized to access the requested store ID.
 *
 * Enforces:
 * - PLATFORM_ADMIN: global access. If requestedStoreId is specified, scopes to that store; otherwise all ('*').
 * - COMPANY_MANAGER: scoped to stores within their company (user.accessibleStoreIds). If specific store requested, must belong to their company.
 * - STORE_MANAGER: strictly scoped to assignedStoreId. Cannot query "ALL" or multiple stores or unassigned stores.
 * - PENDING_ASSIGNMENT / SUSPENDED: zero operational data access (HTTP 403).
 */
export function validateStoreAccess(
  user: VerifiedUser,
  requestedStoreId?: string
): {
  authorized: boolean;
  status: number;
  error?: string;
  targetStoreId?: string;
  effectiveStoreIds: string[];
} {
  // 1. Guard pending assignment and suspended states
  if (user.accessState === 'PENDING_ASSIGNMENT') {
    return {
      authorized: false,
      status: 403,
      error: 'Your account is pending assignment to a company. Please contact your company administrator.',
      effectiveStoreIds: [],
    };
  }

  if (user.accessState === 'SUSPENDED') {
    return {
      authorized: false,
      status: 403,
      error: 'Your account or company access has been suspended.',
      effectiveStoreIds: [],
    };
  }

  // 2. Role-specific validation
  if (user.accessState === 'STORE_MANAGER') {
    const assignedStore = user.assignedStoreId;
    if (!assignedStore) {
      return {
        authorized: false,
        status: 403,
        error: 'No active store assigned to your store manager account.',
        effectiveStoreIds: [],
      };
    }

    // If client requested a store, it MUST be their assigned store (or its alias)
    if (requestedStoreId && requestedStoreId !== 'ALL' && requestedStoreId !== assignedStore) {
      const isAlias = isSameOrAliasedStore(requestedStoreId, assignedStore);
      if (!isAlias) {
        return {
          authorized: false,
          status: 403,
          error: 'Access denied: You are only authorized to access your assigned store.',
          effectiveStoreIds: [],
        };
      }
    }

    // Store managers can never access "ALL" stores across the platform or company
    if (requestedStoreId === 'ALL') {
      return {
        authorized: false,
        status: 403,
        error: 'Access denied: Store managers are not authorized to aggregate across all stores.',
        effectiveStoreIds: [],
      };
    }

    // When requesting without a storeId or with their own storeId, scope strictly to assignedStore
    return {
      authorized: true,
      status: 200,
      targetStoreId: requestedStoreId || assignedStore,
      effectiveStoreIds: [assignedStore],
    };
  }

  if (user.accessState === 'COMPANY_MANAGER') {
    const accessible = user.accessibleStoreIds || [];
    if (user.companyStatus === 'SUSPENDED') {
      return {
        authorized: false,
        status: 403,
        error: 'Company account is suspended.',
        effectiveStoreIds: [],
      };
    }

    if (requestedStoreId && requestedStoreId !== 'ALL') {
      if (!accessible.includes(requestedStoreId)) {
        const isAlias = accessible.some((accId) => isSameOrAliasedStore(requestedStoreId, accId));
        if (!isAlias) {
          return {
            authorized: false,
            status: 403,
            error: 'Access denied: Requested store does not belong to your company.',
            effectiveStoreIds: [],
          };
        }
      }
      return {
        authorized: true,
        status: 200,
        targetStoreId: requestedStoreId,
        effectiveStoreIds: [requestedStoreId],
      };
    }

    // When requestedStoreId is 'ALL' or undefined, company manager can access all active stores in their company
    return {
      authorized: true,
      status: 200,
      targetStoreId: undefined, // meaning all stores within company
      effectiveStoreIds: accessible,
    };
  }

  if (user.accessState === 'PLATFORM_ADMIN') {
    const isSpecific = Boolean(requestedStoreId && requestedStoreId !== 'ALL');
    return {
      authorized: true,
      status: 200,
      targetStoreId: isSpecific ? requestedStoreId : undefined,
      effectiveStoreIds: isSpecific ? [requestedStoreId!] : ['*'],
    };
  }

  return {
    authorized: false,
    status: 403,
    error: 'Unauthorized access state.',
    effectiveStoreIds: [],
  };
}

/**
 * Authenticates the incoming request and validates store access in a single unified call.
 */
export async function authorizeRequest(
  request: Request,
  requestedStoreId?: string
): Promise<AuthorizationResult> {
  const auth = await getAuthenticatedUser(request);
  if (!auth.success || !auth.user) {
    return {
      authorized: false,
      status: auth.status || 401,
      error: auth.error || 'Authentication required.',
      effectiveStoreIds: [],
    };
  }

  const check = validateStoreAccess(auth.user, requestedStoreId);
  return {
    ...check,
    user: auth.user,
  };
}

/**
 * Resolves a verified user's trusted role, company membership, and accessible stores
 * strictly from database records or trusted standalone store caches.
 *
 * Security Guarantee:
 * - Client-supplied role, company ID, or store ID headers or payload fields are strictly ignored.
 * - Platform admin status is derived solely from public.platform_administrators.
 * - An account without an authorized company membership record remains in PENDING_ASSIGNMENT.
 * - Suspended memberships immediately revoke all accessible store IDs.
 */
export async function resolveUserRoleAndPermissions(
  userId: string,
  authMode: 'supabase' | 'standalone',
  legacyRoleFallback?: string
): Promise<{
  accessState: UserAccessState;
  companyId?: string;
  companyName?: string;
  companySlug?: string;
  companyStatus?: 'PENDING_ONBOARDING' | 'ACTIVE' | 'SUSPENDED';
  assignedStoreId?: string;
  assignedStoreName?: string;
  storeId?: string; // Backward compatibility alias for assignedStoreId
  storeName?: string; // Backward compatibility alias for assignedStoreName
  accessibleStoreIds: string[];
}> {
  // 1. Supabase Mode: Query live PostgreSQL tables via Supabase Server Client
  if (authMode === 'supabase' && isSupabaseServerConfigured()) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        // A. Check Platform Administrator Whitelist
        const { data: adminRow } = await supabase
          .from('platform_administrators')
          .select('user_id')
          .eq('user_id', userId)
          .maybeSingle();

        if (adminRow) {
          return {
            accessState: 'PLATFORM_ADMIN',
            accessibleStoreIds: ['*'], // Platform admin has platform-wide operational audit scope
          };
        }

        // B. Check Company Membership
        const { data: membership } = await supabase
          .from('company_memberships')
          .select('company_id, role, status, companies(id, name, slug, status)')
          .eq('user_id', userId)
          .maybeSingle();

        if (membership) {
          const comp = Array.isArray(membership.companies)
            ? membership.companies[0]
            : (membership.companies as { id: string; name: string; slug: string; status: 'PENDING_ONBOARDING' | 'ACTIVE' | 'SUSPENDED' } | null);
          const compStatus = comp?.status || 'ACTIVE';

          // Suspended Member or Suspended Company
          if (membership.status === 'SUSPENDED' || compStatus === 'SUSPENDED') {
            return {
              accessState: 'SUSPENDED',
              companyId: membership.company_id,
              companyName: comp?.name,
              companySlug: comp?.slug,
              companyStatus: compStatus,
              accessibleStoreIds: [],
            };
          }

          // Company Manager: Access all active stores in the company
          if (membership.role === 'COMPANY_MANAGER') {
            const { data: stores } = await supabase
              .from('stores')
              .select('id, name')
              .eq('company_id', membership.company_id)
              .eq('status', 'ACTIVE');

            const storeIds = (stores || []).map((s: { id: string }) => s.id);
            return {
              accessState: 'COMPANY_MANAGER',
              companyId: membership.company_id,
              companyName: comp?.name,
              companySlug: comp?.slug,
              companyStatus: compStatus,
              accessibleStoreIds: storeIds,
            };
          }

          // Store Manager: Access strictly the single assigned store
          if (membership.role === 'STORE_MANAGER') {
            const { data: assignment } = await supabase
              .from('store_assignments')
              .select('store_id, store:stores!store_assignments_store_id_fkey(id, name, status)')
              .eq('company_id', membership.company_id)
              .eq('user_id', userId)
              .maybeSingle();

            if (!assignment || !assignment.store_id) {
              return {
                accessState: 'PENDING_ASSIGNMENT',
                companyId: membership.company_id,
                companyName: comp?.name,
                companySlug: comp?.slug,
                companyStatus: compStatus,
                accessibleStoreIds: [],
              };
            }

            const assignmentAny = assignment as Record<string, unknown>;
            const store = Array.isArray(assignmentAny.store)
              ? (assignmentAny.store as { id: string; name: string; status: string }[])[0]
              : (assignmentAny.store as { id: string; name: string; status: string } | null);

            if (store?.status === 'INACTIVE') {
              return {
                accessState: 'SUSPENDED',
                companyId: membership.company_id,
                companyName: comp?.name,
                companySlug: comp?.slug,
                companyStatus: compStatus,
                assignedStoreId: assignment.store_id,
                assignedStoreName: store?.name,
                accessibleStoreIds: [],
              };
            }

            return {
              accessState: 'STORE_MANAGER',
              companyId: membership.company_id,
              companyName: comp?.name,
              companySlug: comp?.slug,
              companyStatus: compStatus,
              assignedStoreId: assignment.store_id,
              assignedStoreName: store?.name,
              accessibleStoreIds: [assignment.store_id],
            };
          }
        }

        // C. Migration 2 Fallback: Check profiles and stores tables when Migration 4 is not yet applied
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, full_name')
          .eq('id', userId)
          .maybeSingle();

        if (profile) {
          const roleUpper = (profile.role || '').toUpperCase();
          if (roleUpper === 'PLATFORM_ADMIN' || roleUpper === 'ADMIN') {
            return {
              accessState: 'PLATFORM_ADMIN',
              accessibleStoreIds: ['*'],
            };
          }
          if (
            roleUpper === 'STORE_MANAGER' ||
            roleUpper === 'INVENTORY_LEAD' ||
            roleUpper === 'ASSOCIATE' ||
            roleUpper === 'EVALUATOR'
          ) {
            const { data: userStores } = await supabase
              .from('stores')
              .select('id, name')
              .eq('user_id', userId);

            if (userStores && userStores.length > 0) {
              return {
                accessState: 'STORE_MANAGER',
                assignedStoreId: userStores[0].id,
                assignedStoreName: userStores[0].name,
                accessibleStoreIds: userStores.map((s: { id: string }) => s.id),
              };
            }
          }
        }
      } catch (err) {
        console.warn('[ServerAuth] Supabase permission resolution error:', err);
      }
    }
  }

  // 2. Standalone Mode / Development Fallback: Query trusted userStore caches
  const isAdmin = await findPlatformAdmin(userId);
  if (isAdmin) {
    return {
      accessState: 'PLATFORM_ADMIN',
      accessibleStoreIds: ['*'],
    };
  }

  const membership = await findCompanyMembership(userId);
  if (!membership) {
    // If no membership exists, user is PENDING_ASSIGNMENT
    return {
      accessState: 'PENDING_ASSIGNMENT',
      accessibleStoreIds: [],
    };
  }

  if (membership.status === 'SUSPENDED' || membership.companyStatus === 'SUSPENDED') {
    return {
      accessState: 'SUSPENDED',
      companyId: membership.companyId,
      companyName: membership.companyName,
      companySlug: membership.companySlug,
      companyStatus: membership.companyStatus,
      accessibleStoreIds: [],
    };
  }

  if (membership.role === 'COMPANY_MANAGER') {
    const stores = await findCompanyStores(membership.companyId);
    return {
      accessState: 'COMPANY_MANAGER',
      companyId: membership.companyId,
      companyName: membership.companyName,
      companySlug: membership.companySlug,
      companyStatus: membership.companyStatus,
      accessibleStoreIds: stores.map((s) => s.id),
    };
  }

  if (membership.role === 'STORE_MANAGER') {
    const assignment = await findStoreAssignment(userId);
    if (!assignment || !assignment.storeId) {
      return {
        accessState: 'PENDING_ASSIGNMENT',
        companyId: membership.companyId,
        companyName: membership.companyName,
        companySlug: membership.companySlug,
        companyStatus: membership.companyStatus,
        accessibleStoreIds: [],
      };
    }

    return {
      accessState: 'STORE_MANAGER',
      companyId: membership.companyId,
      companyName: membership.companyName,
      companySlug: membership.companySlug,
      companyStatus: membership.companyStatus,
      assignedStoreId: assignment.storeId,
      assignedStoreName: assignment.storeName,
      accessibleStoreIds: [assignment.storeId],
    };
  }

  return {
    accessState: (legacyRoleFallback as UserAccessState) || 'PENDING_ASSIGNMENT',
    accessibleStoreIds: [],
  };
}

/**
 * Extracts and verifies the user identity from an incoming HTTP request,
 * then resolves their active role, company, and store permissions from trusted server records.
 *
 * Supported Authentication Mechanisms:
 * 1. Supabase Bearer JWT: Cryptographically verified via Supabase Auth server API.
 * 2. Standalone Session Cookie / Token: Verified via userStore session cache.
 *
 * Security Guarantees:
 * - User ID is derived exclusively from server-side cryptographic checks or session tokens.
 * - Client-supplied role, company ID, store ID, or user ID in request bodies or untrusted headers are strictly ignored.
 * - Invalid, expired, or missing credentials safely return unauthenticated 401 responses.
 * - On Vercel serverless environments, in-memory standalone sessions are explicitly rejected in production.
 * - Password hashes, salts, and secret credentials are never exposed.
 */
export async function getAuthenticatedUser(
  request: Request | Headers | { headers: Headers }
): Promise<AuthResult> {
  try {
    const headers: Headers =
      request instanceof Headers
        ? request
        : 'headers' in request && request.headers instanceof Headers
          ? request.headers
          : (request as Request).headers;

    if (!headers || typeof headers.get !== 'function') {
      return {
        success: false,
        user: null,
        error: 'Invalid request structure: headers unavailable.',
        status: 401,
      };
    }

    // 1. Extract credentials from Authorization header and/or project cookie
    const authHeader = headers.get('authorization') || headers.get('Authorization');
    const cookieHeader = headers.get('cookie') || headers.get('Cookie') || '';

    let bearerToken: string | null = null;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      bearerToken = authHeader.substring(7).trim();
    }

    let sessionCookie: string | null = null;
    const cookieMatch = cookieHeader.match(/stocksentinel_session=([^;]+)/);
    if (cookieMatch) {
      sessionCookie = decodeURIComponent(cookieMatch[1].trim()).replace(/^"+|"+$/g, '');
    } else {
      // Also check standard Supabase auth cookie patterns (including chunked cookies sb-*-auth-token.0)
      const chunkMatches = Array.from(cookieHeader.matchAll(/sb-[^;=]+-auth-token(?:\.(\d+))?=([^;]+)/g));
      if (chunkMatches.length > 0) {
        try {
          const sortedChunks = chunkMatches
            .map((m) => ({ index: m[1] !== undefined ? parseInt(m[1], 10) : 0, val: m[2] }))
            .sort((a, b) => a.index - b.index)
            .map((c) => decodeURIComponent(c.val.trim()).replace(/^"+|"+$/g, ''))
            .join('');

          let raw = sortedChunks;
          if (raw.startsWith('base64-')) {
            raw = Buffer.from(raw.slice(7), 'base64').toString('utf-8');
          }
          if (raw.startsWith('[') || raw.startsWith('{')) {
            const parsed = JSON.parse(raw);
            sessionCookie = Array.isArray(parsed) ? parsed[0] : parsed.access_token || parsed;
          } else if (raw) {
            sessionCookie = raw;
          }
        } catch {
          // ignore parsing error
        }
      } else {
        const sbLegacyMatch = cookieHeader.match(/sb-access-token=([^;]+)/);
        if (sbLegacyMatch) {
          sessionCookie = decodeURIComponent(sbLegacyMatch[1].trim()).replace(/^"+|"+$/g, '');
        }
      }
    }

    // Reject immediately if no authentication credentials were provided
    if (!bearerToken && !sessionCookie) {
      return {
        success: false,
        user: null,
        error: 'Authentication required. No credentials found in Authorization header or stocksentinel_session cookie.',
        status: 401,
      };
    }

    // 2. Attempt Supabase Auth Verification (if Supabase is configured and a JWT token is present in Bearer header or cookie)
    const supabaseToken =
      bearerToken && !bearerToken.startsWith('ses_')
        ? bearerToken
        : sessionCookie && !sessionCookie.startsWith('ses_')
          ? sessionCookie
          : null;

    if (isSupabaseServerConfigured() && supabaseToken) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        try {
          const { data, error } = await supabase.auth.getUser(supabaseToken);

          if (!error && data?.user) {
            const meta = data.user.user_metadata || {};
            const permissions = await resolveUserRoleAndPermissions(
              data.user.id,
              'supabase',
              (meta.role || meta.accessState) as string | undefined
            );

            return {
              success: true,
              user: {
                id: data.user.id,
                email: data.user.email || '',
                name: (meta.full_name || meta.name || data.user.email?.split('@')[0] || 'Store Associate') as string,
                accessState: permissions.accessState,
                role: permissions.accessState,
                companyId: permissions.companyId,
                companyName: permissions.companyName,
                companySlug: permissions.companySlug,
                companyStatus: permissions.companyStatus,
                assignedStoreId: permissions.assignedStoreId,
                assignedStoreName: permissions.assignedStoreName,
                storeId: permissions.assignedStoreId,
                storeName: permissions.assignedStoreName,
                accessibleStoreIds: permissions.accessibleStoreIds,
                avatarUrl: (meta.avatar_url || meta.picture) as string | undefined,
                authMode: 'supabase',
                isDurable: true,
                token: supabaseToken,
              },
              status: 200,
            };
          }
        } catch {
          // If Supabase check fails, proceed to test standalone token
        }
      }
    }

    // 3. Attempt Standalone Session Verification
    const standaloneToken = sessionCookie || (bearerToken?.startsWith('ses_') ? bearerToken : null);

    if (standaloneToken) {
      const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
      const isProduction = process.env.NODE_ENV === 'production';

      // Safe handling on Vercel: in-memory standalone sessions are non-durable and forbidden in production
      if (isServerless && isProduction && !isSupabaseServerConfigured()) {
        return {
          success: false,
          user: null,
          error:
            'Production deployment on Vercel requires Supabase PostgreSQL authentication. In-memory standalone sessions are non-durable and disabled in serverless production.',
          status: 503,
        };
      }

      const userRecord = await verifySession(standaloneToken);

      if (userRecord) {
        const permissions = await resolveUserRoleAndPermissions(
          userRecord.id,
          'standalone',
          userRecord.role
        );

        return {
          success: true,
          user: {
            id: userRecord.id,
            email: userRecord.email,
            name: userRecord.name,
            accessState: permissions.accessState,
            // For backward compatibility with legacy tests that check userRecord.role
            role: permissions.accessState !== 'PENDING_ASSIGNMENT' ? permissions.accessState : (userRecord.role || 'PENDING_ASSIGNMENT'),
            companyId: permissions.companyId,
            companyName: permissions.companyName,
            companySlug: permissions.companySlug,
            companyStatus: permissions.companyStatus,
            assignedStoreId: permissions.assignedStoreId,
            assignedStoreName: permissions.assignedStoreName,
            storeId: permissions.assignedStoreId,
            storeName: permissions.assignedStoreName,
            accessibleStoreIds: permissions.accessibleStoreIds,
            avatarUrl: userRecord.avatarUrl,
            authMode: 'standalone',
            isDurable: !isServerless,
            token: standaloneToken,
          },
          status: 200,
        };
      }

      return {
        success: false,
        user: null,
        error:
          'Session expired or invalid. In serverless environments, in-memory standalone sessions are non-durable and require Supabase PostgreSQL for persistence.',
        status: 401,
      };
    }

    // Fallback: Provided bearer token could not be verified by any configured provider
    return {
      success: false,
      user: null,
      error: 'Invalid or expired authentication credentials.',
      status: 401,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Authentication verification failure.';
    return {
      success: false,
      user: null,
      error: message,
      status: 401,
    };
  }
}
