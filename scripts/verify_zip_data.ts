import fs from 'fs';
import Papa from 'papaparse';
import { detectDatasetType, suggestColumnMapping, CANONICAL_SCHEMAS, DatasetType } from '../src/lib/universalImport';

const files: { path: string; expected: DatasetType }[] = [
  { path: 'data/R1_Phantom_StockOut_Detector/data/daily_sales_inventory_sample_2stores.csv', expected: 'combined_sales_inventory' },
  { path: 'data/R1_Phantom_StockOut_Detector/data/dev_labels.csv', expected: 'dev_labels' },
  { path: 'data/R1_Phantom_StockOut_Detector/data/dev_truth.csv', expected: 'dev_truth' },
  { path: 'data/R1_Phantom_StockOut_Detector/data/holiday_calendar.csv', expected: 'holidays' },
  { path: 'data/R1_Phantom_StockOut_Detector/data/promotion_calendar.csv', expected: 'promotions' },
  { path: 'data/R1_Phantom_StockOut_Detector/data/sku_master.csv', expected: 'products' },
  { path: 'data/R1_Phantom_StockOut_Detector/data/store_master.csv', expected: 'stores' },
  { path: 'data/R1_Phantom_StockOut_Detector/sample_submission.csv', expected: 'predictions' },
];

console.log('--- AUDITING ALL 8 CSV FILES EXTRACTED FROM EVALUATOR ZIP ---');
let allPassed = true;

for (const f of files) {
  const content = fs.readFileSync(f.path, 'utf8');
  const parsed = Papa.parse(content, { header: true, preview: 10 });
  const headers = parsed.meta.fields || [];
  const detection = detectDatasetType(headers);
  const schema = CANONICAL_SCHEMAS[detection.detectedType];

  const mapped: Record<string, string> = {};
  for (const field of schema.fields) {
    for (const h of headers) {
      const sug = suggestColumnMapping(h, detection.detectedType);
      if (sug.canonicalKey === field.key) {
        mapped[field.key] = h;
        break;
      }
    }
  }

  const missingReq = schema.fields.filter(field => field.required && !mapped[field.key]);
  const isMatch = detection.detectedType === f.expected;
  const isZeroErrors = missingReq.length === 0;
  const passed = isMatch && isZeroErrors;
  if (!passed) allPassed = false;

  const fileName = f.path.split('/').pop();
  console.log(`\nFile: ${fileName}`);
  console.log(`  Status: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Detected Type: ${detection.detectedType} (expected: ${f.expected}, confidence: ${detection.confidence})`);
  console.log(`  Headers Found (${headers.length}): ${headers.join(', ')}`);
  console.log(`  Validation: ${missingReq.length === 0 ? '0 issues (Ready to Commit)' : 'Missing: ' + missingReq.map(m => m.key).join(', ')}`);
}

console.log('\n=======================================');
console.log(`FINAL RESULT: ${allPassed ? 'ALL 8 FILES PASSED (100% SUCCESS)' : 'SOME FILES FAILED'}`);
console.log('=======================================');

