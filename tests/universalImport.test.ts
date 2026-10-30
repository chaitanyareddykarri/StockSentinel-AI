import test from 'node:test';
import assert from 'node:assert/strict';
import {
  suggestColumnMapping,
  detectDatasetType,
  sanitizeCsvCell,
  normalizeHeader,
  CANONICAL_SCHEMAS,
} from '../src/lib/universalImport';

test('Universal Retail CSV Import & Column Mapping Engine', async (t) => {
  await t.test('1. Normalizes varied header naming styles', () => {
    assert.equal(normalizeHeader('Store-ID'), 'store_id');
    assert.equal(normalizeHeader('Sales Qty (Units)'), 'sales_qty_units');
    assert.equal(normalizeHeader('on_hand_eod'), 'on_hand_eod');
    assert.equal(normalizeHeader('Unit Price (INR)'), 'unit_price_inr');
  });

  await t.test('2. Accurately maps alternative retail column variations with HIGH confidence', () => {
    // Official Challenge & POS synonyms
    const mappedDate = suggestColumnMapping('business_date', 'combined_sales_inventory');
    assert.equal(mappedDate.canonicalKey, 'date');
    assert.equal(mappedDate.confidence, 'HIGH');

    const mappedStore = suggestColumnMapping('store_code', 'combined_sales_inventory');
    assert.equal(mappedStore.canonicalKey, 'store_id');
    assert.equal(mappedStore.confidence, 'HIGH');

    const mappedSku = suggestColumnMapping('product_id', 'combined_sales_inventory');
    assert.equal(mappedSku.canonicalKey, 'sku');
    assert.equal(mappedSku.confidence, 'HIGH');

    const mappedUnits = suggestColumnMapping('quantity_sold', 'combined_sales_inventory');
    assert.equal(mappedUnits.canonicalKey, 'units_sold');
    assert.equal(mappedUnits.confidence, 'HIGH');

    const mappedOnHand = suggestColumnMapping('on_hand_eod', 'combined_sales_inventory');
    assert.equal(mappedOnHand.canonicalKey, 'on_hand_stock');
    assert.equal(mappedOnHand.confidence, 'HIGH');

    const mappedStockOnHand = suggestColumnMapping('stock_on_hand', 'combined_sales_inventory');
    assert.equal(mappedStockOnHand.canonicalKey, 'on_hand_stock');
    assert.equal(mappedStockOnHand.confidence, 'HIGH');
  });

  await t.test('3. Rejects ambiguous or unknown fields with NONE confidence', () => {
    const unmapped = suggestColumnMapping('random_audit_checksum_x99', 'combined_sales_inventory');
    assert.equal(unmapped.canonicalKey, null);
    assert.equal(unmapped.confidence, 'NONE');
  });

  await t.test('4. Auto-detects Combined Sales & Inventory dataset type', () => {
    const headers = ['date', 'store_id', 'sku_id', 'units_sold', 'on_hand_eod', 'on_promo'];
    const detected = detectDatasetType(headers);
    assert.equal(detected.detectedType, 'combined_sales_inventory');
    assert.ok(detected.confidence >= 0.9);
  });

  await t.test('5. Auto-detects Daily Sales dataset type', () => {
    const headers = ['sales_date', 'location_id', 'product_code', 'quantity_sold', 'revenue'];
    const detected = detectDatasetType(headers);
    assert.equal(detected.detectedType, 'daily_sales');
  });

  await t.test('6. Auto-detects Inventory Snapshots dataset type', () => {
    const headers = ['as_of_date', 'store_id', 'sku', 'stock_on_hand'];
    const detected = detectDatasetType(headers);
    assert.equal(detected.detectedType, 'inventory_snapshots');
  });

  await t.test('7. Auto-detects Product Catalog dataset type', () => {
    const headers = ['sku_id', 'sku_name', 'category', 'unit_price_inr', 'unit_cost_inr'];
    const detected = detectDatasetType(headers);
    assert.equal(detected.detectedType, 'products');
  });

  await t.test('8. Auto-detects Store Directory dataset type', () => {
    const headers = ['store_id', 'store_name', 'city', 'state', 'format'];
    const detected = detectDatasetType(headers);
    assert.equal(detected.detectedType, 'stores');
  });

  await t.test('9. Neutralizes CSV Spreadsheet Formula Injection (=, +, -, @)', () => {
    assert.equal(sanitizeCsvCell('=SUM(A1:A10)'), "'=SUM(A1:A10)");
    assert.equal(sanitizeCsvCell('+cmd|/c calc'), "'+cmd|/c calc");
    assert.equal(sanitizeCsvCell('@IMPORT'), "'@IMPORT");
    assert.equal(sanitizeCsvCell('-50.25'), "'-50.25");
    assert.equal(sanitizeCsvCell('Normal Store Name'), 'Normal Store Name');
  });

  await t.test('10. Confirms Phantom Stockout detection capability per dataset schema', () => {
    assert.equal(CANONICAL_SCHEMAS.combined_sales_inventory.enablesDetection, true);
    assert.equal(CANONICAL_SCHEMAS.daily_sales.enablesDetection, false);
    assert.equal(CANONICAL_SCHEMAS.inventory_snapshots.enablesDetection, false);
    assert.equal(CANONICAL_SCHEMAS.products.enablesDetection, false);
  });

  await t.test('11. Auto-detects official Hackathon starter pack files with 100% precision', () => {
    // dev_labels.csv
    const devLabelsHeaders = ['episode_id', 'store_id', 'sku_id', 'label_type', 'counts_as_positive', 'episode_start_date', 'last_date_in_window', 'continues_after_window'];
    const devLabelsDetected = detectDatasetType(devLabelsHeaders);
    assert.equal(devLabelsDetected.detectedType, 'dev_labels');
    assert.ok(devLabelsDetected.confidence >= 0.95);

    // dev_truth.csv
    const devTruthHeaders = ['date', 'store_id', 'sku_id', 'label_type', 'episode_id'];
    const devTruthDetected = detectDatasetType(devTruthHeaders);
    assert.equal(devTruthDetected.detectedType, 'dev_truth');
    assert.ok(devTruthDetected.confidence >= 0.95);

    // holiday_calendar.csv
    const holidayHeaders = ['date', 'holiday_name', 'holiday_type', 'scope', 'date_certainty'];
    const holidayDetected = detectDatasetType(holidayHeaders);
    assert.equal(holidayDetected.detectedType, 'holidays');
    assert.ok(holidayDetected.confidence >= 0.95);

    // sample_submission.csv
    const submissionHeaders = ['date', 'store_id', 'sku_id', 'rank', 'confidence', 'reason', 'predicted_type'];
    const submissionDetected = detectDatasetType(submissionHeaders);
    assert.equal(submissionDetected.detectedType, 'predictions');
    assert.ok(submissionDetected.confidence >= 0.95);

    // promotion_calendar.csv
    const promoHeaders = ['promo_id', 'promo_name', 'promo_type', 'scope_level', 'scope_value', 'store_scope', 'store_scope_value', 'start_date', 'end_date', 'discount_pct'];
    const promoDetected = detectDatasetType(promoHeaders);
    assert.equal(promoDetected.detectedType, 'promotions');
    assert.ok(promoDetected.confidence >= 0.95);

    // sku_master.csv
    const skuHeaders = ['sku_id', 'sku_name', 'category', 'sub_category', 'brand', 'pack_size', 'unit_price_inr', 'unit_cost_inr', 'unit_margin_inr', 'shelf_life_class', 'case_pack'];
    const skuDetected = detectDatasetType(skuHeaders);
    assert.equal(skuDetected.detectedType, 'products');
    assert.ok(skuDetected.confidence >= 0.95);

    // store_master.csv
    const storeHeaders = ['store_id', 'store_name', 'format', 'size_sqft', 'city', 'state', 'city_tier', 'region', 'opening_date', 'label_split'];
    const storeDetected = detectDatasetType(storeHeaders);
    assert.equal(storeDetected.detectedType, 'stores');
    assert.ok(storeDetected.confidence >= 0.95);
  });

  await t.test('12. Maps all dev_labels.csv headers to canonical schema with 0 unmapped required fields', () => {
    const devLabelsHeaders = ['episode_id', 'store_id', 'sku_id', 'label_type', 'counts_as_positive', 'episode_start_date', 'last_date_in_window', 'continues_after_window'];
    const schema = CANONICAL_SCHEMAS.dev_labels;
    const mapped: Record<string, string> = {};

    schema.fields.forEach((field) => {
      for (const h of devLabelsHeaders) {
        const suggestion = suggestColumnMapping(h, 'dev_labels');
        if (suggestion.canonicalKey === field.key) {
          mapped[field.key] = h;
          break;
        }
      }
    });

    // Check all required fields are mapped
    const missingRequired = schema.fields.filter((f) => f.required && !mapped[f.key]);
    assert.equal(missingRequired.length, 0, `Missing required fields: ${missingRequired.map((f) => f.key).join(', ')}`);
    assert.equal(mapped.episode_id, 'episode_id');
    assert.equal(mapped.store_id, 'store_id');
    assert.equal(mapped.sku, 'sku_id');
    assert.equal(mapped.label_type, 'label_type');
    assert.equal(mapped.counts_as_positive, 'counts_as_positive');
    assert.equal(mapped.episode_start_date, 'episode_start_date');
    assert.equal(mapped.last_date_in_window, 'last_date_in_window');
  });
});

