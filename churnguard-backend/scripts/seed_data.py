import kaggle  # pyright: ignore[reportMissingImports]
import pandas as pd
import os
import sys
from pathlib import Path

# Add backend root to path so we can import app modules
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.models.database import supabase

# ── Config ────────────────────────────────────────────────────────────────────
DATASET     = "sidramazam/customer-churn-analysis-dataset"
DATA_DIR    = Path(__file__).resolve().parents[1] / "data"
CSV_NAME    = "Churn_Modelling.csv"

# ── Step 1: Download Dataset from Kaggle ─────────────────────────────────────
def download_dataset():
    print("📥 Downloading dataset from Kaggle...")
    DATA_DIR.mkdir(exist_ok=True)
    kaggle.api.authenticate()
    kaggle.api.dataset_download_files(
        DATASET,
        path=str(DATA_DIR),
        unzip=True
    )
    print(f"✅ Dataset downloaded to {DATA_DIR}")

# ── Step 2: Load and Clean CSV ────────────────────────────────────────────────
def load_and_clean():
    print("🧹 Loading and cleaning data...")

    # Find the CSV file
    csv_files = list(DATA_DIR.glob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV found in {DATA_DIR}")

    csv_path = DATA_DIR / CSV_NAME if (DATA_DIR / CSV_NAME).exists() else csv_files[0]
    df = pd.read_csv(csv_path)

    print(f"📊 Loaded {len(df)} rows, {len(df.columns)} columns")
    print(f"   Columns: {list(df.columns)}")

    # Rename columns to match Supabase table
    df = df.rename(columns={
        "RowNumber":       "row_number",
        "CustomerId":      "customer_id",
        "Surname":         "surname",
        "CreditScore":     "credit_score",
        "Geography":       "geography",
        "Gender":          "gender",
        "Age":             "age",
        "Tenure":          "tenure",
        "Balance":         "balance",
        "NumOfProducts":   "num_of_products",
        "HasCrCard":       "has_cr_card",
        "IsActiveMember":  "is_active_member",
        "EstimatedSalary": "estimated_salary",
        "Exited":          "exited"
    })

    # Convert 1/0 integers to booleans for Supabase
    df["has_cr_card"]      = df["has_cr_card"].astype(bool)
    df["is_active_member"] = df["is_active_member"].astype(bool)
    df["exited"]           = df["exited"].astype(bool)

    print("✅ Data cleaned successfully")
    return df

# ── Step 3: Seed into Supabase ────────────────────────────────────────────────
def seed_supabase(df: pd.DataFrame):
    print("🌱 Seeding data into Supabase...")

    # Check if already seeded
    existing = supabase.table("customers").select("customer_id").limit(1).execute()
    if existing.data:
        print("⚠️  customers table already has data. Skipping seed.")
        print("   To re-seed, manually delete all rows from the customers table first.")
        return

    # Insert in batches of 500 to avoid payload limits
    BATCH_SIZE = 500
    records    = df.to_dict(orient="records")
    total      = len(records)

    for i in range(0, total, BATCH_SIZE):
        batch = records[i : i + BATCH_SIZE]
        supabase.table("customers").insert(batch).execute()
        print(f"   Inserted rows {i+1} to {min(i+BATCH_SIZE, total)} / {total}")

    print(f"Successfully seeded {total} rows into Supabase!")

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("ChurnGuard — Data Seeding Pipeline")
    print("=" * 45)
    download_dataset()
    df = load_and_clean()
    seed_supabase(df)
    print("=" * 45)
    print("Seeding complete! Your Supabase customers table is ready.")