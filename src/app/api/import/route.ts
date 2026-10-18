import { NextResponse } from 'next/server';
import { importCsvRecords } from '@/lib/storage';

type ValidEntity = 'stores' | 'products' | 'daily_sales' | 'inventory_snapshots' | 'promotions';

export async function POST(request: Request) {
  try {
    const body = await request.json();
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
    ];

    if (!validEntities.includes(entityType)) {
      return NextResponse.json(
        { success: false, error: `Invalid entityType. Must be one of: ${validEntities.join(', ')}` },
        { status: 400 }
      );
    }

    const rowErrors: string[] = [];
    const validRows: Record<string, unknown>[] = [];

    records.forEach((rowRecord: unknown, index: number) => {
      const rowNum = index + 1;
      const row = (rowRecord && typeof rowRecord === 'object' ? rowRecord : {}) as Record<string, unknown>;

      if (entityType === 'stores') {
        if (!row.code || !row.name) {
          rowErrors.push(`Row ${rowNum}: Missing store code or name.`);
          return;
        }
        validRows.push({
          id: row.id || `store-${String(row.code).toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          code: String(row.code).trim(),
          name: String(row.name).trim(),
          location: String(row.location || 'Retail Location').trim(),
          store_type: String(row.store_type || 'Supercenter').trim(),
          total_skus: Number(row.total_skus) || 0,
          created_at: new Date().toISOString(),
        });
      } else if (entityType === 'products') {
        if (!row.sku || !row.name) {
          rowErrors.push(`Row ${rowNum}: Missing SKU or product name.`);
          return;
        }
        validRows.push({
          id: row.id || `prod-${String(row.sku).toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          sku: String(row.sku).trim(),
          name: String(row.name).trim(),
          category: String(row.category || 'General').trim(),
          unit_price: Number(row.unit_price) || 0.0,
          avg_daily_demand: Number(row.avg_daily_demand) || 1.0,
          min_stock_threshold: Number(row.min_stock_threshold) || 5,
          created_at: new Date().toISOString(),
        });
      } else if (entityType === 'daily_sales') {
        if (!row.store_id || !row.sku || !row.date) {
          rowErrors.push(`Row ${rowNum}: Missing store_id, sku, or date.`);
          return;
        }
        const unitsSold = parseInt(String(row.units_sold), 10);
        if (isNaN(unitsSold) || unitsSold < 0) {
          rowErrors.push(`Row ${rowNum}: Invalid units_sold '${String(row.units_sold)}'. Must be non-negative integer.`);
          return;
        }
        validRows.push({
          id: row.id || `sale-${String(row.store_id)}-${String(row.sku)}-${String(row.date)}`,
          store_id: String(row.store_id).trim(),
          product_id: String(row.product_id || row.sku).trim(),
          sku: String(row.sku).trim(),
          date: String(row.date).trim(),
          units_sold: unitsSold,
          revenue: Number(row.revenue) || 0.0,
          day_of_week: new Date(String(row.date)).getDay(),
        });
      } else if (entityType === 'inventory_snapshots') {
        if (!row.store_id || !row.sku || !row.date) {
          rowErrors.push(`Row ${rowNum}: Missing store_id, sku, or date.`);
          return;
        }
        const onHand = parseInt(String(row.on_hand_stock), 10);
        if (isNaN(onHand) || onHand < 0) {
          rowErrors.push(`Row ${rowNum}: Invalid on_hand_stock '${String(row.on_hand_stock)}'. Must be non-negative integer.`);
          return;
        }
        validRows.push({
          id: row.id || `inv-${String(row.store_id)}-${String(row.sku)}-${String(row.date)}`,
          store_id: String(row.store_id).trim(),
          product_id: String(row.product_id || row.sku).trim(),
          sku: String(row.sku).trim(),
          date: String(row.date).trim(),
          on_hand_stock: onHand,
        });
      } else if (entityType === 'promotions') {
        if (!row.store_id || !row.sku || !row.start_date || !row.end_date) {
          rowErrors.push(`Row ${rowNum}: Missing store_id, sku, start_date, or end_date.`);
          return;
        }
        validRows.push({
          id: row.id || `promo-${String(row.store_id)}-${String(row.sku)}-${String(row.start_date)}`,
          store_id: String(row.store_id).trim(),
          product_id: String(row.product_id || row.sku).trim(),
          sku: String(row.sku).trim(),
          start_date: String(row.start_date).trim(),
          end_date: String(row.end_date).trim(),
          discount_pct: Number(row.discount_pct) || 0.0,
          promo_type: row.promo_type || 'DISCOUNT',
        });
      }
    });

    if (validRows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid records found in the import file.',
          rowErrors,
        },
        { status: 400 }
      );
    }

    const { inserted, errors } = await importCsvRecords(entityType as ValidEntity, validRows);

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
