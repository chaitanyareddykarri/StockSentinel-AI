# Official Benchmark Evaluation & Performance Scorecard

**Competition**: AI Frontier Challenge 2026 / TalentAP Mega Hackathon  
**Problem Statement**: Round 1 — *The Phantom Stock-Out Detector*  
**Dataset**: Saffron Retail Group (25 Stores, 800 SKUs, 548 Calendar Days, 1,183 Scored Store-Days)  
**Evaluator**: Official `evaluate.py` (Starter Pack Evaluation Standard)  
**Submission Rule Compliance**: 9 / 9 Official Criteria Strictly Passed via `scripts/verify_submission.py`  

---

## 1. Official Evaluation Scorecard

StockSentinel AI was evaluated against the public development ground truth (`data/dev_truth.csv`, 13 stores across 91 days = 1,183 store-days) using the official `evaluate.py` scorer:

```bash
py evaluate.py --submission submission/R1_predictions_dev.csv --truth data/dev_truth.csv --out score.json
```

### Comprehensive Benchmark Comparison

| Evaluation Metric | Official Baseline | StockSentinel AI (Optimized) | Relative Improvement | Mathematical Context |
| :--- | :---: | :---: | :---: | :--- |
| **PRIMARY Precision@20** | `0.3965` | **`0.4301`** | **+8.5% relative gain** | Achieves **49.7%** of theoretical mathematical ceiling |
| **Theoretical Ceiling** | `0.8656` | `0.8656` | Baseline ceiling | Maximum mathematically attainable (some store-days have $<20$ positive events) |
| **Flags on Delisted Decoys** | `5.20%` | **`0.02%`** | **99.6% error reduction** | Saffron chain-wide 3-day zero consensus filter eliminates headquarters delisting traps |
| **Row Recall** | `38.20%` | **`43.95%`** | **+15.1% relative gain** | **10,176 verified problem shelf-days** detected (vs 8,845 baseline) |
| **Episode Recall** | `19.40%` | **`22.77%`** | **+17.4% relative gain** | Captures 1 in ~4.4 full distinct problem episodes (653 / 2,868 episodes) |
| **Stretch Diagnostic Accuracy** | N/A (Blank) | **`81.09%`** | **+81.09% net new** | Diagnoses `phantom` (shrinkage) vs `misplaced` with 81.1% accuracy ($n=10,181$) |

---

## 2. Key Algorithmic Drivers of the 0.4301 Precision Score

### 2.1 The Chain-Wide Delisting Consensus Filter (Decoy Trap Immunity)
- **The Problem**: In retail chains, central headquarters occasionally delists an SKU across the entire chain without immediately zeroing ERP stock balances. A single-store model sees consecutive zero-sales with positive recorded stock and incorrectly flags it as a phantom stockout.
- **The Solution**: Central assortment delistings zero out across all 25 stores simultaneously. When $\ge 24$ of 25 stores observe zero sales for an SKU over 3 consecutive days (`CHAIN_DELIST_DAYS = 3`), the SKU is identified as corporate-delisted and excluded from store alert queues.
- **The Impact**: Drops decoy trap errors from **5.20% down to 0.02%** (a 99.6% reduction in false alarms).

### 2.2 Deep Historical Velocity Baseline Window (112–126 Days)
- **The Problem**: Short rolling lookback windows (e.g. 14–28 days) are susceptible to temporary holiday surges, month-end spikes, and localized distributor stockouts, distorting the baseline rate $\lambda$.
- **The Solution**: Expanding the lookback window to 112–126 days (`LOOKBACK_DAYS = 112`) smooths out seasonality and gives high-confidence estimates of true steady-state sales velocity.
- **The Impact**: Precision@20 increased from **0.4108 to 0.4301**.

### 2.3 Diagnostic Root-Cause Attribution Engine (81.09% Accuracy)
- Predicts `phantom` (unrecorded shrinkage/theft) vs `misplaced` (units located in stockroom or wrong aisle) using:
  1. High on-hand stock combined with sudden drop after positive sales $\rightarrow$ `misplaced`.
  2. Sustained zero-sales run length with moderate stock balances $\rightarrow$ `phantom`.
- Achieves **81.09% diagnostic accuracy** across 10,181 verified alerts.

---

## 3. Strict 9-Point Official Submission Compliance

The submission file (`submission/R1_predictions.csv`) was generated via `scripts/run_stocksentinel_detection.py` and validated by `scripts/verify_submission.py`:

```bash
py scripts/verify_submission.py
```

| # | Official Submission Criterion | Verification Result | Details |
| :-: | :--- | :---: | :--- |
| **1** | **Target Date Range** | **PASS** | Exactly 28 days (`2026-09-03` to `2026-09-30`) |
| **2** | **Target Stores** | **PASS** | All 25 stores present |
| **3** | **Total Store-Days** | **PASS** | Exactly 700 store-days ($28 \times 25$) covered |
| **4** | **Rows per Store-Day** | **PASS** | Exactly 20 rows per store-day ($700 \times 20 = 14,000$ total rows) |
| **5** | **Zero Duplicates** | **PASS** | 0 duplicate `(date, store_id, sku_id)` tuples |
| **6** | **Rank Uniqueness** | **PASS** | Ranks 1 to 20 strictly unique within every daily store list |
| **7** | **Confidence Boundedness** | **PASS** | Range: `[0.9102, 1.0000]` ($\subseteq [0.0, 1.0]$) |
| **8** | **Plain-English Reasons** | **PASS** | 100% populated with explainable rationale |
| **9** | **Stretch Predicted Type** | **PASS** | Valid positive types: 10,068 `phantom`, 3,932 `misplaced` |

---

## 4. One-Line Reproduction Commands

```bash
# 1. Run detection engine across both dev (45,500 rows) and test (14,000 rows) in ~3.6s
py scripts/run_stocksentinel_detection.py

# 2. Run official competition evaluator against public ground truth
py evaluate.py --submission submission/R1_predictions_dev.csv --truth data/dev_truth.csv --out score.json

# 3. Verify all 9 submission rules
py scripts/verify_submission.py

# 4. Run all 128 automated full-stack tests
npm test
```
