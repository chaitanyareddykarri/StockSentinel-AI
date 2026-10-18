import {
  Alert,
  DailySale,
  DetectionRun,
  InventorySnapshot,
  Product,
  Promotion,
  Store,
} from '@/types';
import { runBaselineDetection } from './detector';

export const DEMO_STORES: Store[] = [
  {
    id: 'store-001',
    code: 'SEA-101',
    name: 'Downtown Supercenter #101',
    location: 'Downtown Core, Seattle, WA',
    store_type: 'Supercenter',
    total_skus: 30,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'store-002',
    code: 'BEL-204',
    name: 'Metro Express Market #204',
    location: 'City Center, Bellevue, WA',
    store_type: 'Express Market',
    total_skus: 30,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'store-003',
    code: 'TAC-308',
    name: 'Suburban Mall Superstore #308',
    location: 'Westside Mall, Tacoma, WA',
    store_type: 'Superstore',
    total_skus: 30,
    created_at: '2026-01-01T00:00:00Z',
  },
];

export const DEMO_PRODUCTS: Product[] = [
  { id: 'prod-01', sku: 'SKU-101', name: 'Organic Whole Milk 1 Gal', category: 'Dairy', unit_price: 4.99, avg_daily_demand: 4.8, min_stock_threshold: 8, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-02', sku: 'SKU-102', name: 'Cold Brew Coffee 32oz', category: 'Beverages', unit_price: 5.49, avg_daily_demand: 3.2, min_stock_threshold: 6, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-03', sku: 'SKU-103', name: 'Artisan Sourdough Boule', category: 'Bakery', unit_price: 4.29, avg_daily_demand: 3.5, min_stock_threshold: 5, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-04', sku: 'SKU-104', name: 'Electrolyte Citrus Rush 16oz', category: 'Beverages', unit_price: 2.99, avg_daily_demand: 5.5, min_stock_threshold: 12, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-05', sku: 'SKU-105', name: 'Greek Plain Yogurt 32oz', category: 'Dairy', unit_price: 4.79, avg_daily_demand: 2.8, min_stock_threshold: 6, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-06', sku: 'SKU-106', name: 'Sea Salt Kettle Chips 8oz', category: 'Snacks & Pantry', unit_price: 3.89, avg_daily_demand: 4.0, min_stock_threshold: 8, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-07', sku: 'SKU-107', name: 'Almond Crunch Protein Bar 6pk', category: 'Snacks & Pantry', unit_price: 8.99, avg_daily_demand: 2.1, min_stock_threshold: 4, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-08', sku: 'SKU-108', name: 'Lavender Multi-Surface Spray', category: 'Household', unit_price: 4.49, avg_daily_demand: 1.6, min_stock_threshold: 4, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-09', sku: 'SKU-109', name: 'Bamboo Charcoal Toothbrush 2pk', category: 'Personal Care', unit_price: 5.99, avg_daily_demand: 0.8, min_stock_threshold: 4, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-10', sku: 'SKU-110', name: 'Ultra-Absorbent Paper Towels 6pk', category: 'Household', unit_price: 11.99, avg_daily_demand: 2.9, min_stock_threshold: 6, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-11', sku: 'SKU-111', name: 'Pure Clover Raw Honey 16oz', category: 'Snacks & Pantry', unit_price: 7.49, avg_daily_demand: 1.2, min_stock_threshold: 3, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-12', sku: 'SKU-112', name: 'Sparkling Lime Seltzer 12pk', category: 'Beverages', unit_price: 5.99, avg_daily_demand: 4.5, min_stock_threshold: 8, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-13', sku: 'SKU-113', name: 'Gluten-Free Multigrain Bread', category: 'Bakery', unit_price: 5.29, avg_daily_demand: 1.8, min_stock_threshold: 4, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-14', sku: 'SKU-114', name: 'Matcha Green Tea Powder 50g', category: 'Beverages', unit_price: 14.99, avg_daily_demand: 0.35, min_stock_threshold: 2, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-15', sku: 'SKU-115', name: 'Organic Extra Virgin Olive Oil', category: 'Snacks & Pantry', unit_price: 12.49, avg_daily_demand: 0.9, min_stock_threshold: 3, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-16', sku: 'SKU-116', name: 'Dark Chocolate Quinoa Bark', category: 'Snacks & Pantry', unit_price: 4.99, avg_daily_demand: 2.4, min_stock_threshold: 5, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-17', sku: 'SKU-117', name: 'Mineral Sunscreen SPF 50', category: 'Personal Care', unit_price: 13.99, avg_daily_demand: 0.3, min_stock_threshold: 2, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-18', sku: 'SKU-118', name: 'Plant-Based Dish Soap Citrus', category: 'Household', unit_price: 3.99, avg_daily_demand: 2.2, min_stock_threshold: 4, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-19', sku: 'SKU-119', name: 'Sharp White Cheddar Block 8oz', category: 'Dairy', unit_price: 4.49, avg_daily_demand: 2.7, min_stock_threshold: 5, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-20', sku: 'SKU-120', name: 'Italian Dark Espresso Beans 12oz', category: 'Beverages', unit_price: 10.99, avg_daily_demand: 1.7, min_stock_threshold: 3, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-21', sku: 'SKU-121', name: 'Organic Oat Milk 64oz', category: 'Dairy', unit_price: 4.29, avg_daily_demand: 3.6, min_stock_threshold: 6, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-22', sku: 'SKU-122', name: 'Cinnamon Raisin Bagels 6ct', category: 'Bakery', unit_price: 3.99, avg_daily_demand: 2.6, min_stock_threshold: 4, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-23', sku: 'SKU-123', name: 'Herbal Chamomile Tea 20ct', category: 'Beverages', unit_price: 3.79, avg_daily_demand: 0.5, min_stock_threshold: 2, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-24', sku: 'SKU-124', name: 'Handcrafted Lavender Soap Bar', category: 'Personal Care', unit_price: 4.99, avg_daily_demand: 0.4, min_stock_threshold: 2, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-25', sku: 'SKU-125', name: 'Spicy Tomatillo Salsa Verde', category: 'Snacks & Pantry', unit_price: 3.69, avg_daily_demand: 2.3, min_stock_threshold: 4, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-26', sku: 'SKU-126', name: 'Organic Black Chia Seeds 12oz', category: 'Snacks & Pantry', unit_price: 6.29, avg_daily_demand: 0.7, min_stock_threshold: 2, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-27', sku: 'SKU-127', name: 'Compostable Tall Trash Bags 30ct', category: 'Household', unit_price: 8.49, avg_daily_demand: 1.4, min_stock_threshold: 3, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-28', sku: 'SKU-128', name: 'Hydrocolloid Blemish Dots 36ct', category: 'Personal Care', unit_price: 7.99, avg_daily_demand: 1.9, min_stock_threshold: 3, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-29', sku: 'SKU-129', name: 'Zero Sugar Crisp Cola 12pk', category: 'Beverages', unit_price: 6.49, avg_daily_demand: 5.0, min_stock_threshold: 10, created_at: '2026-01-01T00:00:00Z' },
  { id: 'prod-30', sku: 'SKU-130', name: 'Himalayan Pink Rock Salt Grinder', category: 'Snacks & Pantry', unit_price: 5.49, avg_daily_demand: 0.25, min_stock_threshold: 2, created_at: '2026-01-01T00:00:00Z' },
];

export const DEMO_PROMOTIONS: Promotion[] = [
  {
    id: 'promo-01',
    store_id: 'store-002',
    product_id: 'prod-01',
    sku: 'SKU-101',
    start_date: '2026-10-10',
    end_date: '2026-10-20',
    discount_pct: 15,
    promo_type: 'FEATURE',
  },
  {
    id: 'promo-02',
    store_id: 'store-001',
    product_id: 'prod-04',
    sku: 'SKU-104',
    start_date: '2026-10-12',
    end_date: '2026-10-22',
    discount_pct: 20,
    promo_type: 'ENDCAP',
  },
  {
    id: 'promo-03',
    store_id: 'store-003',
    product_id: 'prod-12',
    sku: 'SKU-112',
    start_date: '2026-10-14',
    end_date: '2026-10-24',
    discount_pct: 10,
    promo_type: 'DISCOUNT',
  },
];

// Helper to generate 60 days of realistic sales and inventory
export function generateSyntheticDataset() {
  const sales: DailySale[] = [];
  const inventory: InventorySnapshot[] = [];

  // Anchor date: 2026-10-17 (yesterday relative to current system clock)
  const endDate = new Date('2026-10-17');
  const daysCount = 60;

  // Pre-calculate date list
  const dateList: string[] = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - i);
    dateList.push(d.toISOString().slice(0, 10));
  }

  // Define deliberately injected phantom stockouts
  // (store_id, sku, streak_days, on_hand_stock)
  const injectedPhantoms = [
    { store_id: 'store-001', sku: 'SKU-104', streak: 5, recordedStock: 26 }, // Fast mover, 5 zero days
    { store_id: 'store-002', sku: 'SKU-101', streak: 4, recordedStock: 16 }, // Promo active, 4 zero days
    { store_id: 'store-003', sku: 'SKU-103', streak: 4, recordedStock: 12 }, // Sourdough boule, 4 zero days
    { store_id: 'store-001', sku: 'SKU-112', streak: 3, recordedStock: 19 }, // Sparkling lime, 3 zero days
    { store_id: 'store-002', sku: 'SKU-129', streak: 4, recordedStock: 22 }, // Zero sugar cola, 4 zero days
    { store_id: 'store-003', sku: 'SKU-121', streak: 3, recordedStock: 15 }, // Oat milk, 3 zero days
    { store_id: 'store-001', sku: 'SKU-110', streak: 3, recordedStock: 14 }, // Paper towels, 3 zero days
  ];

  // Pseudo-random deterministic generator for reproducibility
  let seed = 42;
  function pseudoRandom() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  DEMO_STORES.forEach((store) => {
    DEMO_PRODUCTS.forEach((product) => {
      const injected = injectedPhantoms.find(
        (p) => p.store_id === store.id && p.sku === product.sku
      );

      // Running inventory count starting at healthy balance
      let currentStock = Math.round(product.avg_daily_demand * 6 + pseudoRandom() * 10);

      dateList.forEach((dateStr, dayIdx) => {
        const d = new Date(dateStr);
        const dow = d.getDay();
        const dowWeight = dow === 0 || dow === 6 ? 1.4 : dow === 5 ? 1.25 : 0.9;

        let unitsSold = 0;
        const daysFromEnd = daysCount - 1 - dayIdx;

        // If this product has an injected phantom streak on recent days
        if (injected && daysFromEnd < injected.streak) {
          unitsSold = 0;
          // Recorded inventory remains positive because system thinks it's there
          currentStock = injected.recordedStock;
        } else {
          // Normal stochastic Poisson-like demand
          const expected = product.avg_daily_demand * dowWeight;
          if (expected < 0.5) {
            // Slow mover: 0 on ~70% of days, 1 on ~30% of days
            unitsSold = pseudoRandom() < expected ? 1 : 0;
          } else {
            // Normal variance
            const variance = (pseudoRandom() - 0.5) * 1.5;
            unitsSold = Math.max(0, Math.round(expected + variance));
          }

          // Decrement stock and simulate replenishment when low
          currentStock = Math.max(1, currentStock - unitsSold);
          if (currentStock < product.min_stock_threshold) {
            currentStock += Math.round(product.avg_daily_demand * 5 + 4);
          }
        }

        // Record DailySale
        sales.push({
          id: `sale-${store.code}-${product.sku}-${dateStr}`,
          store_id: store.id,
          product_id: product.id,
          sku: product.sku,
          date: dateStr,
          units_sold: unitsSold,
          revenue: Number((unitsSold * product.unit_price).toFixed(2)),
          day_of_week: dow,
        });

        // Record InventorySnapshot
        inventory.push({
          id: `inv-${store.code}-${product.sku}-${dateStr}`,
          store_id: store.id,
          product_id: product.id,
          sku: product.sku,
          date: dateStr,
          on_hand_stock: currentStock,
        });
      });
    });
  });

  return { sales, inventory };
}

// Initial precomputed demo alerts and runs
export function getInitialDemoState() {
  const { sales, inventory } = generateSyntheticDataset();

  // Run baseline detection to generate initial alerts
  const rawAlerts = runBaselineDetection({
    stores: DEMO_STORES,
    products: DEMO_PRODUCTS,
    sales,
    inventory,
    promotions: DEMO_PROMOTIONS,
  });

  const runId = 'RUN-20261017-080000';
  const initialAlerts: Alert[] = rawAlerts.map((alt, idx) => {
    // Attach run_id and mark as demo
    const alert: Alert = {
      ...alt,
      run_id: runId,
      is_demo: true,
    };

    // Pre-seed 3 alerts with realistic physical verification outcomes
    // so the dashboard displays working audit history and verification rate
    if (idx === 1) {
      alert.status = 'VERIFIED';
      alert.verification_outcome = 'PHANTOM_CONFIRMED';
      alert.shelf_count = 0;
      alert.investigation_notes = 'Checked Aisle 4 shelf: Tag was present but shelf was completely empty. Discovered 1 unworked case in backroom staging dock.';
      alert.verified_by = 'Marcus Chen (Store Lead)';
      alert.verified_at = '2026-10-17T09:42:00Z';
    } else if (idx === 3) {
      alert.status = 'VERIFIED';
      alert.verification_outcome = 'BACKROOM_DISPLACED';
      alert.shelf_count = 0;
      alert.investigation_notes = 'Product was physically found palletized in top-tier warehouse racking without an active floor replenishment task.';
      alert.verified_by = 'Sarah Jenkins (Inventory Specialist)';
      alert.verified_at = '2026-10-17T10:15:00Z';
    } else if (idx === 5) {
      alert.status = 'FALSE_POSITIVE';
      alert.verification_outcome = 'IN_STOCK_FALSE_ALARM';
      alert.shelf_count = 14;
      alert.investigation_notes = 'Physical shelf has full facing of 14 units. Customer demand was unusually soft this midweek; not a phantom stock-out.';
      alert.verified_by = 'Elena Rostova (Assoc Manager)';
      alert.verified_at = '2026-10-17T11:30:00Z';
    }

    return alert;
  });

  const criticalCount = initialAlerts.filter((a) => a.risk_category === 'CRITICAL').length;

  const initialRun: DetectionRun = {
    id: runId,
    run_date: '2026-10-17T08:00:00Z',
    store_id: 'ALL',
    total_skus_analyzed: DEMO_STORES.length * DEMO_PRODUCTS.length,
    flagged_count: initialAlerts.length,
    critical_count: criticalCount,
    engine_type: 'BASELINE_POISSON',
    parameters: {
      minConsecutiveZeroDays: 2,
      fastMoverThreshold: 2.5,
      slowMoverThreshold: 0.6,
      significanceThreshold: 0.05,
      maxRankPerStore: 20,
    },
    alerts: initialAlerts,
    is_demo: true,
    created_at: '2026-10-17T08:00:00Z',
  };

  return {
    stores: DEMO_STORES,
    products: DEMO_PRODUCTS,
    promotions: DEMO_PROMOTIONS,
    sales,
    inventory,
    detectionRuns: [initialRun],
    alerts: initialAlerts,
  };
}
