-- ====================================================================
-- StockSentinel AI — PostgreSQL Extensions & Schema Baseline
-- Migration: 20261018000000_init_schema.sql
-- Description: Establishes required PostgreSQL extensions for UUID generation
-- and cryptographic security. Table definitions are managed by the enterprise
-- schema baseline in 20261018000001_secure_schema.sql.
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
