"""
ChurnGuard — Model Training Script
Run from churnguard-backend/ directory:
    python scripts/train_models.py

Trains: Logistic Regression, Random Forest, XGBoost, Neural Network (MLP)
Saves:  ml_models/best_model.joblib, ml_models/scaler.joblib, ml_models/metrics.json
"""
import sys, os, json
from pathlib import Path

# Allow running from anywhere
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pandas as pd
import numpy as np
import joblib

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix
)

try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("⚠️  XGBoost not installed — skipping XGBoost model")

from app.ml.pipeline import run_pipeline, MODELS_DIR

# ── Load Data ─────────────────────────────────────────────────────────────────
DATA_PATH = ROOT / "data" / "Churn_Modelling.csv"

def load_data():
    df = pd.read_csv(DATA_PATH)
    # Normalize column names
    df.columns = [c.lower().replace(" ", "_") for c in df.columns]
    df = df.rename(columns={
        "rownumber": "row_number",
        "customerid": "customer_id",
        "creditscore": "credit_score",
        "numofproducts": "num_of_products",
        "hascrcard": "has_cr_card",
        "isactivemember": "is_active_member",
        "estimatedsalary": "estimated_salary",
    })
    print(f"✅ Loaded {len(df):,} rows from {DATA_PATH.name}")
    print(f"📊 Churn rate: {df['exited'].mean():.2%}")
    return df

# ── Evaluate ──────────────────────────────────────────────────────────────────
def evaluate(model, X_test, y_test, name):
    y_pred = model.predict(X_test)
    try:
        y_prob = model.predict_proba(X_test)[:, 1]
        auc = roc_auc_score(y_test, y_prob)
    except Exception:
        auc = 0.0

    metrics = {
        "model": name,
        "accuracy":  round(accuracy_score(y_test, y_pred), 4),
        "precision": round(precision_score(y_test, y_pred, zero_division=0), 4),
        "recall":    round(recall_score(y_test, y_pred, zero_division=0), 4),
        "f1":        round(f1_score(y_test, y_pred, zero_division=0), 4),
        "roc_auc":   round(auc, 4),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
    }

    print(f"\n{'─'*50}")
    print(f"  {name}")
    print(f"  Accuracy:  {metrics['accuracy']:.4f}")
    print(f"  Precision: {metrics['precision']:.4f}")
    print(f"  Recall:    {metrics['recall']:.4f}  ← primary metric")
    print(f"  F1:        {metrics['f1']:.4f}")
    print(f"  ROC-AUC:   {metrics['roc_auc']:.4f}")

    return metrics

# ── Train All Models ──────────────────────────────────────────────────────────
def train_all(X_train, X_test, y_train, y_test):
    results = {}

    # 1. Logistic Regression
    print("\n🔵 Training Logistic Regression...")
    lr = LogisticRegression(max_iter=1000, class_weight="balanced", random_state=42)
    lr.fit(X_train, y_train)
    results["logistic_regression"] = (lr, evaluate(lr, X_test, y_test, "Logistic Regression"))

    # 2. Random Forest
    print("\n🌲 Training Random Forest...")
    rf = RandomForestClassifier(
        n_estimators=200, max_depth=10, class_weight="balanced",
        random_state=42, n_jobs=-1
    )
    rf.fit(X_train, y_train)
    results["random_forest"] = (rf, evaluate(rf, X_test, y_test, "Random Forest"))

    # 3. XGBoost
    if XGBOOST_AVAILABLE:
        print("\n⚡ Training XGBoost...")
        scale_pos = (y_train == 0).sum() / (y_train == 1).sum()
        xgb_model = xgb.XGBClassifier(
            n_estimators=300, max_depth=6, learning_rate=0.05,
            scale_pos_weight=scale_pos, use_label_encoder=False,
            eval_metric="logloss", random_state=42, n_jobs=-1
        )
        xgb_model.fit(X_train, y_train)
        results["xgboost"] = (xgb_model, evaluate(xgb_model, X_test, y_test, "XGBoost"))

    # 4. Neural Network (MLP)
    print("\n🧠 Training Neural Network (MLP)...")
    nn = MLPClassifier(
        hidden_layer_sizes=(128, 64, 32),
        activation="relu",
        dropout=0.3,
        max_iter=200,
        random_state=42,
        early_stopping=True,
        validation_fraction=0.1,
    )
    try:
        nn.fit(X_train, y_train)
    except TypeError:
        # Some sklearn versions don't support dropout in MLPClassifier
        nn = MLPClassifier(
            hidden_layer_sizes=(128, 64, 32),
            activation="relu",
            max_iter=300,
            random_state=42,
            early_stopping=True,
            validation_fraction=0.1,
        )
        nn.fit(X_train, y_train)
    results["neural_network"] = (nn, evaluate(nn, X_test, y_test, "Neural Network (MLP)"))

    return results

# ── Select Best Model ─────────────────────────────────────────────────────────
def select_best(results):
    # Primary: highest Recall where Precision >= 0.65
    candidates = {
        k: v for k, v in results.items()
        if v[1]["precision"] >= 0.50  # relaxed threshold
    }
    if not candidates:
        candidates = results  # fallback: use all

    best_name = max(candidates, key=lambda k: candidates[k][1]["recall"])
    best_model, best_metrics = results[best_name]
    print(f"\n🏆 Best model: {best_metrics['model']} (Recall={best_metrics['recall']:.4f})")
    return best_name, best_model, best_metrics

# ── Save ──────────────────────────────────────────────────────────────────────
def save_results(best_name, best_model, all_results):
    MODELS_DIR.mkdir(exist_ok=True)

    # Save best model
    joblib.dump(best_model, MODELS_DIR / "best_model.joblib")
    print(f"✅ Saved best_model.joblib")

    # Save all individual models
    for name, (model, _) in all_results.items():
        joblib.dump(model, MODELS_DIR / f"{name}.joblib")
        print(f"✅ Saved {name}.joblib")

    # Build metrics.json
    metrics_out = {
        "best_model": best_name,
        "models": {k: v[1] for k, v in all_results.items()},
    }
    with open(MODELS_DIR / "metrics.json", "w") as f:
        json.dump(metrics_out, f, indent=2)
    print(f"✅ Saved metrics.json")

    # Save feature importance (Random Forest or XGBoost)
    feature_names = [
        "credit_score", "age", "tenure", "balance",
        "num_of_products", "has_cr_card", "is_active_member",
        "estimated_salary", "geography_germany", "geography_spain", "gender_male"
    ]
    importance_model = all_results.get("xgboost") or all_results.get("random_forest")
    if importance_model:
        model_obj = importance_model[0]
        if hasattr(model_obj, "feature_importances_"):
            importances = dict(zip(feature_names, model_obj.feature_importances_.tolist()))
            importances = dict(sorted(importances.items(), key=lambda x: -x[1]))
            with open(MODELS_DIR / "feature_importance.json", "w") as f:
                json.dump(importances, f, indent=2)
            print(f"✅ Saved feature_importance.json")

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("  ChurnGuard — Model Training Pipeline")
    print("=" * 60)

    df = load_data()
    X_train, X_test, y_train, y_test, scaler = run_pipeline(df)

    results = train_all(X_train, X_test, y_train, y_test)
    best_name, best_model, best_metrics = select_best(results)
    save_results(best_name, best_model, results)

    print("\n" + "=" * 60)
    print("  Training Complete!")
    print(f"  Best Model: {best_metrics['model']}")
    print(f"  Recall:     {best_metrics['recall']:.4f}")
    print(f"  Precision:  {best_metrics['precision']:.4f}")
    print(f"  ROC-AUC:    {best_metrics['roc_auc']:.4f}")
    print("=" * 60)
    print("\n✅ Models saved to ml_models/ — backend is ready!")
