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
  user_id?: string;
  code: string;
  name: string;
  location: string;
  store_type: string;
  total_skus?: number;
  created_at: string;
}

export interface Product {
  id: string;
  user_id?: string;
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
  user_id?: string;
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
  user_id?: string;
  store_id: string;
  product_id: string;
  sku: string;
  date: string; // YYYY-MM-DD
  on_hand_stock: number;
  created_at?: string;
}

export interface Promotion {
  id: string;
  user_id?: string;
  store_id: string;
  product_id: string;
  sku: string;
  start_date: string;
  end_date: string;
  discount_pct: number;
  promo_type: 'FEATURE' | 'DISCOUNT' | 'ENDCAP';
  created_at?: string;
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
  user_id?: string;
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
  user_id?: string;
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
  user_id?: string;
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

export interface ImportJob {
  id: string;
  user_id: string;
  entity_type: 'stores' | 'products' | 'daily_sales' | 'inventory_snapshots' | 'promotions';
  filename: string;
  records_count: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  errors?: string[];
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

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: Record<string, unknown>) => void;
          prompt: (notification?: (notification: unknown) => void) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: {
              access_token?: string;
              error?: string;
              error_description?: string;
            }) => void;
          }) => {
            requestAccessToken: (overrideConfig?: Record<string, unknown>) => void;
          };
        };
      };
    };
  }
}

