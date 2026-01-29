"""
Rate Limits Router - Feature usage limits based on subscription tier
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from db import supabase

router = APIRouter()

# Feature limits per tier (-1 = unlimited)
FEATURE_LIMITS = {
    "explorer": {
        "subjects": 2,
        "books_per_month": 10,
        "diagrams_per_hour": 3,
        "diagrams_per_month": 50,
        "lessons_per_day": 3
    },
    "scholar": {
        "subjects": 5,
        "books_per_month": 100,
        "diagrams_per_hour": 15,
        "diagrams_per_month": 450,
        "lessons_per_day": 10
    },
    "master": {
        "subjects": -1,
        "books_per_month": 220,
        "diagrams_per_hour": -1,
        "diagrams_per_month": 1000,
        "lessons_per_day": -1
    },
    "elite": {
        "subjects": -1,
        "books_per_month": 450,
        "diagrams_per_hour": -1,
        "diagrams_per_month": -1,
        "lessons_per_day": -1
    }
}

# Human-readable feature names
FEATURE_NAMES = {
    "subjects": "Subject Profiles",
    "books_per_month": "Books per Month",
    "diagrams_per_hour": "Diagrams per Hour",
    "diagrams_per_month": "Diagrams per Month",
    "lessons_per_day": "Lessons per Day"
}

# --- Models ---

class RateLimitCheckRequest(BaseModel):
    user_id: str
    feature: str  # subjects, books_per_month, diagrams_per_hour, etc.

class RateLimitCheckResponse(BaseModel):
    can_use: bool
    current_usage: int
    limit: int
    feature_name: str
    tier: str

# --- Helper Functions ---

def get_user_tier(user_id: str) -> str:
    """Get user's subscription tier from profiles table."""
    try:
        res = supabase.table("profiles").select("subscription_tier").eq("id", user_id).single().execute()
        if res.data:
            return res.data.get("subscription_tier", "explorer") or "explorer"
    except:
        pass
    return "explorer"

def get_subject_count(user_id: str) -> int:
    """Count user's subjects/courses."""
    try:
        res = supabase.table("courses").select("id", count="exact").eq("user_id", user_id).execute()
        return res.count or 0
    except:
        return 0

def get_books_this_month(user_id: str) -> int:
    """Count books created this month."""
    try:
        start_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        res = supabase.table("course_books").select("id", count="exact").eq("user_id", user_id).gte("created_at", start_of_month.isoformat()).execute()
        return res.count or 0
    except:
        return 0

def get_diagrams_this_hour(user_id: str) -> int:
    """Count diagram analyses in the last hour."""
    try:
        one_hour_ago = (datetime.now() - timedelta(hours=1)).isoformat()
        res = supabase.table("diagram_usage").select("id", count="exact").eq("user_id", user_id).gte("created_at", one_hour_ago).execute()
        return res.count or 0
    except:
        return 0

def get_diagrams_this_month(user_id: str) -> int:
    """Count diagram analyses this month."""
    try:
        start_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        res = supabase.table("diagram_usage").select("id", count="exact").eq("user_id", user_id).gte("created_at", start_of_month.isoformat()).execute()
        return res.count or 0
    except:
        return 0

def get_lessons_today(user_id: str) -> int:
    """Count lessons/study sessions today."""
    try:
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        res = supabase.table("study_sessions").select("id", count="exact").eq("user_id", user_id).gte("created_at", today_start.isoformat()).execute()
        return res.count or 0
    except:
        return 0

def get_usage_count(user_id: str, feature: str) -> int:
    """Get current usage count for a feature."""
    if feature == "subjects":
        return get_subject_count(user_id)
    elif feature == "books_per_month":
        return get_books_this_month(user_id)
    elif feature == "diagrams_per_hour":
        return get_diagrams_this_hour(user_id)
    elif feature == "diagrams_per_month":
        return get_diagrams_this_month(user_id)
    elif feature == "lessons_per_day":
        return get_lessons_today(user_id)
    return 0

# --- Endpoints ---

@router.post("/rate-limit/check")
async def check_rate_limit(req: RateLimitCheckRequest) -> RateLimitCheckResponse:
    """
    Check if user can use a specific feature based on their tier limits.
    Returns current usage, limit, and whether they can proceed.
    """
    if req.feature not in FEATURE_NAMES:
        raise HTTPException(status_code=400, detail=f"Invalid feature. Must be one of: {list(FEATURE_NAMES.keys())}")
    
    tier = get_user_tier(req.user_id)
    limits = FEATURE_LIMITS.get(tier, FEATURE_LIMITS["explorer"])
    limit = limits.get(req.feature, 0)
    
    current_usage = get_usage_count(req.user_id, req.feature)
    
    # -1 means unlimited
    can_use = limit == -1 or current_usage < limit
    
    return RateLimitCheckResponse(
        can_use=can_use,
        current_usage=current_usage,
        limit=limit,
        feature_name=FEATURE_NAMES[req.feature],
        tier=tier
    )

@router.get("/rate-limit/usage/{user_id}")
async def get_all_usage(user_id: str):
    """
    Get all usage counts for a user across all features.
    Useful for displaying usage dashboard.
    """
    tier = get_user_tier(user_id)
    limits = FEATURE_LIMITS.get(tier, FEATURE_LIMITS["explorer"])
    
    usage = {}
    for feature in FEATURE_NAMES.keys():
        current = get_usage_count(user_id, feature)
        limit = limits.get(feature, 0)
        usage[feature] = {
            "current": current,
            "limit": limit,
            "feature_name": FEATURE_NAMES[feature],
            "can_use": limit == -1 or current < limit,
            "is_unlimited": limit == -1
        }
    
    return {
        "tier": tier,
        "usage": usage
    }

@router.get("/rate-limit/limits")
async def get_all_limits():
    """
    Get feature limits for all tiers.
    Useful for displaying pricing comparison.
    """
    return {
        "limits": FEATURE_LIMITS,
        "feature_names": FEATURE_NAMES
    }

@router.post("/rate-limit/track-diagram/{user_id}")
async def track_diagram_usage(user_id: str):
    """
    Track a diagram analysis event.
    Call this when user analyzes a diagram.
    """
    try:
        supabase.table("diagram_usage").insert({
            "user_id": user_id,
            "created_at": datetime.now().isoformat()
        }).execute()
        return {"status": "tracked"}
    except Exception as e:
        print(f"Error tracking diagram usage: {e}")
        return {"status": "error", "message": str(e)}
