import { getSupabaseServerClient } from './supabaseServer';
import { getInitialDemoState } from '../demoData';

export async function seedDemoDataForUser(userId: string): Promise<{ success: boolean; message: string; count: number }> {
  const supabase = getSupabaseServerClient();
  const demo = getInitialDemoState();

  if (!supabase) {
    return {
      success: false,
      message: 'Supabase is not configured yet. Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      count: 0,
    };
  }

  try {
    // 1. Seed Stores with user_id
    const storesToInsert = demo.stores.map((s) => ({
      user_id: userId,
      code: s.code,
      name: s.name,
      location: s.location,
      store_type: s.store_type,
      total_skus: s.total_skus || 30,
    }));
    await supabase.from('stores').upsert(storesToInsert, { onConflict: 'user_id,code' });

    // 2. Seed Products with user_id
    const productsToInsert = demo.products.map((p) => ({
      user_id: userId,
      sku: p.sku,
      name: p.name,
      category: p.category,
      unit_price: p.unit_price,
      avg_daily_demand: p.avg_daily_demand,
      min_stock_threshold: p.min_stock_threshold,
    }));
    await supabase.from('products').upsert(productsToInsert, { onConflict: 'user_id,sku' });

    // 3. Seed Sample Detection Run
    const runId = `run-seed-${Date.now()}`;
    await supabase.from('detection_runs').insert({
      id: runId,
      user_id: userId,
      run_date: new Date().toISOString(),
      store_id: 'ALL',
      total_skus_analyzed: demo.products.length * demo.stores.length,
      flagged_count: demo.alerts.length,
      critical_count: demo.alerts.filter((a) => a.risk_category === 'CRITICAL').length,
      engine_type: 'BASELINE_POISSON',
      is_demo: true,
    });

    // 4. Seed Sample Alerts (explicitly marked is_demo = true)
    const alertsToInsert = demo.alerts.map((a) => ({
      id: `alert-demo-${a.id}-${userId.substring(0, 6)}`,
      user_id: userId,
      run_id: runId,
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
      is_demo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    await supabase.from('alerts').upsert(alertsToInsert, { onConflict: 'id' });

    return {
      success: true,
      message: `Safely seeded ${alertsToInsert.length} demonstration alerts clearly marked with is_demo = true.`,
      count: alertsToInsert.length,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Seeding failed';
    return { success: false, message, count: 0 };
  }
}
