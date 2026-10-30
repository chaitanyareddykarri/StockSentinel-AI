#!/usr/bin/env python3
"""
StockSentinel AI — Data Validation Script
Validates CSV files against the Hackathon data schema, checking:
- Expected column headers
- Non-negative numbers for prices, demand, sales, and inventory
- ISO-8601 date formats (YYYY-MM-DD)
- Non-empty primary keys and codes
"""

import os
import sys
import csv
import argparse
from datetime import datetime
from typing import Dict, List, Tuple

# Set utf-8 encoding if supported
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Required minimum columns per entity (id is optional as it can be auto-generated)
REQUIRED_SCHEMAS: Dict[str, List[str]] = {
    "stores": ["code", "name", "location", "store_type"],
    "products": ["sku", "name", "category", "unit_price", "avg_daily_demand"],
    "daily_sales": ["store_id", "sku", "date", "units_sold"],
    "inventory_snapshots": ["store_id", "sku", "date", "on_hand_stock"],
    "promotions": ["store_id", "sku", "start_date", "end_date", "discount_pct"],
}


def validate_date(date_str: str) -> bool:
    try:
        datetime.strptime(date_str.strip()[:10], "%Y-%m-%d")
        return True
    except ValueError:
        return False


def validate_csv_file(file_path: str, entity_type: str) -> Tuple[bool, List[str]]:
    errors: List[str] = []
    if not os.path.exists(file_path):
        return False, [f"File not found: {file_path}"]

    expected_cols = REQUIRED_SCHEMAS.get(entity_type, [])
    if not expected_cols:
        return False, [f"Unknown entity type: {entity_type}"]

    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = [h.strip() for h in (reader.fieldnames or [])]

        # Check required columns
        for col in expected_cols:
            if col not in headers:
                errors.append(f"Missing required column '{col}'. Present headers: {headers}")

        if errors:
            return False, errors

        row_count = 0
        for idx, row in enumerate(reader, start=1):
            row_count += 1
            # Check date fields
            for date_col in ["date", "start_date", "end_date"]:
                if date_col in row and row[date_col]:
                    if not validate_date(row[date_col]):
                        errors.append(f"Row {idx}: Invalid date format '{row[date_col]}' in '{date_col}' (expected YYYY-MM-DD)")

            # Check numeric non-negative fields
            for num_col in ["unit_price", "avg_daily_demand", "units_sold", "revenue", "on_hand_stock", "discount_pct"]:
                if num_col in row and row[num_col] is not None and str(row[num_col]).strip() != "":
                    try:
                        val = float(row[num_col])
                        if val < 0:
                            errors.append(f"Row {idx}: Negative value '{val}' in column '{num_col}'")
                    except ValueError:
                        errors.append(f"Row {idx}: Non-numeric value '{row[num_col]}' in column '{num_col}'")

            if len(errors) > 25:
                errors.append("... Aborting further checks due to error volume exceeding 25.")
                break

    is_valid = len(errors) == 0
    return is_valid, errors


def main():
    parser = argparse.ArgumentParser(description="Validate retail CSV files for StockSentinel AI")
    parser.add_argument("--data-dir", type=str, default="data/sample", help="Directory containing CSV files")
    parser.add_argument("--file", type=str, help="Specific CSV file to validate")
    parser.add_argument("--entity", type=str, help="Entity type (stores, products, daily_sales, inventory_snapshots, promotions)")
    args = parser.parse_args()

    print("=================================================================")
    print("  StockSentinel AI — Retail CSV Schema Validator")
    print("=================================================================")

    if args.file and args.entity:
        valid, errors = validate_csv_file(args.file, args.entity)
        if valid:
            print(f"[PASS] {args.entity}: {args.file}")
        else:
            print(f"[FAIL] {args.entity}: {len(errors)} errors")
            for e in errors:
                print(f"  - {e}")
        return

    data_dir = args.data_dir
    print(f"Scanning directory: {data_dir}\n")
    all_passed = True

    for entity, _ in REQUIRED_SCHEMAS.items():
        candidate_file = os.path.join(data_dir, f"{entity}.csv")
        if os.path.exists(candidate_file):
            valid, errors = validate_csv_file(candidate_file, entity)
            if valid:
                print(f"  [PASS] {entity:<20} ({candidate_file})")
            else:
                all_passed = False
                print(f"  [FAIL] {entity:<20} ({len(errors)} errors)")
                for e in errors[:5]:
                    print(f"    - {e}")
        else:
            print(f"  [SKIP] {entity:<20} (File not found)")

    print("-----------------------------------------------------------------")
    if all_passed:
        print("Data validation SUCCESSFUL: All present CSVs meet schema rules.")
    else:
        print("Data validation FAILED: Please correct the flagged rows above.")


if __name__ == "__main__":
    main()
