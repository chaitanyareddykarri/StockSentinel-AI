# Benchmark Evaluation: StockSentinel AI

**Evaluation Standard**: Talentap Mega Hackathon — Problem R1  
**Runner Script**: `scripts/run_evaluation.py` (legacy alias `evaluate.py`)  

---

## 1. Evaluation Protocol

To prevent data leakage and guarantee authentic performance measurement:
1. **Strict Ground-Truth Isolation**: Synthetic ground-truth phantom labels are generated separately and strictly omitted from all feature matrices and inference functions.
2. **Top-K Cutoff**: Evaluators evaluate the daily ranked list at $K=10$ and $K=20$.
3. **Reproducibility**: The evaluation script uses a fixed seed (`random.seed(2026)`) to ensure identical dataset generation across testing environments.

---

## 2. Standard Evaluation Metrics

### 2.1 Precision@20 (Primary Metric)
$$\text{Precision@20} = \frac{\text{True Phantoms in Top 20 Alerts}}{20}$$

### 2.2 Recall
$$\text{Recall} = \frac{\text{True Phantoms in Top 20 Alerts}}{\text{Total Ground-Truth Phantoms in Store}}$$

### 2.3 F1-Score
$$\text{F1} = 2 \times \frac{\text{Precision@20} \times \text{Recall}}{\text{Precision@20} + \text{Recall}}$$

### 2.4 Average Rank of True Phantoms
$$\text{AvgRank} = \frac{1}{|P_{\text{true}}|} \sum_{p \in P_{\text{true}}} \text{Rank}(p)$$

---

## 3. Verified Benchmark Results

Generated from a benchmark dataset of 5 stores, 100 SKUs per store, across 60 days (500 store-SKU evaluation pairs, 30 ground-truth phantom events):

| Metric | Result | Target Benchmark |
| :--- | :---: | :---: |
| **Precision@10** | **50.0%** | $> 35.0\%$ |
| **Precision@20** | **40.28%** | $> 30.0\%$ |
| **Recall (Top 20)** | **96.67%** | $> 85.0\%$ |
| **F1-Score** | **56.86** | $> 45.0$ |
| **Average Rank** | **#5.45** | $\le 10.0$ |
| **Detected True Phantoms** | **29 / 30** | $> 25$ |

**Conclusion**: The deterministic baseline captures **96.7%** of all phantom stock-out incidents within the top 20 shelf walk recommendations, concentrating genuine anomalies at an average rank of **#5.45**.

