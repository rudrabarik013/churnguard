"""
Predict router — /api/predict/single and /api/predict/batch
Admin-only endpoints for running ML predictions.
"""
import csv, io
from fastapi import APIRouter, Depends, Request, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from app.models.schemas import SinglePredictionRequest, PredictionResponse
from app.routers.auth import require_admin
from app.ml.predictor import predict_single, predict_batch

router = APIRouter()


def _get_model_scaler(request: Request):
    model = getattr(request.app.state, "model", None)
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="ML model not loaded. Run scripts/train_models.py first."
        )
    import joblib
    from pathlib import Path
    scaler_path = Path(__file__).resolve().parents[2] / "ml_models" / "scaler.joblib"
    if not scaler_path.exists():
        raise HTTPException(status_code=503, detail="Scaler not found. Run training first.")
    return model, joblib.load(scaler_path)


# ── POST /single ──────────────────────────────────────────────────────────────
@router.post("/single", response_model=PredictionResponse)
async def single_prediction(
    request: Request,
    body: SinglePredictionRequest,
    _admin=Depends(require_admin),
):
    model, scaler = _get_model_scaler(request)
    result = predict_single(body.model_dump(), model, scaler)
    return PredictionResponse(**result)


# ── POST /batch (CSV upload) ──────────────────────────────────────────────────
@router.post("/batch")
async def batch_prediction(
    request: Request,
    file: UploadFile = File(...),
    _admin=Depends(require_admin),
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a CSV file")

    model, scaler = _get_model_scaler(request)

    contents = await file.read()
    text     = contents.decode("utf-8")
    reader   = csv.DictReader(io.StringIO(text))

    customers = []
    for row in reader:
        try:
            customers.append({
                "customer_id":     int(row.get("CustomerId") or row.get("customer_id") or 0),
                "credit_score":    int(row.get("CreditScore") or row.get("credit_score") or 0),
                "geography":       row.get("Geography") or row.get("geography") or "",
                "gender":          row.get("Gender") or row.get("gender") or "",
                "age":             int(row.get("Age") or row.get("age") or 0),
                "tenure":          int(row.get("Tenure") or row.get("tenure") or 0),
                "balance":         float(row.get("Balance") or row.get("balance") or 0),
                "num_of_products": int(row.get("NumOfProducts") or row.get("num_of_products") or 1),
                "has_cr_card":     bool(int(row.get("HasCrCard") or row.get("has_cr_card") or 0)),
                "is_active_member":bool(int(row.get("IsActiveMember") or row.get("is_active_member") or 0)),
                "estimated_salary":float(row.get("EstimatedSalary") or row.get("estimated_salary") or 0),
            })
        except (ValueError, KeyError):
            continue

    if not customers:
        raise HTTPException(status_code=400, detail="No valid rows found in CSV")

    results = predict_batch(customers, model, scaler)

    # Return as downloadable CSV
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=[
        "customer_id", "churn_probability", "risk_level", "top_risk_factors", "model_used"
    ])
    writer.writeheader()
    for r in results:
        writer.writerow({
            **r,
            "top_risk_factors": " | ".join(r.get("top_risk_factors", [])),
        })

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=churnguard_predictions.csv"},
    )
