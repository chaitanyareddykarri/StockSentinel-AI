import {
  getStores,
  getProducts,
  getAlerts,
  getDetectionRuns,
  getDailySales,
  getInventorySnapshots,
  getPromotions,
} from '@/lib/storage';
import type { VerifiedUser } from '@/lib/auth/serverAuth';

export interface GroundedContext {
  formattedContext: string;
  matchedSku?: string;
  hasAlerts: boolean;
  storesCount: number;
}

/**
 * Retrieves verified server-side retail inventory data for the authenticated user
 * and formats it into a factual, tamper-proof context block for the AI reasoning engine.
 *
 * Enforces:
 * - Data strictly scoped to the authenticated user's accessible records.
 * - Clear distinction between recorded inventory balances and physically verified counts.
 * - Explicit statements when data or fields are missing; zero fabricated values.
 */
export async function buildInventoryGrounding(
  userId: string,
  userQuery: string,
  user?: VerifiedUser
): Promise<GroundedContext> {
  let allowedStoreIds: string[] | undefined = undefined;
  let companyId: string | undefined = undefined;

  if (user) {
    if (user.accessState === 'STORE_MANAGER') {
      allowedStoreIds = user.assignedStoreId ? [user.assignedStoreId] : [];
      companyId = user.companyId;
    } else if (user.accessState === 'COMPANY_MANAGER') {
      allowedStoreIds = user.accessibleStoreIds || [];
      companyId = user.companyId;
    } else if (user.accessState === 'PLATFORM_ADMIN') {
      allowedStoreIds = ['*'];
    } else {
      allowedStoreIds = [];
      companyId = undefined;
    }
  }

  const [stores, products, alerts, runs, promotions] = await Promise.all([
    getStores(userId, allowedStoreIds, companyId),
    getProducts(userId, companyId),
    getAlerts({ userId, allowedStoreIds, companyId }),
    getDetectionRuns(userId, allowedStoreIds),
    getPromotions(userId, allowedStoreIds, companyId),
  ]);

  const queryLower = userQuery.toLowerCase();

  // 1. Identify if the user is asking about a specific SKU or product name
  let matchedProduct = products.find((p) => {
    const skuMatch = queryLower.includes(p.sku.toLowerCase());
    const nameMatch = p.name.length > 3 && queryLower.includes(p.name.toLowerCase());
    return skuMatch || nameMatch;
  });

  // If not in products list, check if mentioned in alerts
  const matchedAlert = alerts.find((a) => {
    return (
      queryLower.includes(a.sku.toLowerCase()) ||
      (a.product_name.length > 3 && queryLower.includes(a.product_name.toLowerCase()))
    );
  });

  if (!matchedProduct && matchedAlert) {
    matchedProduct = {
      id: matchedAlert.product_id,
      sku: matchedAlert.sku,
      name: matchedAlert.product_name,
      category: matchedAlert.category,
      unit_price: matchedAlert.unit_price,
      avg_daily_demand: matchedAlert.expected_daily_sales,
      min_stock_threshold: 5,
      created_at: matchedAlert.created_at,
    };
  }

  // 2. Deep-dive history for specific product if matched
  let specificProductDetails = '';
  if (matchedProduct) {
    const [salesHistory, inventorySnapshots] = await Promise.all([
      getDailySales(undefined, matchedProduct.sku, userId, allowedStoreIds),
      getInventorySnapshots(undefined, matchedProduct.sku, userId, allowedStoreIds),
    ]);

    // Sort sales ascending by date
    const sortedSales = [...salesHistory].sort((a, b) => a.date.localeCompare(b.date));
    const recentSales = sortedSales.slice(-14);

    // Latest inventory snapshot
    const sortedInv = [...inventorySnapshots].sort((a, b) => b.date.localeCompare(a.date));
    const latestInv = sortedInv[0];

    // Compute zero sales streak
    let consecutiveZeroDays = 0;
    for (let i = recentSales.length - 1; i >= 0; i--) {
      if (recentSales[i].units_sold === 0) {
        consecutiveZeroDays++;
      } else {
        break;
      }
    }

    const matchingAlert = alerts.find((a) => a.sku === matchedProduct!.sku);

    specificProductDetails = `
--- DEEP-DIVE EVIDENCE FOR REFERENCED SKU: ${matchedProduct.sku} (${matchedProduct.name}) ---
- Category: ${matchedProduct.category}
- Retail Unit Price: $${matchedProduct.unit_price.toFixed(2)}
- Recorded System On-Hand Stock: ${latestInv ? `${latestInv.on_hand_stock} units (as of ${latestInv.date})` : 'Not recorded in snapshots'}
- Base Daily Demand: ${matchedProduct.avg_daily_demand.toFixed(2)} units/day
- Recent Consecutive Zero-Sales Days: ${consecutiveZeroDays} days
- Recent 14-Day POS Sales History (units sold): ${
      recentSales.length > 0
        ? recentSales.map((s) => `${s.date}: ${s.units_sold} units`).join(', ')
        : 'No POS sales recorded in recent window'
    }
${
  matchingAlert
    ? `- Flagged Detection Alert: Yes (Risk Category: ${matchingAlert.risk_category}, Risk Score: ${matchingAlert.risk_score}/100)
- Statistical Poisson Zero Probability: ${
        matchingAlert.poisson_anomaly_p < 0.0001
          ? '<0.01%'
          : `${(matchingAlert.poisson_anomaly_p * 100).toFixed(2)}%`
      }
- Estimated Daily Lost Revenue: $${matchingAlert.est_lost_revenue_daily.toFixed(2)}/day
- Active Promotion Lift Applied: ${matchingAlert.is_on_promotion ? 'Yes (1.6x expected demand multiplier)' : 'No'}
- Primary Detection Signal: ${matchingAlert.primary_reason}
- Physical Shelf Walk Status: ${matchingAlert.status} ${
        matchingAlert.verification_outcome ? `(Outcome: ${matchingAlert.verification_outcome})` : '(Pending walk verification)'
      }
- Investigation Notes: ${matchingAlert.investigation_notes || 'None logged yet'}`
    : '- Flagged Detection Alert: None currently active for this product'
}
-----------------------------------------------------------------------------------
`;
  }

  // 3. Summarize Active Stores
  const storesBlock =
    stores.length > 0
      ? stores
          .map(
            (s) =>
              `- Store Code: ${s.code} | Name: "${s.name}" | Location: ${s.location} | Type: ${s.store_type} | Monitored SKUs: ${s.total_skus !== undefined ? s.total_skus : 'All catalog'}`
          )
          .join('\n')
      : 'No stores registered in workspace catalog.';

  // 4. Summarize Top Priority Alerts
  const openAlerts = alerts.filter(
    (a) => a.status === 'OPEN' || a.status === 'UNDER_REVIEW'
  );
  const prioritizedAlerts = openAlerts.length > 0 ? openAlerts : alerts;

  // Sort by risk score descending
  const topRankedAlerts = [...prioritizedAlerts]
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 10);

  const alertsBlock =
    topRankedAlerts.length > 0
      ? topRankedAlerts
          .map(
            (a, idx) =>
              `#${idx + 1}. [${a.risk_category}] ${a.product_name} (SKU: ${a.sku})
   - Store: ${a.store_name} | Category: ${a.category} | Price: $${a.unit_price.toFixed(2)}
   - Recorded System Stock: ${a.recorded_stock} units on hand
   - Consecutive 0-Sales Streak: ${a.consecutive_zero_days} days
   - Expected Daily Demand: ${a.expected_daily_sales.toFixed(1)} units/day
   - Est. Lost Revenue: $${a.est_lost_revenue_daily.toFixed(2)}/day
   - Poisson Zero Probability: ${
     a.poisson_anomaly_p < 0.0001 ? '<0.01%' : `${(a.poisson_anomaly_p * 100).toFixed(2)}%`
   }
   - Active Promo: ${a.is_on_promotion ? 'Yes' : 'No'}
   - Risk Score: ${a.risk_score}/100 | Status: ${a.status}
   - Primary Reason: ${a.primary_reason}`
          )
          .join('\n\n')
      : 'No active phantom stock-out alerts flagged in current detection runs.';

  // 5. Portfolio KPI Metrics
  const totalMonitoredSkus = stores.length * products.length;
  const criticalCount = alerts.filter((a) => a.risk_category === 'CRITICAL').length;
  const highCount = alerts.filter((a) => a.risk_category === 'HIGH').length;
  const totalRevenueAtRisk = openAlerts.reduce(
    (sum, a) => sum + (a.est_lost_revenue_daily || 0),
    0
  );
  const latestRun = runs.length > 0 ? runs[0] : null;

  const metricsBlock = `
- Total Active Stores: ${stores.length}
- Total Monitored Catalog SKUs: ${totalMonitoredSkus}
- Open Flagged Alerts: ${openAlerts.length}
- Critical Risk Alerts: ${criticalCount}
- High Risk Alerts: ${highCount}
- Est. Portfolio Daily Lost Revenue at Risk: $${totalRevenueAtRisk.toFixed(2)}/day
- Last Detection Analysis Run: ${
    latestRun ? `${latestRun.run_date} (Engine: ${latestRun.engine_type})` : 'No runs executed yet'
  }
`;

  // 6. Active Promotions
  const promotionsBlock =
    promotions.length > 0
      ? promotions
          .map(
            (p) =>
              `- SKU: ${p.sku} | Window: ${p.start_date} to ${p.end_date} | Discount: ${p.discount_pct}% (${p.promo_type})`
          )
          .join('\n')
      : 'No active promotions logged in database.';

  // Compose Full Factual Context
  const formattedContext = `
==================== VERIFIED RETAIL INVENTORY CONTEXT ====================
[WORKSPACE PORTFOLIO METRICS]
${metricsBlock}

[ACTIVE STORES]
${storesBlock}

[TOP PRIORITY SUSPICIOUS SKU-STORE ALERTS (RANKED BY RISK SCORE)]
${alertsBlock}
${specificProductDetails}
[ACTIVE PROMOTIONS CALENDAR]
${promotionsBlock}

[OPERATIONAL GUIDANCE RULES]
1. "Recorded On-Hand Stock" represents what the computer inventory system believes exists in the store.
2. "Physically Verified Stock" represents what a store associate has counted in person on the shelf during a shelf walk.
3. Zero sales over multiple days for a fast-moving SKU with high recorded stock is a statistical phantom stock-out signal, NOT physical proof of theft.
4. Physical inspection actions to recommend:
   - Check shelf facing for displaced items or incorrect adjacent tag placement.
   - Scan shelf barcode to confirm tag matches system SKU.
   - Search backroom staging and overhead risers for unworked pallets.
   - If physically missing from both shelf and backroom, log physical count as 0 to unblock automated warehouse reorders.
5. Strict Truthfulness: Cite only the SKUs, stores, demand figures, and risk scores listed above. If a requested metric or product is not in the data, explicitly state that it is not in the system.
===========================================================================
`.trim();

  return {
    formattedContext,
    matchedSku: matchedProduct?.sku,
    hasAlerts: alerts.length > 0,
    storesCount: stores.length,
  };
}
