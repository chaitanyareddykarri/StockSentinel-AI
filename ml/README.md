# Machine Learning & Anomaly Detection Package

**Package**: `ml`  
**Purpose**: Independent statistical detection and evaluation pipeline for phantom stock-outs in retail inventory.

---

## Architecture

```text
ml/
├── src/
│   ├── demand/          # Expected demand rate, day-of-week multipliers, Poisson formulas
│   ├── detection/       # Streak analysis, risk scoring, fast/slow mover adjustments
│   ├── ranking/         # Top-K candidate ranking per store-day
│   ├── explanations/    # Explainable natural-language rationale generator
│   └── evaluation/      # Precision@K, Recall, F1-Score, and Average Rank calculations
├── tests/
│   └── test_ml_pipeline.py # Unit tests for all ML modules
└── README.md
```

---

## Running ML Unit Tests

```bash
python -m unittest discover -s ml/tests
```

