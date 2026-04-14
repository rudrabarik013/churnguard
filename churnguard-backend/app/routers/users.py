"""
Users router — /api/users
Admin-only endpoint for listing Supabase Auth users.
"""
from fastapi import APIRouter, Depends, HTTPException
from app.models.database import supabase
from app.routers.auth import require_admin

router = APIRouter()


@router.get("")
async def list_users(_admin=Depends(require_admin)):
    try:
        resp  = supabase.auth.admin.list_users()
        users = resp if isinstance(resp, list) else getattr(resp, "users", [])
        return [
            {
                "id":         str(u.id),
                "email":      u.email,
                "role":       (u.user_metadata or {}).get("role", "manager"),
                "created_at": str(u.created_at),
            }
            for u in users
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")


@router.delete("/{user_id}")
async def delete_user(user_id: str, _admin=Depends(require_admin)):
    try:
        supabase.auth.admin.delete_user(user_id)
        return {"message": f"User {user_id} deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")
