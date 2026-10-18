'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Papa from 'papaparse';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  Database,
  ArrowRight,
  RefreshCw,
  FileCheck,
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
      { store_id: 'store-001', sku: 'SKU-101', date: '2026-10-15', units_sold: 5, revenue: 24.95 },
      { store_id: 'store-001', sku: 'SKU-104', date: '2026-10-15', units_sold: 0, revenue: 0.00 },
      { store_id: 'store-002', sku: 'SKU-104', date: '2026-10-15', units_sold: 6, revenue: 17.94 },
    ],
    description: 'Daily transaction sales records per SKU and store.',
  },
  inventory_snapshots: {
    name: 'Inventory Snapshots',
    filename: 'template_inventory_snapshots.csv',
    headers: ['store_id', 'sku', 'date', 'on_hand_stock'],
    sampleData: [
      { store_id: 'store-001', sku: 'SKU-101', date: '2026-10-15', on_hand_stock: 18 },
      { store_id: 'store-001', sku: 'SKU-104', date: '2026-10-15', on_hand_stock: 26 },
      { store_id: 'store-002', sku: 'SKU-104', date: '2026-10-15', on_hand_stock: 14 },
    ],
    description: 'Recorded system on-hand inventory levels per SKU and store.',
  },
  promotions: {
    name: 'Promotions',
    filename: 'template_promotions.csv',
    headers: ['store_id', 'sku', 'start_date', 'end_date', 'discount_pct', 'promo_type'],
    sampleData: [
      { store_id: 'store-001', sku: 'SKU-104', start_date: '2026-10-10', end_date: '2026-10-20', discount_pct: 20, promo_type: 'FEATURE' },
      { store_id: 'store-002', sku: 'SKU-101', start_date: '2026-10-12', end_date: '2026-10-22', discount_pct: 15, promo_type: 'ENDCAP' },
    ],
    description: 'Active store circular, feature, and promotional discounts.',
  },
};

export default function ImportPage() {
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
    if (parsedData.length === 0) return;
    setIsUploading(true);

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
        setImportResult({ inserted: data.inserted, errors: data.rowErrors || [] });
      } else {
        setImportResult({ inserted: 0, errors: [data.error || 'Import failed'] });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      setImportResult({ inserted: 0, errors: [msg] });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#0a0e17] text-slate-100 flex flex-col">
        <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            <span>Retail Data Ingestion & CSV Import</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Import sales, inventory, products, and promotion datasets with full client-side validation and database persistence.
          </p>
        </div>

        {/* Entity Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
          {(Object.keys(TEMPLATES) as EntityType[]).map((key) => {
            const def = TEMPLATES[key];
            const isSelected = selectedEntity === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setSelectedEntity(key);
                  setParsedData([]);
                  setValidationErrors([]);
                  setFileDetails(null);
                  setImportResult(null);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm'
                    : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:text-white hover:bg-slate-800'
                }`}
              >
                {def.name}
              </button>
            );
          })}
        </div>

        {/* Template & Upload Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Template Info Card */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>Entity: {currentTemplate.name}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">{currentTemplate.description}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-300 mb-2">Required Columns:</p>
              <div className="flex flex-wrap gap-1.5">
                {currentTemplate.headers.map((h) => (
                  <span
                    key={h}
                    className="font-mono text-[11px] bg-slate-950 px-2 py-0.5 rounded text-emerald-400 border border-white/5"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={downloadTemplate}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Download CSV Template</span>
            </button>
          </div>

          {/* Upload Dropzone */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 md:col-span-2 flex flex-col justify-center">
            <label className="border-2 border-dashed border-white/15 hover:border-emerald-500/50 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-900/30">
              <Upload className="w-8 h-8 text-emerald-400 mb-2" />
              <p className="text-sm font-semibold text-white">Click or drag & drop CSV file here</p>
              <p className="text-xs text-slate-400 mt-1">Must match {currentTemplate.name} schema headers</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {fileDetails && (
              <div className="mt-3 flex items-center justify-between text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-white/5">
                <span className="font-mono">{fileDetails.name}</span>
                <span className="text-slate-400">{(fileDetails.size / 1024).toFixed(1)} KB</span>
              </div>
            )}
          </div>
        </div>

        {/* Validation Errors Box */}
        {validationErrors.length > 0 && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-1">
            <div className="flex items-center space-x-2 font-bold text-rose-400">
              <AlertTriangle className="w-4 h-4" />
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
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center space-x-2 font-bold text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>
                {importResult.inserted > 0
                  ? `Successfully ingested ${importResult.inserted} records into persistent storage!`
                  : 'Import failed to commit.'}
              </span>
            </div>
            {importResult.errors.length > 0 && (
              <ul className="list-disc list-inside space-y-0.5 text-[11px] pt-1 text-slate-400">
                {importResult.errors.map((e, idx) => (
                  <li key={idx}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Data Preview Table */}
        {parsedData.length > 0 && (
          <div className="glass-panel rounded-2xl overflow-hidden border border-white/10 space-y-3 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <FileCheck className="w-4 h-4 text-emerald-400" />
                  <span>Preview Parsed Records ({parsedData.length} total)</span>
                </h3>
                <p className="text-xs text-slate-400">Showing first 10 rows for verification before commit</p>
              </div>

              <button
                onClick={handleCommitImport}
                disabled={isUploading}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 disabled:opacity-50 transition-all cursor-pointer"
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

            <div className="overflow-x-auto border border-white/5 rounded-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    {currentTemplate.headers.map((h) => (
                      <th key={h} className="py-2.5 px-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {parsedData.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/40">
                      <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
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
      </main>
    </div>
  </ProtectedRoute>
  );
}
