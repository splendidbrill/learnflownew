"""
Review Queue Router - Spaced Repetition System

Tracks concepts users struggled with and schedules reviews.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
from db import supabase
import qrcode
import io
import base64

router = APIRouter()


# --- Models ---

class AddToQueueRequest(BaseModel):
    user_id: str
    concept: str
    paragraph_id: str
    book_id: str
    chapter_id: Optional[str] = None
    failed_explanation: str


class CompleteReviewRequest(BaseModel):
    review_id: str
    user_id: str
    success: bool  # True = "Got it!", False = "Still confused"


class TelegramConnectResponse(BaseModel):
    qr_code_base64: str
    telegram_link: str


# --- Endpoints ---

@router.post("/reviews/add")
async def add_to_review_queue(data: AddToQueueRequest):
    """
    Add a concept to the review queue when user clicks "I don't get it".
    """
    try:
        # Calculate next review date (1 day from now)
        next_review = datetime.now() + timedelta(days=1)
        
        result = supabase.table("review_queue").insert({
            "user_id": data.user_id,
            "concept": data.concept,
            "paragraph_id": data.paragraph_id,
            "book_id": data.book_id,
            "chapter_id": data.chapter_id,
            "failed_explanation": data.failed_explanation,
            "next_review_date": next_review.isoformat(),
            "interval_days": 1,
            "status": "pending"
        }).execute()
        
        print(f"📚 Added to review queue: {data.concept} for user {data.user_id}")
        return {"status": "added", "next_review": next_review.isoformat()}
    except Exception as e:
        print(f"❌ Add to queue error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reviews/queue/{user_id}")
async def get_review_queue(user_id: str):
    """
    Get all pending reviews for a user.
    """
    try:
        # Get all pending reviews (not just due ones, for easier testing)
        result = supabase.table("review_queue").select("*").eq(
            "user_id", user_id
        ).eq(
            "status", "pending"
        ).order("next_review_date").execute()
        
        return {"reviews": result.data or []}
    except Exception as e:
        print(f"❌ Get queue error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reviews/complete")
async def complete_review(data: CompleteReviewRequest):
    """
    Mark a review as complete and schedule next review.
    """
    try:
        if data.success:
            # "Got it!" - extend interval (3 → 7 → 14 → 30 days)
            current = supabase.table("review_queue").select("interval_days, review_count").eq(
                "id", data.review_id
            ).single().execute()
            
            current_interval = current.data.get("interval_days", 3)
            review_count = current.data.get("review_count", 0)
            
            # Double the interval, max 30 days
            new_interval = min(current_interval * 2, 30)
            next_review = datetime.now() + timedelta(days=new_interval)
            
            supabase.table("review_queue").update({
                "interval_days": new_interval,
                "next_review_date": next_review.isoformat(),
                "review_count": review_count + 1,
                "status": "pending"  # Keep in queue
            }).eq("id", data.review_id).execute()
            
            print(f"✅ Review successful: next in {new_interval} days")
            return {"status": "success", "next_review_days": new_interval}
        else:
            # "Still confused" - shorten interval (back to 1 day)
            next_review = datetime.now() + timedelta(days=1)
            
            supabase.table("review_queue").update({
                "interval_days": 1,
                "next_review_date": next_review.isoformat(),
                "status": "pending"
            }).eq("id", data.review_id).execute()
            
            print(f"🔄 Review failed: retry tomorrow")
            return {"status": "retry", "next_review_days": 1}
    except Exception as e:
        print(f"❌ Complete review error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reviews/telegram/qr/{user_id}")
async def generate_telegram_qr(user_id: str):
    """
    Generate QR code for Telegram connection.
    Returns base64 encoded QR code image and direct link.
    """
    try:
        # Create Telegram deep link with user ID
        bot_username = "learnainew_bot"  # User's actual bot
        telegram_link = f"https://t.me/{bot_username}?start={user_id}"
        
        # Generate QR code
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(telegram_link)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        return {
            "qr_code_base64": f"data:image/png;base64,{img_base64}",
            "telegram_link": telegram_link
        }
    except Exception as e:
        print(f"❌ QR generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/reviews/telegram/connect")
async def connect_telegram(user_id: str, chat_id: str):
    """
    Store Telegram chat_id for a user.
    Called by the Telegram bot when user sends /start.
    """
    try:
        supabase.table("profiles").update({
            "telegram_chat_id": chat_id
        }).eq("id", user_id).execute()
        
        print(f"✅ Telegram connected: user {user_id} → chat {chat_id}")
        return {"status": "connected"}
    except Exception as e:
        print(f"❌ Telegram connect error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
