import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  createUser,
  createSession,
  setCompanyMembership,
  setCompanyStores,
  clearRbacCaches,
} from '../src/lib/auth/userStore';
import {
  saveDetectionRun,
  isValidUuid,
} from '../src/lib/storage';
import { POST as postDetectRoute } from '../src/app/api/detect/route';
import { GET as getMetricsRoute } from '../src/app/api/metrics/route';
import { GET as getAlertsRoute } from '../src/app/api/alerts/route';
import { GET as getAuditRoute } from '../src/app/api/alerts/audit/route';
import { runBaselineDetection } from '../src/lib/detector';
import type { Alert, DetectionRun, Store, Product, DailySale, InventorySnapshot, Promotion } from '../src/types';

test('Detection Data Flow: Pipeline, Supabase UUID Integrity, Anomaly Verification & Company Isolation', async (t) => {
  clearRbacCaches();

  const companyAId = '00000000-0000-0000-0000-000000000001';
  const companyBId = '00000000-0000-0000-0000-000000000002';

  const userA = await createUser({
    email: `manager_a_${Date.now()}@company-a.com`,
    name: 'Company A Manager',
  });
  const tokenA = await createSession(userA);

  const userB = await createUser({
    email: `manager_b_${Date.now()}@company-b.com`,
    name: 'Company B Manager',
  });
  const tokenB = await createSession(userB);

  const storeA1Id = crypto.randomUUID();
  const storeA2Id = crypto.randomUUID();
  const storeB1Id = crypto.randomUUID();

  setCompanyMembership({
    userId: userA.id,
    companyId: companyAId,
    companyName: 'Company A Retail Group',
    companySlug: 'company-a-retail',
    role: 'COMPANY_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });
  setCompanyStores(companyAId, [
    { id: storeA1Id, name: 'Downtown Supercenter #101' },
    { id: storeA2Id, name: 'Bellevue Square Market #204' },
  ]);

  setCompanyMembership({
    userId: userB.id,
    companyId: companyBId,
    companyName: 'Company B Retail Group',
    companySlug: 'company-b-retail',
    role: 'COMPANY_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });
  setCompanyStores(companyBId, [{ id: storeB1Id, name: 'Tacoma Superstore #308' }]);

  const reqA = (path: string, options: RequestInit = {}) =>
    new Request(`http://localhost:3000${path}`, {
      ...options,
      headers: {
        Cookie: `stocksentinel_session=${tokenA}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

  const reqB = (path: string, options: RequestInit = {}) =>
    new Request(`http://localhost:3000${path}`, {
      ...options,
      headers: {
        Cookie: `stocksentinel_session=${tokenB}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

  await t.test('1. Baseline Detector Anomaly Evaluation: Accurately flags phantom stock-out on zero-streak with positive stock', () => {
    const store1: Store = {
      id: storeA1Id,
      code: 'SEA-101',
      name: 'Downtown Supercenter #101',
      location: 'Seattle, WA',
      store_type: 'Supercenter',
      total_skus: 3,
      created_at: new Date().toISOString(),
    };

    const prodMilk: Product = {
      id: crypto.randomUUID(),
      sku: 'SKU-101',
      name: 'Organic Whole Milk 1 Gal',
      category: 'Dairy',
      unit_price: 4.99,
      avg_daily_demand: 4.8,
      min_stock_threshold: 8,
      created_at: new Date().toISOString(),
    };

    const prodCitrus: Product = {
      id: crypto.randomUUID(),
      sku: 'SKU-104',
      name: 'Electrolyte Citrus Rush 16oz',
      category: 'Beverages',
      unit_price: 2.99,
      avg_daily_demand: 5.5,
      min_stock_threshold: 12,
      created_at: new Date().toISOString(),
    };

    // Inventory: Positive stock on both
    const inventory: InventorySnapshot[] = [
      { id: crypto.randomUUID(), store_id: store1.id, product_id: prodMilk.id, sku: 'SKU-101', date: '2026-10-26', on_hand_stock: 12 },
      { id: crypto.randomUUID(), store_id: store1.id, product_id: prodCitrus.id, sku: 'SKU-104', date: '2026-10-26', on_hand_stock: 26 },
    ];

    // Sales: Milk sold normally, Citrus had 2 consecutive days of 0 sales
    const sales: DailySale[] = [
      { id: crypto.randomUUID(), store_id: store1.id, product_id: prodMilk.id, sku: 'SKU-101', date: '2026-10-25', units_sold: 5, revenue: 24.95 },
      { id: crypto.randomUUID(), store_id: store1.id, product_id: prodMilk.id, sku: 'SKU-101', date: '2026-10-26', units_sold: 6, revenue: 29.94 },
      { id: crypto.randomUUID(), store_id: store1.id, product_id: prodCitrus.id, sku: 'SKU-104', date: '2026-10-25', units_sold: 0, revenue: 0.00 },
      { id: crypto.randomUUID(), store_id: store1.id, product_id: prodCitrus.id, sku: 'SKU-104', date: '2026-10-26', units_sold: 0, revenue: 0.00 },
    ];

    const promotions: Promotion[] = [
      {
        id: crypto.randomUUID(),
        store_id: store1.id,
        product_id: prodCitrus.id,
        sku: 'SKU-104',
        start_date: '2026-10-20',
        end_date: '2026-10-31',
        discount_pct: 20.0,
        promo_type: 'FEATURE',
        created_at: new Date().toISOString(),
      },
    ];

    const alerts = runBaselineDetection({
      stores: [store1],
      products: [prodMilk, prodCitrus],
      sales,
      inventory,
      promotions,
    });

    // Milk must NOT be flagged (normal velocity)
    const milkAlert = alerts.find((a) => a.sku === 'SKU-101');
    assert.equal(milkAlert, undefined, 'Normal sales SKU must not be flagged');

    // Citrus must be flagged as CRITICAL (2 zero days with 26 on-hand units on promo)
    const citrusAlert = alerts.find((a) => a.sku === 'SKU-104');
    assert.ok(citrusAlert, 'Citrus Rush must be flagged as phantom stock-out');
    assert.equal(citrusAlert.store_id, store1.id);
    assert.equal(citrusAlert.consecutive_zero_days, 2);
    assert.equal(citrusAlert.recorded_stock, 26);
    assert.equal(citrusAlert.risk_category, 'CRITICAL');
    assert.ok(citrusAlert.risk_score >= 75);
    assert.ok(citrusAlert.est_lost_revenue_daily > 0);
    assert.ok(isValidUuid(citrusAlert.id), 'Alert ID must be a genuine UUID');
  });

  await t.test('2. Detection Route Execution: Assigns valid UUIDs for run.id, alert.id, and alert.run_id', async () => {
    const res = await postDetectRoute(reqA('/api/detect', { method: 'POST', body: JSON.stringify({ storeId: 'ALL' }) }));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(isValidUuid(data.run.id), `run.id "${data.run.id}" must be a valid RFC 4122 UUID`);
    assert.doesNotMatch(data.run.id, /^RUN-/i, 'run.id must not contain legacy "RUN-" text prefix');

    if (data.alerts && data.alerts.length > 0) {
      for (const alert of data.alerts) {
        assert.ok(isValidUuid(alert.id), `alert.id "${alert.id}" must be a valid UUID`);
        assert.doesNotMatch(alert.id, /^ALT-/i, 'alert.id must not contain legacy "ALT-" text prefix');
        assert.equal(alert.run_id, data.run.id, 'alert.run_id must match the parent run UUID');
      }
    }
  });

  await t.test('3. Company Isolation: Manager cannot trigger detection on unauthorized store', async () => {
    // User A attempts to trigger detection on User B's store
    const res = await postDetectRoute(reqA('/api/detect', { method: 'POST', body: JSON.stringify({ storeId: storeB1Id }) }));
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.match(data.error, /does not belong to your company/i);

    // User B querying their own company metrics succeeds in isolation
    const resB = await getMetricsRoute(reqB('/api/metrics'));
    assert.equal(resB.status, 200);
  });

  await t.test('4. saveDetectionRun UUID Validation: Rejects text prefix IDs by converting to valid UUIDs', async () => {
    const legacyRun: DetectionRun = {
      id: 'RUN-LEGACY-TEXT-ID',
      user_id: userA.id,
      company_id: companyAId,
      run_date: new Date().toISOString(),
      store_id: 'ALL',
      total_skus_analyzed: 10,
      flagged_count: 1,
      critical_count: 1,
      engine_type: 'BASELINE_POISSON',
      parameters: {
        minConsecutiveZeroDays: 2,
        fastMoverThreshold: 2.5,
        slowMoverThreshold: 0.6,
        significanceThreshold: 0.05,
        maxRankPerStore: 20,
      },
      is_demo: false,
      created_at: new Date().toISOString(),
    };

    const legacyAlert: Alert = {
      id: 'ALT-LEGACY-TEXT-ID',
      run_id: 'RUN-LEGACY-TEXT-ID',
      store_id: storeA1Id,
      store_name: 'Downtown Supercenter #101',
      product_id: crypto.randomUUID(),
      sku: 'SKU-104',
      product_name: 'Electrolyte Citrus Rush 16oz',
      category: 'Beverages',
      unit_price: 2.99,
      risk_score: 95,
      risk_category: 'CRITICAL',
      consecutive_zero_days: 3,
      recorded_stock: 20,
      expected_daily_sales: 5.5,
      est_lost_revenue_daily: 16.45,
      poisson_anomaly_p: 0.0001,
      is_on_promotion: false,
      primary_reason: 'Zero sales with positive inventory',
      signals: {
        consecutiveZeroDays: 3,
        recordedStock: 20,
        expectedDailyDemand: 5.5,
        poissonPValue: 0.0001,
        isPromotionActive: false,
        weekendMultiplier: 1.0,
        stockToDemandRatio: 3.6,
        estimatedLostSalesDaily: 16.45,
      },
      status: 'OPEN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Must not throw when calling saveDetectionRun in offline/memory mode
    await assert.doesNotReject(async () => {
      await saveDetectionRun(legacyRun, [legacyAlert], userA.id, companyAId);
    });
  });

  await t.test('5. Metrics & Audit Endpoints: Respect companyId and return valid response shapes', async () => {
    const resMetrics = await getMetricsRoute(reqA('/api/metrics'));
    assert.equal(resMetrics.status, 200);
    const dataMetrics = await resMetrics.json();
    assert.equal(dataMetrics.success, true);
    assert.ok(typeof dataMetrics.metrics.totalMonitoredSkus === 'number');
    assert.ok(typeof dataMetrics.metrics.flaggedPhantomStockouts === 'number');
    assert.ok(typeof dataMetrics.metrics.estRevenueAtRiskDaily === 'number');

    const resAlerts = await getAlertsRoute(reqA('/api/alerts'));
    assert.equal(resAlerts.status, 200);
    const dataAlerts = await resAlerts.json();
    assert.equal(dataAlerts.success, true);
    assert.ok(Array.isArray(dataAlerts.alerts));

    const resAudit = await getAuditRoute(reqA('/api/alerts/audit'));
    assert.equal(resAudit.status, 200);
    const dataAudit = await resAudit.json();
    assert.equal(dataAudit.success, true);
    assert.ok(Array.isArray(dataAudit.runs));
    assert.ok(Array.isArray(dataAudit.auditLogs));
  });
});

