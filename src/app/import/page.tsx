'use client';

import React, { useState, useId } from 'react';
import Papa from 'papaparse';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import {
  DatasetType,
  CANONICAL_SCHEMAS,
  suggestColumnMapping,
  detectDatasetType,
  sanitizeCsvCell,
} from '@/lib/universalImport';
import {
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  Database,
  ArrowRight,
  Sparkles,
  Layers,
  Settings2,
  FileSpreadsheet,
  HelpCircle,
  PlayCircle,
} from 'lucide-react';

interface FileInspectMeta {
  name: string;
  size: number;
  delimiter: string;
  rowCount: number;
  headers: string[];
}

export default function UniversalImportPage() {
  const fileInputId = useId();
  const { user } = useAuth();
  const isStoreManager = user?.accessState === 'STORE_MANAGER';

  // 1. Current Step State: 1: Upload, 2: Map & Preview, 3: Completed
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Selected or Auto-Detected Dataset Type
  const [selectedDataset, setSelectedDataset] = useState<DatasetType>('combined_sales_inventory');
  const [detectionNotice, setDetectionNotice] = useState<string | null>(null);

  // Raw Parsed Data & Inspector Metadata
  const [fileMeta, setFileMeta] = useState<FileInspectMeta | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number>(0);

  // Column Mappings: CanonicalKey -> CSV Header
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({});
  const [mappingConfidence, setMappingConfidence] = useState<Record<string, 'HIGH' | 'MEDIUM' | 'NONE'>>({});

  // Validation
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    message?: string;
    errors: string[];
  } | null>(null);

  const activeSchema = CANONICAL_SCHEMAS[selectedDataset];

  // CSV Template Downloader with canonical schema sample
  const downloadTemplate = (dataset: DatasetType) => {
    const schema = CANONICAL_SCHEMAS[dataset];
    const sampleHeaders = schema.fields.map((f) => f.key);
    const sampleRow: Record<string, string | number> = {};
    schema.fields.forEach((f) => {
      if (f.type === 'number') sampleRow[f.key] = 10;
      else if (f.type === 'date') sampleRow[f.key] = '2026-10-30';
      else if (f.type === 'boolean') sampleRow[f.key] = 0;
      else if (f.key === 'store_id') sampleRow[f.key] = 'STR-BFPW';
      else if (f.key === 'sku') sampleRow[f.key] = 'SKU-047AZA';
      else sampleRow[f.key] = 'Sample Value';
    });

    const csvContent = Papa.unparse([sampleRow], { columns: sampleHeaders });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `template_${dataset}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Step 1 -> Step 2: Parse and process single file
  const parseAndProcessFile = (file: File) => {
    // Safety: File size limit 50MB
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setValidationErrors([`File size exceeds safe web limit of 50MB (${(file.size / (1024 * 1024)).toFixed(1)}MB).`]);
      return;
    }

    setImportResult(null);
    setValidationErrors([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      preview: 5000, // Read up to first 5,000 rows in browser memory safely
      complete: (results) => {
        const rows = results.data as Record<string, unknown>[];
        if (!rows || rows.length === 0) {
          setValidationErrors(['The uploaded CSV file is empty or does not contain data rows.']);
          return;
        }

        const headers = results.meta.fields || Object.keys(rows[0] || {});
        const delimiter = results.meta.delimiter || ',';

        // 1. Auto-detect dataset type from headers
        const { detectedType, reason } = detectDatasetType(headers);
        setSelectedDataset(detectedType);
        setDetectionNotice(reason);

        // 2. Auto-suggest column mappings
        const initialMappings: Record<string, string> = {};
        const confidences: Record<string, 'HIGH' | 'MEDIUM' | 'NONE'> = {};
        const targetSchema = CANONICAL_SCHEMAS[detectedType];

        targetSchema.fields.forEach((field) => {
          let bestHeader = '';
          let highestConf: 'HIGH' | 'MEDIUM' | 'NONE' = 'NONE';

          for (const h of headers) {
            const suggestion = suggestColumnMapping(h, detectedType);
            if (suggestion.canonicalKey === field.key) {
              if (suggestion.confidence === 'HIGH') {
                bestHeader = h;
                highestConf = 'HIGH';
                break;
              } else if (suggestion.confidence === 'MEDIUM' && highestConf === 'NONE') {
                bestHeader = h;
                highestConf = 'MEDIUM';
              }
            }
          }

          if (bestHeader) {
            initialMappings[field.key] = bestHeader;
            confidences[field.key] = highestConf;
          } else {
            initialMappings[field.key] = '';
            confidences[field.key] = 'NONE';
          }
        });

        setColumnMappings(initialMappings);
        setMappingConfidence(confidences);
        setRawRows(rows);
        setFileMeta({
          name: file.name,
          size: file.size,
          delimiter,
          rowCount: rows.length,
          headers,
        });

        // Run validation against initial mappings
        runValidation(rows, detectedType, initialMappings);
        setCurrentStep(2);
      },
      error: (err) => {
        setValidationErrors([`CSV parsing error: ${err.message}`]);
      },
    });
  };

  // Step 1 -> Step 2: Handle File Selection (Supports Multiple CSVs)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadedFiles(files);
    setActiveFileIndex(0);
    parseAndProcessFile(files[0]);
  };

  // Step 2: Validate Rows with Current Mapping
  const runValidation = (
    rows: Record<string, unknown>[],
    datasetType: DatasetType,
    mappings: Record<string, string>
  ) => {
    const errors: string[] = [];
    const schema = CANONICAL_SCHEMAS[datasetType];

    // Check mandatory fields have assigned columns
    schema.fields.forEach((f) => {
      if (f.required && (!mappings[f.key] || mappings[f.key] === '')) {
        errors.push(`Required field "${f.label}" (${f.key}) is not mapped to any CSV column.`);
      }
    });

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Row-level sanity checks on the first 50 sample rows
    const sample = rows.slice(0, 50);
    sample.forEach((row, idx) => {
      const rowNum = idx + 1;
      schema.fields.forEach((f) => {
        const mappedCol = mappings[f.key];
        if (!mappedCol) return;
        const val = row[mappedCol];

        if (f.required && (val === undefined || val === null || String(val).trim() === '')) {
          if (errors.length < 10) {
            errors.push(`Row ${rowNum}: Required field "${f.label}" is missing/empty.`);
          }
        }

        if (f.type === 'number' && val !== undefined && val !== null && String(val).trim() !== '') {
          if (isNaN(Number(val))) {
            if (errors.length < 10) {
              errors.push(`Row ${rowNum}: Value "${val}" in column "${mappedCol}" is not a valid number.`);
            }
          }
        }

        if (f.type === 'date' && val !== undefined && val !== null && String(val).trim() !== '') {
          const parsed = Date.parse(String(val));
          if (isNaN(parsed)) {
            if (errors.length < 10) {
              errors.push(`Row ${rowNum}: Value "${val}" in column "${mappedCol}" is not a recognizable date.`);
            }
          }
        }
      });
    });

    setValidationErrors(errors);
  };

  // Change mapping manually
  const handleMappingChange = (canonicalKey: string, csvHeader: string) => {
    const updated = { ...columnMappings, [canonicalKey]: csvHeader };
    setColumnMappings(updated);
    setMappingConfidence({ ...mappingConfidence, [canonicalKey]: csvHeader ? 'HIGH' : 'NONE' });
    runValidation(rawRows, selectedDataset, updated);
  };

  // Switch Dataset Type Manually
  const handleDatasetTypeChange = (newType: DatasetType) => {
    setSelectedDataset(newType);
    if (!fileMeta) return;

    // Recompute suggestions for new type
    const newMappings: Record<string, string> = {};
    const newConfidences: Record<string, 'HIGH' | 'MEDIUM' | 'NONE'> = {};
    const schema = CANONICAL_SCHEMAS[newType];

    schema.fields.forEach((field) => {
      let bestHeader = '';
      let highestConf: 'HIGH' | 'MEDIUM' | 'NONE' = 'NONE';
      for (const h of fileMeta.headers) {
        const suggestion = suggestColumnMapping(h, newType);
        if (suggestion.canonicalKey === field.key) {
          if (suggestion.confidence === 'HIGH') {
            bestHeader = h;
            highestConf = 'HIGH';
            break;
          } else if (suggestion.confidence === 'MEDIUM' && highestConf === 'NONE') {
            bestHeader = h;
            highestConf = 'MEDIUM';
          }
        }
      }
      newMappings[field.key] = bestHeader;
      newConfidences[field.key] = highestConf;
    });

    setColumnMappings(newMappings);
    setMappingConfidence(newConfidences);
    runValidation(rawRows, newType, newMappings);
  };

  // Step 5: Execute Import
  const handleCommitImport = async () => {
    if (rawRows.length === 0 || validationErrors.length > 0) return;

    setIsUploading(true);
    setImportResult(null);

    // Transform raw rows into normalized canonical rows using user mappings
    const normalizedRecords = rawRows.map((r) => {
      const canonicalRecord: Record<string, unknown> = {};
      Object.entries(columnMappings).forEach(([canonicalKey, csvHeader]) => {
        if (csvHeader && r[csvHeader] !== undefined) {
          canonicalRecord[canonicalKey] = r[csvHeader];
        }
      });
      return canonicalRecord;
    });

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const storedToken = typeof window !== 'undefined' ? localStorage.getItem('stocksentinel_token') : null;
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }

      const res = await fetch('/api/import', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entityType: selectedDataset,
          records: normalizedRecords,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setImportResult({
          inserted: data.inserted || normalizedRecords.length,
          message: data.message,
          errors: [],
        });
        setCurrentStep(3);
      } else {
        setImportResult({
          inserted: 0,
          errors: data.rowErrors || data.storageErrors || [data.error || 'Database rejected the import batch.'],
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error during upload.';
      setImportResult({ inserted: 0, errors: [msg] });
    } finally {
      setIsUploading(false);
    }
  };

  // Download Downloadable Validation or Export Report
  const downloadValidationReport = () => {
    const reportData = validationErrors.map((err, i) => ({
      issue_id: i + 1,
      severity: 'ERROR',
      description: sanitizeCsvCell(err),
      file_source: sanitizeCsvCell(fileMeta?.name || 'unknown'),
      timestamp: new Date().toISOString(),
    }));

    const csv = Papa.unparse(reportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', `validation_report_${Date.now()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <AppShell
      title="Universal Retail CSV Ingestion"
      subtitle="Import any retail CSV format with smart column matching, custom field mapping, delimiter detection, and phantom stockout detection readiness."
    >
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="bg-white/95 rounded-2xl border border-slate-200/80 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center space-x-6 text-xs font-semibold">
            <span
              className={`flex items-center space-x-2 ${
                currentStep === 1 ? 'text-emerald-800 font-bold' : 'text-slate-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
                1
              </span>
              <span>Upload CSV</span>
            </span>
            <span className="text-slate-300">→</span>
            <span
              className={`flex items-center space-x-2 ${
                currentStep === 2 ? 'text-emerald-800 font-bold' : 'text-slate-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
                2
              </span>
              <span>Inspect & Map Columns</span>
            </span>
            <span className="text-slate-300">→</span>
            <span
              className={`flex items-center space-x-2 ${
                currentStep === 3 ? 'text-emerald-800 font-bold' : 'text-slate-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
                3
              </span>
              <span>Verification & Run Detection</span>
            </span>
          </div>

          {currentStep > 1 && (
            <button
              onClick={() => {
                setCurrentStep(1);
                setFileMeta(null);
                setRawRows([]);
                setValidationErrors([]);
                setImportResult(null);
              }}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
            >
              Start Over / New File
            </button>
          )}
        </div>

        {/* STEP 1: UPLOAD & TEMPLATES */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {/* Dropzone Card */}
              <div className="bg-white/95 rounded-2xl border border-slate-200/80 p-6 shadow-xs md:col-span-2 flex flex-col justify-center">
                <label
                  htmlFor={fileInputId}
                  className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors bg-emerald-50/20 text-center"
                >
                  <Upload className="w-10 h-10 text-emerald-700 mb-3" />
                  <p className="text-base font-bold text-slate-900">Drag & drop your retail CSV file here</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-md">
                    Accepts official challenge CSVs, ERP POS transaction summaries, inventory counts, or catalog exports. Any delimiter (, ; | \t) is supported automatically.
                  </p>
                  <div className="mt-4 px-4 py-2 rounded-xl bg-[#064e3b] text-white text-xs font-semibold shadow-xs">
                    Browse File(s) — Single or Multiple CSVs
                  </div>
                  <input
                    id={fileInputId}
                    type="file"
                    multiple
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Ready Sample Templates */}
              <div className="bg-white/95 rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    <span>Download Reference Templates</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Download sample CSV formats for your retail data type:
                  </p>
                </div>

                <div className="space-y-2">
                  {(Object.keys(CANONICAL_SCHEMAS) as DatasetType[]).map((key) => {
                    const schema = CANONICAL_SCHEMAS[key];
                    return (
                      <button
                        key={key}
                        onClick={() => downloadTemplate(key)}
                        className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 text-left transition-colors cursor-pointer group"
                      >
                        <span className="font-semibold text-slate-700 group-hover:text-emerald-900">
                          {schema.name}
                        </span>
                        <Download className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 shrink-0 ml-2" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Supported Dataset Types Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                <span className="font-bold flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-700" />
                  <span>Combined Sales & Inventory</span>
                </span>
                <p className="text-slate-600 text-[11px]">
                  Files with both daily sales and on-hand inventory automatically enable Phantom Stockout detection immediately after import.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 space-y-1">
                <span className="font-bold flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-slate-700" />
                  <span>Multi-File Ingestion</span>
                </span>
                <p className="text-slate-600 text-[11px]">
                  You can upload Sales and Inventory in separate files. Both link automatically on store ID and SKU.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200 text-xs text-amber-950 space-y-1">
                <span className="font-bold flex items-center space-x-1.5">
                  <HelpCircle className="w-4 h-4 text-amber-700" />
                  <span>Detection Prerequisites</span>
                </span>
                <p className="text-slate-600 text-[11px]">
                  To identify physical stockouts without falsified predictions, the system requires both positive on-hand inventory and historical demand sales.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: INSPECT & MAP COLUMNS */}
        {currentStep === 2 && fileMeta && (
          <div className="space-y-6">
            {/* Multi-File Queue Selector */}
            {uploadedFiles.length > 1 && (
              <div className="bg-white/95 rounded-2xl border border-emerald-200/80 p-4 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-emerald-700" />
                    <span className="text-xs font-bold text-slate-900">
                      Multi-File Upload ({uploadedFiles.length} CSV files selected)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    File {activeFileIndex + 1} of {uploadedFiles.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {uploadedFiles.map((f, idx) => (
                    <button
                      key={f.name + idx}
                      type="button"
                      onClick={() => {
                        setActiveFileIndex(idx);
                        parseAndProcessFile(f);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center space-x-1.5 ${
                        idx === activeFileIndex
                          ? 'bg-[#064e3b] text-white border-[#064e3b] shadow-xs'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      <span>{f.name}</span>
                      {idx === activeFileIndex && <CheckCircle className="w-3.5 h-3.5 text-emerald-300" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* File Overview Banner */}
            <div className="bg-white/95 rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{fileMeta.name}</h3>
                  <div className="flex items-center space-x-3 text-xs text-slate-500 mt-0.5 font-mono">
                    <span>{(fileMeta.size / 1024).toFixed(1)} KB</span>
                    <span>•</span>
                    <span>{fileMeta.rowCount.toLocaleString()} rows parsed</span>
                    <span>•</span>
                    <span>Delimiter: &quot;{fileMeta.delimiter}&quot;</span>
                  </div>
                </div>
              </div>

              {/* Dataset Type Selector */}
              <div className="flex items-center space-x-2">
                <label className="text-xs font-semibold text-slate-600">Dataset Target:</label>
                <select
                  value={selectedDataset}
                  onChange={(e) => handleDatasetTypeChange(e.target.value as DatasetType)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-900 cursor-pointer"
                >
                  {(Object.keys(CANONICAL_SCHEMAS) as DatasetType[]).map((key) => (
                    <option key={key} value={key}>
                      {CANONICAL_SCHEMAS[key].name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Smart Detection Readiness Notice */}
            <div
              className={`p-4 rounded-xl border text-xs flex items-start space-x-3 ${
                activeSchema.enablesDetection
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <Sparkles className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {activeSchema.enablesDetection
                    ? 'Phantom Stock-Out Detection Ready'
                    : 'Partial Retail Telemetry Target'}
                </p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  {activeSchema.enablesDetection
                    ? 'This dataset format contains both sales and inventory telemetry, enabling the real Poisson Anomaly Detector immediately upon import.'
                    : activeSchema.requiredForDetectionNotice || activeSchema.description}
                </p>
              </div>
            </div>

            {/* Column Mapping Table */}
            <div className="bg-white/95 rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                    <Settings2 className="w-4 h-4 text-emerald-700" />
                    <span>Column Mapping & Automatic Synonym Matching</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verify or adjust mapped headers. High-confidence auto-matches are pre-selected.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Canonical Field</th>
                      <th className="py-2.5 px-3">Expected Type</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Mapped CSV Column</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeSchema.fields.map((field) => {
                      const currentVal = columnMappings[field.key] || '';
                      const conf = mappingConfidence[field.key] || 'NONE';
                      return (
                        <tr key={field.key} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                              <span>{field.label}</span>
                              {field.required && <span className="text-rose-500">*</span>}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">{field.key}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700">
                              {field.type}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {currentVal ? (
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  conf === 'HIGH'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {conf === 'HIGH' ? 'High Match' : 'Manual / Partial'}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Unmapped</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <select
                              value={currentVal}
                              onChange={(e) => handleMappingChange(field.key, e.target.value)}
                              className="w-full max-w-xs px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 bg-white hover:border-slate-300 focus:border-emerald-500 focus:outline-hidden"
                            >
                              <option value="">-- Do Not Map --</option>
                              {fileMeta.headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Validation Errors Box */}
            {validationErrors.length > 0 && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
                <div className="flex items-center justify-between font-bold text-rose-800">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-700" />
                    <span>Validation Issues Detected ({validationErrors.length})</span>
                  </div>
                  <button
                    onClick={downloadValidationReport}
                    className="flex items-center space-x-1 text-[11px] underline hover:text-rose-950 font-semibold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Validation Report</span>
                  </button>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] pt-1">
                  {validationErrors.slice(0, 6).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {validationErrors.length > 6 && (
                    <li className="font-semibold">+ {validationErrors.length - 6} more errors</li>
                  )}
                </ul>
              </div>
            )}

            {/* Data Preview Table */}
            {rawRows.length > 0 && (
              <div className="bg-white/95 rounded-2xl overflow-hidden border border-slate-200/80 space-y-3 p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                      <FileCheck className="w-4 h-4 text-emerald-700" />
                      <span>Preview First 5 Records</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Sample data from {fileMeta.name} using your chosen column mappings
                    </p>
                  </div>

                  <button
                    onClick={handleCommitImport}
                    disabled={isUploading || validationErrors.length > 0}
                    className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#064e3b] hover:bg-[#047857] text-white shadow-xs disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Committing to Database...</span>
                      </>
                    ) : (
                      <>
                        <span>Commit {rawRows.length.toLocaleString()} Records</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                        {activeSchema.fields
                          .filter((f) => columnMappings[f.key])
                          .map((f) => (
                            <th key={f.key} className="py-2 px-3">
                              {f.label}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rawRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          {activeSchema.fields
                            .filter((f) => columnMappings[f.key])
                            .map((f) => (
                              <td key={f.key} className="py-2 px-3 font-mono text-[11px] text-slate-800">
                                {String(row[columnMappings[f.key]] ?? '-')}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: COMPLETED & RUN DETECTION */}
        {currentStep === 3 && importResult && (
          <div className="bg-white/95 rounded-2xl border border-slate-200/80 p-8 shadow-xs text-center space-y-5 max-w-xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900">Import Batch Successfully Ingested</h3>
              <p className="text-xs text-slate-500 mt-1">
                {importResult.message ||
                  `Committed ${importResult.inserted.toLocaleString()} records into the database with atomic consistency.`}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 pt-2">
              {uploadedFiles.length > 1 && activeFileIndex < uploadedFiles.length - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = activeFileIndex + 1;
                    setActiveFileIndex(nextIdx);
                    parseAndProcessFile(uploadedFiles[nextIdx]);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#064e3b] hover:bg-[#047857] text-white shadow-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <span>Process Next File: {uploadedFiles[activeFileIndex + 1].name}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs flex items-center justify-center space-x-2 transition-colors"
              >
                <PlayCircle className="w-4 h-4" />
                <span>View Dashboard</span>
              </Link>
              <Link
                href="/alerts"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-900 text-white shadow-xs flex items-center justify-center space-x-2 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Review Alerts</span>
              </Link>
              <button
                onClick={() => {
                  setCurrentStep(1);
                  setFileMeta(null);
                  setRawRows([]);
                  setImportResult(null);
                  setUploadedFiles([]);
                  setActiveFileIndex(0);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                Import New File(s)
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
