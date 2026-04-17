from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import joblib
import os

from app.routers import auth, metrics, dashboard, retention, simulation, predict, users

# ── Lifespan: load ML model once at startup ──────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load best model into app state
    model_path = "ml_models/best_model.joblib"
    if os.path.exists(model_path):
        app.state.model = joblib.load(model_path)
        print("✅ ML model loaded successfully")
    else:
        app.state.model = None
        print("⚠️  No ML model found. Train first using scripts/train_models.py")
    yield
    print("🔴 Shutting down ChurnGuard API")

# ── App Init ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="ChurnGuard API",
    description="Customer Churn Prediction & Retention Intelligence Platform",
    version="3.0.0",
    lifespan=lifespan
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",       # Vite dev server
        "https://*.vercel.app",        # Vercel deployment
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,       prefix="/api/auth",        tags=["Auth"])
app.include_router(metrics.router,    prefix="/api/metrics",     tags=["Metrics"])
app.include_router(dashboard.router,  prefix="/api/dashboard",   tags=["Dashboard"])
app.include_router(retention.router,  prefix="/api/retention",   tags=["Retention"])
app.include_router(simulation.router, prefix="/api/simulation",  tags=["Simulation"])
app.include_router(predict.router,    prefix="/api/predict",     tags=["Predict"])
app.include_router(users.router,      prefix="/api/users",       tags=["Users"])

# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["Health"])
async def health_check():
    return {
        "status": "online",
        "version": "3.0.0",
        "model_loaded": app.state.model is not None
    }

# ── Root ──────────────────────────────────────────────────────────────────────
@app.get("/", tags=["Root"])
async def root():
    return {"message": "Welcome to ChurnGuard API. Visit /docs for API reference."}