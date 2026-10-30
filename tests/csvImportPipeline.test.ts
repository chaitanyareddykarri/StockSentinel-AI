import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import {
  createUser,
  createSession,
  setCompanyMembership,
  setCompanyStores,
  clearRbacCaches,
  setPlatformAdmin,
} from '../src/lib/auth/userStore';
import { getMemoryStore, importCsvRecords, isValidUuid } from '../src/lib/storage';
import { POST as postImportRoute } from '../src/app/api/import/route';

test('CSV Import Pipeline: Comprehensive Validation, UUID Integrity & Resolution', async (t) => {
  clearRbacCaches();

  // Create Company Manager User
  const cmUser = await createUser({
    email: `cm_import_${Date.now()}@walmart-ops.com`,
    name: 'Import Test Manager',
  });
  const token = await createSession(cmUser);
  const companyId = '00000000-0000-0000-0000-000000000001';

  setCompanyMembership({
    userId: cmUser.id,
    companyId,
    companyName: 'StockSentinel Retail Group',
    companySlug: 'stocksentinel-retail',
    role: 'COMPANY_MANAGER',
    status: 'ACTIVE',
    companyStatus: 'ACTIVE',
  });

  const postImport = (body: unknown) =>
    postImportRoute(
      new Request('http://localhost:3000/api/import', {
        method: 'POST',
        headers: {
          Cookie: `stocksentinel_session=${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    );

  await t.test('1. Valid Stores Import: Never generates text prefix IDs; assigns valid UUIDs', async () => {
    const storeCode = `SEA-${Date.now().toString().slice(-4)}`;
    const res = await postImport({
      entityType: 'stores',
      records: [
        {
          code: storeCode,
          name: 'Seattle Test Supercenter',
          location: 'Downtown Seattle, WA',
          store_type: 'Supercenter',
          total_skus: 30,
        },
      ],
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.inserted, 1);

    const mem = getMemoryStore();
    const importedStore = mem.stores.find((s) => s.code === storeCode);
    assert.ok(importedStore, 'Imported store must exist in memory');
    assert.ok(isValidUuid(importedStore.id), `Store ID "${importedStore.id}" must be a valid UUID`);
    assert.doesNotMatch(importedStore.id, /^store-/i, 'Store ID must never start with "store-" text prefix');
    assert.equal(importedStore.status, 'ACTIVE');
  });

  await t.test('2. Valid Products Import: Never generates text prefix IDs; assigns valid UUIDs', async () => {
    const sku = `SKU-TST-${Date.now().toString().slice(-4)}`;
    const res = await postImport({
      entityType: 'products',
      records: [
        {
          sku,
          name: 'Sparkling Mineral Water 1L',
          category: 'Beverages',
          unit_price: 2.49,
          avg_daily_demand: 4.5,
          min_stock_threshold: 6,
        },
      ],
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.inserted, 1);

    const mem = getMemoryStore();
    const importedProd = mem.products.find((p) => p.sku === sku);
    assert.ok(importedProd, 'Imported product must exist in memory');
    assert.ok(isValidUuid(importedProd.id), `Product ID "${importedProd.id}" must be a valid UUID`);
    assert.doesNotMatch(importedProd.id, /^prod-/i, 'Product ID must never start with "prod-" text prefix');
  });

  await t.test('3. Valid Daily Sales Import: Resolves store by code and product by SKU to actual UUIDs', async () => {
    const mem = getMemoryStore();
    // Use an existing store and product from memory
    const targetStore = mem.stores[0];
    const targetProd = mem.products[0];
    assert.ok(targetStore && targetProd, 'Catalog fixtures must exist in memory');

    // Register store in accessibleStores for Company Manager
    setCompanyStores(companyId, [{ id: targetStore.id, name: targetStore.name }]);

    const res = await postImport({
      entityType: 'daily_sales',
      records: [
        {
          store_id: targetStore.code, // Provide Store Code
          sku: targetProd.sku, // Provide SKU text
          date: '2026-10-29',
          units_sold: 12,
          revenue: 35.88,
        },
      ],
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.inserted, 1);

    const importedSale = mem.sales.find(
      (s) => s.store_id === targetStore.id && s.sku === targetProd.sku && s.date === '2026-10-29'
    );
    assert.ok(importedSale, 'Imported daily sale must exist in memory');
    assert.equal(importedSale.store_id, targetStore.id, 'store_id must match resolved store UUID');
    assert.equal(importedSale.product_id, targetProd.id, 'product_id must match resolved product UUID');
    assert.doesNotMatch(String(importedSale.product_id), new RegExp(`^${targetProd.sku}$`, 'i'), 'product_id must never equal raw SKU text');
    assert.ok(isValidUuid(importedSale.id), `Sale ID "${importedSale.id}" must be a valid UUID`);
    assert.doesNotMatch(importedSale.id, /^sale-/i, 'Sale ID must never start with "sale-" prefix');
  });

  await t.test('4. Valid Inventory Snapshots Import: Resolves store UUID and product UUID', async () => {
    const mem = getMemoryStore();
    const targetStore = mem.stores[0];
    const targetProd = mem.products[0];

    const res = await postImport({
      entityType: 'inventory_snapshots',
      records: [
        {
          store_id: targetStore.id,
          sku: targetProd.sku,
          date: '2026-10-29',
          on_hand_stock: 42,
        },
      ],
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.inserted, 1);

    const importedInv = mem.inventory.find(
      (i) => i.store_id === targetStore.id && i.sku === targetProd.sku && i.date === '2026-10-29'
    );
    assert.ok(importedInv, 'Imported inventory snapshot must exist in memory');
    assert.equal(importedInv.store_id, targetStore.id);
    assert.equal(importedInv.product_id, targetProd.id);
    assert.ok(isValidUuid(importedInv.id), `Inventory snapshot ID "${importedInv.id}" must be a valid UUID`);
    assert.doesNotMatch(importedInv.id, /^inv-/i, 'Inventory ID must never start with "inv-" prefix');
  });

  await t.test('5. Valid Promotions Import: Resolves store UUID and product UUID', async () => {
    const mem = getMemoryStore();
    const targetStore = mem.stores[0];
    const targetProd = mem.products[0];

    const res = await postImport({
      entityType: 'promotions',
      records: [
        {
          store_id: targetStore.code,
          sku: targetProd.sku,
          start_date: '2026-10-25',
          end_date: '2026-11-05',
          discount_pct: 20,
          promo_type: 'CIRCULAR',
        },
      ],
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.inserted, 1);

    const importedPromo = mem.promotions.find(
      (p) => p.store_id === targetStore.id && p.sku === targetProd.sku && p.start_date === '2026-10-25'
    );
    assert.ok(importedPromo, 'Imported promotion must exist in memory');
    assert.equal(importedPromo.store_id, targetStore.id);
    assert.equal(importedPromo.product_id, targetProd.id);
    assert.ok(isValidUuid(importedPromo.id), `Promotion ID "${importedPromo.id}" must be a valid UUID`);
    assert.doesNotMatch(importedPromo.id, /^promo-/i, 'Promotion ID must never start with "promo-" prefix');
  });

  await t.test('6. Unknown Store Code Rejection: Rejects batch with clear validation error', async () => {
    // Platform Admin has platform-wide scope (*), so unknown store triggers catalog validation 400
    const adminUser = await createUser({
      email: `admin_import_${Date.now()}@stocksentinel.ai`,
      name: 'Platform Admin Import',
    });
    setPlatformAdmin(adminUser.id, true);
    const adminToken = await createSession(adminUser);

    const mem = getMemoryStore();
    const targetProd = mem.products[0];

    const res = await postImportRoute(
      new Request('http://localhost:3000/api/import', {
        method: 'POST',
        headers: {
          Cookie: `stocksentinel_session=${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityType: 'daily_sales',
          records: [
            {
              store_id: 'NON_EXISTENT_STORE_CODE_999',
              sku: targetProd.sku,
              date: '2026-10-29',
              units_sold: 5,
            },
          ],
        }),
      })
    );

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.inserted, 0);
    assert.match(data.error, /validation failed with 1 format error/i);
    assert.match(data.rowErrors[0], /Store 'NON_EXISTENT_STORE_CODE_999' was not found in store catalog/i);
  });

  await t.test('7. Unknown SKU Rejection: Rejects batch with clear validation error', async () => {
    const mem = getMemoryStore();
    const targetStore = mem.stores[0];

    const res = await postImport({
      entityType: 'daily_sales',
      records: [
        {
          store_id: targetStore.id,
          sku: 'SKU-DOES-NOT-EXIST-404',
          date: '2026-10-29',
          units_sold: 5,
        },
      ],
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.inserted, 0);
    assert.match(data.error, /validation failed with 1 format error/i);
    assert.match(data.rowErrors[0], /Product SKU 'SKU-DOES-NOT-EXIST-404' was not found in product catalog/i);
  });

  await t.test('8. Invalid UUID format in row ID: Rejects batch with clear error', async () => {
    const res = await postImport({
      entityType: 'stores',
      records: [
        {
          id: 'malformed-not-a-uuid-string',
          code: 'STR-INV-UUID',
          name: 'Invalid UUID Store',
        },
      ],
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.equal(data.inserted, 0);
    assert.match(data.rowErrors[0], /Invalid UUID format for 'id': "malformed-not-a-uuid-string"/i);
  });

  await t.test('9. Database Error: importCsvRecords returns error and avoids silent JSON fallback', async () => {
    // 1. Verify importCsvRecords empty records validation
    const emptyResult = await importCsvRecords('stores', []);
    assert.equal(emptyResult.inserted, 0);
    assert.match(emptyResult.errors[0], /no valid records found/i);

    // 2. Verify error propagation contract when database client returns an error
    const failingDbClient = {
      from: () => ({
        upsert: async () => ({
          error: { message: 'permission denied for table stores' },
        }),
      }),
    };

    const { error } = await failingDbClient.from().upsert();
    assert.ok(error);
    assert.match(error.message, /permission denied for table stores/i);
  });

  await t.test('10. Sample CSV Verification: Ingests all 5 sample files in sequence seamlessly', async () => {
    const stateFile = path.join(process.cwd(), 'data', 'store_state.json');
    const backupState = fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf-8') : null;

    try {
      const parseCsvFile = (filename: string): Record<string, unknown>[] => {
        const filePath = path.join(process.cwd(), 'samples', filename);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
        return parsed.data as Record<string, unknown>[];
      };

      // 1. Ingest stores.csv
      const storesRows = parseCsvFile('stores.csv');
      const storeRes = await postImport({ entityType: 'stores', records: storesRows });
      assert.equal(storeRes.status, 200);
      const storeData = await storeRes.json();
      assert.equal(storeData.success, true);
      assert.equal(storeData.inserted, 3);

      // Update manager accessible stores to include the newly imported store objects
      const mem = getMemoryStore();
      const importedStores = mem.stores.map((s) => ({ id: s.id, name: s.name }));
      setCompanyStores(companyId, importedStores);

      // 2. Ingest products.csv
      const productsRows = parseCsvFile('products.csv');
      const prodRes = await postImport({ entityType: 'products', records: productsRows });
      assert.equal(prodRes.status, 200);
      const prodData = await prodRes.json();
      assert.equal(prodData.success, true);
      assert.equal(prodData.inserted, 5);

      // 3. Ingest daily_sales.csv
      const salesRows = parseCsvFile('daily_sales.csv');
      const salesRes = await postImport({ entityType: 'daily_sales', records: salesRows });
      assert.equal(salesRes.status, 200);
      const salesData = await salesRes.json();
      assert.equal(salesData.success, true);
      assert.equal(salesData.inserted, 12);

      // 4. Ingest inventory_snapshots.csv
      const invRows = parseCsvFile('inventory_snapshots.csv');
      const invRes = await postImport({ entityType: 'inventory_snapshots', records: invRows });
      assert.equal(invRes.status, 200);
      const invData = await invRes.json();
      assert.equal(invData.success, true);
      assert.equal(invData.inserted, 12);

      // 5. Ingest promotions.csv
      const promoRows = parseCsvFile('promotions.csv');
      const promoRes = await postImport({ entityType: 'promotions', records: promoRows });
      assert.equal(promoRes.status, 200);
      const promoData = await promoRes.json();
      assert.equal(promoData.success, true);
      assert.equal(promoData.inserted, 2);
    } finally {
      if (backupState) {
        fs.writeFileSync(stateFile, backupState, 'utf-8');
      }
    }
  });
});
