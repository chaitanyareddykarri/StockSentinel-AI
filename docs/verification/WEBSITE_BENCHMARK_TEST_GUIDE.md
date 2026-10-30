# StockSentinel AI — Official Challenge Testing & Website Demonstration Guide

**Project**: StockSentinel AI  
**Challenge Target**: TalentAP Mega Hackathon 2026 — Saffron Retail Group Phantom Stock-Out Detector (R1)  
**Document Purpose**: Step-by-step instructions for testing the official competition files through the live Next.js web application and verifying end-to-end data integrity from CSV upload to model evaluation.

---

## 1. Project Architecture & Relevant File Paths

```text
StockSentinel-AI/
├── src/
│   ├── app/
│   │   ├── dashboard/page.tsx      # Main Command Center UI with "Run Detection" button
│   │   ├── alerts/page.tsx         # Alert investigation table with Top-20 ranking & filters
│   │   ├── import/page.tsx         # CSV Ingestion UI with PapaParse schema validation
│   │   ├── analytics/page.tsx      # ROI simulator & department vulnerability breakdown
│   │   ├── verification/page.tsx   # Physical shelf audit resolution workflow
│   │   └── api/
│   │       ├── detect/route.ts     # Detection execution endpoint (POST /api/detect)
│   │       ├── import/route.ts     # CSV transaction commit endpoint (POST /api/import)
│   │       └── alerts/route.ts     # Alert query and status update endpoint
│   ├── components/
│   │   ├── AlertTable.tsx          # Displays ranked alerts, reasons, and operational CSV export
│   │   ├── AlertDetailModal.tsx    # Detailed anomaly signal modal with physical audit actions
│   │   ├── AppShell.tsx            # Global navigation bar containing the "Run Detection" button
│   │   └── SalesInventoryChart.tsx # Time-series sales vs. inventory divergence chart
│   └── lib/
│       ├── detector.ts             # In-app Poisson demand anomaly detection engine
│       ├── storage.ts              # Data persistence (Supabase PostgreSQL + local JSON store fallback)
│       └── auth/serverAuth.ts      # Multi-tenant RBAC session verification
├── ml/
│   ├── src/
│   │   ├── demand/baseline_poisson.py   # Statistical Poisson formulas & DoW multipliers
│   │   ├── detection/anomaly_detector.py# Anomaly risk scoring & velocity thresholds
│   │   ├── ranking/store_ranker.py      # Top-K candidate sorting & truncation
│   │   ├── explanations/reason_generator.py # Plain-English rationale generator
│   │   └── evaluation/metrics.py        # Precision@K, Recall, and ROI arithmetic
│   └── tests/test_ml_pipeline.py        # Python ML unit test suite (8 passing tests)
├── data/
│   ├── daily_sales_inventory.parquet    # Official 7.97M row challenge dataset
│   ├── daily_sales_inventory_sample_2stores.csv # Official 110K row 2-store slice
│   ├── store_master.csv                 # Official 25 store metadata file
│   ├── sku_master.csv                   # Official 800 SKU product catalog file
│   ├── promotion_calendar.csv           # Official promotion schedules
│   ├── dev_truth.csv                    # Official public dev labels (24,639 positive days)
│   └── official_web_sample/             # Web-compatible CSVs extracted from official files
├── scripts/
│   ├── run_stocksentinel_detection.py   # Primary batch detector (produces submission CSVs)
│   ├── prepare_official_website_csvs.py # Adapter: converts official files -> web import CSVs
│   └── verify_submission.py             # Integrity checker for submission/R1_predictions.csv
├── evaluate.py                          # Official competition scorer (TalentAP R1)
└── submission/
    ├── R1_predictions.csv               # Official test submission (14,000 rows, verified)
    └── R1_predictions_dev.csv           # Dev window predictions (45,500 rows, scored)
```

---

## 2. Official Challenge File Explanations

| File Name | Rows | Role in Evaluation | Description & Data Fields |
| :--- | :---: | :--- | :--- |
| `data/daily_sales_inventory.parquet` | 7,970,112 | **Primary Model Input** | Main panel table: 25 stores $\times$ 800 SKUs $\times$ 548 days (`date, store_id, sku_id, units_sold, on_hand_eod, on_promo`). |
| `data/daily_sales_inventory_sample_2stores.csv` | 110,400 | **Quick-Look / Web Sample** | 2 stores (`STR-BFPW`, `STR-H5GD`) across 120 days. Used to prepare web-uploadable CSVs. |
| `data/store_master.csv` | 25 | **Metadata Input** | Store format (`Hyper`, `Market`, `Express`), square footage, city, state, and `label_split` (`dev_labelled` vs `test_hidden`). |
| `data/sku_master.csv` | 800 | **Catalog Input** | SKU master: category, fictional brand, pack size, `unit_price_inr`, `unit_cost_inr`, `unit_margin_inr`, `shelf_life_class`, `case_pack`. |
| `data/promotion_calendar.csv` | 1,789 | **Feature Input** | Promotional campaigns, scope (SKU/category), store scope, date ranges, and discount percentage. |
| `data/holiday_calendar.csv` | 27 | **Feature Input** | Indian national and regional festival dates for 2025–2026. |
| `data/dev_labels.csv` | 2,905 | **Dev Evaluation Only** | Episode-level ground-truth labels for the 13 dev stores (`episode_id, store_id, sku_id, label_type, start_date, last_date`). |
| `data/dev_truth.csv` | 24,639 | **Official Scorer Ground Truth** | Day-level ground-truth for dev window (`date, store_id, sku_id, label_type, episode_id`). Passed to `evaluate.py`. |
| `sample_submission.csv` | 14,000 | **Schema Reference** | Format demonstration of valid test submission (28 dates $\times$ 25 stores $\times$ 20 ranks). |
| `evaluate.py` | – | **Untouched Official Scorer** | Official evaluation script used by hackathon judges to calculate Mean Precision@20, Recall, and Decoy penalty. |
| `baseline/baseline.py` | – | **Organizers' Baseline** | Heuristic 7-day rolling average script scoring 0.3965 Precision@20 on dev. |

> [!IMPORTANT]
> **Data Segregation Rule**:
> - **Inputs allowed for model features**: `daily_sales_inventory.parquet` (up to day $D-1$), `store_master.csv`, `sku_master.csv`, `promotion_calendar.csv`, `holiday_calendar.csv`.
> - **Strictly prohibited as model inputs**: `dev_truth.csv`, `dev_labels.csv`, and any future dates ($D$, $D+1$, ...).

---

## 3. Exact Local Setup Instructions

### Prerequisites
- Node.js $\ge 18$
- Python $\ge 3.9$ with `pandas`, `numpy`, and `pyarrow`

### Step 1: Install Dependencies
```powershell
# In project root (d:\StockSentinel-AI-)
npm install
py -m pip install pandas pyarrow numpy
```

*(Note for Windows 11 users: If Windows Smart App Control blocks `.pyd` files, execute `Get-ChildItem -Path "$env:LOCALAPPDATA\Python\*" -Recurse | Unblock-File`)*

### Step 2: Prepare Official Challenge Web Import Files
Run the built-in adapter script to extract web-compatible CSV files from the official Saffron Retail datasets:
```powershell
py scripts/prepare_official_website_csvs.py
```
This automatically creates 5 perfectly formatted CSV files in `data/official_web_sample/`:
1. `stores.csv` (25 stores)
2. `products.csv` (800 SKUs)
3. `daily_sales.csv` (12,880 sales rows)
4. `inventory_snapshots.csv` (12,880 inventory snapshots)
5. `promotions.csv` (1,755 promotion schedules)

### Step 3: Start the StockSentinel AI Website
```powershell
npm run dev
```
The website will start at: `http://localhost:3000`

---

## 4. Website Testing Steps (Interactive Web Flow)

### Step 4.1: Open the Application
Navigate in your browser to:
`http://localhost:3000/login`

Log in using demo credentials:
- **Email**: `manager@stocksentinel.ai` (or click "Sign In as Demo Store Manager")
- **Password**: `demo1234`
*(Alternatively, Platform Admin credentials: `admin@stocksentinel.ai` / `admin1234`)*

### Step 4.2: Ingest the Official Challenge Datasets
Navigate to the **CSV Import** page:
`http://localhost:3000/import`

Upload the files generated in `data/official_web_sample/` in the following sequence:

1. **Stores**:
   - Click the **Stores** tab.
   - Drag & drop or select `data/official_web_sample/stores.csv`.
   - The preview table will display the 25 Saffron stores (`STR-06EU`, `STR-BFPW`, etc.).
   - Click **"Commit 25 Rows"**. A green confirmation banner will appear.
2. **Products & SKUs**:
   - Click the **Products & SKUs** tab.
   - Drag & drop or select `data/official_web_sample/products.csv`.
   - The preview table will display the 800 FMCG SKUs.
   - Click **"Commit 800 Rows"**.
3. **Daily Sales**:
   - Click the **Daily Sales** tab.
   - Drag & drop or select `data/official_web_sample/daily_sales.csv`.
   - Click **"Commit 12880 Rows"**.
4. **Inventory Snapshots**:
   - Click the **Inventory Snapshots** tab.
   - Drag & drop or select `data/official_web_sample/inventory_snapshots.csv`.
   - Click **"Commit 12880 Rows"**.
5. **Promotions** *(Optional)*:
   - Click the **Promotions** tab.
   - Drag & drop or select `data/official_web_sample/promotions.csv`.
   - Click **"Commit 1755 Rows"**.

### Step 4.3: Trigger In-App Detection
1. Click **Dashboard** in the sidebar navigation (`http://localhost:3000/dashboard`).
2. In the top navigation bar, ensure store selection is set to **"All Stores"** (or select `STR-BFPW`).
3. Click the green **"Run Detection"** button (with the refresh/scan icon).
4. The button will indicate `Analyzing POS...` for 1–2 seconds while `/api/detect` executes the Poisson streak anomaly detector across the imported records.
5. The dashboard metrics will update immediately:
   - **Active Alerts**: Updates with newly detected phantom anomalies.
   - **Critical / High Priority**: Shows highest risk cases.
   - **Revenue Protected**: Calculates financial exposure in INR.
   - **Alert Table**: Ranks the top 20 candidate SKUs per store.

### Step 4.4: Inspect Individual Alert Intelligence
1. Navigate to **Alerts** (`http://localhost:3000/alerts`).
2. Click any row in the Alert Table (e.g. `SKU-CT6HJD`).
3. The **Alert Detail Modal** opens, showing:
   - **Explainable Rationale**: e.g. *"System records 12 units in inventory, but 0 sales occurred over 8 days despite normal velocity of 3.2 units/day (Poisson anomaly p < 0.01%)."*
   - **Time-Series Divergence Chart**: Visualizes sales dropping to zero while recorded stock stays flat.
   - **Associate Triage Actions**: Click `"Confirm Phantom Out of Stock"`, `"Found in Backroom"`, or `"False Alarm"` to record a physical audit entry.

---

## 5. CSV vs. Parquet Compatibility

### Can the Web UI Import Parquet Directly?
- **No.** The web browser's file upload interface uses `PapaParse` (`src/app/import/page.tsx`), which parses plain text CSV format in browser memory.
- The 18.1 MB Parquet file (`daily_sales_inventory.parquet`) contains **7,970,112 rows**. Attempting to parse 8 million binary rows inside client-side browser JavaScript would exhaust browser memory and freeze the tab.
- **The Correct Architecture**:
  1. **Web UI Demonstrations**: Uses `data/official_web_sample/*.csv` via the `/import` page for interactive triage and store manager workflows.
  2. **Official 28-Day Benchmark Execution**: Uses Python with `pyarrow` via `scripts/run_stocksentinel_detection.py`, which loads the entire 7.97M row parquet file in 0.8 seconds and outputs the official submission CSVs.

---

## 6. End-to-End Data Flow Verification

To confirm that imported records reach the detector and are not using hard-coded mock data:

```
[CSV File on Disk]
       │
       ▼  (Browser FileReader + PapaParse in src/app/import/page.tsx)
[In-Memory Records]
       │
       ▼  (POST /api/import)
[Next.js API Handler: src/app/api/import/route.ts]
       │  • Validates store code joins to store_master
       │  • Validates SKU joins to sku_master
       │  • Validates numerical non-negativity
       │
       ▼  (importCsvRecords in src/lib/storage.ts)
[Database / Local JSON Store: data/store_state.json or Supabase]
       │
       ▼  (POST /api/detect triggered by "Run Detection" button)
[Detection Service: src/lib/detector.ts]
       │  • Reads sales history and latest inventory snapshots
       │  • Computes zero-streak length and Poisson p-value
       │  • Generates Top-20 ranking per store
       │
       ▼  (saveDetectionRun in src/lib/storage.ts)
[Alert Records Persisted to Storage]
       │
       ▼  (GET /api/alerts fetched by Dashboard & AlertTable)
[Live User Interface]
```

### How to Verify Each Stage:
1. **Check Upload Commit**: In `POST /api/import`, look for `{ success: true, inserted: 12880 }`.
2. **Check Persistence File**: Open `data/store_state.json`. Search for `"STR-BFPW"` or `"SKU-CT6HJD"`. The imported records will be present under the `daily_sales` and `inventory_snapshots` arrays.
3. **Check Detection Execution**: In your terminal running `npm run dev`, verify `POST /api/detect 200 OK`.
4. **Check Alerts Generated**: In `data/store_state.json`, search for `"alerts"`. Each alert contains `run_id`, `store_id`, `sku`, `risk_score`, and `primary_reason`.

---

## 7. Official Baseline Execution

Run the organizers' baseline exactly as specified in the official starter pack:

```powershell
# 1. Run baseline script (produces dev & test predictions)
py baseline/baseline.py

# 2. Score baseline on development truth with untouched evaluator
py evaluate.py --submission baseline_results/R1_predictions_dev.csv --truth data/dev_truth.csv --out baseline_results/score_baseline.json

# 3. View official score
py -m json.tool baseline_results/score_baseline.json
```

### Verified Baseline Results (`score_baseline.json`):
- **Scored Store-Days**: `1,183` (91 dates $\times$ 13 dev stores)
- **Primary Metric (Mean Precision@20)**: **`0.3965`** (39.65%)
- **Theoretical Ceiling Precision@20**: `0.8656` (45.81% of ceiling)
- **Row Recall**: `0.4051` (9,381 hits out of 23,156 positive days)
- **Episode Recall**: `0.1991` (571 out of 2,868 episodes flagged)
- **Delisted Decoys Wasted**: **`0.0520`** (5.20% of all top-20 slots wasted on delisted items)

---

## 8. StockSentinel AI Benchmark Execution

Run StockSentinel AI's detector and evaluate it using the exact same official evaluator:

```powershell
# 1. Run StockSentinel AI detector
py scripts/run_stocksentinel_detection.py

# 2. Score StockSentinel AI on development truth with untouched evaluator
py evaluate.py --submission submission/R1_predictions_dev.csv --truth data/dev_truth.csv --out score_stocksentinel.json

# 3. View official score
py -m json.tool score_stocksentinel.json
```

### Verified StockSentinel AI Results (`score_stocksentinel.json`):
- **Scored Store-Days**: `1,183` (91 dates $\times$ 13 dev stores)
- **Primary Metric (Mean Precision@20)**: **`0.4247`** (42.47%)
- **Theoretical Ceiling Precision@20**: `0.8656` (49.06% of ceiling)
- **Row Recall**: `0.4339` (10,048 hits out of 23,156 positive days)
- **Episode Recall**: `0.2197` (630 out of 2,868 episodes flagged)
- **Delisted Decoys Wasted**: **`0.0016`** (0.16% — 96.9% reduction in false alarms!)
- **Stretch Goal Type Accuracy**: **`0.8149`** (81.49% accuracy distinguishing phantom vs misplaced)

### Side-by-Side Comparison:
$$\text{Precision@20 Gain} = 0.4247 - 0.3965 = \mathbf{+0.0282\text{ (+7.11\% Relative Improvement)}}$$
$$\text{Additional Hits Caught} = 10,048 - 9,381 = \mathbf{+667\text{ Positive Store-SKU-Days}}$$
$$\text{False Alarms Eliminated} = 1,231 - 38 = \mathbf{1,193\text{ Wasted Slots Saved}}$$

---

## 9. Final Submission Verification (`submission/R1_predictions.csv`)

Verify that the generated test submission strictly complies with all 8 competition rules:

```powershell
py scripts/verify_submission.py
```

### Verification Output:
```text
Verifying submission/R1_predictions.csv...
Loaded successfully via official evaluate.load_submission(). Rows: 14,000
[PASS] Date range: exactly 28 days (2026-09-03 to 2026-09-30)
[PASS] Stores: all 25 stores present
[PASS] Total store-days: 700 (all covered, none missing)
[PASS] Rows per store-day: max 20, exactly 20 rows for every store-day
[PASS] Duplicate check: 0 duplicate store-date-SKU entries
[PASS] Rank uniqueness: ranks 1 to 20 strictly unique within each store-day
[PASS] Confidence range: [0.9102, 1.0000]
[PASS] Plain-English reasons: 100% populated
[PASS] Stretch predicted_type: valid values present (12,438 phantom, 1,562 misplaced)
ALL 9 SUBMISSION CRITERIA STRICTLY VERIFIED! Total submission rows: 14,000
```

---

## 10. Operational CSV Export vs. Hackathon Submission Format

| Characteristic | Website Export (`AlertTable.tsx`) | Official Hackathon Submission (`submission/R1_predictions.csv`) |
| :--- | :--- | :--- |
| **Purpose** | Operational triage report for store managers. | Official competitive benchmark submission. |
| **File Name** | `stocksentinel_alerts_YYYY-MM-DD.csv` | `submission/R1_predictions.csv` |
| **Header** | `ID,Store,SKU,Product,Category,Risk Score,Risk Category,Recorded Stock,Zero Days,Est Lost Rev Daily,Status,Reason` | `date,store_id,sku_id,rank,confidence,reason,predicted_type` |
| **Row Count** | Variable based on UI store/risk filter. | Strictly **14,000 rows** (28 test dates $\times$ 25 stores $\times$ 20 ranks). |
| **Trigger Mechanism** | Clicking "Export CSV" on the alert table. | Running `py scripts/run_stocksentinel_detection.py`. |
| **Official Scorer** | Incompatible (different headers). | **100% compatible** with `evaluate.py`. |

---

## 11. Known Limitations & Blockers

1. **Browser Memory & 8-Million-Row Uploads**:
   - Do not attempt to drag-and-drop the full 8-million-row `daily_sales_inventory.parquet` into the browser `/import` page. Use `data/official_web_sample/*.csv` for web UI demonstrations and `scripts/run_stocksentinel_detection.py` for full-dataset benchmark execution.
2. **LightGBM Claim**:
   - LightGBM was previously claimed in project marketing documents but was refuted during our code audit (no model existed). The validated Poisson + 8-week lookback + network delisted suppression pipeline outperforms the baseline without needing gradient boosted trees.
3. **Financial Impact Realism**:
   - The financial estimates calculated in `/analytics` represent **Potential Gross Margin Opportunity**, NOT actual cash collected at the till. A store must physically restock the shelf and customers must buy the items for revenue to be realized.

---

## 12. Jury Demonstration Checklist

Follow this 5-minute walkthrough during your presentation to hackathon judges:

- [ ] **Step 1: The Problem Framing**:
  - Show the empty shelf scenario for Saffron Retail Group. Explain how phantom stockouts quietly drain sales while recorded on-hand stock remains positive.
- [ ] **Step 2: Show the Data Ingestion Pipeline**:
  - Open `http://localhost:3000/import`.
  - Demonstrate importing `data/official_web_sample/daily_sales.csv`. Highlight the instant schema validation and pre-commit preview table.
- [ ] **Step 3: Trigger Live Demand Anomaly Detection**:
  - Open `http://localhost:3000/dashboard`.
  - Click the **"Run Detection"** button. Point out how the Poisson engine evaluates each SKU's zero-sales streak against its 8-week baseline demand rate and active promotions.
- [ ] **Step 4: Demonstrate Explainable Morning Shelf Walks**:
  - Open `http://localhost:3000/alerts`.
  - Filter by store `STR-BFPW`. Show the exact Top-20 ranking.
  - Click on Rank #1. Show the **Alert Detail Modal**, the sales vs. inventory divergence chart, and the plain-English reason.
  - Click `"Confirm Phantom Out of Stock"` to demonstrate the store manager audit loop.
- [ ] **Step 5: Prove the Benchmark Score on Terminal**:
  - Run `py evaluate.py --submission submission/R1_predictions_dev.csv --truth data/dev_truth.csv`.
  - Show judges the official score: **`0.4247 Precision@20`** (beating the organizers' baseline of `0.3965` by **+7.11%** with a **96.9% reduction in delisted decoys**).
- [ ] **Step 6: Show Validated Submission Package**:
  - Run `py scripts/verify_submission.py`.
  - Prove that `submission/R1_predictions.csv` passes all 9 competition constraints across all 25 stores and 28 test dates.
