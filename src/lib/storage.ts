import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  Alert,
  AlertStatus,
  AuditLogEntry,
  ChatConversation,
  ChatMessage,
  ChatRole,
  DailySale,
  DetectionRun,
  InventorySnapshot,
  Product,
  Promotion,
  Store,
  VerificationOutcome,
} from '@/types';
import { getInitialDemoState } from './demoData';
import { getSupabaseClient, isSupabaseConfigured } from './db/supabaseClient';
import { getSupabaseServerClient, isSupabaseServerConfigured } from './db/supabaseServer';
import { resolveDemoStoreId, expandStoreIds } from './storeResolver';
import { SupabaseClient } from '@supabase/supabase-js';

// Store structure
interface InMemoryStore {
  stores: Store[];
  products: Product[];
  sales: DailySale[];
  inventory: InventorySnapshot[];
  promotions: Promotion[];
  detectionRuns: DetectionRun[];
  alerts: Alert[];
  auditLogs: AuditLogEntry[];
  conversations?: ChatConversation[];
  messages?: ChatMessage[];
}

let memoryState: InMemoryStore | null = null;

function getDbClient(): SupabaseClient | null {
  return getSupabaseServerClient() || getSupabaseClient();
}

function getDbFilePath(): string {
  const localDir = path.join(process.cwd(), 'data');
  const tmpDir = path.join('/tmp', 'stocksentinel');
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    return path.join(localDir, 'store_state.json');
  } catch {
    try {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      return path.join(tmpDir, 'store_state.json');
    } catch {
      return '';
    }
  }
}

function persistStorageToDisk(state: InMemoryStore) {
  try {
    const filePath = getDbFilePath();
    if (filePath) {
      const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      fs.writeFileSync(/*turbopackIgnore: true*/ tmpPath, JSON.stringify(state, null, 2), 'utf-8');
      try {
        fs.renameSync(tmpPath, filePath);
      } catch {
        fs.writeFileSync(/*turbopackIgnore: true*/ filePath, JSON.stringify(state, null, 2), 'utf-8');
        try { fs.unlinkSync(tmpPath); } catch {}
      }
    }
  } catch (err) {
    console.warn('[Storage] Could not persist state to disk:', err);
  }
}

export function getMemoryStore(): InMemoryStore {
  if (!memoryState) {
    const filePath = getDbFilePath();
    if (filePath && fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
      try {
        const content = fs.readFileSync(/*turbopackIgnore: true*/ filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed && Array.isArray(parsed.stores) && Array.isArray(parsed.alerts)) {
          if (!Array.isArray(parsed.conversations)) parsed.conversations = [];
          if (!Array.isArray(parsed.messages)) parsed.messages = [];
          memoryState = parsed;
          return memoryState!;
        }
      } catch (err) {
        console.warn('[Storage] Error reading db file, falling back to seed:', err);
      }
    }

    const initial = getInitialDemoState();
    const initialLogs: AuditLogEntry[] = [
      {
        id: 'log-01',
        alert_id: initial.alerts[1]?.id || 'alert-02',
        previous_status: 'OPEN',
        new_status: 'VERIFIED',
        outcome: 'PHANTOM_CONFIRMED',
        shelf_count: 0,
        notes: initial.alerts[1]?.investigation_notes || 'Shelf physically verified empty.',
        changed_by: initial.alerts[1]?.verified_by || 'Marcus Chen',
        created_at: initial.alerts[1]?.verified_at || '2026-10-17T09:42:00Z',
      },
      {
        id: 'log-02',
        alert_id: initial.alerts[3]?.id || 'alert-04',
        previous_status: 'OPEN',
        new_status: 'VERIFIED',
        outcome: 'BACKROOM_DISPLACED',
        shelf_count: 0,
        notes: initial.alerts[3]?.investigation_notes || 'Displaced stock in warehouse racking.',
        changed_by: initial.alerts[3]?.verified_by || 'Sarah Jenkins',
        created_at: initial.alerts[3]?.verified_at || '2026-10-17T10:15:00Z',
      },
    ];

    memoryState = {
      ...initial,
      auditLogs: initialLogs,
      conversations: [],
      messages: [],
    };
    persistStorageToDisk(memoryState);
  }
  return memoryState;
}

export async function getStores(
  userId?: string,
  allowedStoreIds?: string[],
  companyId?: string
): Promise<Store[]> {
  const expandedAllowed = allowedStoreIds ? expandStoreIds(allowedStoreIds) : undefined;
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('stores').select('*').order('name');
      if (companyId && isValidUuid(companyId)) query = query.eq('company_id', companyId);
      if (expandedAllowed && !expandedAllowed.includes('*')) {
        query = query.in('id', expandedAllowed.length > 0 ? expandedAllowed : ['__NONE__']);
      }
      if (userId && !allowedStoreIds && (!companyId || !isValidUuid(companyId))) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (!error && data) return data as Store[];
      if (error) {
        console.warn('[Storage] Supabase getStores error:', error.message);
        return [];
      }
    } catch (err) {
      console.warn('[Storage] Supabase getStores exception:', err);
      return [];
    }
  }

  let list = getMemoryStore().stores;
  if (companyId) {
    list = list.filter((s) => !s.company_id || s.company_id === companyId);
  }
  if (expandedAllowed && !expandedAllowed.includes('*')) {
    list = list.filter((s) => expandedAllowed.includes(s.id));
  }

  // Deduplicate stores if an onboarded/aliased store points to the same underlying demo store
  const seenDemo = new Set<string>();
  const seenIds = new Set<string>();
  const deduped: Store[] = [];

  for (const s of list) {
    if (seenIds.has(s.id)) continue;
    seenIds.add(s.id);

    const demoId = resolveDemoStoreId(s.id, list);
    if (demoId) {
      if (seenDemo.has(demoId)) continue;
      seenDemo.add(demoId);
    }
    deduped.push(s);
  }

  return deduped;
}

export async function getProducts(userId?: string, companyId?: string): Promise<Product[]> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('products').select('*').order('name');
      if (companyId && isValidUuid(companyId)) query = query.eq('company_id', companyId);
      if (userId && (!companyId || !isValidUuid(companyId))) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (!error && data) return data as Product[];
      if (error) {
        console.warn('[Storage] Supabase getProducts error:', error.message);
        return [];
      }
    } catch (err) {
      console.warn('[Storage] Supabase getProducts exception:', err);
      return [];
    }
  }

  let list = getMemoryStore().products;
  if (companyId) {
    list = list.filter((p) => !p.company_id || p.company_id === companyId);
  }
  return list;
}

export async function getDailySales(
  storeId?: string,
  sku?: string,
  userId?: string,
  allowedStoreIds?: string[],
  companyId?: string
): Promise<DailySale[]> {
  const demoStoreId = storeId ? resolveDemoStoreId(storeId) : undefined;
  const expandedAllowed = allowedStoreIds ? expandStoreIds(allowedStoreIds) : undefined;

  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('daily_sales').select('*').order('date', { ascending: true });
      if (companyId && isValidUuid(companyId)) query = query.eq('company_id', companyId);
      if (expandedAllowed && !expandedAllowed.includes('*')) {
        query = query.in('store_id', expandedAllowed.length > 0 ? expandedAllowed : ['__NONE__']);
      } else if (storeId && storeId !== 'ALL') {
        const targetIds = demoStoreId && demoStoreId !== storeId ? [storeId, demoStoreId] : [storeId];
        query = query.in('store_id', targetIds);
      }
      if (userId && !allowedStoreIds && !companyId) query = query.eq('user_id', userId);
      if (sku) query = query.eq('sku', sku);
      const { data, error } = await query;
      if (!error && data) return data as DailySale[];
      if (error) {
        console.warn('[Storage] Supabase getDailySales error:', error.message);
        return [];
      }
    } catch (err) {
      console.warn('[Storage] Supabase getDailySales exception:', err);
      return [];
    }
  }

  let list = getMemoryStore().sales;
  if (companyId) {
    list = list.filter((s) => !s.company_id || s.company_id === companyId);
  }
  if (expandedAllowed && !expandedAllowed.includes('*')) {
    list = list.filter((s) => expandedAllowed.includes(s.store_id));
  } else if (storeId && storeId !== 'ALL') {
    const targetIds = demoStoreId && demoStoreId !== storeId ? [storeId, demoStoreId] : [storeId];
    list = list.filter((s) => targetIds.includes(s.store_id));
  }
  if (sku) list = list.filter((s) => s.sku === sku);
  return list;
}

export async function getInventorySnapshots(
  storeId?: string,
  sku?: string,
  userId?: string,
  allowedStoreIds?: string[],
  companyId?: string
): Promise<InventorySnapshot[]> {
  const demoStoreId = storeId ? resolveDemoStoreId(storeId) : undefined;
  const expandedAllowed = allowedStoreIds ? expandStoreIds(allowedStoreIds) : undefined;

  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('inventory_snapshots').select('*').order('date', { ascending: true });
      if (companyId && isValidUuid(companyId)) query = query.eq('company_id', companyId);
      if (expandedAllowed && !expandedAllowed.includes('*')) {
        query = query.in('store_id', expandedAllowed.length > 0 ? expandedAllowed : ['__NONE__']);
      } else if (storeId && storeId !== 'ALL') {
        const targetIds = demoStoreId && demoStoreId !== storeId ? [storeId, demoStoreId] : [storeId];
        query = query.in('store_id', targetIds);
      }
      if (userId && !allowedStoreIds && !companyId) query = query.eq('user_id', userId);
      if (sku) query = query.eq('sku', sku);
      const { data, error } = await query;
      if (!error && data) return data as InventorySnapshot[];
      if (error) {
        console.warn('[Storage] Supabase getInventorySnapshots error:', error.message);
        return [];
      }
    } catch (err) {
      console.warn('[Storage] Supabase getInventorySnapshots exception:', err);
      return [];
    }
  }

  let list = getMemoryStore().inventory;
  if (companyId) {
    list = list.filter((i) => !i.company_id || i.company_id === companyId);
  }
  if (expandedAllowed && !expandedAllowed.includes('*')) {
    list = list.filter((i) => expandedAllowed.includes(i.store_id));
  } else if (storeId && storeId !== 'ALL') {
    const targetIds = demoStoreId && demoStoreId !== storeId ? [storeId, demoStoreId] : [storeId];
    list = list.filter((i) => targetIds.includes(i.store_id));
  }
  if (sku) list = list.filter((i) => i.sku === sku);
  return list;
}

export async function getPromotions(
  userId?: string,
  allowedStoreIds?: string[],
  companyId?: string
): Promise<Promotion[]> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('promotions').select('*');
      if (companyId && isValidUuid(companyId)) query = query.eq('company_id', companyId);
      if (allowedStoreIds && !allowedStoreIds.includes('*')) {
        query = query.in('store_id', allowedStoreIds.length > 0 ? allowedStoreIds : ['__NONE__']);
      }
      if (userId && !allowedStoreIds && !companyId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (!error && data) return data as Promotion[];
      if (error) {
        console.warn('[Storage] Supabase getPromotions error:', error.message);
        return [];
      }
    } catch (err) {
      console.warn('[Storage] Supabase getPromotions exception:', err);
      return [];
    }
  }

  let list = getMemoryStore().promotions;
  if (companyId) {
    list = list.filter((p) => !p.company_id || p.company_id === companyId);
  }
  if (allowedStoreIds && !allowedStoreIds.includes('*')) {
    list = list.filter((p) => allowedStoreIds.includes(p.store_id));
  }
  return list;
}

export async function getAlerts(filters?: {
  storeId?: string;
  risk?: string;
  status?: string;
  search?: string;
  userId?: string;
  allowedStoreIds?: string[];
  companyId?: string;
}): Promise<Alert[]> {
  const demoStoreId = filters?.storeId ? resolveDemoStoreId(filters.storeId) : undefined;
  const expandedAllowed = filters?.allowedStoreIds ? expandStoreIds(filters.allowedStoreIds) : undefined;

  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('alerts').select('*').order('risk_score', { ascending: false });
      if (filters?.companyId && isValidUuid(filters.companyId)) query = query.eq('company_id', filters.companyId);
      if (expandedAllowed && !expandedAllowed.includes('*')) {
        query = query.in('store_id', expandedAllowed.length > 0 ? expandedAllowed : ['__NONE__']);
      } else if (filters?.storeId && filters.storeId !== 'ALL') {
        const targetIds = demoStoreId && demoStoreId !== filters.storeId ? [filters.storeId, demoStoreId] : [filters.storeId];
        query = query.in('store_id', targetIds);
      }
      if (filters?.userId && !filters?.allowedStoreIds && !filters?.companyId) query = query.eq('user_id', filters.userId);
      if (filters?.risk && filters.risk !== 'ALL') query = query.eq('risk_category', filters.risk);
      if (filters?.status && filters.status !== 'ALL') query = query.eq('status', filters.status);
      const { data, error } = await query;
      if (!error && data) {
        let result = data as Alert[];
        if (filters?.search) {
          const q = filters.search.toLowerCase();
          result = result.filter(
            (a) =>
              a.product_name.toLowerCase().includes(q) ||
              a.sku.toLowerCase().includes(q) ||
              a.category.toLowerCase().includes(q)
          );
        }
        return result;
      }
      if (error) {
        console.warn('[Storage] Supabase getAlerts error:', error.message);
        return [];
      }
    } catch (err) {
      console.warn('[Storage] Supabase getAlerts exception:', err);
      return [];
    }
  }

  let list = [...getMemoryStore().alerts];
  if (filters?.companyId) {
    list = list.filter((a) => !a.company_id || a.company_id === filters.companyId);
  }
  if (expandedAllowed && !expandedAllowed.includes('*')) {
    list = list.filter((a) => expandedAllowed.includes(a.store_id));
  } else if (filters?.storeId && filters.storeId !== 'ALL') {
    const targetIds = demoStoreId && demoStoreId !== filters.storeId ? [filters.storeId, demoStoreId] : [filters.storeId];
    list = list.filter((a) => targetIds.includes(a.store_id));
  }
  if (filters?.risk && filters.risk !== 'ALL') {
    list = list.filter((a) => a.risk_category === filters.risk);
  }
  if (filters?.status && filters.status !== 'ALL') {
    list = list.filter((a) => a.status === filters.status);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (a) =>
        a.product_name.toLowerCase().includes(q) ||
        a.sku.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
    );
  }
  return list;
}

export async function getAlertById(
  alertId: string,
  userId?: string,
  allowedStoreIds?: string[]
): Promise<Alert | null> {
  const expandedAllowed = allowedStoreIds ? expandStoreIds(allowedStoreIds) : undefined;
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('alerts').select('*').eq('id', alertId);
      if (expandedAllowed && !expandedAllowed.includes('*')) {
        query = query.in('store_id', expandedAllowed.length > 0 ? expandedAllowed : ['__NONE__']);
      }
      if (userId && !allowedStoreIds) query = query.eq('user_id', userId);
      const { data, error } = await query.single();
      if (!error && data) return data as Alert;
    } catch {}
  }
  const found = getMemoryStore().alerts.find((a) => a.id === alertId);
  if (!found) return null;
  if (expandedAllowed && !expandedAllowed.includes('*') && !expandedAllowed.includes(found.store_id)) {
    return null;
  }
  return found;
}

export async function updateAlertStatus(
  alertId: string,
  newStatus: AlertStatus,
  outcome?: VerificationOutcome,
  notes?: string,
  shelfCount?: number,
  auditor: string = 'Store Associate',
  userId?: string,
  allowedStoreIds?: string[]
): Promise<Alert | null> {
  const now = new Date().toISOString();
  const expandedAllowed = allowedStoreIds ? expandStoreIds(allowedStoreIds) : undefined;
  const supabase = getDbClient();

  if (supabase) {
    try {
      let alertQuery = supabase.from('alerts').select('*').eq('id', alertId);
      if (expandedAllowed && !expandedAllowed.includes('*')) {
        alertQuery = alertQuery.in('store_id', expandedAllowed.length > 0 ? expandedAllowed : ['__NONE__']);
      }
      if (userId && !allowedStoreIds) alertQuery = alertQuery.eq('user_id', userId);
      const { data: currentAlert } = await alertQuery.single();

      if (currentAlert) {
        const prevStatus = currentAlert.status;
        const updatePayload: Partial<Alert> = {
          status: newStatus,
          verification_outcome: outcome,
          investigation_notes: notes,
          shelf_count: shelfCount,
          verified_by: auditor,
          verified_at: newStatus === 'VERIFIED' || newStatus === 'FALSE_POSITIVE' ? now : undefined,
          updated_at: now,
        };

        const { data: updated, error } = await supabase
          .from('alerts')
          .update(updatePayload)
          .eq('id', alertId)
          .select()
          .single();

        if (!error && updated) {
          await supabase.from('verification_audit_log').insert({
            user_id: currentAlert.user_id || userId,
            company_id: currentAlert.company_id,
            alert_id: alertId,
            previous_status: prevStatus,
            new_status: newStatus,
            outcome,
            shelf_count: shelfCount,
            notes: notes || '',
            changed_by: auditor,
            created_at: now,
          });
          return updated as Alert;
        }
      }
    } catch {}
  }

  // Persistent Built-in Store
  const store = getMemoryStore();
  const alert = store.alerts.find((a) => a.id === alertId);
  if (!alert) return null;

  if (expandedAllowed && !expandedAllowed.includes('*') && !expandedAllowed.includes(alert.store_id)) {
    return null;
  }

  const previousStatus = alert.status;
  alert.status = newStatus;
  if (outcome) alert.verification_outcome = outcome;
  if (notes !== undefined) alert.investigation_notes = notes;
  if (shelfCount !== undefined) alert.shelf_count = shelfCount;
  if (newStatus === 'VERIFIED' || newStatus === 'FALSE_POSITIVE') {
    alert.verified_by = auditor;
    alert.verified_at = now;
  }
  alert.updated_at = now;

  // Insert audit log
  const logEntry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    alert_id: alertId,
    previous_status: previousStatus,
    new_status: newStatus,
    outcome,
    shelf_count: shelfCount,
    notes: notes || '',
    changed_by: auditor,
    created_at: now,
  };
  store.auditLogs.unshift(logEntry);
  persistStorageToDisk(store);

  return alert;
}

export async function getAuditLogs(
  alertId?: string,
  userId?: string,
  allowedStoreIds?: string[],
  companyId?: string
): Promise<AuditLogEntry[]> {
  const expandedAllowed = allowedStoreIds ? expandStoreIds(allowedStoreIds) : undefined;
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('verification_audit_log').select('*').order('created_at', { ascending: false });
      if (companyId && isValidUuid(companyId)) query = query.eq('company_id', companyId);
      if (alertId) query = query.eq('alert_id', alertId);
      const { data, error } = await query;
      if (!error && data) return data as AuditLogEntry[];
      if (error) {
        console.warn('[Storage] Supabase getAuditLogs error:', error.message);
        return [];
      }
    } catch (err) {
      console.warn('[Storage] Supabase getAuditLogs exception:', err);
      return [];
    }
  }

  let list = getMemoryStore().auditLogs || [];
  if (alertId) {
    list = list.filter((l) => l.alert_id === alertId);
  } else if (expandedAllowed && !expandedAllowed.includes('*')) {
    const alerts = (getMemoryStore().alerts || []).filter((a) => expandedAllowed.includes(a.store_id));
    const alertIds = new Set(alerts.map((a) => a.id));
    list = list.filter((l) => alertIds.has(l.alert_id));
  }
  return list;
}

export async function getDetectionRuns(
  userId?: string,
  allowedStoreIds?: string[],
  companyId?: string
): Promise<DetectionRun[]> {
  const expandedAllowed = allowedStoreIds ? expandStoreIds(allowedStoreIds) : undefined;
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('detection_runs').select('*').order('run_date', { ascending: false });
      if (companyId && isValidUuid(companyId)) query = query.eq('company_id', companyId);
      if (expandedAllowed && !expandedAllowed.includes('*')) {
        const allowedWithAll = [...expandedAllowed, 'ALL'];
        query = query.in('store_id', allowedWithAll);
      }
      if (userId && !allowedStoreIds && !companyId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (!error && data) return data as DetectionRun[];
      if (error) {
        console.warn('[Storage] Supabase getDetectionRuns error:', error.message);
        return [];
      }
    } catch (err) {
      console.warn('[Storage] Supabase getDetectionRuns exception:', err);
      return [];
    }
  }

  let list = getMemoryStore().detectionRuns;
  if (companyId) {
    list = list.filter((r) => !r.company_id || r.company_id === companyId);
  }
  if (expandedAllowed && !expandedAllowed.includes('*')) {
    list = list.filter((r) => expandedAllowed.includes(r.store_id) || r.store_id === 'ALL');
  }
  return list;
}

export async function saveDetectionRun(
  run: DetectionRun,
  newAlerts: Alert[],
  userId?: string,
  companyId?: string
): Promise<void> {
  const finalRunId = isValidUuid(run.id) ? run.id : crypto.randomUUID();
  const finalUserId = run.user_id || userId;
  const finalCompanyId = run.company_id || (companyId && isValidUuid(companyId) ? companyId : undefined);

  const runToInsert: DetectionRun = {
    ...run,
    id: finalRunId,
    user_id: finalUserId,
    company_id: finalCompanyId,
  };

  const alertsToInsert = newAlerts.map((a) => {
    const finalAlertId = isValidUuid(a.id) ? a.id : crypto.randomUUID();
    return {
      ...a,
      id: finalAlertId,
      user_id: a.user_id || finalUserId,
      company_id: a.company_id || finalCompanyId,
      run_id: finalRunId,
    };
  });

  const supabase = getDbClient();
  if (supabase) {
    const { error: runError } = await supabase.from('detection_runs').insert({
      id: runToInsert.id,
      user_id: runToInsert.user_id,
      company_id: runToInsert.company_id,
      run_date: runToInsert.run_date,
      store_id: runToInsert.store_id,
      total_skus_analyzed: runToInsert.total_skus_analyzed,
      flagged_count: runToInsert.flagged_count,
      critical_count: runToInsert.critical_count,
      engine_type: runToInsert.engine_type,
      parameters: runToInsert.parameters,
      is_demo: runToInsert.is_demo ?? false,
      created_at: runToInsert.created_at,
    });

    if (runError) {
      throw new Error(`Supabase Detection Run Error: ${runError.message}`);
    }

    if (alertsToInsert.length > 0) {
      const alertRows = alertsToInsert.map((a) => ({
        id: a.id,
        user_id: a.user_id,
        company_id: a.company_id,
        run_id: a.run_id,
        store_id: a.store_id,
        store_name: a.store_name,
        product_id: a.product_id,
        sku: a.sku,
        product_name: a.product_name,
        category: a.category,
        unit_price: a.unit_price,
        risk_score: a.risk_score,
        risk_category: a.risk_category,
        consecutive_zero_days: a.consecutive_zero_days,
        recorded_stock: a.recorded_stock,
        expected_daily_sales: a.expected_daily_sales,
        est_lost_revenue_daily: a.est_lost_revenue_daily,
        poisson_anomaly_p: a.poisson_anomaly_p,
        is_on_promotion: a.is_on_promotion,
        primary_reason: a.primary_reason,
        signals: a.signals,
        status: a.status,
        is_demo: a.is_demo ?? false,
        created_at: a.created_at,
        updated_at: a.updated_at,
      }));

      const { error: alertsError } = await supabase.from('alerts').upsert(alertRows, { onConflict: 'id' });
      if (alertsError) {
        throw new Error(`Supabase Alerts Error: ${alertsError.message}`);
      }
    }
    return;
  }

  // Built-in persistent storage fallback
  const store = getMemoryStore();
  store.detectionRuns.unshift(runToInsert);
  store.alerts = [...alertsToInsert, ...store.alerts];
  persistStorageToDisk(store);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val.trim());
}

/**
 * Returns catalog stores and products for import validation and resolution.
 * When Supabase is configured, queries the actual live database directly and
 * NEVER falls back to local JSON if the database returns an empty dataset.
 */
export async function getImportCatalogContext(
  userId?: string,
  companyId?: string,
  allowedStoreIds?: string[]
): Promise<{
  stores: Store[];
  products: Product[];
  isUsingDb: boolean;
}> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      let storeQuery = supabase.from('stores').select('*');
      if (companyId && isValidUuid(companyId)) {
        storeQuery = storeQuery.eq('company_id', companyId);
      } else if (userId && !allowedStoreIds) {
        storeQuery = storeQuery.eq('user_id', userId);
      }
      if (allowedStoreIds && !allowedStoreIds.includes('*')) {
        const expanded = expandStoreIds(allowedStoreIds);
        storeQuery = storeQuery.in('id', expanded.length > 0 ? expanded : ['__NONE__']);
      }

      let prodQuery = supabase.from('products').select('*');
      if (companyId && isValidUuid(companyId)) {
        prodQuery = prodQuery.eq('company_id', companyId);
      } else if (userId) {
        prodQuery = prodQuery.eq('user_id', userId);
      }

      const [storesRes, prodsRes] = await Promise.all([storeQuery, prodQuery]);
      const dbStores = (storesRes.data || []) as Store[];
      const dbProducts = (prodsRes.data || []) as Product[];

      return {
        stores: dbStores,
        products: dbProducts,
        isUsingDb: true,
      };
    } catch {
      // In case of query failure, stay in DB mode with empty arrays rather than falsifying data
      return {
        stores: [],
        products: [],
        isUsingDb: true,
      };
    }
  }

  // Standalone / Offline fallback (used strictly when Supabase is not configured)
  const mem = getMemoryStore();
  let stores = mem.stores;
  let products = mem.products;

  if (companyId) {
    stores = stores.filter((s) => !s.company_id || s.company_id === companyId);
    products = products.filter((p) => !p.company_id || p.company_id === companyId);
  }
  if (allowedStoreIds && !allowedStoreIds.includes('*')) {
    const expanded = expandStoreIds(allowedStoreIds);
    stores = stores.filter((s) => expanded.includes(s.id));
  }

  return {
    stores,
    products,
    isUsingDb: false,
  };
}

export async function importCsvRecords(
  entityType: 'stores' | 'products' | 'daily_sales' | 'inventory_snapshots' | 'promotions',
  records: Record<string, unknown>[],
  userId?: string,
  filename: string = 'import.csv',
  allowedStoreIds?: string[],
  companyId?: string
): Promise<{ inserted: number; errors: string[] }> {
  const supabase = getDbClient();
  const errors: string[] = [];

  if (records.length === 0) {
    return { inserted: 0, errors: ['No valid records found in the import file.'] };
  }

  // Pre-validate store ownership if allowedStoreIds is restricted
  if (allowedStoreIds && !allowedStoreIds.includes('*')) {
    const isStoreEntity = ['daily_sales', 'inventory_snapshots', 'promotions'].includes(entityType);
    if (isStoreEntity) {
      for (let i = 0; i < records.length; i++) {
        const rowStoreId = String(records[i].store_id || '');
        if (!rowStoreId || !allowedStoreIds.includes(rowStoreId)) {
          return {
            inserted: 0,
            errors: [`Row ${i + 1}: Store '${rowStoreId}' is unauthorized for your account.`],
          };
        }
      }
    }
  }

  const isDbMode = Boolean(supabase);

  // In database mode (Supabase PostgreSQL), company_id is a UUID foreign key referencing public.companies(id).
  // Any non-UUID string (e.g. "comp_...") will throw PostgreSQL error 22P02.
  // Moreover, any UUID not present in public.companies violates the foreign key constraint.
  // We resolve a verified, existing company UUID from Supabase, or fall back to null.
  let verifiedDbCompanyId: string | null = null;
  if (supabase) {
    const candidateUuid = (companyId && isValidUuid(companyId))
      ? companyId
      : (records[0]?.company_id && isValidUuid(records[0]?.company_id))
        ? String(records[0].company_id)
        : null;

    if (candidateUuid) {
      try {
        const { data: comp } = await supabase
          .from('companies')
          .select('id')
          .eq('id', candidateUuid)
          .maybeSingle();
        if (comp?.id) {
          verifiedDbCompanyId = comp.id;
        }
      } catch {}
    }

    if (!verifiedDbCompanyId && userId && isValidUuid(userId)) {
      try {
        const { data: membership } = await supabase
          .from('company_memberships')
          .select('company_id')
          .eq('user_id', userId)
          .maybeSingle();
        if (membership?.company_id && isValidUuid(membership.company_id)) {
          verifiedDbCompanyId = membership.company_id;
        }
      } catch {}
    }

    if (!verifiedDbCompanyId) {
      try {
        const { data: demoComp } = await supabase
          .from('companies')
          .select('id')
          .eq('is_demo', true)
          .limit(1)
          .maybeSingle();
        if (demoComp?.id) {
          verifiedDbCompanyId = demoComp.id;
        }
      } catch {}
    }
  }

  // Guarantee all primary keys and UUID foreign keys are genuine RFC 4122 UUIDs or null
  const recordsToInsert = records.map((r) => {
    const rawId = r.id;
    const finalId = isValidUuid(rawId) ? String(rawId).trim() : crypto.randomUUID();

    const cleanedRow: Record<string, unknown> = { ...r };

    if (isDbMode) {
      // PostgreSQL strictly requires a valid UUID or NULL for company_id.
      // Non-UUID strings (like comp_...) are replaced with verifiedDbCompanyId or null.
      cleanedRow.company_id = verifiedDbCompanyId;
      if (userId && isValidUuid(userId)) {
        cleanedRow.user_id = userId;
      }
    } else {
      const fallbackCompany = companyId || (r.company_id as string) || undefined;
      if (fallbackCompany) {
        cleanedRow.company_id = fallbackCompany;
      }
      if (userId) {
        cleanedRow.user_id = userId;
      }
    }

    return {
      ...cleanedRow,
      id: finalId,
    };
  });

  if (supabase) {
    try {
      const onConflictMap: Record<string, string> = {
        stores: 'user_id,code',
        products: 'user_id,sku',
        daily_sales: 'user_id,store_id,sku,date',
        inventory_snapshots: 'user_id,store_id,sku,date',
        promotions: 'id',
      };

      const upsertOptions = onConflictMap[entityType]
        ? { onConflict: onConflictMap[entityType] }
        : undefined;

      const { error } = await supabase.from(entityType).upsert(recordsToInsert, upsertOptions);
      if (error) {
        errors.push(`Supabase Database Error: ${error.message}`);
        if (userId) {
          try {
            await supabase.from('import_jobs').insert({
              user_id: userId,
              company_id: verifiedDbCompanyId,
              entity_type: entityType,
              filename,
              records_count: 0,
              status: 'FAILED',
              errors: [error.message],
            });
          } catch {}
        }
        return { inserted: 0, errors };
      }

      if (userId) {
        try {
          await supabase.from('import_jobs').insert({
            user_id: userId,
            company_id: verifiedDbCompanyId,
            entity_type: entityType,
            filename,
            records_count: records.length,
            status: 'COMPLETED',
            errors: [],
          });
        } catch {}
      }

      return { inserted: records.length, errors: [] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Database communication failed';
      return { inserted: 0, errors: [msg] };
    }
  }

  // Built-in persistent import fallback (Strictly for offline/standalone mode when Supabase is unconfigured)
  const store = getMemoryStore();
  if (entityType === 'stores') {
    const casted = recordsToInsert as unknown as Store[];
    store.stores = [...casted, ...store.stores.filter((s) => !casted.some((r) => r.id === s.id || r.code === s.code))];
  } else if (entityType === 'products') {
    const casted = recordsToInsert as unknown as Product[];
    store.products = [...casted, ...store.products.filter((p) => !casted.some((r) => r.id === p.id || r.sku === p.sku))];
  } else if (entityType === 'daily_sales') {
    const casted = recordsToInsert as unknown as DailySale[];
    store.sales = [...casted, ...store.sales.filter((s) => !casted.some((r) => r.store_id === s.store_id && r.sku === s.sku && r.date === s.date))];
  } else if (entityType === 'inventory_snapshots') {
    const casted = recordsToInsert as unknown as InventorySnapshot[];
    store.inventory = [...casted, ...store.inventory.filter((inv) => !casted.some((r) => r.store_id === inv.store_id && r.sku === inv.sku && r.date === inv.date))];
  } else if (entityType === 'promotions') {
    const casted = recordsToInsert as unknown as Promotion[];
    store.promotions = [...casted, ...store.promotions];
  }

  persistStorageToDisk(store);
  return { inserted: records.length, errors: [] };
}

export function isUsingSupabase(): boolean {
  return isSupabaseConfigured() || isSupabaseServerConfigured();
}

// --------------------------------------------------------------------
// Chat & AI Assistant Storage Layer
// --------------------------------------------------------------------

export async function getConversations(userId: string): Promise<ChatConversation[]> {
  if (!userId) return [];
  const supabase = getDbClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (!error && data) return data as ChatConversation[];
    } catch {}
  }

  const store = getMemoryStore();
  const list = (store.conversations || []).filter((c) => c.user_id === userId);
  return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getConversationById(
  conversationId: string,
  userId: string,
  companyId?: string
): Promise<ChatConversation | null> {
  if (!conversationId || !userId) return null;
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase
        .from('chat_conversations')
        .select('*')
        .eq('id', conversationId)
        .eq('user_id', userId);
      if (companyId && isValidUuid(companyId)) query = query.eq('company_id', companyId);
      const { data, error } = await query.single();
      if (!error && data) return data as ChatConversation;
    } catch {}
  }

  const store = getMemoryStore();
  const found = (store.conversations || []).find(
    (c) => c.id === conversationId && c.user_id === userId && (!companyId || !c.company_id || c.company_id === companyId)
  );
  return found || null;
}

export async function createConversation(
  userId: string,
  title?: string,
  companyId?: string
): Promise<ChatConversation> {
  const now = new Date().toISOString();
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const cleanTitle = title?.trim() || 'New Conversation';

  const newConv: ChatConversation = {
    id,
    user_id: userId,
    ...(companyId && isValidUuid(companyId) ? { company_id: companyId } : {}),
    title: cleanTitle,
    created_at: now,
    updated_at: now,
  };

  const supabase = getDbClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert(newConv)
        .select()
        .single();
      if (!error && data) return data as ChatConversation;
    } catch {}
  }

  const store = getMemoryStore();
  if (!store.conversations) store.conversations = [];
  store.conversations.unshift(newConv);
  persistStorageToDisk(store);
  return newConv;
}

export async function deleteConversation(
  conversationId: string,
  userId: string,
  companyId?: string
): Promise<boolean> {
  if (!conversationId || !userId) return false;
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase
        .from('chat_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', userId);
      if (companyId && isValidUuid(companyId)) query = query.eq('company_id', companyId);
      const { data, error } = await query.select();
      if (!error && data && data.length > 0) return true;
      if (!error && data && data.length === 0) return false;
    } catch {}
  }

  const store = getMemoryStore();
  const existingConv = (store.conversations || []).find(
    (c) => c.id === conversationId && c.user_id === userId && (!companyId || !c.company_id || c.company_id === companyId)
  );
  if (!existingConv) return false;

  if (store.conversations) {
    store.conversations = store.conversations.filter(
      (c) => !(c.id === conversationId && c.user_id === userId)
    );
  }
  if (store.messages) {
    store.messages = store.messages.filter(
      (m) => !(m.conversation_id === conversationId && m.user_id === userId)
    );
  }
  persistStorageToDisk(store);
  return true;
}

export async function getMessages(
  conversationId: string,
  userId: string
): Promise<ChatMessage[]> {
  if (!conversationId || !userId) return [];
  const supabase = getDbClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (!error && data) return data as ChatMessage[];
    } catch {}
  }

  const store = getMemoryStore();
  const list = (store.messages || []).filter(
    (m) => m.conversation_id === conversationId && m.user_id === userId
  );
  return list.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function saveMessage(params: {
  conversationId: string;
  userId: string;
  role: ChatRole;
  content: string;
}): Promise<ChatMessage | null> {
  const { conversationId, userId, role, content } = params;
  if (!conversationId || !userId || !content) return null;

  const now = new Date().toISOString();
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const newMsg: ChatMessage = {
    id,
    conversation_id: conversationId,
    user_id: userId,
    role,
    content,
    created_at: now,
  };

  const supabase = getDbClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert(newMsg)
        .select()
        .single();
      if (!error && data) {
        // Refresh conversation updated_at
        await supabase
          .from('chat_conversations')
          .update({ updated_at: now })
          .eq('id', conversationId)
          .eq('user_id', userId);
        return data as ChatMessage;
      }
    } catch {}
  }

  const store = getMemoryStore();
  const conv = (store.conversations || []).find(
    (c) => c.id === conversationId && c.user_id === userId
  );
  if (!conv) return null;

  if (!store.messages) store.messages = [];
  store.messages.push(newMsg);
  conv.updated_at = now;
  persistStorageToDisk(store);
  return newMsg;
}
