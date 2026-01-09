from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime, timedelta
from db import supabase

router = APIRouter()

class StatsResponse(BaseModel):
    xp: int
    streak: int
    level: int
    rank: str
    total_hours: float

@router.get("/stats/{user_id}", response_model=StatsResponse)
async def get_user_stats(user_id: str):
    # --- 1. XP CALCULATION ---
    # Paragraphs: 10 XP each
    para_res = supabase.table("paragraphs")\
        .select("id", count="exact")\
        .eq("is_completed", True)\
        .execute() # Note: In real app, join with user_progress if tracking multi-user on same book rows
        
    # We need to count paragraphs completed BY THIS USER.
    # Since your 'paragraphs' table handles completion per row (MVP style), 
    # we assume for now the book is unique to the user or you use a 'user_progress' table.
    # If using 'user_progress':
    prog_res = supabase.table("paragraphs").select("*", count="exact").eq("is_completed", True).execute()
    # For MVP (assuming you are updating paragraphs directly):
    para_count = prog_res.count or 0
    
    # Sessions: 50 XP each
    sess_res = supabase.table("study_sessions").select("id", count="exact").eq("user_id", user_id).eq("status", "confirmed").execute()
    sess_count = sess_res.count or 0

    total_xp = (para_count * 10) + (sess_count * 50)

    # --- 2. STREAK CALCULATION ---
    # Get all confirmed dates
    dates_res = supabase.table("study_sessions")\
        .select("scheduled_at")\
        .eq("user_id", user_id)\
        .eq("status", "confirmed")\
        .order("scheduled_at", desc=True)\
        .execute()

    confirmed_dates = set()
    for item in dates_res.data:
        dt = datetime.fromisoformat(item['scheduled_at'].replace('Z', '+00:00'))
        confirmed_dates.add(dt.date())

    # Count backwards from today
    streak = 0
    check_date = datetime.now().date()
    
    # Allow missing 'today' if they studied yesterday
    if check_date not in confirmed_dates:
        if (check_date - timedelta(days=1)) in confirmed_dates:
            check_date -= timedelta(days=1)
        else:
            check_date = None # Streak broken/not started

    if check_date:
        while check_date in confirmed_dates:
            streak += 1
            check_date -= timedelta(days=1)

    # --- 3. RANKS ---
    level = int((total_xp ** 0.5) // 5) + 1
    rank = "Novice"
    if level > 5: rank = "Apprentice"
    if level > 10: rank = "Scholar"
    if level > 25: rank = "Master"

    return {
        "xp": total_xp,
        "streak": streak,
        "level": level,
        "rank": rank,
        "total_hours": round((para_count * 5) / 60, 1) # Avg 5 mins per paragraph
    }