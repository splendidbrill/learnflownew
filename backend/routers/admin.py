"""
Admin Router - Founder Control Panel API
Only accessible by splendidbrill@gmail.com (is_ultimate = true)
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from db import supabase
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
    res = supabase.table("profiles").select("is_ultimate").eq("id", admin_user_id).single().execute()
    
    if not res.data or not res.data.get("is_ultimate"):
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
        # List all users (limited)
        auth_response = supabase.auth.admin.list_users()
        
        # Filter users by email pattern
        matching_users = []
        for auth_user in auth_response:
            if email.lower() in auth_user.email.lower():
                # Get profile data for this user
                profile_res = supabase.table("profiles").select(
                    "full_name, subscription_tier, credits, is_ultimate, xp"
                ).eq("id", auth_user.id).single().execute()
                
                profile = profile_res.data or {}
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
    
    # Get profile data
    profile_res = supabase.table("profiles").select(
        "id, full_name, subscription_tier, credits, is_ultimate, xp, streak"
    ).eq("id", user_id).single().execute()
    
    if not profile_res.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    return profile_res.data


@router.post("/admin/credits/grant")
async def grant_credits(req: CreditOperation, admin_id: str):
    """
    Grant credits to a user.
    Only founder can perform this action.
    """
    await verify_founder(admin_id)
    
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    
    # 1. Get current credits
    profile_res = supabase.table("profiles").select("credits").eq("id", req.user_id).single().execute()
    
    if not profile_res.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_credits = profile_res.data.get("credits", 0) or 0
    new_credits = current_credits + req.amount
    
    # 2. Update profile credits
    supabase.table("profiles").update({"credits": new_credits}).eq("id", req.user_id).execute()
    
    # 3. Log to ledger
    supabase.table("credits_ledger").insert({
        "user_id": req.user_id,
        "amount": req.amount,
        "operation": "grant",
        "description": req.description or f"Granted by founder",
        "granted_by": admin_id
    }).execute()
    
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
    
    # 1. Get current credits
    profile_res = supabase.table("profiles").select("credits").eq("id", req.user_id).single().execute()
    
    if not profile_res.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_credits = profile_res.data.get("credits", 0) or 0
    new_credits = max(0, current_credits - req.amount)  # Don't go negative
    
    # 2. Update profile credits
    supabase.table("profiles").update({"credits": new_credits}).eq("id", req.user_id).execute()
    
    # 3. Log to ledger
    supabase.table("credits_ledger").insert({
        "user_id": req.user_id,
        "amount": -req.amount,
        "operation": "revoke",
        "description": req.description or f"Revoked by founder",
        "granted_by": admin_id
    }).execute()
    
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
    
    # Update subscription
    res = supabase.table("profiles").update({
        "subscription_tier": req.new_tier
    }).eq("id", req.user_id).execute()
    
    # Log to ledger as a special entry
    supabase.table("credits_ledger").insert({
        "user_id": req.user_id,
        "amount": 0,
        "operation": "grant",
        "description": f"Subscription changed to {req.new_tier.upper()} by founder",
        "granted_by": admin_id
    }).execute()
    
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
    
    res = supabase.table("credits_ledger").select(
        "id, amount, operation, description, created_at"
    ).eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()
    
    return res.data or []


@router.get("/admin/all-users")
async def get_all_users(admin_id: str, limit: int = 50):
    """
    Get all users with their subscription info.
    Only founder can access this.
    """
    await verify_founder(admin_id)
    
    res = supabase.table("profiles").select(
        "id, full_name, subscription_tier, credits, is_ultimate, xp"
    ).limit(limit).execute()
    
    return res.data or []
