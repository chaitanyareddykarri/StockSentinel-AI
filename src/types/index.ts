export type RiskCategory = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type AlertStatus = 'OPEN' | 'UNDER_REVIEW' | 'VERIFIED' | 'FALSE_POSITIVE' | 'RESOLVED';

export type VerificationOutcome = 
  | 'PHANTOM_CONFIRMED'
  | 'BACKROOM_DISPLACED'
  | 'MISPLACED_SHELF'
  | 'THEFT_SHRINKAGE'
  | 'IN_STOCK_FALSE_ALARM';

export interface Store {
  id: string;
  code: string;
  name: string;
  location: string;
  store_type: string;
  total_skus?: number;
  created_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit_price: number;
  avg_daily_demand: number;
  min_stock_threshold: number;
  created_at: string;
}

export interface DailySale {
  id: string;
  store_id: string;
  product_id: string;
  sku: string;
  date: string; // YYYY-MM-DD
  units_sold: number;
  revenue: number;
  day_of_week?: number; // 0-6
  created_at?: string;
}

export interface InventorySnapshot {
  id: string;
  store_id: string;
  product_id: string;
  sku: string;
  date: string; // YYYY-MM-DD
  on_hand_stock: number;
  created_at?: string;
}

export interface Promotion {
  id: string;
  store_id: string;
  product_id: string;
  sku: string;
  start_date: string;
  end_date: string;
  discount_pct: number;
  promo_type: 'FEATURE' | 'DISCOUNT' | 'ENDCAP';
}

export interface DetectionConfig {
  minConsecutiveZeroDays: number;
  fastMoverThreshold: number; // units/day threshold for fast movers
  slowMoverThreshold: number; // units/day threshold for slow movers
  significanceThreshold: number; // Poisson p-value limit
  maxRankPerStore: number;
}

export interface AlertSignals {
  consecutiveZeroDays: number;
  recordedStock: number;
  expectedDailyDemand: number;
  poissonPValue: number;
  isPromotionActive: boolean;
  weekendMultiplier: number;
  stockToDemandRatio: number;
  estimatedLostSalesDaily: number;
}

export interface Alert {
  id: string;
  run_id: string;
  store_id: string;
  store_name: string;
  product_id: string;
  sku: string;
  product_name: string;
  category: string;
  unit_price: number;
  risk_score: number; // 0-100
  risk_category: RiskCategory;
  consecutive_zero_days: number;
  recorded_stock: number;
  expected_daily_sales: number;
  est_lost_revenue_daily: number;
  poisson_anomaly_p: number;
  is_on_promotion: boolean;
  primary_reason: string;
  signals: AlertSignals;
  status: AlertStatus;
  verification_outcome?: VerificationOutcome;
  shelf_count?: number;
  investigation_notes?: string;
  verified_by?: string;
  verified_at?: string;
  is_demo?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  alert_id: string;
  previous_status: AlertStatus;
  new_status: AlertStatus;
  outcome?: VerificationOutcome;
  shelf_count?: number;
  notes: string;
  changed_by: string;
  created_at: string;
}

export interface DetectionRun {
  id: string;
  run_date: string;
  store_id: string; // or 'ALL'
  total_skus_analyzed: number;
  flagged_count: number;
  critical_count: number;
  engine_type: 'BASELINE_POISSON' | 'ENSEMBLE_ML' | 'PYTHON_FASTAPI';
  parameters: DetectionConfig;
  alerts?: Alert[];
  is_demo?: boolean;
  created_at: string;
}

export interface DashboardMetrics {
  totalMonitoredSkus: number;
  activeStores: number;
  flaggedPhantomStockouts: number;
  criticalAlerts: number;
  estRevenueAtRiskDaily: number;
  verificationRate: number;
  verifiedCount: number;
  precisionAt20: number;
  lastDetectionRun?: string;
}

export interface EvaluationResult {
  precisionAt10: number;
  precisionAt20: number;
  recall: number;
  f1Score: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  totalEvaluated: number;
  averageRankOfPhantoms: number;
}
