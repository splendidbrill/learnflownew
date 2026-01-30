"""
Payment Router - Razorpay integration for subscription payments
Security: Uses HMAC-SHA256 signature verification - only backend can validate payments
"""

import os
import hmac
import hashlib
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import razorpay
from db import supabase

router = APIRouter()

# Initialize Razorpay client
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_TEST_KEY_ID")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_TEST_KEY_SECRET")

if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET:
    client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    print(f"✅ Razorpay initialized (Key: {RAZORPAY_KEY_ID[:12]}...)")
else:
    client = None
    print("⚠️ Razorpay keys not configured")

# Pricing in INR (paise - 100 paise = 1 rupee)
TIER_PRICES_INR = {
    "explorer": 0,       # Free tier
    "scholar": 170000,   # ₹1,700 = 170000 paise
    "master": 420000,    # ₹4,200 = 420000 paise
    "elite": 840000,     # ₹8,400 = 840000 paise
}

TIER_LABELS = {
    "explorer": "Explorer (Free)",
    "scholar": "Scholar Plan",
    "master": "Master Plan",
    "elite": "Elite Plan",
}

TIER_ORDER = ["explorer", "scholar", "master", "elite"]

# --- Models ---

class CreateOrderRequest(BaseModel):
    user_id: str
    tier: str  # scholar, master, elite

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    user_id: str
    tier: str

# --- Endpoints ---

@router.post("/payment/create-order")
async def create_order(req: CreateOrderRequest):
    """
    Create a Razorpay order for subscription upgrade.
    Calculates pro-rata pricing (pay the difference only).
    """
    if not client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    
    if req.tier not in TIER_PRICES_INR or req.tier == "explorer":
        raise HTTPException(status_code=400, detail=f"Invalid tier: {req.tier}")
    
    # Get user info
    user_res = supabase.table("profiles").select("email, full_name, subscription_tier").eq("id", req.user_id).single().execute()
    
    if not user_res.data:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_tier = user_res.data.get("subscription_tier", "explorer")
    
    # Check for downgrade (not allowed)
    current_idx = TIER_ORDER.index(current_tier)
    target_idx = TIER_ORDER.index(req.tier)
    
    if target_idx <= current_idx:
        raise HTTPException(status_code=400, detail=f"Cannot downgrade. You already have {current_tier.upper()} tier or higher")
    
    # Check for pending payments for same tier (prevent double payment)
    pending_res = supabase.table("payments").select("id").eq("user_id", req.user_id).eq("tier", req.tier).eq("status", "pending").execute()
    
    if pending_res.data and len(pending_res.data) > 0:
        raise HTTPException(status_code=400, detail="You already have a pending payment for this tier. Please complete or cancel it first.")
    
    # Calculate pro-rata upgrade price (pay the difference)
    current_price = TIER_PRICES_INR.get(current_tier, 0)
    target_price = TIER_PRICES_INR[req.tier]
    upgrade_amount = target_price - current_price
    
    if upgrade_amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid upgrade amount")
    
    # Create Razorpay order
    try:
        upgrade_desc = f"Upgrade: {TIER_LABELS.get(current_tier, current_tier)} → {TIER_LABELS[req.tier]}"
        
        order_data = {
            "amount": upgrade_amount,
            "currency": "INR",
            "receipt": f"upg_{req.user_id[:8]}_{req.tier}",
            "notes": {
                "user_id": req.user_id,
                "tier": req.tier,
                "from_tier": current_tier,
                "description": upgrade_desc
            }
        }
        
        order = client.order.create(data=order_data)
        
        # Store pending order in database
        supabase.table("payments").insert({
            "user_id": req.user_id,
            "razorpay_order_id": order["id"],
            "amount": upgrade_amount,
            "currency": "INR",
            "tier": req.tier,
            "status": "pending"
        }).execute()
        
        return {
            "order_id": order["id"],
            "amount": upgrade_amount,
            "full_amount": target_price,  # Full price for display
            "upgrade_from": current_tier,
            "currency": "INR",
            "key_id": RAZORPAY_KEY_ID,
            "name": "LearnFlow",
            "description": upgrade_desc,
            "prefill": {
                "name": user_res.data.get("full_name", ""),
                "email": user_res.data.get("email", "")
            }
        }
        
    except Exception as e:
        print(f"❌ Razorpay order creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create payment order")


@router.post("/payment/verify")
async def verify_payment(req: VerifyPaymentRequest):
    """
    Verify Razorpay payment signature and upgrade subscription.
    
    SECURITY: This uses HMAC-SHA256 signature verification.
    The signature is created by Razorpay using YOUR secret key.
    Only this backend (with the secret) can verify it - cannot be forged.
    """
    if not client:
        raise HTTPException(status_code=500, detail="Payment gateway not configured")
    
    # 1. Verify signature using HMAC-SHA256
    # Signature = HMAC-SHA256(order_id + "|" + payment_id, secret)
    message = f"{req.razorpay_order_id}|{req.razorpay_payment_id}"
    expected_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    
    if expected_signature != req.razorpay_signature:
        print(f"❌ Signature mismatch! Expected: {expected_signature[:20]}..., Got: {req.razorpay_signature[:20]}...")
        
        # Update payment status to failed
        supabase.table("payments").update({
            "status": "signature_failed"
        }).eq("razorpay_order_id", req.razorpay_order_id).execute()
        
        raise HTTPException(status_code=400, detail="Payment verification failed - invalid signature")
    
    # 2. Verify order exists and is pending
    payment_res = supabase.table("payments").select("*").eq("razorpay_order_id", req.razorpay_order_id).single().execute()
    
    if not payment_res.data:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if payment_res.data.get("status") == "paid":
        return {"status": "already_processed", "tier": payment_res.data.get("tier")}
    
    # 3. Update payment record
    supabase.table("payments").update({
        "razorpay_payment_id": req.razorpay_payment_id,
        "status": "paid",
        "paid_at": datetime.now().isoformat()
    }).eq("razorpay_order_id", req.razorpay_order_id).execute()
    
    # 4. Upgrade user subscription
    supabase.table("profiles").update({
        "subscription_tier": req.tier
    }).eq("id", req.user_id).execute()
    
    # 5. Log to credits_ledger for audit (non-critical, don't fail payment if this fails)
    amount_inr = payment_res.data.get("amount", 0) / 100  # Convert paise to rupees
    try:
        supabase.table("credits_ledger").insert({
            "user_id": req.user_id,
            "amount": 0,
            "operation": "purchase",
            "description": f"Razorpay: Paid ₹{amount_inr:.0f} for {req.tier.upper()} subscription",
            "granted_by": req.user_id
        }).execute()
    except Exception as ledger_err:
        print(f"⚠️ Credits ledger logging failed (non-critical): {ledger_err}")
    
    print(f"✅ Payment verified! User {req.user_id[:8]}... upgraded to {req.tier}")
    
    return {
        "status": "success",
        "message": f"Successfully upgraded to {req.tier.upper()}!",
        "tier": req.tier
    }


@router.get("/payment/config")
async def get_payment_config():
    """
    Get Razorpay public config for frontend.
    Only returns the public key, never the secret.
    """
    return {
        "key_id": RAZORPAY_KEY_ID,
        "currency": "INR",
        "tiers": {
            tier: {
                "amount": amount,
                "amount_display": f"₹{amount // 100:,}",
                "label": TIER_LABELS[tier]
            }
            for tier, amount in TIER_PRICES_INR.items()
        }
    }
