from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# ── Auth Schemas ──────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    role: str = "manager"  # default role is manager

class AuthResponse(BaseModel):
    access_token: str
    role: str
    email: str

# ── Customer Schemas ──────────────────────────────────────────────────────────
class CustomerBase(BaseModel):
    customer_id: int
    row_number: Optional[int] = None
    surname: Optional[str] = None
    credit_score: Optional[int] = None
    geography: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    tenure: Optional[int] = None
    balance: Optional[float] = None
    num_of_products: Optional[int] = None
    has_cr_card: Optional[bool] = None
    is_active_member: Optional[bool] = None
    estimated_salary: Optional[float] = None
    exited: Optional[bool] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerResponse(CustomerBase):
    pass

# ── Prediction Schemas ────────────────────────────────────────────────────────
class SinglePredictionRequest(BaseModel):
    credit_score: int
    geography: str
    gender: str
    age: int
    tenure: int
    balance: float
    num_of_products: int
    has_cr_card: bool
    is_active_member: bool
    estimated_salary: float

class PredictionResponse(BaseModel):
    customer_id: Optional[int] = None
    churn_probability: float
    risk_level: str          # High / Medium / Low
    top_risk_factors: List[str]
    model_used: str

# ── Simulation Schemas ────────────────────────────────────────────────────────
class SimulationRequest(BaseModel):
    scenario_name: str

class SimulationResponse(BaseModel):
    scenario_name: str
    churn_before: float
    churn_after: float
    customers_affected: int
    revenue_impact: float
    precision: Optional[float] = None
    recall: Optional[float] = None

# ── Simulation Log Schema ─────────────────────────────────────────────────────
class SimulationLog(BaseModel):
    log_id: Optional[int] = None
    scenario_name: str
    parameters: Optional[dict] = None
    churn_before: float
    churn_after: float
    customers_affected: int
    revenue_impact: float
    run_by: Optional[str] = None
    run_at: Optional[datetime] = None

# ── User Schema ───────────────────────────────────────────────────────────────
class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    created_at: Optional[datetime] = None

# ── KPI Schema ────────────────────────────────────────────────────────────────
class KPIResponse(BaseModel):
    total_customers: int
    churn_rate: float
    churned_customers: int
    retained_customers: int
    revenue_at_risk: float
    avg_balance_churned: float
    avg_balance_retained: float