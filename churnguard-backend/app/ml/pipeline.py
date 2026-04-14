import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split
from imblearn.over_sampling import SMOTE
import joblib
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
MODELS_DIR = Path(__file__).resolve().parents[2] / "ml_models"
MODELS_DIR.mkdir(exist_ok=True)

# ── Feature Columns ───────────────────────────────────────────────────────────
DROP_COLS    = ["row_number", "surname", "customer_id"]
TARGET_COL   = "exited"
CAT_COLS     = ["geography", "gender"]
SCALE_COLS   = ["credit_score", "age", "tenure", "balance", "estimated_salary"]
FEATURE_COLS = [
    "credit_score", "age", "tenure", "balance",
    "num_of_products", "has_cr_card", "is_active_member",
    "estimated_salary", "geography_germany", "geography_spain",
    "gender_male"
]

# ── Step 1: Clean & Encode ────────────────────────────────────────────────────
def preprocess(df: pd.DataFrame):
    df = df.copy()

    # Drop non-predictive columns
    df = df.drop(columns=[c for c in DROP_COLS if c in df.columns])

    # Convert booleans to int
    for col in ["has_cr_card", "is_active_member", "exited"]:
        if col in df.columns:
            df[col] = df[col].astype(int)

    # One-Hot Encode Geography (drop France as baseline)
    df = pd.get_dummies(df, columns=["geography"], drop_first=False)
    df = df.rename(columns={
        "geography_Germany": "geography_germany",
        "geography_Spain":   "geography_spain",
        "geography_France":  "geography_france"
    })
    # Drop France (baseline to avoid multicollinearity)
    if "geography_france" in df.columns:
        df = df.drop(columns=["geography_france"])

    # Label Encode Gender (Male=1, Female=0)
    if "gender" in df.columns:
        le = LabelEncoder()
        df["gender_male"] = le.fit_transform(df["gender"])
        df = df.drop(columns=["gender"])

    return df

# ── Step 2: Scale Features ────────────────────────────────────────────────────
def scale_features(X_train, X_test):
    scaler = StandardScaler()
    X_train_scaled = X_train.copy()
    X_test_scaled  = X_test.copy()

    X_train_scaled[SCALE_COLS] = scaler.fit_transform(X_train[SCALE_COLS])
    X_test_scaled[SCALE_COLS]  = scaler.transform(X_test[SCALE_COLS])

    # Save scaler for inference
    joblib.dump(scaler, MODELS_DIR / "scaler.joblib")
    print("✅ Scaler saved")

    return X_train_scaled, X_test_scaled, scaler

# ── Step 3: Split + SMOTE ─────────────────────────────────────────────────────
def split_and_smote(df: pd.DataFrame):
    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    print(f"📊 Class distribution before SMOTE: {dict(y.value_counts())}")

    # 80/20 stratified split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Apply SMOTE to training set only
    smote = SMOTE(random_state=42)
    X_train_bal, y_train_bal = smote.fit_resample(X_train, y_train)

    print(f"📊 Class distribution after SMOTE:  {dict(pd.Series(y_train_bal).value_counts())}")
    print(f"✅ Train size: {len(X_train_bal)} | Test size: {len(X_test)}")

    return X_train_bal, X_test, y_train_bal, y_test

# ── Full Pipeline ─────────────────────────────────────────────────────────────
def run_pipeline(df: pd.DataFrame):
    print("⚙️  Running preprocessing pipeline...")
    df_processed = preprocess(df)
    X_train, X_test, y_train, y_test = split_and_smote(df_processed)
    X_train_scaled, X_test_scaled, scaler = scale_features(X_train, X_test)
    print("✅ Pipeline complete!")
    return X_train_scaled, X_test_scaled, y_train, y_test, scaler

# ── Inference Preprocessor ────────────────────────────────────────────────────
def preprocess_single(input_dict: dict) -> np.ndarray:
    """Preprocess a single customer input for prediction."""
    scaler = joblib.load(MODELS_DIR / "scaler.joblib")

    df = pd.DataFrame([input_dict])

    # One-hot encode geography
    df["geography_germany"] = int(input_dict.get("geography", "").lower() == "germany")
    df["geography_spain"]   = int(input_dict.get("geography", "").lower() == "spain")

    # Label encode gender
    df["gender_male"] = int(input_dict.get("gender", "").lower() == "male")

    # Select and scale
    X = df[FEATURE_COLS].copy()
    X[SCALE_COLS] = scaler.transform(X[SCALE_COLS])

    return X.values