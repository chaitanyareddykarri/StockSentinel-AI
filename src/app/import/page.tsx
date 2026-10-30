'use client';

import React, { useState } from 'react';
import Papa from 'papaparse';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import {
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  Database,
  ArrowRight,
} from 'lucide-react';

type EntityType = 'stores' | 'products' | 'daily_sales' | 'inventory_snapshots' | 'promotions';

interface TemplateDef {
  name: string;
  filename: string;
  headers: string[];
  sampleData: Record<string, unknown>[];
  description: string;
}

const TEMPLATES: Record<EntityType, TemplateDef> = {
  stores: {
    name: 'Stores',
    filename: 'template_stores.csv',
    headers: ['code', 'name', 'location', 'store_type', 'total_skus'],
    sampleData: [
      { code: 'SEA-101', name: 'Downtown Supercenter #101', location: 'Seattle, WA', store_type: 'Supercenter', total_skus: 30 },
      { code: 'BEL-204', name: 'Metro Express Market #204', location: 'Bellevue, WA', store_type: 'Express Market', total_skus: 30 },
      { code: 'TAC-308', name: 'Suburban Mall Superstore #308', location: 'Tacoma, WA', store_type: 'Superstore', total_skus: 30 },
    ],
    description: 'Store locations and retail store metadata.',
  },
  products: {
    name: 'Products & SKUs',
    filename: 'template_products.csv',
    headers: ['sku', 'name', 'category', 'unit_price', 'avg_daily_demand', 'min_stock_threshold'],
    sampleData: [
      { sku: 'SKU-101', name: 'Organic Whole Milk 1 Gal', category: 'Dairy', unit_price: 4.99, avg_daily_demand: 4.8, min_stock_threshold: 8 },
      { sku: 'SKU-104', name: 'Electrolyte Citrus Rush 16oz', category: 'Beverages', unit_price: 2.99, avg_daily_demand: 5.5, min_stock_threshold: 12 },
      { sku: 'SKU-114', name: 'Matcha Green Tea Powder 50g', category: 'Beverages', unit_price: 14.99, avg_daily_demand: 0.35, min_stock_threshold: 2 },
    ],
    description: 'Catalog master data including baseline expected sales velocity.',
  },
  daily_sales: {
    name: 'Daily Sales',
    filename: 'template_daily_sales.csv',
    headers: ['store_id', 'sku', 'date', 'units_sold', 'revenue'],
    sampleData: [
      { store_id: 'SEA-101', sku: 'SKU-101', date: '2026-10-15', units_sold: 5, revenue: 24.95 },
      { store_id: 'SEA-101', sku: 'SKU-104', date: '2026-10-15', units_sold: 0, revenue: 0.00 },
      { store_id: 'BEL-204', sku: 'SKU-104', date: '2026-10-15', units_sold: 6, revenue: 17.94 },
    ],
    description: 'Daily transaction sales records per SKU and store.',
  },
  inventory_snapshots: {
    name: 'Inventory Snapshots',
    filename: 'template_inventory_snapshots.csv',
    headers: ['store_id', 'sku', 'date', 'on_hand_stock'],
    sampleData: [
      { store_id: 'SEA-101', sku: 'SKU-101', date: '2026-10-15', on_hand_stock: 18 },
      { store_id: 'SEA-101', sku: 'SKU-104', date: '2026-10-15', on_hand_stock: 26 },
      { store_id: 'BEL-204', sku: 'SKU-104', date: '2026-10-15', on_hand_stock: 14 },
    ],
    description: 'Recorded system on-hand inventory levels per SKU and store.',
  },
  promotions: {
    name: 'Promotions',
    filename: 'template_promotions.csv',
    headers: ['store_id', 'sku', 'start_date', 'end_date', 'discount_pct', 'promo_type'],
    sampleData: [
      { store_id: 'SEA-101', sku: 'SKU-104', start_date: '2026-10-10', end_date: '2026-10-20', discount_pct: 20, promo_type: 'FEATURE' },
      { store_id: 'BEL-204', sku: 'SKU-101', start_date: '2026-10-12', end_date: '2026-10-22', discount_pct: 15, promo_type: 'ENDCAP' },
    ],
    description: 'Active store circular, feature, and promotional discounts.',
  },
};

export default function ImportPage() {
  const { user } = useAuth();
  const isStoreManager = user?.accessState === 'STORE_MANAGER';
  const [selectedEntity, setSelectedEntity] = useState<EntityType>('daily_sales');
  const [parsedData, setParsedData] = useState<Record<string, unknown>[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fileDetails, setFileDetails] = useState<{ name: string; size: number } | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<{ inserted: number; errors: string[] } | null>(null);

  const currentTemplate = TEMPLATES[selectedEntity];

  // CSV Template Downloader
  const downloadTemplate = () => {
    const csvContent = Papa.unparse(currentTemplate.sampleData, {
      columns: currentTemplate.headers,
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', currentTemplate.filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV File Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileDetails({ name: file.name, size: file.size });
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, unknown>[];
        validateRows(rows);
      },
      error: (err) => {
        setValidationErrors([`File parse error: ${err.message}`]);
      },
    });
  };

  const validateRows = (rows: Record<string, unknown>[]) => {
    const errors: string[] = [];
    const headers = Object.keys(rows[0] || {});

    // Check required headers
    currentTemplate.headers.forEach((h) => {
      if (!headers.includes(h)) {
        errors.push(`Missing mandatory column header: "${h}"`);
      }
    });

    // Row-by-row validation
    rows.forEach((row, idx) => {
      const rowNum = idx + 1;
      if (selectedEntity === 'stores') {
        if (!row.code) errors.push(`Row ${rowNum}: store code cannot be empty.`);
      } else if (selectedEntity === 'products') {
        if (!row.sku) errors.push(`Row ${rowNum}: SKU cannot be empty.`);
      } else if (selectedEntity === 'daily_sales') {
        if (!row.store_id || !row.sku || !row.date) {
          errors.push(`Row ${rowNum}: store_id, sku, and date are required.`);
        }
        const unitsSold = parseInt(String(row.units_sold), 10);
        if (isNaN(unitsSold) || unitsSold < 0) {
          errors.push(`Row ${rowNum}: units_sold must be a non-negative integer.`);
        }
      } else if (selectedEntity === 'inventory_snapshots') {
        if (!row.store_id || !row.sku || !row.date) {
          errors.push(`Row ${rowNum}: store_id, sku, and date are required.`);
        }
        const onHand = parseInt(String(row.on_hand_stock), 10);
        if (isNaN(onHand) || onHand < 0) {
          errors.push(`Row ${rowNum}: on_hand_stock must be a non-negative integer.`);
        }
      }
    });

    setValidationErrors(errors);
    setParsedData(rows);
  };

  const handleCommitImport = async () => {
    if (parsedData.length === 0 || validationErrors.length > 0) return;

    setIsUploading(true);
    setImportResult(null);

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: selectedEntity,
          records: parsedData,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setImportResult({ inserted: data.inserted, errors: [] });
        setParsedData([]);
        setFileDetails(null);
      } else {
        setImportResult({ inserted: 0, errors: data.errors || [data.error || 'Import failed.'] });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error during upload.';
      setImportResult({ inserted: 0, errors: [msg] });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <AppShell
      title="Retail Data Ingestion & CSV Import"
      subtitle="Import store sales, inventory, products, and promotion datasets with full schema validation and database persistence."
    >
      {/* Entity Selection Tabs */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500">Select Dataset Type</h2>
          <div className="flex flex-wrap gap-2 pt-2">
            {(Object.keys(TEMPLATES) as EntityType[]).map((key) => {
              const def = TEMPLATES[key];
              const isSelected = selectedEntity === key;
              const isRestrictedForRole = isStoreManager && (key === 'stores' || key === 'products');
              return (
                <button
                  key={key}
                  disabled={isRestrictedForRole}
                  onClick={() => {
                    setSelectedEntity(key);
                    setParsedData([]);
                    setValidationErrors([]);
                    setFileDetails(null);
                    setImportResult(null);
                  }}
                  title={isRestrictedForRole ? 'Managed exclusively by Company Managers' : undefined}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isRestrictedForRole
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                      : isSelected
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {def.name}
                  {isRestrictedForRole && <span className="ml-1 text-[10px] text-slate-400 font-normal">(Company Mgr)</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Template & Upload Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* Template Info Card */}
          <div className="bg-white/95 rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 flex flex-col justify-between">
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <Database className="w-4 h-4 text-emerald-700" />
                  <span>Schema: {currentTemplate.name}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">{currentTemplate.description}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1.5">Required Headers:</p>
                <div className="flex flex-wrap gap-1.5">
                  {currentTemplate.headers.map((h) => (
                    <span
                      key={h}
                      className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-emerald-800 border border-slate-200 font-semibold"
                    >
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={downloadTemplate}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>Download CSV Template</span>
            </button>
          </div>

          {/* Upload Dropzone */}
          <div className="bg-white/95 rounded-2xl border border-slate-200/80 p-5 shadow-xs md:col-span-2 flex flex-col justify-center">
            <label className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-emerald-50/20">
              <Upload className="w-8 h-8 text-emerald-700 mb-2" />
              <p className="text-sm font-semibold text-slate-900">Click or drag & drop CSV file here</p>
              <p className="text-xs text-slate-500 mt-1">Must conform to the {currentTemplate.name} schema headers</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {fileDetails && (
              <div className="mt-3 flex items-center justify-between text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="font-mono font-medium">{fileDetails.name}</span>
                <span className="text-slate-500">{(fileDetails.size / 1024).toFixed(1)} KB</span>
              </div>
            )}
          </div>
        </div>

        {/* Validation Errors Box */}
        {validationErrors.length > 0 && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
            <div className="flex items-center space-x-2 font-bold text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-700" />
              <span>Validation Issues Detected ({validationErrors.length})</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] pt-1">
              {validationErrors.slice(0, 5).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
              {validationErrors.length > 5 && (
                <li className="font-semibold">+ {validationErrors.length - 5} more errors</li>
              )}
            </ul>
          </div>
        )}

        {/* Import Results Box */}
        {importResult && (
          <div
            className={`p-4 rounded-xl border text-xs ${
              importResult.inserted > 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-center space-x-2 font-bold text-sm">
              <CheckCircle className="w-4 h-4 text-emerald-700" />
              <span>
                {importResult.inserted > 0
                  ? `Successfully ingested ${importResult.inserted} records into persistent storage!`
                  : 'Import failed to commit.'}
              </span>
            </div>
            {importResult.errors.length > 0 && (
              <ul className="list-disc list-inside space-y-0.5 text-[11px] pt-1 text-slate-600">
                {importResult.errors.map((e, idx) => (
                  <li key={idx}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Data Preview Table */}
        {parsedData.length > 0 && (
          <div className="bg-white/95 rounded-2xl overflow-hidden border border-slate-200/80 space-y-3 p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                  <FileCheck className="w-4 h-4 text-emerald-700" />
                  <span>Preview Parsed Records ({parsedData.length} total)</span>
                </h3>
                <p className="text-xs text-slate-500">Showing first 10 rows for validation before database commit</p>
              </div>

              <button
                onClick={handleCommitImport}
                disabled={isUploading || validationErrors.length > 0}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#064e3b] hover:bg-[#047857] text-white shadow-xs disabled:opacity-50 transition-all cursor-pointer"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Committing to Database...</span>
                  </>
                ) : (
                  <>
                    <span>Commit {parsedData.length} Rows</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    {currentTemplate.headers.map((h) => (
                      <th key={h} className="py-2.5 px-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {parsedData.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                      {currentTemplate.headers.map((h) => (
                        <td key={h} className="py-2 px-3 whitespace-nowrap">
                          {row[h] !== undefined ? String(row[h]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}