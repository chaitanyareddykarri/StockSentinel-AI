#!/usr/bin/env python3
"""
StockSentinel AI — Official Submission Packager
Packages the repository into the exact submission ZIP format required by
the TalentAP Mega Hackathon 2026 / AI Frontier Challenge 2026:

Required Zip Structure:
teamID_R1.zip
├── README.md                  # Authoritative instructions and benchmark results
├── submission/
│   └── R1_predictions.csv     # Verified test window predictions (14,000 rows)
└── FULL_CODE/                 # Complete source code (web app, ML engine, API, tests)
"""
from __future__ import annotations

import argparse
import os
import sys
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

# Excluded from the submission ZIP as mandated by competition guidelines:
EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    ".next",
    "__pycache__",
    ".pytest_cache",
    ".venv",
    "venv",
    "env",
    ".turbo",
    "dist",
    "build",
    "coverage",
    ".nyc_output",
    ".idea",
    ".vscode",
    "data",  # Pack data files must not be bundled in zip
}

EXCLUDE_FILES = {
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    "score.json",
    "score_baseline.json",
    "score_stocksentinel.json",
    "tsconfig.tsbuildinfo",
}

EXCLUDE_EXTENSIONS = {
    ".pyc",
    ".pyo",
    ".pyd",
    ".parquet",
    ".log",
    ".tmp",
    ".zip",
}


def should_exclude(rel_path: Path) -> bool:
    parts = rel_path.parts
    for part in parts:
        if part in EXCLUDE_DIRS:
            return True
    if rel_path.name in EXCLUDE_FILES:
        return True
    if rel_path.suffix.lower() in EXCLUDE_EXTENSIONS:
        return True
    return False


def build_submission_zip(team_id: str, output_path: Path):
    submission_csv = REPO_ROOT / "submission" / "R1_predictions.csv"
    readme_md = REPO_ROOT / "README.md"

    if not submission_csv.exists():
        print(f"ERROR: {submission_csv} not found! Run scripts/run_stocksentinel_detection.py first.")
        sys.exit(1)

    if not readme_md.exists():
        print(f"ERROR: {readme_md} not found!")
        sys.exit(1)

    zip_filename = f"{team_id}_R1.zip"
    target_zip = output_path / zip_filename

    print(f"Creating submission package: {target_zip} ...")
    with zipfile.ZipFile(target_zip, "w", zipfile.ZIP_DEFLATED) as zf:
        # 1. Add top-level README.md
        zf.write(readme_md, arcname="README.md")
        print("  [+] Added README.md")

        # 2. Add top-level submission/R1_predictions.csv
        zf.write(submission_csv, arcname="submission/R1_predictions.csv")
        print("  [+] Added submission/R1_predictions.csv")

        # 3. Add all project code under FULL_CODE/
        files_added = 0
        for root, dirs, files in os.walk(REPO_ROOT):
            # Prune excluded directories in-place
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

            for file in sorted(files):
                full_path = Path(root) / file
                rel_path = full_path.relative_to(REPO_ROOT)

                if should_exclude(rel_path):
                    continue

                arcname = Path("FULL_CODE") / rel_path
                zf.write(full_path, arcname=str(arcname).replace("\\", "/"))
                files_added += 1

        print(f"  [+] Packaged {files_added} source code files into FULL_CODE/")

    zip_size_mb = target_zip.stat().st_size / (1024 * 1024)
    print(f"\nSUCCESS: Created {target_zip.name} ({zip_size_mb:.2f} MB)")
    print("Submission archive is 100% compliant with official hackathon packaging rules!")


def main():
    parser = argparse.ArgumentParser(description="Package StockSentinel AI for Official Submission")
    parser.add_argument(
        "--team-id",
        default="StockSentinel",
        help="Your Team ID (creates <team_id>_R1.zip)",
    )
    parser.add_argument(
        "--out-dir",
        default=".",
        help="Destination directory for the submission zip (default: project root)",
    )
    args = parser.parse_args()

    out_dir = Path(args.out_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    build_submission_zip(args.team_id, out_dir)


if __name__ == "__main__":
    main()

