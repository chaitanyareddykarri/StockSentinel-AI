import { NextResponse } from 'next/server';
import {
  getStores,
  getProducts,
  getAlerts,
  getDetectionRuns,
  getDailySales,
  getInventorySnapshots,
  isUsingSupabase,
} from '@/lib/storage';
import { authorizeRequest } from '@/lib/auth/serverAuth';
import type { DashboardMetrics, TimeSeriesPoint } from '@/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedStoreId = searchParams.get('storeId') || undefined;

    const auth = await authorizeRequest(request, requestedStoreId);
    if (!auth.authorized || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: auth.status || 401 }
      );
    }

    const [stores, products, alerts, runs, sales, inventory] = await Promise.all([
      getStores(auth.user.id, auth.effectiveStoreIds, auth.user.companyId),
      getProducts(auth.user.id, auth.user.companyId),
      getAlerts({
        userId: auth.user.id,
        storeId: auth.targetStoreId,
        allowedStoreIds: auth.effectiveStoreIds,
        companyId: auth.user.companyId,
      }),
      getDetectionRuns(auth.user.id, auth.effectiveStoreIds, auth.user.companyId),
      getDailySales(auth.targetStoreId, undefined, auth.user.id, auth.effectiveStoreIds, auth.user.companyId),
      getInventorySnapshots(auth.targetStoreId, undefined, auth.user.id, auth.effectiveStoreIds, auth.user.companyId),
    ]);

    const totalMonitoredSkus = stores.length * products.length;
    const activeStores = stores.length;
    const openAlerts = alerts.filter((a) => a.status === 'OPEN' || a.status === 'UNDER_REVIEW');
    const flaggedPhantomStockouts = openAlerts.length;
    const criticalAlerts = openAlerts.filter((a) => a.risk_category === 'CRITICAL').length;

    const estRevenueAtRiskDaily = openAlerts.reduce(
      (sum, a) => sum + (a.est_lost_revenue_daily || 0),
      0
    );

    const verifiedOrResolved = alerts.filter(
      (a) => a.status === 'VERIFIED' || a.status === 'FALSE_POSITIVE' || a.status === 'RESOLVED'
    );
    const verificationRate =
      alerts.length > 0 ? Math.round((verifiedOrResolved.length / alerts.length) * 100) : 0;

    // Precision@20 benchmark based on verified outcomes
    const confirmedPhantoms = alerts.filter(
      (a) => a.verification_outcome === 'PHANTOM_CONFIRMED' || a.verification_outcome === 'BACKROOM_DISPLACED'
    ).length;
    const totalVerified = alerts.filter(
      (a) => a.status === 'VERIFIED' || a.status === 'FALSE_POSITIVE'
    ).length;

    const precisionAt20 =
      totalVerified > 0 ? Number(((confirmedPhantoms / totalVerified) * 100).toFixed(1)) : 0;

    const lastRun = runs.length > 0 ? runs[0].run_date : undefined;

    // Aggregate real daily sales and inventory time-series (last 14 days)
    const dailyMap = new Map<string, TimeSeriesPoint>();
    sales.forEach((s) => {
      if (!dailyMap.has(s.date)) {
        dailyMap.set(s.date, { date: s.date, unitsSold: 0, onHandUnits: 0 });
      }
      dailyMap.get(s.date)!.unitsSold += s.units_sold || 0;
    });

    inventory.forEach((i) => {
      if (!dailyMap.has(i.date)) {
        dailyMap.set(i.date, { date: i.date, unitsSold: 0, onHandUnits: 0 });
      }
      dailyMap.get(i.date)!.onHandUnits += i.on_hand_stock || 0;
    });

    const sortedDates = Array.from(dailyMap.keys()).sort();
    const timeSeries: TimeSeriesPoint[] = sortedDates.slice(-14).map((d) => dailyMap.get(d)!);

    const metrics: DashboardMetrics = {
      totalMonitoredSkus,
      activeStores,
      flaggedPhantomStockouts,
      criticalAlerts,
      estRevenueAtRiskDaily: Number(estRevenueAtRiskDaily.toFixed(2)),
      verificationRate,
      verifiedCount: verifiedOrResolved.length,
      precisionAt20,
      lastDetectionRun: lastRun,
      timeSeries,
    };

    return NextResponse.json({
      success: true,
      metrics,
      stores,
      storageType: isUsingSupabase() ? 'SUPABASE_POSTGRESQL' : 'PERSISTENT_STORE',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to calculate metrics';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
