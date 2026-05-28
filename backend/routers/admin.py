"""
Admin Router - Founder Control Panel API
Only accessible by splendidbrill@gmail.com (is_ultimate = true)
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from db_helpers import db_fetch, db_fetchrow, db_execute, db_fetchval
from db import get_pool
import os

router = APIRouter()

# Founder email from environment variable
FOUNDER_EMAIL = os.getenv("FOUNDER_EMAIL", "splendidbrill@gmail.com")

# --- Models ---

class UserSearchResult(BaseModel):
    id: str
    email: str
    full_name: Optional[str]
    subscription_tier: str
    credits: int
    is_ultimate: bool

class CreditOperation(BaseModel):
    user_id: str
    amount: int
    description: Optional[str] = None

class SubscriptionChange(BaseModel):
    user_id: str
    new_tier: str  # explorer, scholar, master, elite

class LedgerEntry(BaseModel):
    id: str
    amount: int
    operation: str
    description: Optional[str]
    created_at: str

# --- Helper: Verify Founder ---

async def verify_founder(admin_user_id: str):
    """Check if the requesting user is the founder"""
    pool = await get_pool()
    row = await db_fetchrow(pool, "SELECT is_ultimate FROM profiles WHERE id = $1", admin_user_id)

    if not row or not row.get("is_ultimate"):
        raise HTTPException(status_code=403, detail="Access denied. Founder privileges required.")

    return True

# --- Endpoints ---

@router.get("/admin/users")
async def search_users(email: str, admin_id: str):
    """
    Search users by email (partial match).
    Only founder can access this endpoint.
    Uses Supabase Admin API to list users.
    """
    await verify_founder(admin_id)

    if len(email) < 2:
        return []

    # Use Supabase Admin API to list users and filter by email
    # The service role key gives us access to auth.admin
    try:
        from db import supabase
        # List all users (limited)
        auth_response = supabase.auth.admin.list_users()

        pool = await get_pool()

        # Filter users by email pattern
        matching_users = []
        for auth_user in auth_response:
            if email.lower() in auth_user.email.lower():
                # Get profile data for this user
                profile_row = await db_fetchrow(
                    pool,
                    "SELECT full_name, subscription_tier, credits, is_ultimate, xp FROM profiles WHERE id = $1",
                    auth_user.id
                )

                profile = dict(profile_row) if profile_row else {}
                matching_users.append({
                    "id": auth_user.id,
                    "email": auth_user.email,
                    "full_name": profile.get("full_name"),
                    "subscription_tier": profile.get("subscription_tier", "explorer"),
                    "credits": profile.get("credits", 0) or 0,
                    "is_ultimate": profile.get("is_ultimate", False)
                })

                if len(matching_users) >= 10:
                    break

        return matching_users

    except Exception as e:
        print(f"Admin user search error: {e}")
        # Fallback: return empty if admin API fails
        return []


@router.get("/admin/user/{user_id}")
async def get_user_details(user_id: str, admin_id: str):
    """Get detailed user info including credit balance and subscription"""
    await verify_founder(admin_id)

    pool = await get_pool()

    # Get profile data
    profile_row = await db_fetchrow(
        pool,
        "SELECT id, full_name, subscription_tier, credits, is_ultimate, xp, streak FROM profiles WHERE id = $1",
        user_id
    )

    if not profile_row:
        raise HTTPException(status_code=404, detail="User not found")

    return dict(profile_row)


@router.post("/admin/credits/grant")
async def grant_credits(req: CreditOperation, admin_id: str):
    """
    Grant credits to a user.
    Only founder can perform this action.
    """
    await verify_founder(admin_id)

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    pool = await get_pool()

    # 1. Get current credits
    profile_row = await db_fetchrow(pool, "SELECT credits FROM profiles WHERE id = $1", req.user_id)

    if not profile_row:
        raise HTTPException(status_code=404, detail="User not found")

    current_credits = profile_row.get("credits", 0) or 0
    new_credits = current_credits + req.amount

    # 2. Update profile credits
    await db_execute(pool, "UPDATE profiles SET credits = $1 WHERE id = $2", new_credits, req.user_id)

    # 3. Log to ledger
    await db_execute(
        pool,
        """INSERT INTO credits_ledger (user_id, amount, operation, description, granted_by)
           VALUES ($1, $2, $3, $4, $5)""",
        req.user_id, req.amount, "grant",
        req.description or "Granted by founder",
        admin_id
    )

    return {
        "status": "success",
        "new_balance": new_credits,
        "granted": req.amount
    }


@router.post("/admin/credits/revoke")
async def revoke_credits(req: CreditOperation, admin_id: str):
    """
    Revoke credits from a user.
    Only founder can perform this action.
    """
    await verify_founder(admin_id)

    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    pool = await get_pool()

    # 1. Get current credits
    profile_row = await db_fetchrow(pool, "SELECT credits FROM profiles WHERE id = $1", req.user_id)

    if not profile_row:
        raise HTTPException(status_code=404, detail="User not found")

    current_credits = profile_row.get("credits", 0) or 0
    new_credits = max(0, current_credits - req.amount)  # Don't go negative

    # 2. Update profile credits
    await db_execute(pool, "UPDATE profiles SET credits = $1 WHERE id = $2", new_credits, req.user_id)

    # 3. Log to ledger
    await db_execute(
        pool,
        """INSERT INTO credits_ledger (user_id, amount, operation, description, granted_by)
           VALUES ($1, $2, $3, $4, $5)""",
        req.user_id, -req.amount, "revoke",
        req.description or "Revoked by founder",
        admin_id
    )

    return {
        "status": "success",
        "new_balance": new_credits,
        "revoked": req.amount
    }


@router.post("/admin/subscription/change")
async def change_subscription(req: SubscriptionChange, admin_id: str):
    """
    Change a user's subscription tier.
    Only founder can perform this action.
    """
    await verify_founder(admin_id)

    valid_tiers = ["explorer", "scholar", "master", "elite"]
    if req.new_tier not in valid_tiers:
        raise HTTPException(status_code=400, detail=f"Invalid tier. Must be one of: {valid_tiers}")

    pool = await get_pool()

    # Update subscription
    await db_execute(
        pool,
        "UPDATE profiles SET subscription_tier = $1 WHERE id = $2",
        req.new_tier, req.user_id
    )

    # Log to ledger as a special entry
    await db_execute(
        pool,
        """INSERT INTO credits_ledger (user_id, amount, operation, description, granted_by)
           VALUES ($1, $2, $3, $4, $5)""",
        req.user_id, 0, "grant",
        f"Subscription changed to {req.new_tier.upper()} by founder",
        admin_id
    )

    return {
        "status": "success",
        "new_tier": req.new_tier
    }


@router.get("/admin/ledger/{user_id}")
async def get_user_ledger(user_id: str, admin_id: str, limit: int = 20):
    """
    Get credit ledger history for a user.
    Only founder can access this.
    """
    await verify_founder(admin_id)

    pool = await get_pool()
    rows = await db_fetch(
        pool,
        """SELECT id, amount, operation, description, created_at
           FROM credits_ledger WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2""",
        user_id, limit
    )

    return [dict(r) for r in rows] if rows else []


@router.get("/admin/all-users")
async def get_all_users(admin_id: str, limit: int = 50):
    """
    Get all users with their subscription info.
    Only founder can access this.
    """
    await verify_founder(admin_id)

    pool = await get_pool()
    rows = await db_fetch(
        pool,
        "SELECT id, full_name, subscription_tier, credits, is_ultimate, xp FROM profiles LIMIT $1",
        limit
    )

    return [dict(r) for r in rows] if rows else []
