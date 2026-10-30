import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createUser,
  createSession,
  setCompanyMembership,
  setCompanyStores,
  clearRbacCaches,
} from '../src/lib/auth/userStore';
import { getMemoryStore, isValidUuid } from '../src/lib/storage';
import { POST as postImportRoute } from '../src/app/api/import/route';

test('Combined Sales & Inventory Universal Import Pipeline', async (t) => {
  clearRbacCaches();

  const cmUser = await createUser({
    email: `cm_combined_${Date.now()}@walmart-ops.com`,
    name: 'Combined Import Manager',
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

  await t.test('1. Ingests combined sales & inventory rows simultaneously into both collections', async () => {
    const mem = getMemoryStore();
    const targetStore = mem.stores.find((s) => s.company_id === companyId) || mem.stores[0];
    const targetProd = mem.products.find((p) => !p.company_id || p.company_id === companyId) || mem.products[0];
    assert.ok(targetStore && targetProd, 'Catalog fixtures must exist in memory');

    setCompanyStores(companyId, [{ id: targetStore.id, name: targetStore.name }]);

    const testDate = '2026-10-30';
    const res = await postImport({
      entityType: 'combined_sales_inventory',
      records: [
        {
          date: testDate,
          store_id: targetStore.code, // Synonyms / alternative naming
          sku: targetProd.sku,
          units_sold: 7,
          on_hand_eod: 45,
          on_promo: 0,
        },
      ],
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.inserted, 1);
    assert.equal(data.inventorySnapshotsInserted, 1);

    // Verify sale record in memory
    const sale = mem.sales.find(
      (s) => s.store_id === targetStore.id && s.sku === targetProd.sku && s.date === testDate
    );
    assert.ok(sale, 'Sale record must be inserted');
    assert.equal(sale.units_sold, 7);
    assert.ok(isValidUuid(sale.id), 'Sale ID must be a valid UUID');

    // Verify inventory snapshot in memory
    const inv = mem.inventory.find(
      (i) => i.store_id === targetStore.id && i.sku === targetProd.sku && i.date === testDate
    );
    assert.ok(inv, 'Inventory snapshot record must be inserted');
    assert.equal(inv.on_hand_stock, 45);
    assert.ok(isValidUuid(inv.id), 'Inventory ID must be a valid UUID');
  });

  await t.test('2. Rejects combined row missing store code or SKU with atomic safety', async () => {
    const res = await postImport({
      entityType: 'combined_sales_inventory',
      records: [
        {
          date: '2026-10-30',
          store_id: 'NON_EXISTENT_STORE_CODE',
          sku: 'NON_EXISTENT_SKU',
          units_sold: 5,
          on_hand_eod: 10,
        },
      ],
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.rowErrors && data.rowErrors.length > 0);
  });
});
