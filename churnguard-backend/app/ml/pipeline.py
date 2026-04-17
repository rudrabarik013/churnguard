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
SCALE_COLS   = ["credit_score", "age", "tenure", "balance", "estimated_salary"]
FEATURE_COLS = [
    "credit_score", "age", "tenure", "balance",
    "num_of_products", "has_cr_card", "is_active_member",
    "estimated_salary", "geography_germany", "geography_spain",
    "gender_male"
]

# ── Step 1: Clean & Encode ────────────────────────────────────────────────────
def preprocess(df: pd.DataFrame) -> pd.DataFrame:
    """
    Encode categorical columns and drop non-predictive features.
    Does NOT scale — scaling is done later, after the train/test split.
    """
    df = df.copy()

    # Drop non-predictive columns
    df = df.drop(columns=[c for c in DROP_COLS if c in df.columns])

    # Convert booleans to int
    for col in ["has_cr_card", "is_active_member", "exited"]:
        if col in df.columns:
            df[col] = df[col].astype(int)

    # One-Hot Encode Geography — drop France as the baseline category
    df = pd.get_dummies(df, columns=["geography"], drop_first=False)
    df = df.rename(columns={
        "geography_Germany": "geography_germany",
        "geography_Spain":   "geography_spain",
        "geography_France":  "geography_france",
    })
    if "geography_france" in df.columns:
        df = df.drop(columns=["geography_france"])

    # Label Encode Gender (Male = 1, Female = 0)
    if "gender" in df.columns:
        le = LabelEncoder()
        df["gender_male"] = le.fit_transform(df["gender"])
        df = df.drop(columns=["gender"])

    return df


# ── Step 2: Train / Validation / Test split (70 / 10 / 20) ───────────────────
def split(df: pd.DataFrame):
    """
    Stratified three-way split:
        70% training   — used to fit the model (after SMOTE)
        10% validation — used during training for early stopping / tuning
        20% test       — held-out, never touched until final evaluation

    Stratify=y on every split so all three sets preserve the original
    ~80/20 (retained/churned) class ratio.
    """
    X = df[FEATURE_COLS]
    y = df[TARGET_COL]
    print(f"📊 Class distribution: {dict(y.value_counts())} | Churn rate: {y.mean():.2%}")

    # Step 1: carve out 20% test set → 80% remaining
    X_temp, X_test, y_temp, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )

    # Step 2: from the 80% remaining, carve out 10/80 = 12.5% → gives 10% of total
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=0.125, random_state=42, stratify=y_temp
    )

    print(f"✅ Split sizes — Train: {len(X_train):,} (70%) | Val: {len(X_val):,} (10%) | Test: {len(X_test):,} (20%)")
    print(f"   Train churn rate: {y_train.mean():.2%} | Val: {y_val.mean():.2%} | Test: {y_test.mean():.2%}")

    return X_train, X_val, X_test, y_train, y_val, y_test


# ── Step 3: Scale (BEFORE SMOTE) ─────────────────────────────────────────────
def scale_features(X_train, X_val, X_test):
    """
    Fit scaler ONLY on the 70% training set (original, pre-SMOTE data).
    Then apply the same transform to val and test — no data leakage.
    """
    scaler = StandardScaler()

    X_train_scaled = X_train.copy()
    X_val_scaled   = X_val.copy()
    X_test_scaled  = X_test.copy()

    X_train_scaled[SCALE_COLS] = scaler.fit_transform(X_train[SCALE_COLS])   # fit here only
    X_val_scaled[SCALE_COLS]   = scaler.transform(X_val[SCALE_COLS])          # transform only
    X_test_scaled[SCALE_COLS]  = scaler.transform(X_test[SCALE_COLS])         # transform only

    joblib.dump(scaler, MODELS_DIR / "scaler.joblib")
    print("✅ Scaler fitted on 70% training data and saved")

    return X_train_scaled, X_val_scaled, X_test_scaled, scaler


# ── Step 4: SMOTE on training set only (AFTER scaling) ───────────────────────
def apply_smote(X_train_scaled, y_train):
    """
    SMOTE only on the training split — val and test are never oversampled.
    Working on scaled data means distance-based interpolation is meaningful.
    """
    smote = SMOTE(random_state=42)
    X_bal, y_bal = smote.fit_resample(X_train_scaled, y_train)
    print(f"📊 After SMOTE — {dict(pd.Series(y_bal).value_counts())} | Balanced train size: {len(X_bal):,}")
    return X_bal, y_bal


# ── Full Pipeline ─────────────────────────────────────────────────────────────
def run_pipeline(df: pd.DataFrame):
    """
    Correct ML pipeline order:
        1. Encode
        2. Three-way stratified split  (70 / 10 / 20)
        3. Scale  — fit on 70% train only, transform val + test
        4. SMOTE  — on training set only, after scaling
    """
    print("⚙️  Running preprocessing pipeline...")
    df_processed = preprocess(df)

    X_train, X_val, X_test, y_train, y_val, y_test = split(df_processed)

    X_train_scaled, X_val_scaled, X_test_scaled, scaler = scale_features(X_train, X_val, X_test)

    X_train_bal, y_train_bal = apply_smote(X_train_scaled, y_train)

    print(f"✅ Pipeline complete!")
    return X_train_bal, X_val_scaled, X_test_scaled, y_train_bal, y_val, y_test, scaler


# ── Inference Preprocessor ────────────────────────────────────────────────────
def preprocess_single(input_dict: dict) -> np.ndarray:
    """Preprocess a single customer dict for live prediction."""
    scaler = joblib.load(MODELS_DIR / "scaler.joblib")

    row = {
        "credit_score":      float(input_dict.get("credit_score", 0)),
        "age":               float(input_dict.get("age", 0)),
        "tenure":            float(input_dict.get("tenure", 0)),
        "balance":           float(input_dict.get("balance", 0)),
        "num_of_products":   float(input_dict.get("num_of_products", 1)),
        "has_cr_card":       float(int(input_dict.get("has_cr_card", False))),
        "is_active_member":  float(int(input_dict.get("is_active_member", False))),
        "estimated_salary":  float(input_dict.get("estimated_salary", 0)),
        "geography_germany": float(str(input_dict.get("geography", "")).lower() == "germany"),
        "geography_spain":   float(str(input_dict.get("geography", "")).lower() == "spain"),
        "gender_male":       float(str(input_dict.get("gender", "")).lower() == "male"),
    }

    X = pd.DataFrame([row])[FEATURE_COLS]
    X[SCALE_COLS] = scaler.transform(X[SCALE_COLS])
    return X.values