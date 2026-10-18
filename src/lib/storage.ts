import fs from 'fs';
import path from 'path';
import {
  Alert,
  AlertStatus,
  AuditLogEntry,
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
      fs.writeFileSync(/*turbopackIgnore: true*/ filePath, JSON.stringify(state, null, 2), 'utf-8');
    }
  } catch (err) {
    console.warn('[Storage] Could not persist state to disk:', err);
  }
}

function getMemoryStore(): InMemoryStore {
  if (!memoryState) {
    const filePath = getDbFilePath();
    if (filePath && fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
      try {
        const content = fs.readFileSync(/*turbopackIgnore: true*/ filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (parsed && Array.isArray(parsed.stores) && Array.isArray(parsed.alerts)) {
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
    };
    persistStorageToDisk(memoryState);
  }
  return memoryState;
}

export async function getStores(userId?: string): Promise<Store[]> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('stores').select('*').order('name');
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data as Store[];
    } catch {}
  }
  return getMemoryStore().stores;
}

export async function getProducts(userId?: string): Promise<Product[]> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('products').select('*').order('name');
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data as Product[];
    } catch {}
  }
  return getMemoryStore().products;
}

export async function getDailySales(storeId?: string, sku?: string, userId?: string): Promise<DailySale[]> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('daily_sales').select('*').order('date', { ascending: true });
      if (userId) query = query.eq('user_id', userId);
      if (storeId && storeId !== 'ALL') query = query.eq('store_id', storeId);
      if (sku) query = query.eq('sku', sku);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data as DailySale[];
    } catch {}
  }

  let list = getMemoryStore().sales;
  if (storeId && storeId !== 'ALL') list = list.filter((s) => s.store_id === storeId);
  if (sku) list = list.filter((s) => s.sku === sku);
  return list;
}

export async function getInventorySnapshots(storeId?: string, sku?: string, userId?: string): Promise<InventorySnapshot[]> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('inventory_snapshots').select('*').order('date', { ascending: true });
      if (userId) query = query.eq('user_id', userId);
      if (storeId && storeId !== 'ALL') query = query.eq('store_id', storeId);
      if (sku) query = query.eq('sku', sku);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data as InventorySnapshot[];
    } catch {}
  }

  let list = getMemoryStore().inventory;
  if (storeId && storeId !== 'ALL') list = list.filter((i) => i.store_id === storeId);
  if (sku) list = list.filter((i) => i.sku === sku);
  return list;
}

export async function getPromotions(userId?: string): Promise<Promotion[]> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('promotions').select('*');
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data as Promotion[];
    } catch {}
  }
  return getMemoryStore().promotions;
}

export async function getAlerts(filters?: {
  storeId?: string;
  risk?: string;
  status?: string;
  search?: string;
  userId?: string;
}): Promise<Alert[]> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('alerts').select('*').order('risk_score', { ascending: false });
      if (filters?.userId) query = query.eq('user_id', filters.userId);
      if (filters?.storeId && filters.storeId !== 'ALL') query = query.eq('store_id', filters.storeId);
      if (filters?.risk && filters.risk !== 'ALL') query = query.eq('risk_category', filters.risk);
      if (filters?.status && filters.status !== 'ALL') query = query.eq('status', filters.status);
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
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
    } catch {}
  }

  let list = [...getMemoryStore().alerts];
  if (filters?.storeId && filters.storeId !== 'ALL') {
    list = list.filter((a) => a.store_id === filters.storeId);
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

export async function getAlertById(alertId: string, userId?: string): Promise<Alert | null> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('alerts').select('*').eq('id', alertId);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query.single();
      if (!error && data) return data as Alert;
    } catch {}
  }
  const found = getMemoryStore().alerts.find((a) => a.id === alertId);
  return found || null;
}

export async function updateAlertStatus(
  alertId: string,
  newStatus: AlertStatus,
  outcome?: VerificationOutcome,
  notes?: string,
  shelfCount?: number,
  auditor: string = 'Store Associate',
  userId?: string
): Promise<Alert | null> {
  const now = new Date().toISOString();
  const supabase = getDbClient();

  if (supabase) {
    try {
      let alertQuery = supabase.from('alerts').select('*').eq('id', alertId);
      if (userId) alertQuery = alertQuery.eq('user_id', userId);
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

export async function getAuditLogs(alertId?: string, userId?: string): Promise<AuditLogEntry[]> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('verification_audit_log').select('*').order('created_at', { ascending: false });
      if (userId) query = query.eq('user_id', userId);
      if (alertId) query = query.eq('alert_id', alertId);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data as AuditLogEntry[];
    } catch {}
  }

  let list = getMemoryStore().auditLogs;
  if (alertId) list = list.filter((l) => l.alert_id === alertId);
  return list;
}

export async function getDetectionRuns(userId?: string): Promise<DetectionRun[]> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      let query = supabase.from('detection_runs').select('*').order('run_date', { ascending: false });
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data as DetectionRun[];
    } catch {}
  }
  return getMemoryStore().detectionRuns;
}

export async function saveDetectionRun(run: DetectionRun, newAlerts: Alert[], userId?: string): Promise<void> {
  const supabase = getDbClient();
  if (supabase) {
    try {
      await supabase.from('detection_runs').insert({
        id: run.id,
        user_id: run.user_id || userId,
        run_date: run.run_date,
        store_id: run.store_id,
        total_skus_analyzed: run.total_skus_analyzed,
        flagged_count: run.flagged_count,
        critical_count: run.critical_count,
        engine_type: run.engine_type,
        parameters: run.parameters,
        is_demo: run.is_demo ?? false,
        created_at: run.created_at,
      });

      if (newAlerts.length > 0) {
        const alertRows = newAlerts.map((a) => ({
          id: a.id,
          user_id: a.user_id || run.user_id || userId,
          run_id: run.id,
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
        await supabase.from('alerts').upsert(alertRows, { onConflict: 'id' });
      }
      return;
    } catch {}
  }

  // Built-in persistent storage fallback
  const store = getMemoryStore();
  store.detectionRuns.unshift(run);
  store.alerts = [...newAlerts, ...store.alerts];
  persistStorageToDisk(store);
}

export async function importCsvRecords(
  entityType: 'stores' | 'products' | 'daily_sales' | 'inventory_snapshots' | 'promotions',
  records: Record<string, unknown>[],
  userId?: string,
  filename: string = 'import.csv'
): Promise<{ inserted: number; errors: string[] }> {
  const supabase = getDbClient();
  const errors: string[] = [];

  if (records.length === 0) {
    return { inserted: 0, errors: ['No valid records found in the import file.'] };
  }

  if (supabase) {
    try {
      const recordsToInsert = userId
        ? records.map((r) => ({ ...r, user_id: userId }))
        : records;

      const { error } = await supabase.from(entityType).upsert(recordsToInsert);
      if (error) {
        errors.push(`Supabase Database Error: ${error.message}`);
        if (userId) {
          try {
            await supabase.from('import_jobs').insert({
              user_id: userId,
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

  // Built-in persistent import fallback
  const store = getMemoryStore();
  if (entityType === 'stores') {
    const casted = records as unknown as Store[];
    store.stores = [...casted, ...store.stores.filter((s) => !casted.some((r) => r.id === s.id || r.code === s.code))];
  } else if (entityType === 'products') {
    const casted = records as unknown as Product[];
    store.products = [...casted, ...store.products.filter((p) => !casted.some((r) => r.id === p.id || r.sku === p.sku))];
  } else if (entityType === 'daily_sales') {
    store.sales = [...(records as unknown as DailySale[]), ...store.sales];
  } else if (entityType === 'inventory_snapshots') {
    store.inventory = [...(records as unknown as InventorySnapshot[]), ...store.inventory];
  } else if (entityType === 'promotions') {
    store.promotions = [...(records as unknown as Promotion[]), ...store.promotions];
  }

  persistStorageToDisk(store);
  return { inserted: records.length, errors: [] };
}

export function isUsingSupabase(): boolean {
  return isSupabaseConfigured() || isSupabaseServerConfigured();
}
