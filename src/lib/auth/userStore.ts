import crypto from 'crypto';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isValidUuid(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

import fs from 'fs';
import path from 'path';
import { isSupabaseServerConfigured, getSupabaseServerClient } from '@/lib/db/supabaseServer';

export type UserAccessState =
  | 'PLATFORM_ADMIN'
  | 'COMPANY_MANAGER'
  | 'STORE_MANAGER'
  | 'PENDING_ASSIGNMENT'
  | 'SUSPENDED';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  storeName?: string;
  role: UserAccessState | 'INVENTORY_LEAD' | 'ASSOCIATE' | 'EVALUATOR';
  accessState?: UserAccessState;
  companyId?: string;
  assignedStoreId?: string;
  passwordHash?: string;
  salt?: string;
  provider: 'email' | 'google';
  avatarUrl?: string;
  createdAt: string;
}

interface SessionRecord {
  token: string;
  userId: string;
  expiresAt: number;
}

export interface StandaloneCompanyMembership {
  companyId: string;
  companyName: string;
  companySlug: string;
  companyStatus: 'PENDING_ONBOARDING' | 'ACTIVE' | 'SUSPENDED';
  userId: string;
  role: 'COMPANY_MANAGER' | 'STORE_MANAGER';
  status: 'ACTIVE' | 'SUSPENDED';
}

export interface StandaloneStoreAssignment {
  companyId: string;
  storeId: string;
  storeName?: string;
  userId: string;
}

export interface StandaloneCompany {
  id: string;
  name: string;
  slug: string;
  maxStores: number;
  status: 'PENDING_ONBOARDING' | 'ACTIVE' | 'SUSPENDED';
  isDemo: boolean;
  createdBy: string;
  createdAt: string;
}

export interface StandaloneInvitation {
  id: string;
  companyId: string;
  companyName?: string;
  storeId?: string;
  storeName?: string;
  email: string;
  role: 'COMPANY_MANAGER' | 'STORE_MANAGER';
  tokenHash: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED' | 'DECLINED';
  invitedBy: string;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
}

// In-Memory caches for standalone identity and role resolution
let usersCache: Map<string, UserRecord> | null = null;
const sessionsCache: Map<string, SessionRecord> = new Map();
const platformAdminsCache: Set<string> = new Set();
const membershipsCache: Map<string, StandaloneCompanyMembership> = new Map();
const assignmentsCache: Map<string, StandaloneStoreAssignment> = new Map();
const companyStoresCache: Map<string, { id: string; name: string; code?: string; location?: string }[]> = new Map();
const companiesCache: Map<string, StandaloneCompany> = new Map();
const invitationsCache: Map<string, StandaloneInvitation> = new Map(); // key: tokenHash

// File persistence paths (Local workspace or /tmp for Vercel Serverless)
function getStoragePaths() {
  const localDir = path.join(process.cwd(), 'data');
  const tmpDir = path.join('/tmp', 'stocksentinel');

  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return { dir: localDir, usersFile: path.join(localDir, 'users.json') };
  } catch {
    if (!fs.existsSync(tmpDir)) {
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
      } catch {
        // Fallback to in-memory only
      }
    }
    return { dir: tmpDir, usersFile: path.join(tmpDir, 'users.json') };
  }
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function loadUsers(): Map<string, UserRecord> {
  if (usersCache) return usersCache;

  usersCache = new Map();
  const { usersFile } = getStoragePaths();

  try {
    if (fs.existsSync(/*turbopackIgnore: true*/ usersFile)) {
      const data = fs.readFileSync(/*turbopackIgnore: true*/ usersFile, 'utf-8');
      const parsed: UserRecord[] = JSON.parse(data);
      for (const u of parsed) {
        usersCache.set(u.email.toLowerCase(), u);
      }
    }
  } catch (err) {
    console.warn('[UserStore] Could not read users file, using memory store:', err);
  }

  return usersCache;
}

function saveUsersToDisk() {
  if (!usersCache) return;
  const { usersFile } = getStoragePaths();
  try {
    const array = Array.from(usersCache.values());
    const tmpPath = `${usersFile}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(/*turbopackIgnore: true*/ tmpPath, JSON.stringify(array, null, 2), 'utf-8');
    try {
      fs.renameSync(tmpPath, usersFile);
    } catch {
      fs.writeFileSync(/*turbopackIgnore: true*/ usersFile, JSON.stringify(array, null, 2), 'utf-8');
      try { fs.unlinkSync(tmpPath); } catch {}
    }
  } catch (err) {
    console.warn('[UserStore] Could not persist users to disk:', err);
  }
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const users = loadUsers();
  return users.get(email.toLowerCase().trim()) || null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  if (isSupabaseServerConfigured()) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, name, role')
          .eq('id', id)
          .maybeSingle();

        if (profile) {
          return {
            id: profile.id,
            email: profile.email,
            name: profile.name,
            role: profile.role || 'STORE_MANAGER',
            provider: 'email',
            createdAt: new Date().toISOString(),
          };
        }
      } catch {}
    }
  }

  const users = loadUsers();
  for (const u of users.values()) {
    if (u.id === id) return u;
  }
  return null;
}

export async function createUser(params: {
  email: string;
  password?: string;
  name: string;
  storeName?: string;
  role?: UserRecord['role'];
  provider?: 'email' | 'google';
  avatarUrl?: string;
}): Promise<UserRecord> {
  const users = loadUsers();
  const cleanEmail = params.email.toLowerCase().trim();

  if (users.has(cleanEmail)) {
    throw new Error('An account with this email address already exists.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = params.password ? hashPassword(params.password, salt) : undefined;

  const newUser: UserRecord = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: cleanEmail,
    name: params.name.trim() || cleanEmail.split('@')[0],
    storeName: params.storeName?.trim() || 'Retail Operations',
    // Default to PENDING_ASSIGNMENT unless explicitly set by a trusted administrative test helper
    role: params.role || 'PENDING_ASSIGNMENT',
    passwordHash,
    salt,
    provider: params.provider || 'email',
    avatarUrl: params.avatarUrl,
    createdAt: new Date().toISOString(),
  };

  users.set(cleanEmail, newUser);
  saveUsersToDisk();

  // If role is explicitly specified by a trusted test fixture or administrative harness,
  // link the mock standalone membership and store assignment
  if (params.role === 'STORE_MANAGER') {
    const companyId = crypto.randomUUID();
    const storeId = crypto.randomUUID();
    const storeName = params.storeName?.trim() || 'Store #101';
    setCompanyMembership({
      userId: newUser.id,
      companyId,
      companyName: 'Test Retail Corp',
      companySlug: `test-corp-${newUser.id}`,
      role: 'STORE_MANAGER',
      status: 'ACTIVE',
      companyStatus: 'ACTIVE',
    });
    setStoreAssignment({
      userId: newUser.id,
      companyId,
      storeId,
      storeName,
    });
    setCompanyStores(companyId, [
      { id: storeId, name: storeName },
    ]);
  } else if (params.role === 'COMPANY_MANAGER') {
    const companyId = crypto.randomUUID();
    const storeId = crypto.randomUUID();
    const storeName = params.storeName?.trim() || 'Store #101';
    setCompanyMembership({
      userId: newUser.id,
      companyId,
      companyName: 'Test Retail Corp',
      companySlug: `test-corp-${newUser.id}`,
      role: 'COMPANY_MANAGER',
      status: 'ACTIVE',
      companyStatus: 'ACTIVE',
    });
    setCompanyStores(companyId, [
      { id: storeId, name: storeName },
    ]);
  }

  return newUser;
}

/**
 * Creates or updates a Google OAuth user record.
 * Security Guarantee: Never automatically promotes newly authenticated Google users
 * to operational manager roles. Accounts default to PENDING_ASSIGNMENT until linked
 * to a verified company membership or invitation.
 */
export async function createOrUpdateGoogleUser(params: {
  email: string;
  name: string;
  avatarUrl?: string;
  sub?: string;
}): Promise<UserRecord> {
  const users = loadUsers();
  const cleanEmail = params.email.toLowerCase().trim();
  const existing = users.get(cleanEmail);

  if (existing) {
    if (params.avatarUrl && !existing.avatarUrl) {
      existing.avatarUrl = params.avatarUrl;
    }
    if (params.name && (!existing.name || existing.name === cleanEmail.split('@')[0])) {
      existing.name = params.name;
    }
    saveUsersToDisk();
    return existing;
  }

  return createUser({
    email: cleanEmail,
    name: params.name || cleanEmail.split('@')[0],
    storeName: 'Pending Organization Assignment',
    role: 'PENDING_ASSIGNMENT',
    provider: 'google',
    avatarUrl: params.avatarUrl,
  });
}

export async function verifyCredentials(email: string, password: string): Promise<UserRecord | null> {
  const user = await findUserByEmail(email);
  if (!user || !user.passwordHash || !user.salt) return null;

  const attemptHash = hashPassword(password, user.salt);
  if (crypto.timingSafeEqual(Buffer.from(attemptHash), Buffer.from(user.passwordHash))) {
    return user;
  }
  return null;
}

export async function updatePassword(email: string, newPassword: string): Promise<boolean> {
  const users = loadUsers();
  const user = users.get(email.toLowerCase().trim());
  if (!user) return false;

  const salt = crypto.randomBytes(16).toString('hex');
  user.salt = salt;
  user.passwordHash = hashPassword(newPassword, salt);
  saveUsersToDisk();
  return true;
}

export async function createSession(user: UserRecord): Promise<string> {
  const token = `ses_${crypto.randomBytes(32).toString('hex')}`;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  sessionsCache.set(token, {
    token,
    userId: user.id,
    expiresAt: Date.now() + sevenDaysMs,
  });
  return token;
}

export async function verifySession(token: string): Promise<UserRecord | null> {
  if (!token) return null;
  const session = sessionsCache.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    sessionsCache.delete(token);
    return null;
  }

  return findUserById(session.userId);
}

export async function destroySession(token: string): Promise<void> {
  if (token) {
    sessionsCache.delete(token);
  }
}

// ====================================================================
// Standalone RBAC Resolution Helpers (Development & Standalone Mode)
// ====================================================================

export async function findPlatformAdmin(userId: string): Promise<boolean> {
  return platformAdminsCache.has(userId);
}

export async function findCompanyMembership(userId: string): Promise<StandaloneCompanyMembership | null> {
  return membershipsCache.get(userId) || null;
}

export async function findStoreAssignment(userId: string): Promise<StandaloneStoreAssignment | null> {
  return assignmentsCache.get(userId) || null;
}

export async function findCompanyStores(companyId: string): Promise<{ id: string; name: string; code?: string; location?: string }[]> {
  if (isSupabaseServerConfigured() && isValidUuid(companyId)) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('stores')
          .select('id, name, code, location')
          .eq('company_id', companyId)
          .order('name');

        if (!error && data && data.length > 0) {
          return data;
        }
      } catch {}
    }
  }

  return companyStoresCache.get(companyId) || [];
}

export function setPlatformAdmin(userId: string, isAdmin: boolean): void {
  if (isAdmin) {
    platformAdminsCache.add(userId);
  } else {
    platformAdminsCache.delete(userId);
  }
}

export function setCompanyMembership(membership: StandaloneCompanyMembership): void {
  membershipsCache.set(membership.userId, membership);
  if (!companiesCache.has(membership.companyId)) {
    companiesCache.set(membership.companyId, {
      id: membership.companyId,
      name: membership.companyName || 'Retail Operations',
      slug: membership.companySlug || 'retail-ops',
      maxStores: 10,
      status: (membership.companyStatus as 'ACTIVE') || 'ACTIVE',
      isDemo: false,
      createdBy: membership.userId,
      createdAt: new Date().toISOString(),
    });
  }
}

export function setStoreAssignment(assignment: StandaloneStoreAssignment): void {
  assignmentsCache.set(assignment.userId, assignment);
}

export function setCompanyStores(
  companyId: string,
  stores: { id: string; name: string; code?: string; location?: string }[]
): void {
  companyStoresCache.set(companyId, stores);
}

export function addCompanyStore(
  companyId: string,
  store: { id: string; name: string; code?: string; location?: string }
): void {
  const existing = companyStoresCache.get(companyId) || [];
  if (!existing.some((s) => s.id === store.id)) {
    companyStoresCache.set(companyId, [...existing, store]);
  }
}

export async function getStoreAssignmentsForCompany(companyId: string): Promise<StandaloneStoreAssignment[]> {
  if (isSupabaseServerConfigured() && isValidUuid(companyId)) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('store_assignments')
          .select('company_id, store_id, user_id, assigned_at')
          .eq('company_id', companyId);

        if (!error && data && data.length > 0) {
          return data.map((d) => ({
            companyId: d.company_id,
            storeId: d.store_id,
            userId: d.user_id,
            assignedAt: d.assigned_at,
          }));
        }
      } catch {}
    }
  }

  return Array.from(assignmentsCache.values()).filter((a) => a.companyId === companyId);
}

export function getAllPlatformAdminUserIds(): string[] {
  return Array.from(platformAdminsCache);
}

export function findCompanyBySlug(slug: string): StandaloneCompany | null {
  const cleanSlug = slug.toLowerCase().trim();
  for (const c of companiesCache.values()) {
    if (c.slug === cleanSlug) return c;
  }
  return null;
}

import { extractInvitationToken } from './invitationTokens';
export { extractInvitationToken } from './invitationTokens';

export function hashInvitationToken(token: string): string {
  const clean = extractInvitationToken(token);
  return crypto.createHash('sha256').update(clean.trim()).digest('hex');
}

export function createStandaloneCompany(data: {
  name: string;
  slug: string;
  maxStores?: number;
  createdBy: string;
}): StandaloneCompany {
  const id = crypto.randomUUID();
  const company: StandaloneCompany = {
    id,
    name: data.name.trim(),
    slug: data.slug.toLowerCase().trim(),
    maxStores: data.maxStores || 5,
    status: 'ACTIVE',
    isDemo: false,
    createdBy: data.createdBy,
    createdAt: new Date().toISOString(),
  };
  companiesCache.set(id, company);
  return company;
}

export function getStandaloneCompany(id: string): StandaloneCompany | null {
  return companiesCache.get(id) || null;
}

export async function findCompanyById(companyId: string): Promise<StandaloneCompany | null> {
  if (isSupabaseServerConfigured()) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('id, name, slug, status, max_stores, is_demo, created_by, created_at')
          .eq('id', companyId)
          .maybeSingle();

        if (!error && data) {
          return {
            id: data.id,
            name: data.name,
            slug: data.slug,
            status: data.status as 'PENDING_ONBOARDING' | 'ACTIVE' | 'SUSPENDED',
            maxStores: data.max_stores ?? 5,
            isDemo: Boolean(data.is_demo),
            createdBy: data.created_by,
            createdAt: data.created_at,
          };
        }
      } catch {}
    }
  }

  return companiesCache.get(companyId) || null;
}

export async function updateCompanyName(
  companyId: string,
  newName: string
): Promise<StandaloneCompany | null> {
  const cleanName = newName.trim();
  if (isSupabaseServerConfigured()) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('companies')
          .update({ name: cleanName, updated_at: new Date().toISOString() })
          .eq('id', companyId)
          .select('id, name, slug, status, max_stores, is_demo, created_by, created_at')
          .maybeSingle();

        if (!error && data) {
          const updated: StandaloneCompany = {
            id: data.id,
            name: data.name,
            slug: data.slug,
            status: data.status as 'PENDING_ONBOARDING' | 'ACTIVE' | 'SUSPENDED',
            maxStores: data.max_stores ?? 5,
            isDemo: Boolean(data.is_demo),
            createdBy: data.created_by,
            createdAt: data.created_at,
          };
          companiesCache.set(companyId, updated);
          return updated;
        }
      } catch {}
    }
  }

  const comp = companiesCache.get(companyId);
  if (!comp) return null;
  comp.name = cleanName;
  return comp;
}

export function getAllStandaloneCompanies(): StandaloneCompany[] {
  return Array.from(companiesCache.values());
}

export function updateStandaloneCompanyStatus(
  id: string,
  status: 'ACTIVE' | 'SUSPENDED'
): StandaloneCompany | null {
  const comp = companiesCache.get(id);
  if (!comp) return null;
  comp.status = status;

  // Propagate suspension status to associated memberships
  for (const m of membershipsCache.values()) {
    if (m.companyId === id) {
      m.companyStatus = status;
    }
  }
  return comp;
}

export function createStandaloneInvitation(data: {
  companyId: string;
  companyName?: string;
  storeId?: string;
  storeName?: string;
  email: string;
  role: 'COMPANY_MANAGER' | 'STORE_MANAGER';
  tokenHash: string;
  invitedBy: string;
  expiresInDays?: number;
}): StandaloneInvitation {
  const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const expiresAt = new Date(Date.now() + (data.expiresInDays || 7) * 24 * 60 * 60 * 1000).toISOString();
  const invitation: StandaloneInvitation = {
    id,
    companyId: data.companyId,
    companyName: data.companyName,
    storeId: data.storeId,
    storeName: data.storeName,
    email: data.email.toLowerCase().trim(),
    role: data.role,
    tokenHash: data.tokenHash,
    status: 'PENDING',
    invitedBy: data.invitedBy,
    expiresAt,
    createdAt: new Date().toISOString(),
  };
  invitationsCache.set(data.tokenHash, invitation);
  return invitation;
}

export function getStandaloneInvitationByHash(tokenHash: string): StandaloneInvitation | null {
  const inv = invitationsCache.get(tokenHash);
  if (!inv) return null;
  if (inv.status === 'PENDING' && new Date(inv.expiresAt).getTime() < Date.now()) {
    inv.status = 'EXPIRED';
  }
  return inv;
}

export function getStandaloneCompanyInvitations(companyId: string): StandaloneInvitation[] {
  return Array.from(invitationsCache.values()).filter((i) => i.companyId === companyId);
}

export async function getCompanyInvitations(companyId: string): Promise<StandaloneInvitation[]> {
  if (isSupabaseServerConfigured()) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('invitations')
          .select('id, company_id, store_id, email, role, status, expires_at, accepted_at, created_at, companies(name), stores(name)')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((inv) => {
            const comp = Array.isArray(inv.companies) ? inv.companies[0] : (inv.companies as { name: string } | null);
            const str = Array.isArray(inv.stores) ? inv.stores[0] : (inv.stores as { name: string } | null);
            return {
              id: inv.id,
              companyId: inv.company_id,
              companyName: comp?.name || 'Retail Operations',
              storeId: inv.store_id || undefined,
              storeName: str?.name || undefined,
              email: inv.email,
              role: inv.role as 'COMPANY_MANAGER' | 'STORE_MANAGER',
              tokenHash: '', // Withheld for security
              status: inv.status as 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED',
              invitedBy: '',
              expiresAt: inv.expires_at,
              acceptedAt: inv.accepted_at || undefined,
              createdAt: inv.created_at,
            };
          });
        }
      } catch {}
    }
  }

  return getStandaloneCompanyInvitations(companyId);
}

export async function createCompanyInvitation(data: {
  companyId: string;
  companyName?: string;
  storeId?: string;
  storeName?: string;
  email: string;
  role: 'COMPANY_MANAGER' | 'STORE_MANAGER';
  tokenHash: string;
  invitedBy: string;
  expiresInDays?: number;
}): Promise<StandaloneInvitation> {
  const expiresAt = new Date(Date.now() + (data.expiresInDays || 7) * 24 * 60 * 60 * 1000).toISOString();
  const invitationId = crypto.randomUUID();

  if (isSupabaseServerConfigured()) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data: invRow, error } = await supabase
          .from('invitations')
          .insert({
            id: invitationId,
            company_id: data.companyId,
            store_id: data.storeId || null,
            email: data.email.toLowerCase().trim(),
            role: data.role,
            token_hash: data.tokenHash,
            status: 'PENDING',
            invited_by: data.invitedBy,
            expires_at: expiresAt,
          })
          .select('id, company_id, store_id, email, role, token_hash, status, invited_by, expires_at, created_at')
          .single();

        if (!error && invRow) {
          const inv: StandaloneInvitation = {
            id: invRow.id,
            companyId: invRow.company_id,
            companyName: data.companyName || 'Retail Operations',
            storeId: invRow.store_id || undefined,
            storeName: data.storeName,
            email: invRow.email,
            role: invRow.role as 'COMPANY_MANAGER' | 'STORE_MANAGER',
            tokenHash: data.tokenHash,
            status: 'PENDING',
            invitedBy: invRow.invited_by,
            expiresAt: invRow.expires_at,
            createdAt: invRow.created_at,
          };
          invitationsCache.set(data.tokenHash, inv);
          return inv;
        }
      } catch {}
    }
  }

  return createStandaloneInvitation(data);
}

export async function revokeCompanyInvitation(companyId: string, invitationId: string): Promise<boolean> {
  if (isSupabaseServerConfigured() && isValidUuid(companyId)) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { error } = await supabase
          .from('invitations')
          .update({ status: 'REVOKED' })
          .eq('company_id', companyId)
          .eq('id', invitationId)
          .eq('status', 'PENDING');

        if (!error) {
          revokeStandaloneInvitation(companyId, invitationId);
          return true;
        }
      } catch {}
    }
  }

  return revokeStandaloneInvitation(companyId, invitationId);
}

export async function resendCompanyInvitation(
  companyId: string,
  invitationId: string,
  newTokenHash: string,
  expiresInDays: number = 7
): Promise<StandaloneInvitation | null> {
  const newExpiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  if (isSupabaseServerConfigured() && isValidUuid(companyId)) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('invitations')
          .update({
            token_hash: newTokenHash,
            status: 'PENDING',
            expires_at: newExpiresAt,
          })
          .eq('company_id', companyId)
          .eq('id', invitationId)
          .select('id, company_id, store_id, email, role, status, expires_at, created_at, companies(name), stores(name)')
          .maybeSingle();

        if (!error && data) {
          const comp = Array.isArray(data.companies) ? data.companies[0] : (data.companies as { name: string } | null);
          const str = Array.isArray(data.stores) ? data.stores[0] : (data.stores as { name: string } | null);
          const inv: StandaloneInvitation = {
            id: data.id,
            companyId: data.company_id,
            companyName: comp?.name || 'Retail Operations',
            storeId: data.store_id || undefined,
            storeName: str?.name,
            email: data.email,
            role: data.role as 'COMPANY_MANAGER' | 'STORE_MANAGER',
            tokenHash: newTokenHash,
            status: 'PENDING',
            invitedBy: '',
            expiresAt: data.expires_at,
            createdAt: data.created_at,
          };
          invitationsCache.set(newTokenHash, inv);
          return inv;
        }
      } catch {}
    }
  }

  return resendStandaloneInvitation(companyId, invitationId, newTokenHash, expiresInDays);
}

export function revokeStandaloneInvitation(companyId: string, invitationId: string): boolean {
  for (const inv of invitationsCache.values()) {
    if (inv.companyId === companyId && (inv.id === invitationId || inv.tokenHash === invitationId)) {
      if (inv.status === 'ACCEPTED') return false;
      inv.status = 'REVOKED';
      return true;
    }
  }
  return false;
}

export function resendStandaloneInvitation(
  companyId: string,
  invitationId: string,
  newTokenHash: string,
  expiresInDays: number = 7
): StandaloneInvitation | null {
  for (const [hash, inv] of invitationsCache.entries()) {
    if (inv.companyId === companyId && (inv.id === invitationId || inv.tokenHash === invitationId)) {
      if (inv.status === 'ACCEPTED') return null;
      invitationsCache.delete(hash);
      inv.tokenHash = newTokenHash;
      inv.status = 'PENDING';
      inv.expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
      invitationsCache.set(newTokenHash, inv);
      return inv;
    }
  }
  return null;
}

export function acceptStandaloneInvitation(
  tokenHash: string,
  userId: string,
  userEmail?: string
): { success: boolean; error?: string; invitation?: StandaloneInvitation } {
  const effectiveHash =
    tokenHash.length === 64 && /^[a-f0-9]{64}$/i.test(tokenHash) && invitationsCache.has(tokenHash)
      ? tokenHash
      : hashInvitationToken(tokenHash);

  const inv = getStandaloneInvitationByHash(effectiveHash) || getStandaloneInvitationByHash(tokenHash);
  if (!inv) {
    return { success: false, error: 'Invitation not found.' };
  }
  if (userEmail && inv.email.toLowerCase().trim() !== userEmail.toLowerCase().trim()) {
    return {
      success: false,
      error: `This invitation was issued to "${inv.email}". Current account is "${userEmail}".`,
    };
  }
  if (inv.status === 'ACCEPTED') {
    return { success: false, error: 'This invitation has already been accepted.' };
  }
  if (inv.status === 'EXPIRED' || new Date(inv.expiresAt).getTime() < Date.now()) {
    inv.status = 'EXPIRED';
    return { success: false, error: 'This invitation has expired.' };
  }
  if (inv.status === 'REVOKED') {
    return { success: false, error: 'This invitation has been revoked.' };
  }
  if (inv.status === 'DECLINED') {
    return { success: false, error: 'This invitation has been declined.' };
  }

  // Bind membership and store assignment
  const company = companiesCache.get(inv.companyId);
  const companyName = company?.name || inv.companyName || 'Retail Operations';
  const companySlug = company?.slug || 'retail-ops';

  setCompanyMembership({
    userId,
    companyId: inv.companyId,
    companyName,
    companySlug,
    role: inv.role,
    status: 'ACTIVE',
    companyStatus: company?.status || 'ACTIVE',
  });

  if (inv.role === 'STORE_MANAGER' && inv.storeId) {
    setStoreAssignment({
      userId,
      companyId: inv.companyId,
      storeId: inv.storeId,
      storeName: inv.storeName,
    });
  }

  inv.status = 'ACCEPTED';
  inv.acceptedAt = new Date().toISOString();

  return { success: true, invitation: inv };
}

/**
 * Retrieves all pending invitations for a verified user email.
 * Safe for client display (token hashes are strictly omitted).
 */
export async function getUserInvitations(email: string): Promise<StandaloneInvitation[]> {
  const cleanEmail = email.toLowerCase().trim();

  if (isSupabaseServerConfigured()) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('invitations')
          .select('id, company_id, store_id, email, role, status, invited_by, expires_at, accepted_at, created_at, companies(name, status), stores(name)')
          .eq('email', cleanEmail)
          .eq('status', 'PENDING')
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false });

        if (!error && data) {
          return data.map((inv) => {
            const comp = Array.isArray(inv.companies) ? inv.companies[0] : (inv.companies as { name: string; status?: string } | null);
            const str = Array.isArray(inv.stores) ? inv.stores[0] : (inv.stores as { name: string } | null);
            return {
              id: inv.id,
              companyId: inv.company_id,
              companyName: comp?.name || 'Retail Operations',
              storeId: inv.store_id || undefined,
              storeName: str?.name || 'Assigned Store',
              email: inv.email,
              role: inv.role as 'COMPANY_MANAGER' | 'STORE_MANAGER',
              tokenHash: '', // Withheld for security
              status: inv.status,
              invitedBy: inv.invited_by || '',
              expiresAt: inv.expires_at,
              acceptedAt: inv.accepted_at || undefined,
              createdAt: inv.created_at,
            };
          });
        }
      } catch (err) {
        console.warn('[UserStore] Error fetching user invitations from Supabase:', err);
      }
    }
  }

  // Standalone in-memory fallback
  const results: StandaloneInvitation[] = [];
  const now = Date.now();
  for (const inv of invitationsCache.values()) {
    if (inv.email.toLowerCase().trim() === cleanEmail && inv.status === 'PENDING') {
      if (new Date(inv.expiresAt).getTime() > now) {
        results.push({ ...inv, tokenHash: '' });
      } else {
        inv.status = 'EXPIRED';
      }
    }
  }
  return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Declines a pending invitation issued to the authenticated caller's email.
 */
export async function declineInvitation(invitationId: string, userEmail: string): Promise<boolean> {
  const cleanEmail = userEmail.toLowerCase().trim();

  if (isSupabaseServerConfigured()) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { error } = await supabase
          .from('invitations')
          .update({ status: 'DECLINED' })
          .eq('id', invitationId)
          .eq('email', cleanEmail)
          .eq('status', 'PENDING');

        if (!error) return true;

        // Fallback to REVOKED if check constraint doesn't yet support DECLINED
        const { error: fallbackError } = await supabase
          .from('invitations')
          .update({ status: 'REVOKED' })
          .eq('id', invitationId)
          .eq('email', cleanEmail)
          .eq('status', 'PENDING');

        return !fallbackError;
      } catch (err) {
        console.warn('[UserStore] Error declining invitation in Supabase:', err);
      }
    }
  }

  // Standalone fallback
  for (const inv of invitationsCache.values()) {
    if (inv.id === invitationId && inv.email.toLowerCase().trim() === cleanEmail && inv.status === 'PENDING') {
      inv.status = 'DECLINED';
      return true;
    }
  }
  return false;
}

/**
 * Atomically accepts an invitation by its database ID for an authenticated user with matching verified email.
 */
export async function acceptInvitationById(
  invitationId: string,
  userId: string,
  userEmail: string,
  userAccessToken?: string
): Promise<{
  success: boolean;
  error?: string;
  companyId?: string;
  companyName?: string;
  storeId?: string;
  storeName?: string;
  role?: string;
}> {
  const cleanEmail = userEmail.toLowerCase().trim();

  if (isSupabaseServerConfigured()) {
    const supabase = getSupabaseServerClient(userAccessToken);
    if (supabase) {
      try {
        // Query invitation token_hash securely on server side
        const { data: invRow, error: fetchErr } = await supabase
          .from('invitations')
          .select('id, token_hash, email, status, expires_at')
          .eq('id', invitationId)
          .maybeSingle();

        if (fetchErr || !invRow) {
          return { success: false, error: 'Invitation not found.' };
        }

        if (invRow.email.toLowerCase().trim() !== cleanEmail) {
          return {
            success: false,
            error: `This invitation was issued to "${invRow.email}". Current account is "${userEmail}".`,
          };
        }

        if (invRow.status === 'ACCEPTED') {
          return { success: false, error: 'This invitation has already been accepted.' };
        }

        if (invRow.status === 'EXPIRED' || new Date(invRow.expires_at).getTime() < Date.now()) {
          return { success: false, error: 'This invitation has expired.' };
        }

        if (invRow.status === 'REVOKED' || invRow.status === 'DECLINED') {
          return { success: false, error: 'This invitation is no longer active.' };
        }

        // Invoke the atomic stored procedure with the row's token_hash
        const { data, error } = await supabase.rpc('accept_invitation', {
          p_token_hash: invRow.token_hash,
        });

        if (error) {
          // If RPC doesn't exist or table missing, fall through to standalone; otherwise return error
          const isMissingDbObject =
            error.code === '42883' ||
            error.code === '42P01' ||
            error.code === 'PGRST202' ||
            error.message?.toLowerCase().includes('schema cache') ||
            error.message?.toLowerCase().includes('could not find the function');

          if (!isMissingDbObject) {
            return { success: false, error: error.message };
          }
        }

        if (!error && data) {
          const acceptedRow = Array.isArray(data) ? data[0] : data;
          let companyName = 'Retail Operations';
          let storeName = 'Assigned Store';

          if (acceptedRow?.company_id) {
            const { data: comp } = await supabase
              .from('companies')
              .select('name')
              .eq('id', acceptedRow.company_id)
              .maybeSingle();
            if (comp?.name) companyName = comp.name;
          }

          if (acceptedRow?.store_id) {
            const { data: store } = await supabase
              .from('stores')
              .select('name')
              .eq('id', acceptedRow.store_id)
              .maybeSingle();
            if (store?.name) storeName = store.name;
          }

          return {
            success: true,
            companyId: acceptedRow?.company_id,
            companyName,
            storeId: acceptedRow?.store_id,
            storeName,
            role: acceptedRow?.role,
          };
        }
      } catch (err) {
        console.warn('[UserStore] Error in acceptInvitationById via Supabase:', err);
      }
    }
  }

  // Standalone fallback
  for (const inv of invitationsCache.values()) {
    if (inv.id === invitationId) {
      if (inv.email.toLowerCase().trim() !== cleanEmail) {
        return {
          success: false,
          error: `This invitation was issued to "${inv.email}". Current account is "${userEmail}".`,
        };
      }
      const res = acceptStandaloneInvitation(inv.tokenHash, userId, userEmail);
      if (!res.success) return { success: false, error: res.error };
      return {
        success: true,
        companyId: res.invitation?.companyId,
        companyName: res.invitation?.companyName,
        storeId: res.invitation?.storeId,
        storeName: res.invitation?.storeName,
        role: res.invitation?.role,
      };
    }
  }

  return { success: false, error: 'Invitation not found.' };
}

export function clearRbacCaches(): void {
  platformAdminsCache.clear();
  membershipsCache.clear();
  assignmentsCache.clear();
  companyStoresCache.clear();
  companiesCache.clear();
  invitationsCache.clear();
}
