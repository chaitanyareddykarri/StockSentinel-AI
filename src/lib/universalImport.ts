/**
 * Universal Retail Column Mapping & CSV Ingestion Engine
 * Normalizes diverse CSV schemas (Hackathon, ERP, POS, WMS, Catalog) into canonical models.
 */

export type DatasetType =
  | 'combined_sales_inventory'
  | 'daily_sales'
  | 'inventory_snapshots'
  | 'products'
  | 'stores'
  | 'promotions';

export interface CanonicalFieldDef {
  key: string;
  label: string;
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'boolean';
  synonyms: string[];
}

export const CANONICAL_SCHEMAS: Record<DatasetType, {
  name: string;
  description: string;
  fields: CanonicalFieldDef[];
  enablesDetection: boolean;
  requiredForDetectionNotice?: string;
}> = {
  combined_sales_inventory: {
    name: 'Combined Sales & Inventory',
    description: 'Unified retail report containing daily sales transactions and on-hand inventory balances (e.g., official challenge daily_sales_inventory format).',
    enablesDetection: true,
    fields: [
      {
        key: 'date',
        label: 'Date',
        description: 'Business transaction date (YYYY-MM-DD)',
        required: true,
        type: 'date',
        synonyms: ['date', 'sales_date', 'transaction_date', 'business_date', 'day', 'dt'],
      },
      {
        key: 'store_id',
        label: 'Store Identifier',
        description: 'Store ID or alphanumeric code (e.g. STR-BFPW, SEA-101)',
        required: true,
        type: 'string',
        synonyms: ['store_id', 'store', 'store_code', 'location_id', 'site_id', 'store_num', 'store_no'],
      },
      {
        key: 'sku',
        label: 'SKU / Product Identifier',
        description: 'Unique product code or SKU ID (e.g. SKU-047AZA)',
        required: true,
        type: 'string',
        synonyms: ['sku_id', 'sku', 'product_id', 'item_id', 'product_code', 'article_id', 'barcode', 'upc'],
      },
      {
        key: 'units_sold',
        label: 'Units Sold',
        description: 'Daily units purchased / sold (non-negative integer)',
        required: true,
        type: 'number',
        synonyms: ['units_sold', 'quantity_sold', 'sales_qty', 'units', 'qty', 'sold_qty', 'volume_sold', 'sales_units'],
      },
      {
        key: 'on_hand_stock',
        label: 'On-Hand Inventory (EOD)',
        description: 'End-of-day physical stock or system on-hand inventory count',
        required: true,
        type: 'number',
        synonyms: ['on_hand_eod', 'inventory', 'stock_on_hand', 'available_stock', 'ending_inventory', 'on_hand_stock', 'soh', 'stock_qty', 'current_inventory', 'closing_stock'],
      },
      {
        key: 'on_promo',
        label: 'Promotion Flag',
        description: 'Binary promotional indicator (1/0, true/false, Y/N)',
        required: false,
        type: 'boolean',
        synonyms: ['on_promo', 'promotion', 'promo_flag', 'is_promotional', 'promo', 'is_promo', 'featured'],
      },
      {
        key: 'revenue',
        label: 'Sales Revenue',
        description: 'Gross or net sales currency value',
        required: false,
        type: 'number',
        synonyms: ['revenue', 'sales_amount', 'sales_val', 'total_sales', 'net_sales', 'turnover'],
      },
    ],
  },
  daily_sales: {
    name: 'Daily Sales Transactions',
    description: 'Transaction sales logs per store and SKU. Note: requires inventory data to detect phantom stockouts.',
    enablesDetection: false,
    requiredForDetectionNotice: 'Daily sales data establishes demand baseline, but requires inventory snapshots to verify shelf availability.',
    fields: [
      {
        key: 'date',
        label: 'Date',
        description: 'Transaction date (YYYY-MM-DD)',
        required: true,
        type: 'date',
        synonyms: ['date', 'sales_date', 'transaction_date', 'business_date', 'day'],
      },
      {
        key: 'store_id',
        label: 'Store Identifier',
        description: 'Store ID or code',
        required: true,
        type: 'string',
        synonyms: ['store_id', 'store', 'store_code', 'location_id', 'site_id'],
      },
      {
        key: 'sku',
        label: 'SKU Identifier',
        description: 'Product SKU or item code',
        required: true,
        type: 'string',
        synonyms: ['sku_id', 'sku', 'product_id', 'item_id', 'product_code'],
      },
      {
        key: 'units_sold',
        label: 'Units Sold',
        description: 'Units sold on this date',
        required: true,
        type: 'number',
        synonyms: ['units_sold', 'quantity_sold', 'sales_qty', 'units', 'qty', 'volume_sold'],
      },
      {
        key: 'revenue',
        label: 'Revenue',
        description: 'Monetary sales total',
        required: false,
        type: 'number',
        synonyms: ['revenue', 'sales_amount', 'sales_val', 'total_sales', 'turnover'],
      },
    ],
  },
  inventory_snapshots: {
    name: 'Inventory Snapshots (On-Hand EOD)',
    description: 'Daily system recorded stock levels per store and SKU. Note: requires historical sales to compute zero-sales probability.',
    enablesDetection: false,
    requiredForDetectionNotice: 'Inventory snapshots confirm positive recorded stock, but require sales history to detect anomalous zero-sales streaks.',
    fields: [
      {
        key: 'date',
        label: 'Date',
        description: 'Snapshot date (YYYY-MM-DD)',
        required: true,
        type: 'date',
        synonyms: ['date', 'snapshot_date', 'as_of_date', 'inventory_date', 'business_date'],
      },
      {
        key: 'store_id',
        label: 'Store Identifier',
        description: 'Store ID or code',
        required: true,
        type: 'string',
        synonyms: ['store_id', 'store', 'store_code', 'location_id'],
      },
      {
        key: 'sku',
        label: 'SKU Identifier',
        description: 'Product SKU or item code',
        required: true,
        type: 'string',
        synonyms: ['sku_id', 'sku', 'product_id', 'item_id', 'product_code'],
      },
      {
        key: 'on_hand_stock',
        label: 'On-Hand Stock',
        description: 'Recorded system balance',
        required: true,
        type: 'number',
        synonyms: ['on_hand_stock', 'on_hand_eod', 'inventory', 'stock_on_hand', 'available_stock', 'ending_inventory', 'soh'],
      },
    ],
  },
  products: {
    name: 'Products & SKU Catalog',
    description: 'Product master catalog with unit prices, categories, and baseline velocity parameters.',
    enablesDetection: false,
    fields: [
      {
        key: 'sku',
        label: 'SKU ID',
        description: 'Unique product code',
        required: true,
        type: 'string',
        synonyms: ['sku_id', 'sku', 'product_id', 'item_id', 'product_code', 'article_id'],
      },
      {
        key: 'name',
        label: 'Product Name',
        description: 'Full product description / title',
        required: true,
        type: 'string',
        synonyms: ['name', 'product_name', 'sku_name', 'item_name', 'description', 'title'],
      },
      {
        key: 'category',
        label: 'Category',
        description: 'Department or category',
        required: false,
        type: 'string',
        synonyms: ['category', 'dept', 'department', 'merchandise_group', 'product_group'],
      },
      {
        key: 'unit_price',
        label: 'Unit Price',
        description: 'Retail selling price (INR, USD, etc.)',
        required: false,
        type: 'number',
        synonyms: ['unit_price', 'price', 'selling_price', 'unit_price_inr', 'mrp', 'retail_price'],
      },
      {
        key: 'unit_cost',
        label: 'Unit Cost',
        description: 'Acquisition / purchase cost',
        required: false,
        type: 'number',
        synonyms: ['unit_cost', 'cost', 'unit_cost_inr', 'purchase_cost', 'cogs'],
      },
      {
        key: 'avg_daily_demand',
        label: 'Baseline Daily Demand',
        description: 'Expected historical velocity (units/day)',
        required: false,
        type: 'number',
        synonyms: ['avg_daily_demand', 'daily_velocity', 'expected_demand', 'avg_demand', 'velocity'],
      },
      {
        key: 'min_stock_threshold',
        label: 'Min Stock Threshold',
        description: 'Safety stock / presentation minimum threshold',
        required: false,
        type: 'number',
        synonyms: ['min_stock_threshold', 'safety_stock', 'presentation_min', 'reorder_point', 'min_threshold'],
      },
    ],
  },
  stores: {
    name: 'Store Master',
    description: 'Retail store directory with format, location, and metadata.',
    enablesDetection: false,
    fields: [
      {
        key: 'code',
        label: 'Store Code / ID',
        description: 'Unique store identifier or code',
        required: true,
        type: 'string',
        synonyms: ['store_id', 'code', 'store_code', 'store', 'location_id', 'site_id'],
      },
      {
        key: 'name',
        label: 'Store Name',
        description: 'Full store name',
        required: true,
        type: 'string',
        synonyms: ['name', 'store_name', 'location_name', 'store_title', 'branch_name'],
      },
      {
        key: 'location',
        label: 'Location / City',
        description: 'Physical location or city/state',
        required: false,
        type: 'string',
        synonyms: ['location', 'city', 'address', 'store_location', 'region'],
      },
      {
        key: 'store_type',
        label: 'Format / Type',
        description: 'Store format (Hyper, Express, Supercenter)',
        required: false,
        type: 'string',
        synonyms: ['store_type', 'format', 'type', 'tier'],
      },
      {
        key: 'total_skus',
        label: 'Total Active SKUs',
        description: 'Count of active catalog products',
        required: false,
        type: 'number',
        synonyms: ['total_skus', 'sku_count', 'active_items', 'assortment_size'],
      },
    ],
  },
  promotions: {
    name: 'Promotions Calendar',
    description: 'Active circular and price promotion dates per product or store.',
    enablesDetection: false,
    fields: [
      {
        key: 'sku',
        label: 'SKU Identifier',
        description: 'Promoted product SKU',
        required: true,
        type: 'string',
        synonyms: ['sku_id', 'sku', 'product_id', 'scope_value', 'item_id'],
      },
      {
        key: 'store_id',
        label: 'Store Identifier',
        description: 'Store where promo applies (or leave empty for all)',
        required: false,
        type: 'string',
        synonyms: ['store_id', 'store', 'store_code', 'store_scope_value'],
      },
      {
        key: 'start_date',
        label: 'Start Date',
        description: 'Promo start date (YYYY-MM-DD)',
        required: true,
        type: 'date',
        synonyms: ['start_date', 'promo_start', 'from_date', 'begin_date'],
      },
      {
        key: 'end_date',
        label: 'End Date',
        description: 'Promo end date (YYYY-MM-DD)',
        required: true,
        type: 'date',
        synonyms: ['end_date', 'promo_end', 'to_date', 'finish_date'],
      },
      {
        key: 'discount_pct',
        label: 'Discount %',
        description: 'Percentage discount (e.g. 15, 20)',
        required: false,
        type: 'number',
        synonyms: ['discount_pct', 'discount', 'pct_off', 'discount_percentage'],
      },
      {
        key: 'promo_type',
        label: 'Promotion Type',
        description: 'bogo, price_off, feature, endcap',
        required: false,
        type: 'string',
        synonyms: ['promo_type', 'type', 'mechanic', 'promotion_type'],
      },
    ],
  },
};

/**
 * Normalizes header string for comparison: lowercase, stripped punctuation, underscores.
 */
export function normalizeHeader(header: string): string {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Suggests best canonical mapping for an uploaded CSV column header.
 */
export function suggestColumnMapping(
  csvHeader: string,
  targetDataset: DatasetType
): { canonicalKey: string | null; confidence: 'HIGH' | 'MEDIUM' | 'NONE'; reason: string } {
  const norm = normalizeHeader(csvHeader);
  const schema = CANONICAL_SCHEMAS[targetDataset];
  if (!schema) return { canonicalKey: null, confidence: 'NONE', reason: 'Unknown dataset schema' };

  // 1. Exact match with canonical key or primary key synonyms
  for (const field of schema.fields) {
    if (normalizeHeader(field.key) === norm) {
      return { canonicalKey: field.key, confidence: 'HIGH', reason: `Exact match for "${field.label}"` };
    }
  }

  // 2. High confidence match with synonyms
  for (const field of schema.fields) {
    for (const syn of field.synonyms) {
      if (normalizeHeader(syn) === norm) {
        return { canonicalKey: field.key, confidence: 'HIGH', reason: `Matches recognized synonym "${syn}"` };
      }
    }
  }

  // 3. Medium confidence substring match
  for (const field of schema.fields) {
    for (const syn of field.synonyms) {
      const synNorm = normalizeHeader(syn);
      if (norm.includes(synNorm) || synNorm.includes(norm)) {
        // Prevent false positives on short terms like "id" or "date"
        if (synNorm.length >= 4 && norm.length >= 4) {
          return { canonicalKey: field.key, confidence: 'MEDIUM', reason: `Partial match with "${syn}"` };
        }
      }
    }
  }

  return { canonicalKey: null, confidence: 'NONE', reason: 'No confident match found; manual mapping required.' };
}

/**
 * Auto-detects the most suitable DatasetType from an array of CSV header strings.
 */
export function detectDatasetType(headers: string[]): {
  detectedType: DatasetType;
  confidence: number;
  reason: string;
} {
  const normalized = headers.map(normalizeHeader);

  // Check for combined sales & inventory first (both units_sold/sales and on_hand/inventory present)
  const hasDate = normalized.some((h) => ['date', 'sales_date', 'day'].some((s) => h.includes(s)));
  const hasStore = normalized.some((h) => ['store', 'location'].some((s) => h.includes(s)));
  const hasSku = normalized.some((h) => ['sku', 'product', 'item'].some((s) => h.includes(s)));
  const hasSales = normalized.some((h) => ['units_sold', 'quantity_sold', 'sales_qty', 'units', 'qty', 'sold'].some((s) => h.includes(s)));
  const hasInventory = normalized.some((h) => ['on_hand', 'inventory', 'stock', 'soh'].some((s) => h.includes(s)));

  if (hasDate && hasStore && hasSku && hasSales && hasInventory) {
    return {
      detectedType: 'combined_sales_inventory',
      confidence: 0.95,
      reason: 'Contains date, store, SKU, sales volume, and on-hand inventory columns.',
    };
  }

  if (hasDate && hasStore && hasSku && hasSales) {
    return {
      detectedType: 'daily_sales',
      confidence: 0.85,
      reason: 'Contains store sales transactions (requires matching inventory snapshots for phantom detection).',
    };
  }

  if (hasDate && hasStore && hasSku && hasInventory) {
    return {
      detectedType: 'inventory_snapshots',
      confidence: 0.85,
      reason: 'Contains on-hand inventory snapshots per store and SKU.',
    };
  }

  // Check catalog types
  const hasPrice = normalized.some((h) => ['price', 'unit_price', 'mrp', 'cost'].some((s) => h.includes(s)));
  const hasName = normalized.some((h) => ['name', 'description', 'title'].some((s) => h.includes(s)));
  if (hasSku && (hasPrice || hasName)) {
    return {
      detectedType: 'products',
      confidence: 0.8,
      reason: 'Contains SKU catalog with product descriptions/prices.',
    };
  }

  const hasLocation = normalized.some((h) => ['location', 'city', 'state', 'address'].some((s) => h.includes(s)));
  if (hasStore && (hasLocation || hasName)) {
    return {
      detectedType: 'stores',
      confidence: 0.8,
      reason: 'Contains store directory with locations and store names.',
    };
  }

  const hasDiscount = normalized.some((h) => ['discount', 'promo'].some((s) => h.includes(s)));
  if (hasDiscount) {
    return {
      detectedType: 'promotions',
      confidence: 0.75,
      reason: 'Contains promotional calendar schedules.',
    };
  }

  return {
    detectedType: 'combined_sales_inventory',
    confidence: 0.5,
    reason: 'Defaulting to Combined Sales & Inventory (configure manually if needed).',
  };
}

/**
 * Sanitizes cell contents against CSV Formula Injection (=, +, -, @, \t, \r)
 */
export function sanitizeCsvCell(value: unknown): string {
  const str = String(value ?? '').trim();
  if (/^[=\+\-\@\t\r]/.test(str)) {
    return `'${str}`; // Prefix with single-quote to escape spreadsheet interpretation
  }
  return str;
}
