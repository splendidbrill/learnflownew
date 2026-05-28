"""
Gamification Router - Badges, Levels, XP, Leaderboards
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from db_helpers import db_fetch, db_fetchrow, db_execute, db_fetchval
from db import get_pool

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
    pool = await get_pool()

    # Get user progress from user_progress table
    progress_rows = await db_fetch(
        pool,
        "SELECT * FROM user_progress WHERE user_id = $1 AND is_completed = TRUE",
        user_id
    )

    completed_count = len(progress_rows) if progress_rows else 0

    # Get existing badges
    existing_badge_rows = await db_fetch(
        pool,
        "SELECT badge_type FROM user_badges WHERE user_id = $1",
        user_id
    )

    existing_badge_types = {b["badge_type"] for b in (existing_badge_rows or [])}
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

    pool = await get_pool()

    # Insert badge
    await db_execute(
        pool,
        """INSERT INTO user_badges (user_id, badge_type, badge_name, badge_description)
           VALUES ($1, $2, $3, $4)""",
        user_id, badge_type, badge_info["name"], badge_info["description"]
    )

    # Award XP
    await add_xp(user_id, badge_info["xp_reward"])


async def add_xp(user_id: str, xp_amount: int):
    """Add XP to user and check for level up"""
    pool = await get_pool()

    # Get current level
    level_rows = await db_fetch(
        pool,
        "SELECT * FROM user_levels WHERE user_id = $1",
        user_id
    )

    if not level_rows:
        # Create initial level record
        await db_execute(
            pool,
            """INSERT INTO user_levels (user_id, level, xp, next_level_xp)
               VALUES ($1, $2, $3, $4)""",
            user_id, 1, xp_amount, calculate_next_level_xp(1)
        )
        return

    current = level_rows[0]
    new_xp = current["xp"] + xp_amount
    current_level = current["level"]
    next_level_xp = current["next_level_xp"]

    # Check for level up
    while new_xp >= next_level_xp:
        current_level += 1
        next_level_xp = calculate_next_level_xp(current_level)

    # Update user level
    await db_execute(
        pool,
        """UPDATE user_levels
           SET xp = $1, level = $2, next_level_xp = $3, updated_at = $4
           WHERE user_id = $5""",
        new_xp, current_level, next_level_xp, datetime.now().isoformat(), user_id
    )


@router.get("/leaderboard")
async def get_leaderboard(limit: int = 10):
    """Get top performers from materialized view"""
    pool = await get_pool()

    # Refresh materialized view
    try:
        await db_execute(pool, "REFRESH MATERIALIZED VIEW leaderboard")
    except:
        pass  # Materialized view might not support direct refresh or might not exist

    rows = await db_fetch(
        pool,
        "SELECT * FROM leaderboard LIMIT $1",
        limit
    )

    return [dict(r) for r in rows] if rows else []


@router.get("/user-stats/{user_id}")
async def get_user_stats(user_id: str):
    """Get complete user stats: level, XP, badges, progress"""
    pool = await get_pool()

    # Get level
    level_rows = await db_fetch(
        pool,
        "SELECT * FROM user_levels WHERE user_id = $1",
        user_id
    )

    level_data = dict(level_rows[0]) if level_rows else {
        "level": 1,
        "xp": 0,
        "next_level_xp": 100
    }

    # Get badges
    badges_rows = await db_fetch(
        pool,
        "SELECT * FROM user_badges WHERE user_id = $1",
        user_id
    )

    # Get chapter progress
    progress_rows = await db_fetch(
        pool,
        "SELECT * FROM chapter_progress WHERE user_id = $1",
        user_id
    )

    return {
        "level": level_data,
        "badges": [dict(r) for r in badges_rows] if badges_rows else [],
        "chapter_progress": [dict(r) for r in progress_rows] if progress_rows else []
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
    pool = await get_pool()

    # Upsert: insert or update on conflict of (user_id, chapter_id)
    await db_execute(
        pool,
        """INSERT INTO chapter_progress
               (user_id, chapter_id, paragraphs_completed, total_paragraphs, mastered_concepts, total_concepts, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, chapter_id) DO UPDATE
               SET paragraphs_completed = EXCLUDED.paragraphs_completed,
                   total_paragraphs = EXCLUDED.total_paragraphs,
                   mastered_concepts = EXCLUDED.mastered_concepts,
                   total_concepts = EXCLUDED.total_concepts,
                   updated_at = EXCLUDED.updated_at""",
        user_id, chapter_id, paragraphs_completed, total_paragraphs,
        mastered_concepts, total_concepts, datetime.now().isoformat()
    )

    # Check if chapter is complete
    if paragraphs_completed >= total_paragraphs:
        # Award chapter completion badge
        await award_badge(user_id, "chapter_champion")
        await add_xp(user_id, 50)  # Bonus XP for completion

    return {"success": True}
