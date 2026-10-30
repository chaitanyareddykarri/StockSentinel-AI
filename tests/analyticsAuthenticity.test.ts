import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  createUser,
  createSession,
  setCompanyMembership,
  setCompanyStores,
  setStoreAssignment,
  clearRbacCaches,
} from '../src/lib/auth/userStore';
import { GET as getMetricsRoute } from '../src/app/api/metrics/route';
import { GET as getAlertsRoute } from '../src/app/api/alerts/route';
import {
  calculateRoiSimulation,
  calculateCategoryVulnerability,
  OFFLINE_EVALUATE_BENCHMARK,
  INDUSTRY_REFERENCE_CATEGORIES,
} from '../src/lib/analytics';
import type { Alert } from '../src/types';

test('Analytics & ROI Authenticity: Metric Provenance, Benchmark Isolation, Formula Integrity & RBAC', async (t) => {
  clearRbacCaches();

  await t.test('1. Benchmark Provenance: Confirms offline evaluate.py benchmark values and synthetic origin', () => {
    // 5 stores, 100 SKUs, 60 days
    assert.strictEqual(OFFLINE_EVALUATE_BENCHMARK.datasetStores, 5);
    assert.strictEqual(OFFLINE_EVALUATE_BENCHMARK.datasetSkus, 100);
    assert.strictEqual(OFFLINE_EVALUATE_BENCHMARK.datasetDays, 60);

    // Exact evaluate.py metrics
    assert.strictEqual(OFFLINE_EVALUATE_BENCHMARK.precisionAt20, 40.3);
    assert.strictEqual(OFFLINE_EVALUATE_BENCHMARK.recallTop20, 96.7);
    assert.strictEqual(OFFLINE_EVALUATE_BENCHMARK.detectedTruePhantoms, 29);
    assert.strictEqual(OFFLINE_EVALUATE_BENCHMARK.totalDatasetPhantoms, 30);
    assert.strictEqual(OFFLINE_EVALUATE_BENCHMARK.avgRankOfPhantoms, 5.45);
    assert.strictEqual(OFFLINE_EVALUATE_BENCHMARK.f1Score, 56.9);
    assert.strictEqual(OFFLINE_EVALUATE_BENCHMARK.isSyntheticBenchmark, true);
  });

  await t.test('2. ROI Simulator Arithmetic: Validates exact formula and default scenario values', () => {
    // Default slider = 12 walks, $48.50/phantom, 85% accuracy
    const simDefault = calculateRoiSimulation({ dailyWalks: 12 });
    assert.strictEqual(simDefault.dailyWalks, 12);
    assert.strictEqual(simDefault.avgLostPerPhantom, 48.5);
    assert.strictEqual(simDefault.detectionAccuracy, 0.85);

    // Daily recovered: 12 * 48.50 * 0.85 = 494.70
    assert.strictEqual(simDefault.dailyRecovered, 494.7);

    // Monthly recovered: round(494.70 * 30) = 14,841
    assert.strictEqual(simDefault.monthlyRecovered, 14841);

    // Annual recovered: 14,841 * 12 = 178,092
    assert.strictEqual(simDefault.annualRecovered, 178092);

    // Min slider boundary: 2 walks
    const simMin = calculateRoiSimulation({ dailyWalks: 2 });
    assert.strictEqual(simMin.monthlyRecovered, Math.round(2 * 48.5 * 0.85 * 30)); // 2474
    assert.strictEqual(simMin.annualRecovered, simMin.monthlyRecovered * 12); // 29688

    // Max slider boundary: 20 walks
    const simMax = calculateRoiSimulation({ dailyWalks: 20 });
    assert.strictEqual(simMax.monthlyRecovered, Math.round(20 * 48.5 * 0.85 * 30)); // 24735
    assert.strictEqual(simMax.annualRecovered, simMax.monthlyRecovered * 12); // 296820

    // Custom average loss
    const simCustom = calculateRoiSimulation({ dailyWalks: 10, avgLostPerPhantom: 60, detectionAccuracy: 0.9 });
    assert.strictEqual(simCustom.dailyRecovered, 540);
    assert.strictEqual(simCustom.monthlyRecovered, 16200);
    assert.strictEqual(simCustom.annualRecovered, 194400);
  });

  await t.test('3. Department Vulnerability: Aggregates real operational incidents accurately without mock injection', () => {
    const mockAlerts: Alert[] = [
      {
        id: crypto.randomUUID(),
        run_id: crypto.randomUUID(),
        store_id: 'store-1',
        store_name: 'Store #1',
        product_id: 'prod-1',
        sku: 'SKU-001',
        product_name: 'Milk Whole 1 Gal',
        category: 'Dairy',
        unit_price: 3.99,
        risk_score: 85,
        risk_category: 'CRITICAL',
        consecutive_zero_days: 4,
        recorded_stock: 12,
        expected_daily_sales: 3.5,
        est_lost_revenue_daily: 13.97,
        poisson_anomaly_p: 0.0001,
        is_on_promotion: false,
        primary_reason: 'Anomaly detected',
        signals: {
          consecutiveZeroDays: 4,
          recordedStock: 12,
          expectedDailyDemand: 3.5,
          poissonPValue: 0.0001,
          isPromotionActive: false,
          weekendMultiplier: 1.0,
          stockToDemandRatio: 3.4,
          estimatedLostSalesDaily: 13.97,
        },
        status: 'OPEN',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        run_id: crypto.randomUUID(),
        store_id: 'store-1',
        store_name: 'Store #1',
        product_id: 'prod-2',
        sku: 'SKU-002',
        product_name: 'Yogurt Greek 32oz',
        category: 'Dairy',
        unit_price: 5.49,
        risk_score: 75,
        risk_category: 'CRITICAL',
        consecutive_zero_days: 3,
        recorded_stock: 8,
        expected_daily_sales: 2.0,
        est_lost_revenue_daily: 10.98,
        poisson_anomaly_p: 0.001,
        is_on_promotion: false,
        primary_reason: 'Anomaly detected',
        signals: {
          consecutiveZeroDays: 3,
          recordedStock: 8,
          expectedDailyDemand: 2.0,
          poissonPValue: 0.001,
          isPromotionActive: false,
          weekendMultiplier: 1.0,
          stockToDemandRatio: 4.0,
          estimatedLostSalesDaily: 10.98,
        },
        status: 'OPEN',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: crypto.randomUUID(),
        run_id: crypto.randomUUID(),
        store_id: 'store-1',
        store_name: 'Store #1',
        product_id: 'prod-3',
        sku: 'SKU-003',
        product_name: 'Sparkling Mineral Water',
        category: 'Beverages',
        unit_price: 2.49,
        risk_score: 90,
        risk_category: 'CRITICAL',
        consecutive_zero_days: 5,
        recorded_stock: 15,
        expected_daily_sales: 4.0,
        est_lost_revenue_daily: 9.96,
        poisson_anomaly_p: 0.00005,
        is_on_promotion: true,
        primary_reason: 'Anomaly detected during promotion',
        signals: {
          consecutiveZeroDays: 5,
          recordedStock: 15,
          expectedDailyDemand: 4.0,
          poissonPValue: 0.00005,
          isPromotionActive: true,
          weekendMultiplier: 1.2,
          stockToDemandRatio: 3.75,
          estimatedLostSalesDaily: 9.96,
        },
        status: 'OPEN',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const result = calculateCategoryVulnerability(mockAlerts);
    assert.strictEqual(result.length, 2);

    // Beverages: 1 incident, risk 90 (highest risk, ranked first)
    const bev = result.find((c) => c.name === 'Beverages');
    assert.ok(bev);
    assert.strictEqual(bev.incidentCount, 1);
    assert.strictEqual(bev.incidentRate, '33%'); // 1/3 = 33%
    assert.strictEqual(bev.riskIndex, 90);
    assert.strictEqual(bev.avgStockoutDays, 5.0);
    assert.strictEqual(bev.totalLostRevenueDaily, 9.96);

    // Dairy: 2 incidents, avg risk = (85 + 75) / 2 = 80
    const dairy = result.find((c) => c.name === 'Dairy');
    assert.ok(dairy);
    assert.strictEqual(dairy.incidentCount, 2);
    assert.strictEqual(dairy.incidentRate, '67%'); // 2/3 = 67%
    assert.strictEqual(dairy.riskIndex, 80);
    assert.strictEqual(dairy.avgStockoutDays, 3.5); // (4 + 3) / 2 = 3.5
    assert.strictEqual(dairy.totalLostRevenueDaily, 24.95); // 13.97 + 10.98 = 24.95
  });

  await t.test('4. Empty State Authenticity: Returns empty array and avoids fabricated categories when alerts are missing', () => {
    const emptyResult = calculateCategoryVulnerability([]);
    assert.strictEqual(emptyResult.length, 0);

    // Industry reference is available as explicit separate baseline, not confused with live data
    assert.ok(INDUSTRY_REFERENCE_CATEGORIES.length > 0);
    assert.strictEqual(INDUSTRY_REFERENCE_CATEGORIES[0].name, 'Beverages');
  });

  await t.test('5. Tenant Isolation: Company Manager vs Store Manager permissions for operational analytics telemetry', async () => {
    const companyId = '00000000-0000-0000-0000-000000000001';

    const store1Id = crypto.randomUUID();
    const store2Id = crypto.randomUUID();

    // 1. Company Manager setup
    const compManager = await createUser({
      email: `analytics_cm_${Date.now()}@acme-retail.com`,
      name: 'Acme CM',
    });
    const cmToken = await createSession(compManager);

    setCompanyMembership({
      userId: compManager.id,
      companyId,
      companyName: 'Acme Retail Group',
      companySlug: 'acme-retail',
      role: 'COMPANY_MANAGER',
      status: 'ACTIVE',
      companyStatus: 'ACTIVE',
    });
    setCompanyStores(companyId, [
      { id: store1Id, name: 'Acme Store #1' },
      { id: store2Id, name: 'Acme Store #2' },
    ]);

    // 2. Store Manager setup (assigned strictly to store1Id)
    const storeManager = await createUser({
      email: `analytics_sm_${Date.now()}@acme-retail.com`,
      name: 'Acme SM 1',
    });
    const smToken = await createSession(storeManager);

    setCompanyMembership({
      userId: storeManager.id,
      companyId,
      companyName: 'Acme Retail Group',
      companySlug: 'acme-retail',
      role: 'STORE_MANAGER',
      status: 'ACTIVE',
      companyStatus: 'ACTIVE',
    });
    setStoreAssignment({
      companyId,
      storeId: store1Id,
      storeName: 'Acme Store #1',
      userId: storeManager.id,
    });

    // Request helper
    const makeReq = (token: string, path: string) =>
      new Request(`http://localhost:3000${path}`, {
        headers: {
          Cookie: `stocksentinel_session=${token}`,
        },
      });

    // Test A: Company Manager can access company-wide metrics
    const cmRes = await getMetricsRoute(makeReq(cmToken, '/api/metrics'));
    assert.strictEqual(cmRes.status, 200);
    const cmData = await cmRes.json();
    assert.strictEqual(cmData.success, true);
    assert.ok(cmData.metrics);

    // Test B: Store Manager querying assigned store succeeds
    const smResAllowed = await getMetricsRoute(makeReq(smToken, `/api/metrics?storeId=${store1Id}`));
    assert.strictEqual(smResAllowed.status, 200);
    const smDataAllowed = await smResAllowed.json();
    assert.strictEqual(smDataAllowed.success, true);

    // Test C: Store Manager querying unauthorized store2Id is blocked with 403
    const smResBlocked = await getMetricsRoute(makeReq(smToken, `/api/metrics?storeId=${store2Id}`));
    assert.strictEqual(smResBlocked.status, 403);

    // Test D: Store Manager querying unauthorized store in alerts route is blocked with 403
    const smAlertsBlocked = await getAlertsRoute(makeReq(smToken, `/api/alerts?storeId=${store2Id}`));
    assert.strictEqual(smAlertsBlocked.status, 403);

    // Test E: Cross-company access is blocked
    const crossRes = await getMetricsRoute(makeReq(cmToken, `/api/metrics?storeId=${crypto.randomUUID()}`));
    assert.strictEqual(crossRes.status, 403);
  });
});
