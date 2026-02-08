"""
Gamification Router - Badges, Levels, XP, Leaderboards
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from db import supabase

router = APIRouter(prefix="/api/gamification", tags=["gamification"])

# Badge definitions
BADGE_CRITERIA = {
    "first_steps": {
        "name": "First Steps",
        "description": "Complete your first paragraph",
        "xp_reward": 10
    },
    "biology_master": {
        "name": "Biology Master",
        "description": "Master 10 biology concepts",
        "xp_reward": 100
    },
    "10_day_streak": {
        "name": "10-Day Streak",
        "description": "Study 10 days in a row",
        "xp_reward": 200
    },
    "night_owl": {
        "name": "Night Owl",
        "description": "Study after 10 PM",
        "xp_reward": 50
    },
    "early_bird": {
        "name": "Early Bird",
        "description": "Study before 6 AM",
        "xp_reward": 50
    },
    "concept_crusher": {
        "name": "Concept Crusher",
        "description": "Click 'Got it!' 50 times",
        "xp_reward": 150
    },
    "test_ace": {
        "name": "Test Ace",
        "description": "Score 90%+ on a test",
        "xp_reward": 100
    },
    "chapter_champion": {
        "name": "Chapter Champion",
        "description": "Complete a full chapter",
        "xp_reward": 75
    }
}

# Level XP thresholds
def calculate_next_level_xp(level: int) -> int:
    """XP needed for next level (exponential growth)"""
    return int(100 * (1.5 ** (level - 1)))


@router.post("/check-badges/{user_id}")
async def check_and_award_badges(user_id: str):
    """
    Check if user earned new badges based on current stats
    """
    # Get user progress from user_progress table
    progress_result = supabase.table("user_progress") \
        .select("*") \
        .eq("user_id", user_id) \
        .eq("is_completed", True) \
        .execute()
    
    completed_count = len(progress_result.data) if progress_result.data else 0
    
    # Get existing badges
    existing_badges = supabase.table("user_badges")\
        .select("badge_type")\
        .eq("user_id", user_id)\
        .execute()
    
    existing_badge_types = {b["badge_type"] for b in (existing_badges.data or [])}
    newly_awarded = []
    
    # Check "first_steps" badge
    if completed_count >= 1 and "first_steps" not in existing_badge_types:
        await award_badge(user_id, "first_steps")
        newly_awarded.append("first_steps")
    
    # Check "chapter_champion" - completed all paragraphs in a chapter
    # (This would need more complex logic checking chapter completion)
    
    return {
        "newly_awarded": newly_awarded,
        "total_badges": len(existing_badge_types) + len(newly_awarded)
    }


async def award_badge(user_id: str, badge_type: str):
    """Award a badge to user and give XP reward"""
    badge_info = BADGE_CRITERIA.get(badge_type)
    if not badge_info:
        return
    
    # Insert badge
    supabase.table("user_badges").insert({
        "user_id": user_id,
        "badge_type": badge_type,
        "badge_name": badge_info["name"],
        "badge_description": badge_info["description"]
    }).execute()
    
    # Award XP
    await add_xp(user_id, badge_info["xp_reward"])


async def add_xp(user_id: str, xp_amount: int):
    """Add XP to user and check for level up"""
    # Get current level
    level_result = supabase.table("user_levels")\
        .select("*")\
        .eq("user_id", user_id)\
        .execute()
    
    if not level_result.data:
        # Create initial level record
        supabase.table("user_levels").insert({
            "user_id": user_id,
            "level": 1,
            "xp": xp_amount,
            "next_level_xp": calculate_next_level_xp(1)
        }).execute()
        return
    
    current = level_result.data[0]
    new_xp = current["xp"] + xp_amount
    current_level = current["level"]
    next_level_xp = current["next_level_xp"]
    
    # Check for level up
    while new_xp >= next_level_xp:
        current_level += 1
        next_level_xp = calculate_next_level_xp(current_level)
    
    # Update user level
    supabase.table("user_levels").update({
        "xp": new_xp,
        "level": current_level,
        "next_level_xp": next_level_xp,
        "updated_at": datetime.now().isoformat()
    }).eq("user_id", user_id).execute()


@router.get("/leaderboard")
async def get_leaderboard(limit: int = 10):
    """Get top performers from materialized view"""
    # Refresh materialized view
    try:
        supabase.rpc("refresh_leaderboard").execute()
    except:
        pass  # Materialized view might not support direct refresh via API
    
    result = supabase.table("leaderboard")\
        .select("*")\
        .limit(limit)\
        .execute()
    
    return result.data or []


@router.get("/user-stats/{user_id}")
async def get_user_stats(user_id: str):
    """Get complete user stats: level, XP, badges, progress"""
    # Get level
    level_result = supabase.table("user_levels")\
        .select("*")\
        .eq("user_id", user_id)\
        .execute()
    
    level_data = level_result.data[0] if level_result.data else {
        "level": 1,
        "xp": 0,
        "next_level_xp": 100
    }
    
    # Get badges
    badges_result = supabase.table("user_badges")\
        .select("*")\
        .eq("user_id", user_id)\
        .execute()
    
    # Get chapter progress
    progress_result = supabase.table("chapter_progress")\
        .select("*")\
        .eq("user_id", user_id)\
        .execute()
    
    return {
        "level": level_data,
        "badges": badges_result.data or [],
        "chapter_progress": progress_result.data or []
    }


@router.post("/award-xp")
async def award_xp_endpoint(user_id: str, xp: int, reason: str):
    """Award XP for various actions (called by other services)"""
    await add_xp(user_id, xp)
    return {"success": True, "xp_awarded": xp}


@router.post("/update-progress/{user_id}/{chapter_id}")
async def update_chapter_progress(
    user_id: str,
    chapter_id: str,
    paragraphs_completed: int,
    total_paragraphs: int,
    mastered_concepts: Optional[int] = 0,
    total_concepts: Optional[int] = 0
):
    """Update chapter completion progress"""
    supabase.table("chapter_progress").upsert({
        "user_id": user_id,
        "chapter_id": chapter_id,
        "paragraphs_completed": paragraphs_completed,
        "total_paragraphs": total_paragraphs,
        "mastered_concepts": mastered_concepts,
        "total_concepts": total_concepts,
        "updated_at": datetime.now().isoformat()
    }, on_conflict="user_id,chapter_id").execute()
    
    # Check if chapter is complete
    if paragraphs_completed >= total_paragraphs:
        # Award chapter completion badge
        await award_badge(user_id, "chapter_champion")
        await add_xp(user_id, 50)  # Bonus XP for completion
    
    return {"success": True}
