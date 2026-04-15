"""
Simulation router — /api/simulation/run
Runs one of 7 banking scenarios against the dataset using the loaded ML model.
"""
from fastapi import APIRouter, Depends, Request, HTTPException
import copy, json
from pathlib import Path

from app.models.database import supabase
from app.models.schemas import SimulationRequest, SimulationResponse
from app.routers.auth import get_current_user

router = APIRouter()
MODELS_DIR = Path(__file__).resolve().parents[2] / "ml_models"

# ── Scenario definitions ──────────────────────────────────────────────────────
SCENARIOS = {
    "activate_inactive_members": {
        "label": "Activate Inactive Members",
        "description": "Launch engagement campaigns — set all inactive members to active",
        "modifier": lambda r: {**r, "is_active_member": True},
        "filter": lambda r: not r.get("is_active_member"),
    },
    "germany_retention": {
        "label": "Germany Retention Campaign",
        "description": "Dedicated German market team — activate + add product",
        "modifier": lambda r: {**r, "is_active_member": True,
                               "num_of_products": min((r.get("num_of_products") or 1) + 1, 4)},
        "filter": lambda r: r.get("geography") == "Germany",
    },
    "cross_sell_single_product": {
        "label": "Cross-Sell to Single-Product Holders",
        "description": "Bundle savings + credit card for customers with 1 product",
        "modifier": lambda r: {**r, "num_of_products": 2},
        "filter": lambda r: (r.get("num_of_products") or 0) == 1,
    },
    "credit_score_improvement": {
        "label": "Credit Score Improvement",
        "description": "Free credit workshops + secured cards for low credit customers",
        "modifier": lambda r: {**r, "credit_score": 600},
        "filter": lambda r: (r.get("credit_score") or 999) < 500,
    },
    "age_targeted_retention": {
        "label": "Age-Targeted Retention (40–60)",
        "description": "Premium wealth advisory — activate + add product for age 40–60",
        "modifier": lambda r: {**r, "is_active_member": True,
                               "num_of_products": min((r.get("num_of_products") or 1) + 1, 4)},
        "filter": lambda r: 40 <= (r.get("age") or 0) <= 60,
    },
    "zero_balance_engagement": {
        "label": "Zero-Balance Engagement",
        "description": "Deposit bonuses and savings incentives — set balance to median",
        "modifier": lambda r: {**r, "balance": 97199.0},
        "filter": lambda r: (r.get("balance") or 0) == 0,
    },
    "comprehensive_package": {
        "label": "Comprehensive Retention Package",
        "description": "Full-scale initiative combining all interventions",
        "modifier": lambda r: {
            **r,
            "is_active_member": True,
            "num_of_products": min((r.get("num_of_products") or 1) + (1 if (r.get("num_of_products") or 1) == 1 else 0), 4),
            "credit_score": max(r.get("credit_score") or 0, 600) if (r.get("credit_score") or 999) < 500 else r.get("credit_score"),
            "balance": 97199.0 if (r.get("balance") or 0) == 0 else r.get("balance"),
        },
        "filter": lambda r: True,
    },
}

AVG_BALANCE = 76485.89  # avg balance of all customers
ANNUAL_REVENUE_PER_CUSTOMER = AVG_BALANCE * 0.05  # 5% NIM assumption


def _get_model_and_scaler(request: Request):
    model = getattr(request.app.state, "model", None)
    if model is None:
        return None, None
    from pathlib import Path
    import joblib
    scaler_path = MODELS_DIR / "scaler.joblib"
    if not scaler_path.exists():
        return None, None
    scaler = joblib.load(scaler_path)
    return model, scaler


def _predict_churn_rate(rows, model, scaler) -> float:
    """
    Predict churn rate using a single batch call to model.predict_proba.
    This is ~100x faster than calling predict_proba row-by-row.
    """
    import pandas as pd
    from app.ml.pipeline import FEATURE_COLS, SCALE_COLS

    records = []
    for r in rows:
        records.append({
            "credit_score":      float(r.get("credit_score") or 0),
            "age":               float(r.get("age") or 0),
            "tenure":            float(r.get("tenure") or 0),
            "balance":           float(r.get("balance") or 0),
            "num_of_products":   float(r.get("num_of_products") or 1),
            "has_cr_card":       float(int(r.get("has_cr_card") or 0)),
            "is_active_member":  float(int(r.get("is_active_member") or 0)),
            "estimated_salary":  float(r.get("estimated_salary") or 0),
            "geography_germany": float(str(r.get("geography") or "").lower() == "germany"),
            "geography_spain":   float(str(r.get("geography") or "").lower() == "spain"),
            "gender_male":       float(str(r.get("gender") or "").lower() == "male"),
        })

    X = pd.DataFrame(records)[FEATURE_COLS]
    X[SCALE_COLS] = scaler.transform(X[SCALE_COLS])

    probs = model.predict_proba(X.values)[:, 1]
    return float((probs >= 0.5).mean())


def _actual_churn_rate(rows) -> float:
    if not rows:
        return 0.2037
    return sum(1 for r in rows if r.get("exited")) / len(rows)


# ── POST /run ─────────────────────────────────────────────────────────────────
@router.post("/run", response_model=SimulationResponse)
async def run_simulation(request: Request, body: SimulationRequest, user=Depends(get_current_user)):
    scenario_key = body.scenario_name
    if scenario_key not in SCENARIOS:
        raise HTTPException(status_code=400, detail=f"Unknown scenario: {scenario_key}. Valid: {list(SCENARIOS.keys())}")

    scenario = SCENARIOS[scenario_key]
    try:
        all_rows = []
        page_size = 1000
        offset = 0
        while True:
            batch = supabase.table("customers").select("*").range(offset, offset + page_size - 1).execute().data or []
            all_rows.extend(batch)
            if len(batch) < page_size:
                break
            offset += page_size
        rows = all_rows
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Unable to reach the database. Please check your Supabase connection. Error: {str(e)}"
        )

    if not rows:
        raise HTTPException(
            status_code=404,
            detail="No customer data found in the database. Please load the customer dataset into the 'customers' table before running simulations."
        )

    model, scaler = _get_model_and_scaler(request)

    # Baseline churn rate
    if model and scaler:
        churn_before = _predict_churn_rate(rows, model, scaler)
    else:
        churn_before = _actual_churn_rate(rows)

    # Apply scenario modifications
    affected = []
    modified_rows = []
    for r in rows:
        if scenario["filter"](r):
            modified = scenario["modifier"](r)
            affected.append(modified)
            modified_rows.append(modified)
        else:
            modified_rows.append(r)

    customers_affected = len(affected)

    # Post-scenario churn rate
    if model and scaler:
        churn_after = _predict_churn_rate(modified_rows, model, scaler)
    else:
        # Heuristic fallback
        churn_after = max(0, churn_before - 0.03 * (customers_affected / len(rows)) * 10)

    # Revenue impact: customers saved × expected annual revenue
    customers_saved  = max(0, (churn_before - churn_after) * len(rows))
    revenue_impact   = round(customers_saved * ANNUAL_REVENUE_PER_CUSTOMER, 2)

    # Log to Supabase (best effort)
    try:
        supabase.table("simulation_logs").insert({
            "scenario_name":      scenario_key,
            "parameters":         {"scenario_label": scenario["label"]},
            "churn_before":       round(churn_before * 100, 2),
            "churn_after":        round(churn_after * 100, 2),
            "customers_affected": customers_affected,
            "revenue_impact":     revenue_impact,
            "run_by":             user.get("id"),
        }).execute()
    except Exception:
        pass

    return SimulationResponse(
        scenario_name=      scenario["label"],
        churn_before=       round(churn_before * 100, 2),
        churn_after=        round(churn_after * 100, 2),
        customers_affected= customers_affected,
        revenue_impact=     revenue_impact,
    )


# ── GET /scenarios ─────────────────────────────────────────────────────────────
@router.get("/scenarios")
async def list_scenarios(_user=Depends(get_current_user)):
    return [
        {"key": k, "label": v["label"], "description": v["description"]}
        for k, v in SCENARIOS.items()
    ]


# ── GET /logs ─────────────────────────────────────────────────────────────────
@router.get("/logs")
async def get_logs(_user=Depends(get_current_user)):
    try:
        resp = supabase.table("simulation_logs").select("*").order("run_at", desc=True).limit(50).execute()
        return resp.data or []
    except Exception:
        return []


