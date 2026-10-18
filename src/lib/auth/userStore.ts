import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  storeName?: string;
  role: 'STORE_MANAGER' | 'INVENTORY_LEAD' | 'ASSOCIATE' | 'EVALUATOR';
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

// In-Memory caches
let usersCache: Map<string, UserRecord> | null = null;
const sessionsCache: Map<string, SessionRecord> = new Map();

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

  // Ensure default seed store manager exists
  const seedEmail = 'manager@store101.com';
  if (!usersCache.has(seedEmail)) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword('Sentinel2026!', salt);
    const defaultManager: UserRecord = {
      id: 'usr-default-manager',
      email: seedEmail,
      name: 'Elena Rostova',
      storeName: 'Downtown Supercenter #101',
      role: 'STORE_MANAGER',
      passwordHash: hash,
      salt,
      provider: 'email',
      createdAt: new Date().toISOString(),
    };
    usersCache.set(seedEmail, defaultManager);
    saveUsersToDisk();
  }

  return usersCache;
}

function saveUsersToDisk() {
  if (!usersCache) return;
  const { usersFile } = getStoragePaths();
  try {
    const array = Array.from(usersCache.values());
    fs.writeFileSync(/*turbopackIgnore: true*/ usersFile, JSON.stringify(array, null, 2), 'utf-8');
  } catch (err) {
    // Graceful error handling for serverless read-only contexts
    console.warn('[UserStore] Could not persist users to disk:', err);
  }
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const users = loadUsers();
  return users.get(email.toLowerCase().trim()) || null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
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
    storeName: params.storeName?.trim() || 'Retail Supercenter #101',
    role: params.role || 'STORE_MANAGER',
    passwordHash,
    salt,
    provider: params.provider || 'email',
    avatarUrl: params.avatarUrl,
    createdAt: new Date().toISOString(),
  };

  users.set(cleanEmail, newUser);
  saveUsersToDisk();

  return newUser;
}

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
    storeName: 'Retail Supercenter #101',
    role: 'STORE_MANAGER',
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
