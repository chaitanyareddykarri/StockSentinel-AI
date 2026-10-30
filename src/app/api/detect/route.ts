import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getStores,
  getProducts,
  getDailySales,
  getInventorySnapshots,
  getPromotions,
  saveDetectionRun,
  isValidUuid,
} from '@/lib/storage';
import { authorizeRequest } from '@/lib/auth/serverAuth';
import { runBaselineDetection } from '@/lib/detector';
import { isSameOrAliasedStore } from '@/lib/storeResolver';
import type { Alert, DetectionConfig, DetectionRun } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const requestedStoreId = body.storeId || undefined;

    const auth = await authorizeRequest(request, requestedStoreId);
    if (!auth.authorized || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: auth.status || 401 }
      );
    }

    const configOverrides: Partial<DetectionConfig> = body.config || {};

    const [stores, products, sales, inventory, promotions] = await Promise.all([
      getStores(auth.user.id, auth.effectiveStoreIds, auth.user.companyId),
      getProducts(auth.user.id, auth.user.companyId),
      getDailySales(auth.targetStoreId, undefined, auth.user.id, auth.effectiveStoreIds, auth.user.companyId),
      getInventorySnapshots(auth.targetStoreId, undefined, auth.user.id, auth.effectiveStoreIds, auth.user.companyId),
      getPromotions(auth.user.id, auth.effectiveStoreIds, auth.user.companyId),
    ]);

    const filteredStores =
      auth.targetStoreId && auth.targetStoreId !== 'ALL'
        ? stores.filter((s) => s.id === auth.targetStoreId || isSameOrAliasedStore(s.id, auth.targetStoreId))
        : stores;

    let engineType: DetectionRun['engine_type'] = 'BASELINE_POISSON';
    let alerts: Alert[] = [];

    // Check if an external Python ML microservice is configured
    const pythonServiceUrl = process.env.DETECTION_SERVICE_URL;
    let usedPython = false;

    if (pythonServiceUrl && pythonServiceUrl.startsWith('http')) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const pyResponse = await fetch(`${pythonServiceUrl.replace(/\/$/, '')}/detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stores: filteredStores,
            products,
            sales,
            inventory,
            promotions,
            config: configOverrides,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (pyResponse.ok) {
          const pyData = await pyResponse.json();
          if (Array.isArray(pyData.alerts)) {
            alerts = pyData.alerts;
            engineType = 'PYTHON_FASTAPI';
            usedPython = true;
          }
        }
      } catch {
        // Honest fallback to deterministic baseline
        usedPython = false;
      }
    }

    if (!usedPython) {
      alerts = runBaselineDetection({
        stores: filteredStores,
        products,
        sales,
        inventory,
        promotions,
        config: configOverrides,
      });
      engineType = 'BASELINE_POISSON';
    }

    const runId = crypto.randomUUID();
    const now = new Date().toISOString();

    const finalizedAlerts = alerts.map((alt) => ({
      ...alt,
      id: isValidUuid(alt.id) ? alt.id : crypto.randomUUID(),
      user_id: auth.user!.id,
      company_id: auth.user!.companyId,
      run_id: runId,
    }));

    const criticalCount = finalizedAlerts.filter((a) => a.risk_category === 'CRITICAL').length;

    const runRecord: DetectionRun = {
      id: runId,
      user_id: auth.user.id,
      company_id: auth.user.companyId,
      run_date: now,
      store_id: auth.targetStoreId || 'ALL',
      total_skus_analyzed: filteredStores.length * products.length,
      flagged_count: finalizedAlerts.length,
      critical_count: criticalCount,
      engine_type: engineType,
      parameters: {
        minConsecutiveZeroDays: configOverrides.minConsecutiveZeroDays ?? 2,
        fastMoverThreshold: configOverrides.fastMoverThreshold ?? 2.5,
        slowMoverThreshold: configOverrides.slowMoverThreshold ?? 0.6,
        significanceThreshold: configOverrides.significanceThreshold ?? 0.05,
        maxRankPerStore: configOverrides.maxRankPerStore ?? 20,
      },
      is_demo: false,
      created_at: now,
    };

    await saveDetectionRun(runRecord, finalizedAlerts, auth.user.id, auth.user.companyId);

    return NextResponse.json({
      success: true,
      run: runRecord,
      alerts: finalizedAlerts,
      engine_type: engineType,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Detection failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
