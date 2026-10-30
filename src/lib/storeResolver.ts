import type { Store } from '@/types';

// Canonical demo store constants
export const DEMO_STORE_IDS = ['store-001', 'store-002', 'store-003'] as const;
export type DemoStoreId = (typeof DEMO_STORE_IDS)[number];

export const DEMO_STORE_MAP: Record<
  DemoStoreId,
  { code: string; name: string; number: string; city: string }
> = {
  'store-001': { code: 'SEA-101', name: 'Downtown Supercenter #101', number: '101', city: 'seattle' },
  'store-002': { code: 'BEL-204', name: 'Metro Express Market #204', number: '204', city: 'bellevue' },
  'store-003': { code: 'TAC-308', name: 'Suburban Mall Superstore #308', number: '308', city: 'tacoma' },
};

/**
 * Resolves any store identifier, name, or code to its canonical demo store ID ('store-001' | 'store-002' | 'store-003')
 * if it represents one of the 3 seeded demo retail stores.
 *
 * Matches:
 * - Direct IDs: 'store-001', 'store-002', 'store-003'
 * - Store codes: 'SEA-101', 'BEL-204', 'TAC-308'
 * - Store numbers: '101', '204', '308'
 * - City / Location: 'seattle', 'bellevue', 'tacoma'
 * - Onboarding titles: 'Store #204 - Bellevue Square', 'Store #101 - Seattle Flagship', 'Store #308 - Tacoma Center'
 * - Onboarding auto-IDs: 'store_<slug>_1' -> 'store-001', 'store_<slug>_2' -> 'store-002', 'store_<slug>_3' -> 'store-003'
 * - Store object matching if storeList is provided
 */
export function resolveDemoStoreId(storeRef?: string | null, storeList?: Store[]): DemoStoreId | undefined {
  if (!storeRef || typeof storeRef !== 'string') return undefined;
  const ref = storeRef.trim();
  if (!ref || ref === 'ALL' || ref === '*') return undefined;

  // 1. Direct ID match
  if (ref === 'store-001' || ref === 'store-002' || ref === 'store-003') {
    return ref;
  }
  if (ref === 'f6aa88e5-0dba-4285-bc00-9250a43ceb85' || ref === '2f14e2f2-37c8-44c5-8c28-d9a2a2a81543') {
    return 'store-001';
  }
  if (ref === '0ca79c80-6a14-4471-b954-66d0f57cbb73') {
    return 'store-002';
  }
  if (ref === 'ef65c827-ae77-4517-a3e8-c9cfb65d3d75') {
    return 'store-003';
  }

  // 2. Onboarding store ID pattern: store_<slug>_<index> (e.g. store_retailops_1, store_mycompany_2)
  if (/_1$|_1_/.test(ref)) return 'store-001';
  if (/_2$|_2_/.test(ref)) return 'store-002';
  if (/_3$|_3_/.test(ref)) return 'store-003';

  const lower = ref.toLowerCase();
  const upper = ref.toUpperCase();

  // 3. Store Codes
  if (upper.includes('BEL-204')) return 'store-002';
  if (upper.includes('SEA-101')) return 'store-001';
  if (upper.includes('TAC-308')) return 'store-003';

  // 4. Store Numbers
  if (/(?:^|\bstore\s+|#)204\b/i.test(ref) || upper === '204') return 'store-002';
  if (/(?:^|\bstore\s+|#)101\b/i.test(ref) || upper === '101') return 'store-001';
  if (/(?:^|\bstore\s+|#)308\b/i.test(ref) || upper === '308') return 'store-003';

  // 5. City and Location matching
  if (lower.includes('bellevue')) return 'store-002';
  if (lower.includes('seattle')) return 'store-001';
  if (lower.includes('tacoma')) return 'store-003';

  // 6. Store object lookup if available
  if (storeList && Array.isArray(storeList)) {
    const found = storeList.find((s) => s.id === ref);
    if (found) {
      return resolveDemoStoreId(`${found.id} ${found.code || ''} ${found.name || ''} ${found.location || ''}`);
    }
  }

  return undefined;
}

/**
 * Checks whether two store references identify the same store, either by exact match
 * or by resolving to the same underlying demo store.
 */
export function isSameOrAliasedStore(storeA?: string | null, storeB?: string | null, storeList?: Store[]): boolean {
  if (!storeA || !storeB) return false;
  if (storeA === storeB) return true;
  const demoA = resolveDemoStoreId(storeA, storeList);
  const demoB = resolveDemoStoreId(storeB, storeList);
  return Boolean(demoA && demoB && demoA === demoB);
}

/**
 * Expands an array of store IDs to include corresponding demo store IDs.
 * Preserves wildcard '*' and avoids adding duplicates.
 */
export function expandStoreIds(storeIds?: string[], storeList?: Store[]): string[] {
  if (!storeIds || !Array.isArray(storeIds)) return [];
  if (storeIds.includes('*')) return ['*'];

  const resultSet = new Set<string>(storeIds);
  for (const id of storeIds) {
    const demoId = resolveDemoStoreId(id, storeList);
    if (demoId) {
      resultSet.add(demoId);
    }
  }
  return Array.from(resultSet);
}
