"""
Rate Limits Router - Feature usage limits based on subscription tier
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
from db_helpers import db_fetch, db_fetchrow, db_execute, db_fetchval
from db import get_pool

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

async def get_user_tier(pool, user_id: str) -> str:
    """Get user's subscription tier from profiles table."""
    try:
        row = await db_fetchrow(pool, "SELECT subscription_tier FROM profiles WHERE id = $1", user_id)
        if row:
            return row.get("subscription_tier", "explorer") or "explorer"
    except:
        pass
    return "explorer"

async def get_subject_count(pool, user_id: str) -> int:
    """Count user's subjects/courses."""
    try:
        count = await db_fetchval(pool, "SELECT COUNT(*) FROM courses WHERE user_id = $1", user_id)
        return count or 0
    except:
        return 0

async def get_books_this_month(pool, user_id: str) -> int:
    """Count books created this month."""
    try:
        start_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        count = await db_fetchval(
            pool,
            "SELECT COUNT(*) FROM course_books WHERE user_id = $1 AND created_at >= $2",
            user_id, start_of_month.isoformat()
        )
        return count or 0
    except:
        return 0

async def get_diagrams_this_hour(pool, user_id: str) -> int:
    """Count diagram analyses in the last hour."""
    try:
        one_hour_ago = (datetime.now() - timedelta(hours=1)).isoformat()
        count = await db_fetchval(
            pool,
            "SELECT COUNT(*) FROM diagram_usage WHERE user_id = $1 AND created_at >= $2",
            user_id, one_hour_ago
        )
        return count or 0
    except:
        return 0

async def get_diagrams_this_month(pool, user_id: str) -> int:
    """Count diagram analyses this month."""
    try:
        start_of_month = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        count = await db_fetchval(
            pool,
            "SELECT COUNT(*) FROM diagram_usage WHERE user_id = $1 AND created_at >= $2",
            user_id, start_of_month.isoformat()
        )
        return count or 0
    except:
        return 0

async def get_lessons_today(pool, user_id: str) -> int:
    """Count lessons/study sessions today."""
    try:
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        count = await db_fetchval(
            pool,
            "SELECT COUNT(*) FROM study_sessions WHERE user_id = $1 AND created_at >= $2",
            user_id, today_start.isoformat()
        )
        return count or 0
    except:
        return 0

async def get_usage_count(pool, user_id: str, feature: str) -> int:
    """Get current usage count for a feature."""
    if feature == "subjects":
        return await get_subject_count(pool, user_id)
    elif feature == "books_per_month":
        return await get_books_this_month(pool, user_id)
    elif feature == "diagrams_per_hour":
        return await get_diagrams_this_hour(pool, user_id)
    elif feature == "diagrams_per_month":
        return await get_diagrams_this_month(pool, user_id)
    elif feature == "lessons_per_day":
        return await get_lessons_today(pool, user_id)
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

    pool = await get_pool()
    tier = await get_user_tier(pool, req.user_id)
    limits = FEATURE_LIMITS.get(tier, FEATURE_LIMITS["explorer"])
    limit = limits.get(req.feature, 0)

    current_usage = await get_usage_count(pool, req.user_id, req.feature)

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
    pool = await get_pool()
    tier = await get_user_tier(pool, user_id)
    limits = FEATURE_LIMITS.get(tier, FEATURE_LIMITS["explorer"])

    usage = {}
    for feature in FEATURE_NAMES.keys():
        current = await get_usage_count(pool, user_id, feature)
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
        pool = await get_pool()
        await db_execute(
            pool,
            "INSERT INTO diagram_usage (user_id, created_at) VALUES ($1, $2)",
            user_id, datetime.now().isoformat()
        )
        return {"status": "tracked"}
    except Exception as e:
        print(f"Error tracking diagram usage: {e}")
        return {"status": "error", "message": str(e)}
