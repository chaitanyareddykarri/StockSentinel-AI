#!/usr/bin/env python3
"""
StockSentinel AI — Benchmark Evaluation Entrypoint
Forwards directly to scripts/run_evaluation.py for repository organization compliance.
"""

import sys
import os

# Forward execution to scripts/run_evaluation.py
scripts_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts')
sys.path.insert(0, scripts_dir)

from run_evaluation import main

if __name__ == '__main__':
    main()
