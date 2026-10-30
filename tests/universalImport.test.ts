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
});

