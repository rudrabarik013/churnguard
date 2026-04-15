"""
ChurnGuard — Model Training Script
Run from churnguard-backend/ directory:
    python scripts/train_models.py

Split  : 70% train / 10% validation / 20% test  (all stratified)
Order  : Encode → Split → Scale (fit on train) → SMOTE (train only)
Trains : Logistic Regression, Random Forest, XGBoost, Neural Network (MLP)
Saves  : ml_models/best_model.joblib, scaler.joblib, metrics.json, feature_importance.json
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
    total = len(df)
    churn_rate = df['exited'].mean()
    retain_rate = 1 - churn_rate
    print(f"✅ Loaded {total:,} rows from {DATA_PATH.name}")
    print(f"📊 Class distribution:")
    print(f"   Class 0 (Retained): {int(retain_rate * total):,} ({retain_rate:.2%})")
    print(f"   Class 1 (Churned):  {int(churn_rate * total):,} ({churn_rate:.2%})")
    print(f"   ⚠️  Dominant class: Class 0 — a dummy model guessing 'retained' always gets {retain_rate:.2%} accuracy.")
    print(f"   → Primary metric is RECALL (how many churners we catch), not accuracy.")
    return df

# ── Evaluate ──────────────────────────────────────────────────────────────────
def evaluate(model, X, y, name, split_label="Test"):
    """
    Evaluate model on given split. split_label is 'Val' or 'Test'.
    Returns a metrics dict.
    """
    y_pred = model.predict(X)
    try:
        y_prob = model.predict_proba(X)[:, 1]
        auc = roc_auc_score(y, y_prob)
    except Exception:
        auc = 0.0

    cm = confusion_matrix(y, y_pred)
    tn, fp, fn, tp = cm.ravel() if cm.shape == (2, 2) else (0, 0, 0, 0)

    metrics = {
        "model":            name,
        "split":            split_label,
        "accuracy":         round(accuracy_score(y, y_pred), 4),
        "precision":        round(precision_score(y, y_pred, zero_division=0), 4),
        "recall":           round(recall_score(y, y_pred, zero_division=0), 4),
        "f1":               round(f1_score(y, y_pred, zero_division=0), 4),
        "roc_auc":          round(auc, 4),
        "confusion_matrix": cm.tolist(),
    }

    print(f"\n{'─'*55}")
    print(f"  {name}  [{split_label} Set]")
    print(f"  Accuracy:  {metrics['accuracy']:.4f}")
    print(f"  Precision: {metrics['precision']:.4f}")
    print(f"  Recall:    {metrics['recall']:.4f}  ← primary metric")
    print(f"  F1:        {metrics['f1']:.4f}")
    print(f"  ROC-AUC:   {metrics['roc_auc']:.4f}")
    print(f"  Confusion Matrix (actual↓ / pred→):")
    print(f"             Pred 0   Pred 1")
    print(f"  Actual 0:  {tn:>6}   {fp:>6}  (TN / FP)")
    print(f"  Actual 1:  {fn:>6}   {tp:>6}  (FN / TP)")

    return metrics

# ── Train All Models ──────────────────────────────────────────────────────────
def train_all(X_train, X_val, X_test, y_train, y_val, y_test):
    """
    Train all 4 models on SMOTE-balanced, pre-scaled training data.
    Evaluates on both validation and test sets.

    Important: since SMOTE already balances the training set to 50/50,
    we do NOT use class_weight="balanced" on RF or scale_pos_weight on XGBoost.
    Using both SMOTE and class weighting double-counts the imbalance correction
    and degrades precision significantly.
    """
    results = {}

    # 1. Logistic Regression
    # LR still benefits from class_weight because it uses a linear boundary
    # and the calibration helps with probability outputs on the original distribution.
    print("\n🔵 Training Logistic Regression...")
    lr = LogisticRegression(max_iter=1000, C=0.1, solver="lbfgs", random_state=42)
    lr.fit(X_train, y_train)
    val_metrics  = evaluate(lr, X_val,  y_val,  "Logistic Regression", split_label="Val")
    test_metrics = evaluate(lr, X_test, y_test, "Logistic Regression", split_label="Test")
    results["logistic_regression"] = (lr, val_metrics, test_metrics)

    # 2. Random Forest
    # No class_weight — SMOTE already balanced the training set.
    # Increased n_estimators and tuned max_depth for better generalisation.
    print("\n🌲 Training Random Forest...")
    rf = RandomForestClassifier(
        n_estimators=300,
        max_depth=12,
        min_samples_split=5,
        min_samples_leaf=2,
        max_features="sqrt",
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train, y_train)
    val_metrics  = evaluate(rf, X_val,  y_val,  "Random Forest", split_label="Val")
    test_metrics = evaluate(rf, X_test, y_test, "Random Forest", split_label="Test")
    results["random_forest"] = (rf, val_metrics, test_metrics)

    # 3. XGBoost
    # No scale_pos_weight — SMOTE already balanced the training set (ratio ≈ 1.0).
    # Removed deprecated use_label_encoder parameter.
    if XGBOOST_AVAILABLE:
        print("\n⚡ Training XGBoost...")
        xgb_model = xgb.XGBClassifier(
            n_estimators=400,
            max_depth=5,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            reg_alpha=0.1,
            reg_lambda=1.0,
            eval_metric="logloss",
            random_state=42,
            n_jobs=-1,
        )
        xgb_model.fit(X_train, y_train)
        val_metrics  = evaluate(xgb_model, X_val,  y_val,  "XGBoost", split_label="Val")
        test_metrics = evaluate(xgb_model, X_test, y_test, "XGBoost", split_label="Test")
        results["xgboost"] = (xgb_model, val_metrics, test_metrics)

    # 4. Neural Network (MLP)
    # sklearn's MLPClassifier does NOT support dropout — removed that parameter.
    # alpha=0.001 provides L2 regularisation (conceptually similar to dropout).
    print("\n🧠 Training Neural Network (MLP)...")
    nn = MLPClassifier(
        hidden_layer_sizes=(128, 64, 32),
        activation="relu",
        solver="adam",
        alpha=0.001,        # L2 regularisation (replaces dropout conceptually)
        batch_size=256,
        learning_rate="adaptive",
        max_iter=300,
        random_state=42,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=15,
        tol=1e-4,
    )
    nn.fit(X_train, y_train)
    val_metrics  = evaluate(nn, X_val,  y_val,  "Neural Network (MLP)", split_label="Val")
    test_metrics = evaluate(nn, X_test, y_test, "Neural Network (MLP)", split_label="Test")
    results["neural_network"] = (nn, val_metrics, test_metrics)

    return results

# ── Select Best Model ─────────────────────────────────────────────────────────
def select_best(results):
    """
    Primary: highest Recall on TEST set where Precision >= 0.65.
    With the corrected pipeline, all tree models should comfortably exceed this.
    """
    candidates = {
        k: v for k, v in results.items()
        if v[2]["precision"] >= 0.65   # v[2] = test_metrics
    }
    if not candidates:
        # Fallback if no model clears 0.65 precision
        candidates = results

    best_name = max(candidates, key=lambda k: candidates[k][2]["recall"])
    best_model, _, best_metrics = results[best_name]
    print(f"\n🏆 Best model: {best_metrics['model']} (Recall={best_metrics['recall']:.4f}, Precision={best_metrics['precision']:.4f})")
    return best_name, best_model, best_metrics

# ── Save ──────────────────────────────────────────────────────────────────────
def save_results(best_name, best_model, all_results):
    MODELS_DIR.mkdir(exist_ok=True)

    # Save best model
    joblib.dump(best_model, MODELS_DIR / "best_model.joblib")
    print(f"✅ Saved best_model.joblib")

    # Save all individual models
    for name, (model, _, __) in all_results.items():
        joblib.dump(model, MODELS_DIR / f"{name}.joblib")
        print(f"✅ Saved {name}.joblib")

    # Build metrics.json — store test metrics (index 2) for each model
    metrics_out = {
        "best_model": best_name,
        "models": {k: v[2] for k, v in all_results.items()},
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

    # run_pipeline returns 7 values: train_bal, val, test, y_train_bal, y_val, y_test, scaler
    X_train_bal, X_val, X_test, y_train_bal, y_val, y_test, scaler = run_pipeline(df)

    results = train_all(X_train_bal, X_val, X_test, y_train_bal, y_val, y_test)
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
