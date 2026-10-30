import fs from 'fs';
import Papa from 'papaparse';
import { importCsvRecords, getMemoryStore } from '../src/lib/storage';
import { CANONICAL_SCHEMAS, suggestColumnMapping, DatasetType } from '../src/lib/universalImport';

async function ingestZipDataset() {
  console.log('--- INGESTING EVALUATOR ZIP DATA INTO WEB STORAGE ---');

  const files: { path: string; entity: any; name: string }[] = [
    { path: 'data/R1_Phantom_StockOut_Detector/data/store_master.csv', entity: 'stores', name: 'Store Master' },
    { path: 'data/R1_Phantom_StockOut_Detector/data/sku_master.csv', entity: 'products', name: 'Product Catalog' },
    { path: 'data/R1_Phantom_StockOut_Detector/data/daily_sales_inventory_sample_2stores.csv', entity: 'daily_sales', name: 'Daily Sales' },
    { path: 'data/R1_Phantom_StockOut_Detector/data/daily_sales_inventory_sample_2stores.csv', entity: 'inventory_snapshots', name: 'Inventory Snapshots' },
    { path: 'data/R1_Phantom_StockOut_Detector/data/promotion_calendar.csv', entity: 'promotions', name: 'Promotions' },
    { path: 'data/R1_Phantom_StockOut_Detector/data/dev_labels.csv', entity: 'dev_labels', name: 'Ground Truth Labels' },
    { path: 'data/R1_Phantom_StockOut_Detector/data/dev_truth.csv', entity: 'dev_truth', name: 'Ground Truth Incidents' },
    { path: 'data/R1_Phantom_StockOut_Detector/data/holiday_calendar.csv', entity: 'holidays', name: 'Holidays' },
    { path: 'data/R1_Phantom_StockOut_Detector/sample_submission.csv', entity: 'predictions', name: 'Predictions / Submission' },
  ];

  for (const f of files) {
    if (!fs.existsSync(f.path)) {
      console.warn(`File not found: ${f.path}`);
      continue;
    }
    const content = fs.readFileSync(f.path, 'utf8');
    const parsed = Papa.parse<Record<string, unknown>>(content, { header: true, preview: 100 });
    const rows = parsed.data.filter(r => Object.keys(r).length > 1);
    const headers = parsed.meta.fields || [];

    // Map according to canonical schema
    const schemaKey = f.entity === 'daily_sales' || f.entity === 'inventory_snapshots'
      ? (f.entity as DatasetType)
      : (f.entity as DatasetType);
    const schema = CANONICAL_SCHEMAS[schemaKey] || CANONICAL_SCHEMAS.combined_sales_inventory;

    const mappings: Record<string, string> = {};
    for (const field of schema.fields) {
      for (const h of headers) {
        const sug = suggestColumnMapping(h, schemaKey);
        if (sug.canonicalKey === field.key) {
          mappings[field.key] = h;
          break;
        }
      }
    }

    const normalizedRecords = rows.map(r => {
      const rec: Record<string, unknown> = {};
      for (const [canonKey, header] of Object.entries(mappings)) {
        if (header && r[header] !== undefined) {
          rec[canonKey] = r[header];
        }
      }
      return rec;
    });

    const result = await importCsvRecords(
      f.entity,
      normalizedRecords,
      'user_evaluator_001',
      f.path.split('/').pop(),
      ['*'],
      undefined,
      'standalone'
    );

    console.log(`[INGESTED] ${f.name} (${f.path.split('/').pop()}): ${result.inserted} records stored. Errors: ${result.errors.length}`);
  }

  const store = getMemoryStore();
  console.log('\n--- VERIFYING WEB STORAGE STATE ---');
  console.log(`Stores in database: ${store.stores.length}`);
  console.log(`Products in database: ${store.products.length}`);
  console.log(`Sales in database: ${store.sales.length}`);
  console.log(`Inventory records: ${store.inventory.length}`);
  console.log(`Alerts generated: ${store.alerts.length}`);
  console.log(`Ground truth episode labels: ${(store.devLabels || []).length}`);
  console.log(`Ground truth daily incidents: ${(store.devTruth || []).length}`);
  console.log(`Holidays: ${(store.holidays || []).length}`);
  console.log(`Predictions: ${(store.predictions || []).length}`);
}

ingestZipDataset().catch(console.error);
