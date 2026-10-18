-- ====================================================================
-- StockSentinel AI — PostgreSQL Database Schema
-- Run this in your Supabase SQL Editor or standard PostgreSQL database
-- ====================================================================

CREATE TABLE IF NOT EXISTS stores (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    store_type TEXT NOT NULL DEFAULT 'Supercenter',
    total_skus INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    avg_daily_demand NUMERIC(8, 2) NOT NULL DEFAULT 1.00,
    min_stock_threshold INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_sales (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    date DATE NOT NULL,
    units_sold INTEGER NOT NULL DEFAULT 0,
    revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    day_of_week SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sales_store_sku_date UNIQUE (store_id, sku, date)
);

CREATE TABLE IF NOT EXISTS inventory_snapshots (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    date DATE NOT NULL,
    on_hand_stock INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inv_store_sku_date UNIQUE (store_id, sku, date)
);

CREATE TABLE IF NOT EXISTS promotions (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    promo_type TEXT NOT NULL DEFAULT 'DISCOUNT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS detection_runs (
    id TEXT PRIMARY KEY,
    run_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    store_id TEXT NOT NULL DEFAULT 'ALL',
    total_skus_analyzed INTEGER NOT NULL DEFAULT 0,
    flagged_count INTEGER NOT NULL DEFAULT 0,
    critical_count INTEGER NOT NULL DEFAULT 0,
    engine_type TEXT NOT NULL DEFAULT 'BASELINE_POISSON',
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    run_id TEXT REFERENCES detection_runs(id) ON DELETE CASCADE,
    store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    store_name TEXT NOT NULL,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku TEXT NOT NULL,
    product_name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_category TEXT NOT NULL CHECK (risk_category IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    consecutive_zero_days INTEGER NOT NULL DEFAULT 0,
    recorded_stock INTEGER NOT NULL DEFAULT 0,
    expected_daily_sales NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    est_lost_revenue_daily NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    poisson_anomaly_p NUMERIC(8, 6) NOT NULL DEFAULT 1.000000,
    is_on_promotion BOOLEAN NOT NULL DEFAULT FALSE,
    primary_reason TEXT NOT NULL,
    signals JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'VERIFIED', 'FALSE_POSITIVE', 'RESOLVED')),
    verification_outcome TEXT CHECK (verification_outcome IN ('PHANTOM_CONFIRMED', 'BACKROOM_DISPLACED', 'MISPLACED_SHELF', 'THEFT_SHRINKAGE', 'IN_STOCK_FALSE_ALARM')),
    shelf_count INTEGER,
    investigation_notes TEXT,
    verified_by TEXT,
    verified_at TIMESTAMPTZ,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_audit_log (
    id TEXT PRIMARY KEY,
    alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL,
    outcome TEXT,
    shelf_count INTEGER,
    notes TEXT,
    changed_by TEXT NOT NULL DEFAULT 'Store Associate',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_store_date ON daily_sales(store_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_sku_date ON daily_sales(sku, date);
CREATE INDEX IF NOT EXISTS idx_inv_store_date ON inventory_snapshots(store_id, date);
CREATE INDEX IF NOT EXISTS idx_inv_sku_date ON inventory_snapshots(sku, date);
CREATE INDEX IF NOT EXISTS idx_alerts_run_id ON alerts(run_id);
CREATE INDEX IF NOT EXISTS idx_alerts_store_status ON alerts(store_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_risk_category ON alerts(risk_category);
CREATE INDEX IF NOT EXISTS idx_audit_alert_id ON verification_audit_log(alert_id);
