import {
  Alert,
  DetectionConfig,
  DailySale,
  InventorySnapshot,
  Product,
  Promotion,
  Store,
  RiskCategory,
} from '@/types';

export const DEFAULT_DETECTION_CONFIG: DetectionConfig = {
  minConsecutiveZeroDays: 2,
  fastMoverThreshold: 2.5,
  slowMoverThreshold: 0.6,
  significanceThreshold: 0.05,
  maxRankPerStore: 20,
};

// Day of week demand multipliers (0 = Sun, 1 = Mon, ..., 6 = Sat)
const DOW_MULTIPLIERS: Record<number, number> = {
  0: 1.35, // Sunday peak
  1: 0.85, // Monday slump
  2: 0.90, // Tuesday
  3: 0.95, // Wednesday
  4: 1.05, // Thursday
  5: 1.30, // Friday peak
  6: 1.45, // Saturday peak
};

export interface DetectionInput {
  stores: Store[];
  products: Product[];
  sales: DailySale[];
  inventory: InventorySnapshot[];
  promotions?: Promotion[];
  config?: Partial<DetectionConfig>;
}

export function runBaselineDetection({
  stores,
  products,
  sales,
  inventory,
  promotions = [],
  config = {},
}: DetectionInput): Alert[] {
  const finalConfig: DetectionConfig = {
    ...DEFAULT_DETECTION_CONFIG,
    ...config,
  };

  // Map products for fast lookup
  const productMap = new Map<string, Product>();
  products.forEach((p) => {
    productMap.set(p.id, p);
    productMap.set(p.sku, p);
  });

  // Map stores for fast lookup
  const storeMap = new Map<string, Store>();
  stores.forEach((s) => {
    storeMap.set(s.id, s);
    storeMap.set(s.code, s);
  });

  // Group latest inventory by (store_id, product_id/sku)
  const latestInventoryMap = new Map<string, InventorySnapshot>();
  inventory.forEach((item) => {
    const key = `${item.store_id}__${item.sku || item.product_id}`;
    const existing = latestInventoryMap.get(key);
    if (!existing || new Date(item.date) > new Date(existing.date)) {
      latestInventoryMap.set(key, item);
    }
  });

  // Group sales by store and SKU, sorted by date ascending
  const salesHistoryMap = new Map<string, DailySale[]>();
  sales.forEach((sale) => {
    const key = `${sale.store_id}__${sale.sku || sale.product_id}`;
    const list = salesHistoryMap.get(key) || [];
    list.push(sale);
    salesHistoryMap.set(key, list);
  });

  // Sort each sale list by date ascending
  salesHistoryMap.forEach((list) => {
    list.sort((a, b) => a.date.localeCompare(b.date));
  });

  const alertsByStore = new Map<string, Alert[]>();

  // Iterate over each store and product combination
  stores.forEach((store) => {
    const storeAlerts: Alert[] = [];

    products.forEach((product) => {
      const invKey = `${store.id}__${product.sku}`;
      const invSnapshot = latestInventoryMap.get(invKey);

      // Phantom stockout requires positive recorded on-hand stock
      if (!invSnapshot || invSnapshot.on_hand_stock <= 0) {
        return;
      }

      const recordedStock = invSnapshot.on_hand_stock;
      const salesKey = `${store.id}__${product.sku}`;
      const history = salesHistoryMap.get(salesKey) || [];

      if (history.length === 0) {
        return;
      }

      // Analyze the most recent window (up to last 14 days)
      const recentWindow = history.slice(-14);
      const latestDateStr = recentWindow[recentWindow.length - 1].date;

      // Count consecutive zero sales days ending on latest date
      let consecutiveZeroDays = 0;
      const zeroDayDates: string[] = [];
      for (let i = recentWindow.length - 1; i >= 0; i--) {
        if (recentWindow[i].units_sold === 0) {
          consecutiveZeroDays++;
          zeroDayDates.unshift(recentWindow[i].date);
        } else {
          break;
        }
      }

      // Filter out if below minimum zero days
      if (consecutiveZeroDays < finalConfig.minConsecutiveZeroDays) {
        return;
      }

      // Check if an active promotion exists on this product at this store
      const isPromotionActive = promotions.some((promo) => {
        const matchesStore = promo.store_id === store.id || promo.store_id === 'ALL';
        const matchesProduct = promo.sku === product.sku || promo.product_id === product.id;
        if (!matchesStore || !matchesProduct) return false;
        return latestDateStr >= promo.start_date && latestDateStr <= promo.end_date;
      });

      // Calculate baseline daily demand
      const baseDailyDemand = product.avg_daily_demand || 1.0;
      const promoMultiplier = isPromotionActive ? 1.6 : 1.0;

      // Calculate cumulative expected sales during the zero streak taking day of week into account
      let cumulativeExpectedSales = 0;
      let avgDowMultiplier = 1.0;

      if (zeroDayDates.length > 0) {
        let dowSum = 0;
        zeroDayDates.forEach((dStr) => {
          const d = new Date(dStr);
          const dow = isNaN(d.getDay()) ? 3 : d.getDay();
          const dowMult = DOW_MULTIPLIERS[dow] || 1.0;
          dowSum += dowMult;
          cumulativeExpectedSales += baseDailyDemand * dowMult * promoMultiplier;
        });
        avgDowMultiplier = Number((dowSum / zeroDayDates.length).toFixed(2));
      } else {
        cumulativeExpectedSales = baseDailyDemand * consecutiveZeroDays * promoMultiplier;
      }

      // Poisson zero sales probability: P(X = 0) = exp(-Lambda)
      // Cap Lambda to 50 to avoid math overflow
      const clampedLambda = Math.min(cumulativeExpectedSales, 50);
      const poissonZeroP = Math.exp(-clampedLambda);

      // Slow mover handling: if base demand is very low, zero sales for 2-3 days is NOT an anomaly
      const isSlowMover = baseDailyDemand < finalConfig.slowMoverThreshold;
      const isFastMover = baseDailyDemand >= finalConfig.fastMoverThreshold;

      // If slow mover and p-value is still large (e.g. > 0.25), skip or downweight
      if (isSlowMover && poissonZeroP > 0.15) {
        return;
      }

      // Calculate anomaly confidence score (0 to 100)
      let rawScore = 0;

      // Component 1: Poisson Anomaly (0 to 50 points)
      // A p-value of < 0.001 gives 50 pts, p-value of 0.05 gives 25 pts
      const pScore = Math.max(0, Math.min(50, Math.round((1 - Math.min(poissonZeroP, 1)) * 50)));

      // Component 2: Consecutive zero days relative to demand (0 to 25 points)
      const dayFactor = Math.min(25, Math.round((consecutiveZeroDays / Math.max(1, 1 / baseDailyDemand)) * 12));

      // Component 3: Stock health confidence (0 to 15 points)
      // If stock is plenty (recorded_stock >= 5), associate expects shelf to have stock
      const stockHealth = Math.min(15, Math.round(Math.min(recordedStock, 20) * 0.75));

      // Component 4: Promo lift penalty (0 or 10 points)
      const promoBoost = isPromotionActive ? 10 : 0;

      rawScore = pScore + dayFactor + stockHealth + promoBoost;

      // Dampen score if slow mover
      if (isSlowMover) {
        rawScore = Math.round(rawScore * 0.65);
      }

      // Fast movers with ample stock get a floor of 70 if consecutive zero days >= 3
      if (isFastMover && consecutiveZeroDays >= 3 && recordedStock >= 5) {
        rawScore = Math.max(rawScore, 78);
      }

      const riskScore = Math.max(1, Math.min(99, rawScore));

      // Categorize
      let riskCategory: RiskCategory = 'LOW';
      if (riskScore >= 75) riskCategory = 'CRITICAL';
      else if (riskScore >= 55) riskCategory = 'HIGH';
      else if (riskScore >= 35) riskCategory = 'MEDIUM';
      else riskCategory = 'LOW';

      // Estimate daily lost revenue
      const expectedDailyUnits = Number((baseDailyDemand * avgDowMultiplier * promoMultiplier).toFixed(1));
      const estLostRevenueDaily = Number((expectedDailyUnits * product.unit_price).toFixed(2));

      // Generate honest, clear, human-readable primary reason
      let primaryReason = '';
      const pPercentStr = poissonZeroP < 0.0001 ? '<0.01%' : `${(poissonZeroP * 100).toFixed(1)}%`;

      if (isPromotionActive && isFastMover) {
        primaryReason = `System records ${recordedStock} units in inventory, but 0 sales occurred over ${consecutiveZeroDays} days during an active promotion (expected ${expectedDailyUnits} units/day, anomaly chance ${pPercentStr}).`;
      } else if (isFastMover) {
        primaryReason = `High-velocity product (avg ${baseDailyDemand.toFixed(1)} units/day) with ${recordedStock} recorded on-hand units has had ${consecutiveZeroDays} consecutive days with zero sales.`;
      } else if (isSlowMover) {
        primaryReason = `Slow-moving SKU with ${recordedStock} recorded units has shown an extended zero-sales run of ${consecutiveZeroDays} days beyond its typical cycle.`;
      } else {
        primaryReason = `Positive inventory of ${recordedStock} units with ${consecutiveZeroDays} days of 0 sales despite expected demand of ${expectedDailyUnits} units/day (Poisson anomaly p=${pPercentStr}).`;
      }

      const now = new Date().toISOString();
      const alert: Alert = {
        id: `ALT-${store.code}-${product.sku}-${Date.now().toString(36)}`,
        run_id: '', // Will be attached by caller
        store_id: store.id,
        store_name: store.name,
        product_id: product.id,
        sku: product.sku,
        product_name: product.name,
        category: product.category,
        unit_price: product.unit_price,
        risk_score: riskScore,
        risk_category: riskCategory,
        consecutive_zero_days: consecutiveZeroDays,
        recorded_stock: recordedStock,
        expected_daily_sales: expectedDailyUnits,
        est_lost_revenue_daily: estLostRevenueDaily,
        poisson_anomaly_p: Number(poissonZeroP.toFixed(5)),
        is_on_promotion: isPromotionActive,
        primary_reason: primaryReason,
        signals: {
          consecutiveZeroDays,
          recordedStock,
          expectedDailyDemand: product.avg_daily_demand,
          poissonPValue: Number(poissonZeroP.toFixed(5)),
          isPromotionActive,
          weekendMultiplier: avgDowMultiplier,
          stockToDemandRatio: Number((recordedStock / Math.max(0.1, baseDailyDemand)).toFixed(1)),
          estimatedLostSalesDaily: expectedDailyUnits,
        },
        status: 'OPEN',
        created_at: now,
        updated_at: now,
      };

      storeAlerts.push(alert);
    });

    // Rank by risk score descending and take up to maxRankPerStore
    storeAlerts.sort((a, b) => b.risk_score - a.risk_score);
    const topRanked = storeAlerts.slice(0, finalConfig.maxRankPerStore);
    alertsByStore.set(store.id, topRanked);
  });

  // Combine alerts across all stores
  const allAlerts: Alert[] = [];
  alertsByStore.forEach((list) => {
    allAlerts.push(...list);
  });

  // Global sort descending by risk score
  return allAlerts.sort((a, b) => b.risk_score - a.risk_score);
}
