import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { importCsvRecords, getImportCatalogContext, isValidUuid } from '@/lib/storage';
import { getAuthenticatedUser } from '@/lib/auth/serverAuth';

type ValidEntity = 'stores' | 'products' | 'daily_sales' | 'inventory_snapshots' | 'promotions' | 'combined_sales_inventory';

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth.success || !auth.user) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Authentication required' },
        { status: auth.status || 401 }
      );
    }

    if (auth.user.accessState === 'PENDING_ASSIGNMENT' || auth.user.accessState === 'SUSPENDED') {
      return NextResponse.json(
        { success: false, error: 'Your account or company access is suspended or unassigned.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { entityType, records } = body;

    if (!entityType || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { success: false, error: 'entityType and non-empty records array are required' },
        { status: 400 }
      );
    }

    const validEntities: ValidEntity[] = [
      'stores',
      'products',
      'daily_sales',
      'inventory_snapshots',
      'promotions',
      'combined_sales_inventory',
    ];

    if (!validEntities.includes(entityType)) {
      return NextResponse.json(
        { success: false, error: `Invalid entityType. Must be one of: ${validEntities.join(', ')}` },
        { status: 400 }
      );
    }

    // Role-based permissions on entityType
    if (auth.user.accessState === 'STORE_MANAGER') {
      if (entityType === 'stores' || entityType === 'products') {
        return NextResponse.json(
          { success: false, error: 'Store managers are not authorized to import store or product catalog entities.' },
          { status: 403 }
        );
      }
    }

    const rowErrors: string[] = [];
    const validRows: Record<string, unknown>[] = [];
    const validInventoryRows: Record<string, unknown>[] = [];
    const userRole = auth.user.accessState;
    const assignedStore = auth.user.assignedStoreId;
    const accessibleStores = auth.user.accessibleStoreIds || [];

    // Pre-load catalog context to resolve store UUIDs and product UUIDs for telemetry entities
    const isTelemetryEntity = ['daily_sales', 'inventory_snapshots', 'promotions', 'combined_sales_inventory'].includes(entityType);
    const catalogContext = isTelemetryEntity
      ? await getImportCatalogContext(
          auth.user.id,
          auth.user.companyId,
          auth.user.accessState === 'PLATFORM_ADMIN' ? ['*'] : undefined,
          auth.user.authMode
        )
      : null;

    for (let index = 0; index < records.length; index++) {
      const rowNum = index + 1;
      const rowRecord = records[index];
      const row = (rowRecord && typeof rowRecord === 'object' ? rowRecord : {}) as Record<string, unknown>;

      // Validate ID if explicitly supplied in the CSV
      if (row.id !== undefined && row.id !== null && String(row.id).trim() !== '') {
        if (!isValidUuid(row.id)) {
          rowErrors.push(
            `Row ${rowNum}: Invalid UUID format for 'id': "${row.id}". Must be a valid UUID or omitted.`
          );
          continue;
        }
      }

      const rowId = row.id && isValidUuid(row.id) ? String(row.id).trim() : crypto.randomUUID();

      // Row-level store authorization and resolution for transaction entities
      if (isTelemetryEntity) {
        const rowStoreId = String(row.store_id || '').trim();
        if (!rowStoreId) {
          rowErrors.push(`Row ${rowNum}: Missing required store_id.`);
          continue;
        }

        // Resolve store to actual database record (UUID) by matching UUID or store code
        const matchingStore = catalogContext?.stores.find(
          (s) =>
            s.id.toLowerCase() === rowStoreId.toLowerCase() ||
            s.code.toLowerCase() === rowStoreId.toLowerCase()
        );

        if (!matchingStore) {
          rowErrors.push(`Row ${rowNum}: Store '${rowStoreId}' was not found in store catalog. Please import stores first.`);
          continue;
        }

        // Authorize Store Manager strictly to assigned store (accepts either store UUID or store code)
        if (userRole === 'STORE_MANAGER' && matchingStore.id !== assignedStore) {
          return NextResponse.json(
            {
              success: false,
              error: `Access denied on Row ${rowNum}: Store managers can only import records for their assigned store (${assignedStore}). Row references '${rowStoreId}'.`,
              inserted: 0,
            },
            { status: 403 }
          );
        }

        // Authorize Company Manager strictly to company stores
        if (userRole === 'COMPANY_MANAGER' && !accessibleStores.includes(matchingStore.id)) {
          return NextResponse.json(
            {
              success: false,
              error: `Access denied on Row ${rowNum}: Store '${rowStoreId}' does not belong to your company.`,
              inserted: 0,
            },
            { status: 403 }
          );
        }

        // Resolve product to actual database record (UUID)
        const rowSku = String(row.sku || '').trim();
        if (!rowSku) {
          rowErrors.push(`Row ${rowNum}: Missing required sku.`);
          continue;
        }

        const matchingProduct = catalogContext?.products.find(
          (p) =>
            p.sku.toLowerCase() === rowSku.toLowerCase() ||
            (p.id && p.id.toLowerCase() === rowSku.toLowerCase())
        );

        if (!matchingProduct) {
          rowErrors.push(`Row ${rowNum}: Product SKU '${rowSku}' was not found in product catalog. Please import products first.`);
          continue;
        }

        if (entityType === 'combined_sales_inventory') {
          const rawDate = row.date || row.sales_date || row.business_date;
          if (!rawDate) {
            rowErrors.push(`Row ${rowNum}: Missing date.`);
            continue;
          }
          const unitsSoldRaw = row.units_sold !== undefined ? row.units_sold : row.quantity_sold;
          const unitsSold = parseInt(String(unitsSoldRaw ?? 0), 10);
          if (isNaN(unitsSold) || unitsSold < 0) {
            rowErrors.push(`Row ${rowNum}: Invalid units_sold '${String(unitsSoldRaw)}'. Must be non-negative integer.`);
            continue;
          }

          const onHandRaw = row.on_hand_stock !== undefined ? row.on_hand_stock : row.on_hand_eod;
          const onHand = parseInt(String(onHandRaw ?? 0), 10);
          if (isNaN(onHand) || onHand < 0) {
            rowErrors.push(`Row ${rowNum}: Invalid on_hand_stock / on_hand_eod '${String(onHandRaw)}'. Must be non-negative integer.`);
            continue;
          }

          const dateStr = String(rawDate).trim();
          const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;

          // 1. Sales row
          validRows.push({
            id: rowId,
            ...(auth.user.companyId && isValidUuid(auth.user.companyId) ? { company_id: auth.user.companyId } : {}),
            store_id: matchingStore.id,
            product_id: matchingProduct.id,
            sku: matchingProduct.sku,
            date: cleanDate,
            units_sold: unitsSold,
            revenue: Number(row.revenue) || (unitsSold * (matchingProduct.unit_price || 0.0)),
            day_of_week: new Date(cleanDate).getDay(),
            created_at: new Date().toISOString(),
          });

          // 2. Inventory row
          validInventoryRows.push({
            id: crypto.randomUUID(),
            ...(auth.user.companyId && isValidUuid(auth.user.companyId) ? { company_id: auth.user.companyId } : {}),
            store_id: matchingStore.id,
            product_id: matchingProduct.id,
            sku: matchingProduct.sku,
            date: cleanDate,
            on_hand_stock: onHand,
            created_at: new Date().toISOString(),
          });
          continue;
        }

        if (entityType === 'daily_sales') {
          if (!row.date) {
            rowErrors.push(`Row ${rowNum}: Missing date.`);
            continue;
          }
          const unitsSold = parseInt(String(row.units_sold), 10);
          if (isNaN(unitsSold) || unitsSold < 0) {
            rowErrors.push(`Row ${rowNum}: Invalid units_sold '${String(row.units_sold)}'. Must be non-negative integer.`);
            continue;
          }
          validRows.push({
            id: rowId,
            ...(auth.user.companyId && isValidUuid(auth.user.companyId) ? { company_id: auth.user.companyId } : {}),
            store_id: matchingStore.id, // Actual database UUID
            product_id: matchingProduct.id, // Actual database UUID
            sku: matchingProduct.sku,
            date: String(row.date).trim(),
            units_sold: unitsSold,
            revenue: Number(row.revenue) || 0.0,
            day_of_week: new Date(String(row.date)).getDay(),
            created_at: new Date().toISOString(),
          });
        } else if (entityType === 'inventory_snapshots') {
          if (!row.date) {
            rowErrors.push(`Row ${rowNum}: Missing date.`);
            continue;
          }
          const onHand = parseInt(String(row.on_hand_stock), 10);
          if (isNaN(onHand) || onHand < 0) {
            rowErrors.push(`Row ${rowNum}: Invalid on_hand_stock '${String(row.on_hand_stock)}'. Must be non-negative integer.`);
            continue;
          }
          validRows.push({
            id: rowId,
            ...(auth.user.companyId && isValidUuid(auth.user.companyId) ? { company_id: auth.user.companyId } : {}),
            store_id: matchingStore.id, // Actual database UUID
            product_id: matchingProduct.id, // Actual database UUID
            sku: matchingProduct.sku,
            date: String(row.date).trim(),
            on_hand_stock: onHand,
            created_at: new Date().toISOString(),
          });
        } else if (entityType === 'promotions') {
          if (!row.start_date || !row.end_date) {
            rowErrors.push(`Row ${rowNum}: Missing start_date or end_date.`);
            continue;
          }
          validRows.push({
            id: rowId,
            ...(auth.user.companyId && isValidUuid(auth.user.companyId) ? { company_id: auth.user.companyId } : {}),
            store_id: matchingStore.id, // Actual database UUID
            product_id: matchingProduct.id, // Actual database UUID
            sku: matchingProduct.sku,
            start_date: String(row.start_date).trim(),
            end_date: String(row.end_date).trim(),
            discount_pct: Number(row.discount_pct) || 0.0,
            promo_type: row.promo_type || 'DISCOUNT',
            created_at: new Date().toISOString(),
          });
        }
        continue;
      }

      if (entityType === 'stores') {
        if (!row.code || !row.name) {
          rowErrors.push(`Row ${rowNum}: Missing store code or name.`);
          continue;
        }

        let loc = String(row.location || 'Retail Location').trim();
        let storeType = String(row.store_type || 'Supercenter').trim();
        let totalSkus = Number(row.total_skus);

        // Auto-heal unquoted comma in CSV location (e.g. "Seattle, WA, Supercenter, 30")
        if (isNaN(totalSkus) && row.store_type && /^[A-Z]{2}$/i.test(String(row.store_type).trim())) {
          loc = `${loc}, ${row.store_type}`;
          storeType = String(row.total_skus || 'Supercenter').trim();
          const rowKeys = Object.keys(row);
          const overflowValue = Number((row as Record<string, unknown>)[rowKeys[5]]);
          totalSkus = !isNaN(overflowValue) ? overflowValue : 30;
        }

        validRows.push({
          id: rowId,
          ...(auth.user.companyId && isValidUuid(auth.user.companyId) ? { company_id: auth.user.companyId } : {}),
          code: String(row.code).trim(),
          name: String(row.name).trim(),
          location: loc,
          store_type: storeType,
          total_skus: !isNaN(totalSkus) ? totalSkus : 0,
          status: 'ACTIVE',
          created_at: new Date().toISOString(),
        });
      } else if (entityType === 'products') {
        if (!row.sku || !row.name) {
          rowErrors.push(`Row ${rowNum}: Missing SKU or product name.`);
          continue;
        }
        validRows.push({
          id: rowId,
          ...(auth.user.companyId && isValidUuid(auth.user.companyId) ? { company_id: auth.user.companyId } : {}),
          sku: String(row.sku).trim(),
          name: String(row.name).trim(),
          category: String(row.category || 'General').trim(),
          unit_price: Number(row.unit_price) || 0.0,
          avg_daily_demand: Number(row.avg_daily_demand) || 1.0,
          min_stock_threshold: Number(row.min_stock_threshold) || 5,
          created_at: new Date().toISOString(),
        });
      }
    }

    // Atomic processing: reject the batch if format errors were encountered
    if (rowErrors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Import batch validation failed with ${rowErrors.length} format error(s). Batch was aborted to preserve atomic consistency.`,
          rowErrors,
          totalRows: records.length,
          inserted: 0,
        },
        { status: 400 }
      );
    }

    if (validRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid records found in the import file.',
          rowErrors,
          inserted: 0,
        },
        { status: 400 }
      );
    }

    if (entityType === 'combined_sales_inventory') {
      const salesResult = await importCsvRecords(
        'daily_sales',
        validRows,
        auth.user.id,
        'combined_sales.csv',
        auth.user.accessState === 'PLATFORM_ADMIN' ? ['*'] : auth.user.accessibleStoreIds,
        auth.user.companyId,
        auth.user.authMode
      );

      const inventoryResult = await importCsvRecords(
        'inventory_snapshots',
        validInventoryRows,
        auth.user.id,
        'combined_inventory.csv',
        auth.user.accessState === 'PLATFORM_ADMIN' ? ['*'] : auth.user.accessibleStoreIds,
        auth.user.companyId,
        auth.user.authMode
      );

      const combinedErrors = [...salesResult.errors, ...inventoryResult.errors];
      if (combinedErrors.length > 0 && salesResult.inserted === 0 && inventoryResult.inserted === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `Combined import failed: ${combinedErrors.join(', ')}`,
            storageErrors: combinedErrors,
            totalRows: records.length,
            inserted: 0,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        entityType: 'combined_sales_inventory',
        totalRows: records.length,
        inserted: salesResult.inserted,
        inventorySnapshotsInserted: inventoryResult.inserted,
        skipped: 0,
        rowErrors: [],
        storageErrors: combinedErrors,
        message: `Successfully ingested ${salesResult.inserted} sales transactions and ${inventoryResult.inserted} inventory snapshot balances into persistent storage! Ready for Phantom Stockout detection.`,
      });
    }

    const { inserted, errors } = await importCsvRecords(
      entityType as ValidEntity,
      validRows,
      auth.user.id,
      'import.csv',
      auth.user.accessState === 'PLATFORM_ADMIN' ? ['*'] : auth.user.accessibleStoreIds,
      auth.user.companyId,
      auth.user.authMode
    );

    if (errors.length > 0 && inserted === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Database import failed: ${errors.join(', ')}`,
          storageErrors: errors,
          totalRows: records.length,
          skipped: rowErrors.length,
          rowErrors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      totalRows: records.length,
      inserted,
      skipped: rowErrors.length,
      rowErrors,
      storageErrors: errors,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'CSV Import failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
