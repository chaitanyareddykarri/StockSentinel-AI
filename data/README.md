# Data Directory Structure: StockSentinel AI

This directory manages datasets across their full lifecycle in StockSentinel AI.

---

## Directory Hierarchy

```text
data/
├── raw/         # Immutable raw retail datasets (e.g., official Hackathon exports)
├── interim/     # Intermediate transformations, joined tables, and cleaned data
├── processed/   # Final feature sets ready for inference and model evaluation
└── sample/      # Small, validated sample datasets for quickstart testing
```

---

## 1. `data/raw/`
- **Purpose**: Stores original, immutable input datasets as provided by competition organizers or retail ERP dumps.
- **Rule**: NEVER modify or overwrite files in `raw/`.
- **Git Policy**: Raw data files are excluded via `.gitignore` to prevent committing large or proprietary files.

---

## 2. `data/interim/`
- **Purpose**: Holds partially transformed datasets (e.g. joined sales and inventory, mapped UUIDs, filtered stores).
- **Git Policy**: Excluded via `.gitignore`.

---

## 3. `data/processed/`
- **Purpose**: Stores final, structured feature matrices used by the detection models and evaluation scripts.
- **Git Policy**: Excluded via `.gitignore`.

---

## 4. `data/sample/`
- **Purpose**: Contains small, verified sample CSV fixtures used for automated integration tests and demonstration imports.
- **Files**:
  - `stores.csv`: Store master metadata.
  - `products.csv`: Product catalog with base demand and unit prices.
  - `daily_sales.csv`: Daily sales transaction telemetry.
  - `inventory_snapshots.csv`: Daily on-hand inventory levels.
  - `promotions.csv`: Store and SKU promotional discount calendar.
- **Git Policy**: Version-controlled and tracked in Git.

