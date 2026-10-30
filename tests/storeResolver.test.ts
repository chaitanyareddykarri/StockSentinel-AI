import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDemoStoreId,
  isSameOrAliasedStore,
  expandStoreIds,
} from '../src/lib/storeResolver';
import type { Store } from '../src/types';

test('1. resolveDemoStoreId: Resolves exact demo store IDs', () => {
  assert.equal(resolveDemoStoreId('store-001'), 'store-001');
  assert.equal(resolveDemoStoreId('store-002'), 'store-002');
  assert.equal(resolveDemoStoreId('store-003'), 'store-003');
});

test('2. resolveDemoStoreId: Resolves store codes and store numbers', () => {
  assert.equal(resolveDemoStoreId('BEL-204'), 'store-002');
  assert.equal(resolveDemoStoreId('SEA-101'), 'store-001');
  assert.equal(resolveDemoStoreId('TAC-308'), 'store-003');
  assert.equal(resolveDemoStoreId('Store 204'), 'store-002');
  assert.equal(resolveDemoStoreId('Store 101'), 'store-001');
  assert.equal(resolveDemoStoreId('Store 308'), 'store-003');
});

test('3. resolveDemoStoreId: Resolves onboarding titles and locations', () => {
  assert.equal(resolveDemoStoreId('Store #204 - Bellevue Square'), 'store-002');
  assert.equal(resolveDemoStoreId('Store #101 - Seattle Flagship'), 'store-001');
  assert.equal(resolveDemoStoreId('Store #308 - Tacoma Center'), 'store-003');
  assert.equal(resolveDemoStoreId('Bellevue Market'), 'store-002');
  assert.equal(resolveDemoStoreId('Seattle Flagship'), 'store-001');
  assert.equal(resolveDemoStoreId('Tacoma Center'), 'store-003');
});

test('4. resolveDemoStoreId: Resolves onboarding generated store IDs', () => {
  assert.equal(resolveDemoStoreId('store_walmart_1'), 'store-001');
  assert.equal(resolveDemoStoreId('store_walmart_2'), 'store-002');
  assert.equal(resolveDemoStoreId('store_walmart_3'), 'store-003');
  assert.equal(resolveDemoStoreId('store_targetcorp_2'), 'store-002');
});

test('5. resolveDemoStoreId: Resolves using store list lookup', () => {
  const customStores: Store[] = [
    {
      id: 'custom-uuid-abc',
      code: 'BEL-204',
      name: 'Metro Express Market #204',
      location: 'Bellevue, WA',
      store_type: 'Supercenter',
      created_at: new Date().toISOString(),
    },
  ];
  assert.equal(resolveDemoStoreId('custom-uuid-abc', customStores), 'store-002');
});

test('6. resolveDemoStoreId: Preserves ALL, wildcard, and unmapped custom stores', () => {
  assert.equal(resolveDemoStoreId('ALL'), undefined);
  assert.equal(resolveDemoStoreId('*'), undefined);
  assert.equal(resolveDemoStoreId(''), undefined);
  assert.equal(resolveDemoStoreId(undefined), undefined);
  assert.equal(resolveDemoStoreId('custom_independent_store_999'), undefined);
});

test('7. isSameOrAliasedStore: Correctly identifies equivalent store references', () => {
  assert.equal(isSameOrAliasedStore('store-002', 'Store #204 - Bellevue Square'), true);
  assert.equal(isSameOrAliasedStore('store_walmart_2', 'store-002'), true);
  assert.equal(isSameOrAliasedStore('BEL-204', 'store-002'), true);
  assert.equal(isSameOrAliasedStore('store-001', 'Store #101 - Seattle Flagship'), true);
  assert.equal(isSameOrAliasedStore('store-001', 'store-002'), false);
  assert.equal(isSameOrAliasedStore('Store #204 - Bellevue Square', 'Store #101 - Seattle Flagship'), false);
});

test('8. expandStoreIds: Expands allowed store IDs with demo store IDs without leaking other stores', () => {
  const expanded = expandStoreIds(['store_walmart_2']);
  assert.ok(expanded.includes('store_walmart_2'));
  assert.ok(expanded.includes('store-002'));
  assert.equal(expanded.includes('store-001'), false);
  assert.equal(expanded.includes('store-003'), false);

  const expandedAll = expandStoreIds(['*']);
  assert.deepEqual(expandedAll, ['*']);

  const expandedEmpty = expandStoreIds([]);
  assert.deepEqual(expandedEmpty, []);
});

