"""
ChurnGuard — Inference / Prediction Logic
Used by the /api/predict endpoints.
"""
import json
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from typing import List, Dict, Any

MODELS_DIR = Path(__file__).resolve().parents[2] / "ml_models"

FEATURE_NAMES = [
    "credit_score", "age", "tenure", "balance",
    "num_of_products", "has_cr_card", "is_active_member",
    "estimated_salary", "geography_germany", "geography_spain", "gender_male"
]

SCALE_COLS = ["credit_score", "age", "tenure", "balance", "estimated_salary"]

# ── Load artefacts ─────────────────────────────────────────────────────────────
def load_model_and_scaler():
    model_path  = MODELS_DIR / "best_model.joblib"
    scaler_path = MODELS_DIR / "scaler.joblib"
    if not model_path.exists():
        raise FileNotFoundError("best_model.joblib not found. Run scripts/train_models.py first.")
    model  = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    return model, scaler


def load_best_model_name() -> str:
    metrics_path = MODELS_DIR / "metrics.json"
    if metrics_path.exists():
        with open(metrics_path) as f:
            data = json.load(f)
        return data.get("best_model", "best_model")
    return "best_model"


def load_feature_importance() -> Dict[str, float]:
    fi_path = MODELS_DIR / "feature_importance.json"
    if fi_path.exists():
        with open(fi_path) as f:
            return json.load(f)
    return {}

# ── Preprocess single customer ────────────────────────────────────────────────
def _build_feature_row(customer: dict, scaler) -> np.ndarray:
    row = {
        "credit_score":      float(customer.get("credit_score", 0)),
        "age":               float(customer.get("age", 0)),
        "tenure":            float(customer.get("tenure", 0)),
        "balance":           float(customer.get("balance", 0)),
        "num_of_products":   float(customer.get("num_of_products", 1)),
        "has_cr_card":       float(int(customer.get("has_cr_card", False))),
        "is_active_member":  float(int(customer.get("is_active_member", False))),
        "estimated_salary":  float(customer.get("estimated_salary", 0)),
        "geography_germany": float(str(customer.get("geography", "")).lower() == "germany"),
        "geography_spain":   float(str(customer.get("geography", "")).lower() == "spain"),
        "gender_male":       float(str(customer.get("gender", "")).lower() == "male"),
    }
    X = pd.DataFrame([row])[FEATURE_NAMES]
    X[SCALE_COLS] = scaler.transform(X[SCALE_COLS])
    return X.values

# ── Risk level ────────────────────────────────────────────────────────────────
def _risk_level(prob: float) -> str:
    if prob >= 0.6:
        return "High"
    elif prob >= 0.35:
        return "Medium"
    return "Low"

# ── Top risk factors ──────────────────────────────────────────────────────────
FACTOR_LABELS = {
    "age":               "Older age group",
    "balance":           "High account balance",
    "num_of_products":   "Number of products held",
    "is_active_member":  "Inactive membership",
    "geography_germany": "German market segment",
    "credit_score":      "Low credit score",
    "tenure":            "Short tenure with bank",
    "gender_male":       "Gender factor",
    "geography_spain":   "Spanish market segment",
    "has_cr_card":       "No credit card held",
    "estimated_salary":  "Salary profile",
}

def _top_risk_factors(customer: dict, feature_importance: dict, n: int = 3) -> List[str]:
    """Return top-n risk factor labels for this customer."""
    if not feature_importance:
        # Fallback: hard-coded domain knowledge
        factors = []
        age = customer.get("age", 0)
        if age >= 40:
            factors.append("Older age group (higher churn risk)")
        if not customer.get("is_active_member"):
            factors.append("Inactive membership status")
        geo = str(customer.get("geography", "")).lower()
        if geo == "germany":
            factors.append("German customers have highest churn rate")
        if customer.get("num_of_products", 1) >= 3:
            factors.append("High product count associated with churn")
        if customer.get("balance", 0) == 0:
            factors.append("Zero balance indicates disengagement")
        return factors[:n] or ["Elevated churn probability detected"]

    # Use feature importance ranking
    ranked = sorted(feature_importance.items(), key=lambda x: -x[1])
    return [FACTOR_LABELS.get(name, name.replace("_", " ").title()) for name, _ in ranked[:n]]

# ── Public API ─────────────────────────────────────────────────────────────────
def predict_single(customer: dict, model, scaler) -> dict:
    X = _build_feature_row(customer, scaler)
    prob = float(model.predict_proba(X)[0, 1])
    fi   = load_feature_importance()
    return {
        "churn_probability": round(prob, 4),
        "risk_level":        _risk_level(prob),
        "top_risk_factors":  _top_risk_factors(customer, fi),
        "model_used":        load_best_model_name(),
    }


def predict_batch(customers: list, model, scaler) -> list:
    results = []
    fi = load_feature_importance()
    for c in customers:
        X    = _build_feature_row(c, scaler)
        prob = float(model.predict_proba(X)[0, 1])
        results.append({
            "customer_id":       c.get("customer_id"),
            "churn_probability": round(prob, 4),
            "risk_level":        _risk_level(prob),
            "top_risk_factors":  _top_risk_factors(c, fi),
            "model_used":        load_best_model_name(),
        })
    return results
