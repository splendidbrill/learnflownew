"""
Subscription Router - User balance and subscription purchase endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db_helpers import db_fetch, db_fetchrow, db_execute, db_fetchval
from db import get_pool

router = APIRouter()

# Credit costs for each tier
TIER_CREDIT_COSTS = {
    "scholar": 200,
    "master": 500,
    "elite": 1000,
}

# --- Models ---

class SubscriptionPurchaseRequest(BaseModel):
    user_id: str
    tier: str  # scholar, master, elite

class UserBalanceResponse(BaseModel):
    credits: int
    subscription_tier: str
    full_name: Optional[str]

# --- Endpoints ---

@router.get("/user/balance/{user_id}")
async def get_user_balance(user_id: str):
    """
    Get user's credit balance and current subscription tier.
    This is a public endpoint (user can only fetch their own data).
    """
    try:
        pool = await get_pool()
        row = await db_fetchrow(
            pool,
            "SELECT credits, subscription_tier, full_name FROM profiles WHERE id = $1",
            user_id
        )

        if not row:
            raise HTTPException(status_code=404, detail="User not found")

        return {
            "credits": row.get("credits", 0) or 0,
            "subscription_tier": row.get("subscription_tier", "explorer"),
            "full_name": row.get("full_name")
        }
    except Exception as e:
        print(f"Error fetching user balance: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch balance")


@router.post("/subscription/purchase")
async def purchase_subscription(req: SubscriptionPurchaseRequest):
    """
    Purchase a subscription tier using credits.
    Validates credit balance, deducts credits, and updates subscription.
    """
    # Validate tier
    if req.tier not in TIER_CREDIT_COSTS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid tier. Must be one of: {list(TIER_CREDIT_COSTS.keys())}"
        )

    credit_cost = TIER_CREDIT_COSTS[req.tier]

    pool = await get_pool()

    # 1. Get current user profile
    profile_row = await db_fetchrow(
        pool,
        "SELECT credits, subscription_tier FROM profiles WHERE id = $1",
        req.user_id
    )

    if not profile_row:
        raise HTTPException(status_code=404, detail="User not found")

    current_credits = profile_row.get("credits", 0) or 0
    current_tier = profile_row.get("subscription_tier", "explorer")

    # 2. Check if user already has this tier or higher
    tier_order = ["explorer", "scholar", "master", "elite"]
    current_tier_index = tier_order.index(current_tier) if current_tier in tier_order else 0
    new_tier_index = tier_order.index(req.tier)

    if new_tier_index <= current_tier_index:
        raise HTTPException(
            status_code=400,
            detail=f"You already have {current_tier.upper()} tier or higher"
        )

    # 3. Check if user has enough credits
    if current_credits < credit_cost:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient credits. Need {credit_cost}, have {current_credits}"
        )

    # 4. Deduct credits and update subscription
    new_credits = current_credits - credit_cost

    await db_execute(
        pool,
        "UPDATE profiles SET credits = $1, subscription_tier = $2 WHERE id = $3",
        new_credits, req.tier, req.user_id
    )

    # 5. Log to credits_ledger
    await db_execute(
        pool,
        """INSERT INTO credits_ledger (user_id, amount, operation, description, granted_by)
           VALUES ($1, $2, $3, $4, $5)""",
        req.user_id, -credit_cost, "purchase",
        f"Purchased {req.tier.upper()} subscription",
        req.user_id  # Self-purchase
    )

    return {
        "status": "success",
        "new_tier": req.tier,
        "credits_spent": credit_cost,
        "remaining_credits": new_credits
    }


@router.get("/subscription/tiers")
async def get_tier_pricing():
    """
    Get credit costs for all subscription tiers.
    """
    return {
        "tiers": [
            {"name": "scholar", "label": "Scholar", "price_usd": 20, "credits": 200},
            {"name": "master", "label": "Master", "price_usd": 49, "credits": 500},
            {"name": "elite", "label": "Elite", "price_usd": 99, "credits": 1000},
        ]
    }
