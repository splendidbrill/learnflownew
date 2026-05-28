from fastapi import APIRouter
from pydantic import BaseModel
from datetime import datetime, timedelta
from db_helpers import db_fetch, db_fetchrow, db_execute, db_fetchval
from db import get_pool

router = APIRouter()

class StatsResponse(BaseModel):
    xp: int
    streak: int
    level: int
    rank: str
    total_hours: float

@router.post("/stats/checkin/{user_id}")
async def check_in_streak(user_id: str):
    """
    Updates the user's streak based on their last visit.
    Logic:
    - If last_visit is today: Do nothing.
    - If last_visit is yesterday: Increment streak.
    - If last_visit is older: Reset streak to 1.
    - Always update last_visit to now.
    """
    now = datetime.now()
    today_str = now.date().isoformat()

    pool = await get_pool()

    # 1. Get current profile data
    row = await db_fetchrow(
        pool,
        "SELECT streak, last_visit FROM profiles WHERE id = $1",
        user_id
    )

    if not row:
        # Create profile if missing (shouldn't happen for logged in user usually, but safe fallback)
        # Assuming triggers handle profile creation, but if not:
        return {"status": "profile_not_found"}

    current_streak = row.get("streak", 0) or 0
    last_visit_str = row.get("last_visit")

    # Defaults
    new_streak = 1

    if last_visit_str:
        # Parse last_visit (handle potential Z or offset)
        try:
            # Simple date comparison
            last_visit_date = datetime.fromisoformat(str(last_visit_str).replace('Z', '+00:00')).date()
            current_date = now.date()

            diff = (current_date - last_visit_date).days

            if diff == 0:
                # Already visited today
                # FIX: If streak is 0 for some reason (e.g. first run logic fail), bump to 1
                if current_streak == 0:
                    new_streak = 1
                    # Fall through to update DB
                else:
                    return {"status": "already_checked_in", "streak": current_streak}
            elif diff == 1:
                # Visited yesterday, increment
                new_streak = current_streak + 1
            else:
                # Broken streak
                new_streak = 1
        except Exception as e:
            print(f"Error parsing date: {e}")
            new_streak = 1
    else:
        # First visit ever
        new_streak = 1

    # 2. Update DB
    await db_execute(
        pool,
        "UPDATE profiles SET streak = $1, last_visit = $2 WHERE id = $3",
        new_streak, now.isoformat(), user_id
    )

    return {"status": "updated", "streak": new_streak}

@router.get("/stats/{user_id}", response_model=StatsResponse)
async def get_user_stats(user_id: str):
    pool = await get_pool()

    # --- 1. XP CALCULATION ---
    # Paragraphs: 10 XP each
    para_count = await db_fetchval(
        pool,
        "SELECT COUNT(*) FROM paragraphs WHERE is_completed = TRUE"
    ) or 0

    # Sessions: 50 XP each
    sess_count = await db_fetchval(
        pool,
        "SELECT COUNT(*) FROM study_sessions WHERE user_id = $1 AND status = $2",
        user_id, "confirmed"
    ) or 0

    total_xp = (para_count * 10) + (sess_count * 50)

    # --- 2. STREAK (Now from Profiles) ---
    streak = 0
    try:
        prof_row = await db_fetchrow(pool, "SELECT streak FROM profiles WHERE id = $1", user_id)
        if prof_row:
            streak = prof_row.get("streak", 0) or 0
    except Exception as e:
        print(f"Error fetching streak: {e}")

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
