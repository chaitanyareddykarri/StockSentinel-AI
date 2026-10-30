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
  | 'promotions'
  | 'dev_labels'
  | 'dev_truth'
  | 'holidays'
  | 'predictions';

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
        synonyms: ['category', 'sub_category', 'dept', 'department', 'merchandise_group', 'product_group'],
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
        key: 'unit_margin',
        label: 'Unit Margin',
        description: 'Profit margin per unit (INR)',
        required: false,
        type: 'number',
        synonyms: ['unit_margin_inr', 'unit_margin', 'margin', 'gross_margin'],
      },
      {
        key: 'brand',
        label: 'Brand',
        description: 'Product brand or manufacturer',
        required: false,
        type: 'string',
        synonyms: ['brand', 'brand_name', 'manufacturer', 'vendor'],
      },
      {
        key: 'shelf_life_class',
        label: 'Shelf Life Class',
        description: 'Perishability or shelf life classification',
        required: false,
        type: 'string',
        synonyms: ['shelf_life_class', 'shelf_life', 'perishability', 'life_class'],
      },
      {
        key: 'case_pack',
        label: 'Case Pack Size',
        description: 'Units per carton / pack size',
        required: false,
        type: 'number',
        synonyms: ['case_pack', 'pack_size', 'case_size', 'pack'],
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
        synonyms: ['location', 'city', 'state', 'address', 'store_location', 'region'],
      },
      {
        key: 'store_type',
        label: 'Format / Type',
        description: 'Store format (Hyper, Express, Supercenter, tier)',
        required: false,
        type: 'string',
        synonyms: ['store_type', 'format', 'type', 'tier', 'city_tier'],
      },
      {
        key: 'size_sqft',
        label: 'Store Size (Sq Ft)',
        description: 'Retail store square footage',
        required: false,
        type: 'number',
        synonyms: ['size_sqft', 'sqft', 'store_size', 'size', 'square_feet'],
      },
      {
        key: 'label_split',
        label: 'Dataset Split',
        description: 'Dev, Validation, or Evaluation partition',
        required: false,
        type: 'string',
        synonyms: ['label_split', 'split', 'dataset_split', 'partition'],
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
        key: 'promo_id',
        label: 'Promotion Identifier',
        description: 'Unique promo campaign ID',
        required: false,
        type: 'string',
        synonyms: ['promo_id', 'promotion_id', 'campaign_id', 'id'],
      },
      {
        key: 'sku',
        label: 'SKU Identifier',
        description: 'Promoted product SKU or scope target',
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
        synonyms: ['store_id', 'store', 'store_code', 'store_scope_value', 'store_scope'],
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
        synonyms: ['promo_type', 'type', 'mechanic', 'promotion_type', 'promo_name'],
      },
    ],
  },
  dev_labels: {
    name: 'Ground Truth Episode Labels',
    description: 'Official evaluation benchmark ground truth episode window records (dev_labels.csv).',
    enablesDetection: true,
    fields: [
      {
        key: 'episode_id',
        label: 'Episode Identifier',
        description: 'Unique identifier for the phantom stockout episode',
        required: true,
        type: 'string',
        synonyms: ['episode_id', 'incident_id', 'id', 'episode'],
      },
      {
        key: 'store_id',
        label: 'Store Identifier',
        description: 'Store ID where incident occurred (e.g. STR-BFPW)',
        required: true,
        type: 'string',
        synonyms: ['store_id', 'store', 'store_code', 'location_id'],
      },
      {
        key: 'sku',
        label: 'SKU Identifier',
        description: 'Affected product SKU ID (e.g. SKU-4ZMFTW)',
        required: true,
        type: 'string',
        synonyms: ['sku_id', 'sku', 'product_id', 'item_id'],
      },
      {
        key: 'label_type',
        label: 'Incident Type',
        description: 'Verified stockout classification (phantom_stockout, slow_mover, zero_sales)',
        required: true,
        type: 'string',
        synonyms: ['label_type', 'incident_type', 'stockout_type', 'type', 'category'],
      },
      {
        key: 'counts_as_positive',
        label: 'Counts As Positive',
        description: 'Binary flag indicating whether episode counts as a positive incident (1/0, TRUE/FALSE)',
        required: true,
        type: 'boolean',
        synonyms: ['counts_as_positive', 'is_positive', 'positive', 'target', 'is_phantom'],
      },
      {
        key: 'episode_start_date',
        label: 'Episode Start Date',
        description: 'Date the phantom stockout begins (YYYY-MM-DD)',
        required: true,
        type: 'date',
        synonyms: ['episode_start_date', 'start_date', 'start', 'incident_date'],
      },
      {
        key: 'last_date_in_window',
        label: 'Last Date in Window',
        description: 'Closing evaluation date of the episode window (YYYY-MM-DD)',
        required: true,
        type: 'date',
        synonyms: ['last_date_in_window', 'end_date', 'window_end', 'last_date'],
      },
      {
        key: 'continues_after_window',
        label: 'Continues After Window',
        description: 'Indicator if the incident persists past window closure (1/0, TRUE/FALSE)',
        required: false,
        type: 'boolean',
        synonyms: ['continues_after_window', 'continues', 'ongoing', 'active'],
      },
    ],
  },
  dev_truth: {
    name: 'Ground Truth Daily Incidents',
    description: 'Day-level official ground truth incident occurrences (dev_truth.csv).',
    enablesDetection: true,
    fields: [
      {
        key: 'date',
        label: 'Incident Date',
        description: 'Date of ground truth stockout (YYYY-MM-DD)',
        required: true,
        type: 'date',
        synonyms: ['date', 'incident_date', 'day', 'dt'],
      },
      {
        key: 'store_id',
        label: 'Store Identifier',
        description: 'Store code (e.g. STR-BFPW)',
        required: true,
        type: 'string',
        synonyms: ['store_id', 'store', 'store_code', 'location_id'],
      },
      {
        key: 'sku',
        label: 'SKU Identifier',
        description: 'Target product SKU ID',
        required: true,
        type: 'string',
        synonyms: ['sku_id', 'sku', 'product_id', 'item_id'],
      },
      {
        key: 'label_type',
        label: 'Incident Type',
        description: 'Stockout label category (phantom_stockout, slow_mover, zero_sales)',
        required: true,
        type: 'string',
        synonyms: ['label_type', 'incident_type', 'type', 'stockout_type'],
      },
      {
        key: 'episode_id',
        label: 'Episode Identifier',
        description: 'Reference to parent episode ID if multi-day',
        required: false,
        type: 'string',
        synonyms: ['episode_id', 'episode', 'id'],
      },
    ],
  },
  holidays: {
    name: 'Holiday & Event Calendar',
    description: 'Regional and national holiday calendar (holiday_calendar.csv).',
    enablesDetection: false,
    fields: [
      {
        key: 'date',
        label: 'Holiday Date',
        description: 'Calendar date of the holiday or event (YYYY-MM-DD)',
        required: true,
        type: 'date',
        synonyms: ['date', 'holiday_date', 'day'],
      },
      {
        key: 'holiday_name',
        label: 'Holiday Name',
        description: 'Official name of the holiday (e.g. Diwali, Republic Day)',
        required: true,
        type: 'string',
        synonyms: ['holiday_name', 'name', 'holiday', 'event', 'title'],
      },
      {
        key: 'holiday_type',
        label: 'Holiday Type',
        description: 'Gazetted, restricted, regional, or seasonal event',
        required: false,
        type: 'string',
        synonyms: ['holiday_type', 'type', 'category', 'event_type'],
      },
      {
        key: 'scope',
        label: 'Regional Scope',
        description: 'National or state scope (e.g. National, Maharashtra, Karnataka)',
        required: false,
        type: 'string',
        synonyms: ['scope', 'coverage', 'region', 'state', 'geography'],
      },
      {
        key: 'date_certainty',
        label: 'Date Certainty',
        description: 'Exact, estimated, lunar-dependent',
        required: false,
        type: 'string',
        synonyms: ['date_certainty', 'certainty', 'status', 'confidence'],
      },
    ],
  },
  predictions: {
    name: 'Model Predictions & Submissions',
    description: 'Algorithmic predictions or official challenge submission file (sample_submission.csv).',
    enablesDetection: true,
    fields: [
      {
        key: 'date',
        label: 'Prediction Date',
        description: 'Predicted incident date (YYYY-MM-DD)',
        required: true,
        type: 'date',
        synonyms: ['date', 'prediction_date', 'day', 'dt'],
      },
      {
        key: 'store_id',
        label: 'Store Identifier',
        description: 'Store identifier (e.g. STR-BFPW)',
        required: true,
        type: 'string',
        synonyms: ['store_id', 'store', 'store_code', 'location_id'],
      },
      {
        key: 'sku',
        label: 'SKU Identifier',
        description: 'Product SKU identifier',
        required: true,
        type: 'string',
        synonyms: ['sku_id', 'sku', 'product_id', 'item_id'],
      },
      {
        key: 'rank',
        label: 'Prediction Rank',
        description: 'Store-day rank order (1 = highest priority incident)',
        required: false,
        type: 'number',
        synonyms: ['rank', 'order', 'priority', 'ranking'],
      },
      {
        key: 'confidence',
        label: 'Confidence / Probability',
        description: 'Model output probability score (0.0 to 1.0)',
        required: false,
        type: 'number',
        synonyms: ['confidence', 'probability', 'prob', 'score', 'p_score'],
      },
      {
        key: 'reason',
        label: 'AI Diagnostic Reason',
        description: 'Explainable AI diagnostic rationale (e.g. Consecutive zero-sales with positive book stock)',
        required: false,
        type: 'string',
        synonyms: ['reason', 'explanation', 'root_cause', 'justification', 'rationale'],
      },
      {
        key: 'predicted_type',
        label: 'Predicted Stockout Type',
        description: 'phantom_stockout, slow_mover, zero_sales',
        required: false,
        type: 'string',
        synonyms: ['predicted_type', 'prediction', 'label', 'type', 'incident_type'],
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

  // 1. Check for Ground Truth Episode Labels (dev_labels.csv)
  // Headers: ['episode_id', 'store_id', 'sku_id', 'label_type', 'counts_as_positive', 'episode_start_date', 'last_date_in_window', 'continues_after_window']
  const hasEpisode = normalized.some((h) => h === 'episode_id' || h.includes('episode'));
  const hasCountsAsPositive = normalized.some((h) => h === 'counts_as_positive' || h.includes('positive'));
  const hasEpisodeStartDate = normalized.some((h) => h === 'episode_start_date' || h === 'last_date_in_window');
  if (hasEpisode && (hasCountsAsPositive || hasEpisodeStartDate)) {
    return {
      detectedType: 'dev_labels',
      confidence: 0.99,
      reason: 'Detected official evaluation episode labels (contains episode_id and episode window fields).',
    };
  }

  // 2. Check for Ground Truth Daily Incidents (dev_truth.csv)
  // Headers: ['date', 'store_id', 'sku_id', 'label_type', 'episode_id']
  const hasDate = normalized.some((h) => ['date', 'sales_date', 'day', 'dt'].some((s) => h === s || h.includes(s)));
  const hasLabelType = normalized.some((h) => h === 'label_type' || h === 'stockout_type' || h.includes('incident_type'));
  if (hasEpisode && hasLabelType && hasDate) {
    return {
      detectedType: 'dev_truth',
      confidence: 0.98,
      reason: 'Detected official daily ground truth incidents (contains date, episode_id, and label_type).',
    };
  }

  // 3. Check for Holiday Calendar (holiday_calendar.csv)
  // Headers: ['date', 'holiday_name', 'holiday_type', 'scope', 'date_certainty']
  const hasHoliday = normalized.some((h) => h === 'holiday_name' || h.includes('holiday') || h === 'date_certainty');
  if (hasHoliday && hasDate) {
    return {
      detectedType: 'holidays',
      confidence: 0.98,
      reason: 'Detected holiday & promotional calendar (contains holiday_name/date_certainty).',
    };
  }

  // 4. Check for Predictions / Submissions (sample_submission.csv)
  // Headers: ['date', 'store_id', 'sku_id', 'rank', 'confidence', 'reason', 'predicted_type']
  const hasRank = normalized.some((h) => h === 'rank' || h === 'order' || h === 'ranking');
  const hasConfidence = normalized.some((h) => h === 'confidence' || h === 'probability' || h === 'prob');
  const hasPredictedType = normalized.some((h) => h === 'predicted_type' || h === 'prediction');
  if (hasRank || (hasConfidence && (hasPredictedType || normalized.some((h) => h === 'reason')))) {
    return {
      detectedType: 'predictions',
      confidence: 0.98,
      reason: 'Detected algorithm predictions/submissions (contains rank, confidence, or predicted_type).',
    };
  }

  // 5. Check for Promotion Calendar (promotion_calendar.csv)
  // Headers: ['promo_id', 'promo_name', 'promo_type', 'scope_level', 'scope_value', 'store_scope', 'store_scope_value', 'start_date', 'end_date', 'discount_pct']
  const hasPromoId = normalized.some((h) => h === 'promo_id' || h === 'promotion_id' || h === 'discount_pct' || h === 'scope_level');
  if (hasPromoId) {
    return {
      detectedType: 'promotions',
      confidence: 0.95,
      reason: 'Detected retail promotions calendar (contains promo_id, discount_pct, or scope_level).',
    };
  }

  // 6. Check for Combined Sales & Inventory (daily_sales_inventory_sample_2stores.csv)
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

  // 7. Check for separate transaction and snapshot entities
  if (hasDate && hasStore && hasSku && hasSales) {
    return {
      detectedType: 'daily_sales',
      confidence: 0.90,
      reason: 'Contains store sales transactions (requires matching inventory snapshots for phantom detection).',
    };
  }

  if (hasDate && hasStore && hasSku && hasInventory) {
    return {
      detectedType: 'inventory_snapshots',
      confidence: 0.90,
      reason: 'Contains on-hand inventory snapshots per store and SKU.',
    };
  }

  // 8. Check catalog master schemas
  const hasPrice = normalized.some((h) => ['price', 'unit_price', 'mrp', 'cost', 'unit_margin'].some((s) => h.includes(s)));
  const hasSkuName = normalized.some((h) => h === 'sku_name' || h === 'shelf_life_class' || h === 'pack_size' || h === 'case_pack');
  const hasName = normalized.some((h) => ['name', 'description', 'title'].some((s) => h.includes(s)));
  if (hasSku && (hasPrice || hasSkuName || hasName)) {
    return {
      detectedType: 'products',
      confidence: 0.95,
      reason: 'Detected SKU master product catalog.',
    };
  }

  const hasStoreFeatures = normalized.some((h) => ['size_sqft', 'sqft', 'format', 'city_tier', 'label_split', 'opening_date'].some((s) => h.includes(s)));
  const hasLocation = normalized.some((h) => ['location', 'city', 'state', 'address'].some((s) => h.includes(s)));
  if (hasStore && (hasStoreFeatures || hasLocation || hasName)) {
    return {
      detectedType: 'stores',
      confidence: 0.95,
      reason: 'Detected Store Master directory.',
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
