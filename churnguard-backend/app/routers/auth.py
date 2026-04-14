"""
Auth router — /api/auth/login, /api/auth/register, /api/auth/me
Uses Supabase Auth for authentication and role management.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.models.database import supabase, supabase_anon
from app.models.schemas import LoginRequest, RegisterRequest, AuthResponse

router = APIRouter()
security = HTTPBearer()


# ── Dependency: get current user from JWT ─────────────────────────────────────
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        user_resp = supabase.auth.get_user(token)
        user = user_resp.user
        role = (user.user_metadata or {}).get("role", "manager")
        return {"id": str(user.id), "email": user.email, "role": role, "token": token}
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


# ── POST /login ───────────────────────────────────────────────────────────────
@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    try:
        resp    = supabase_anon.auth.sign_in_with_password({"email": body.email, "password": body.password})
        session = resp.session
        user    = resp.user
        if not session:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        role = (user.user_metadata or {}).get("role", "manager")
        return AuthResponse(access_token=session.access_token, role=role, email=user.email)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Login failed: {str(e)}")


# ── POST /register ────────────────────────────────────────────────────────────
@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterRequest):
    if body.role not in ("admin", "manager"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'manager'")
    try:
        resp = supabase.auth.admin.create_user({
            "email":         body.email,
            "password":      body.password,
            "user_metadata": {"role": body.role},
            "email_confirm": True,
        })
        user = resp.user
        login_resp = supabase_anon.auth.sign_in_with_password({"email": body.email, "password": body.password})
        session = login_resp.session
        return AuthResponse(access_token=session.access_token, role=body.role, email=user.email)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Registration failed: {str(e)}")


# ── GET /me ───────────────────────────────────────────────────────────────────
@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return {"id": current_user["id"], "email": current_user["email"], "role": current_user["role"]}
