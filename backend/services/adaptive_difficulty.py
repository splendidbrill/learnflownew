"""
Adaptive Difficulty Service - Adjust content difficulty based on user performance
"""

from typing import Dict, Optional
from db import supabase


def calculate_difficulty_adjustment(got_it_ratio: float) -> str:
    """
    Determine difficulty level based on success ratio
    
    - > 80% success: increase difficulty (use advanced concepts)
    - 50-80%: maintain current level
    - < 50%: decrease difficulty (simpler language, more examples)
    """
    if got_it_ratio > 0.8:
        return "increase"
    elif got_it_ratio < 0.5:
        return "decrease"
    return "maintain"


def get_difficulty_level_for_user(user_id: str, chapter_id: Optional[str] = None) -> str:
    """
    Get current difficulty level for user in a chapter
    Returns: 'easy', 'medium', or 'hard'
    """
    if not chapter_id:
        return "medium"  # Default
    
    try:
        result = supabase.table("difficulty_tracking") \
            .select("difficulty_level") \
            .eq("user_id", user_id) \
            .eq("chapter_id", chapter_id) \
            .execute()
        
        if result.data:
            return result.data[0]["difficulty_level"]
        return "medium"
        
    except Exception as e:
        print(f"⚠️ Could not fetch difficulty level: {e}")
        return "medium"


def update_difficulty_tracking(
    user_id: str,
    chapter_id: str,
    got_it: bool,
    subject: str = "general"
):
    """
    Update difficulty tracking after each "Got it!" or "I don't get it" click
    """
    try:
        # Get current tracking
        result = supabase.table("difficulty_tracking") \
            .select("*") \
            .eq("user_id", user_id) \
            .eq("chapter_id", chapter_id) \
            .execute()
        
        if result.data:
            # Update existing
            current = result.data[0]
            new_got_it = current["got_it_count"] + (1 if got_it else 0)
            new_confused = current["confused_count"] + (0 if got_it else 1)
            total = new_got_it + new_confused
            ratio = new_got_it / total if total > 0 else 0.5
            
            # Determine new difficulty
            adjustment = calculate_difficulty_adjustment(ratio)
            current_level = current["difficulty_level"]
            
            if adjustment == "increase" and current_level == "medium":
                new_level = "hard"
            elif adjustment == "increase" and current_level == "easy":
                new_level = "medium"
            elif adjustment == "decrease" and current_level == "hard":
                new_level = "medium"
            elif adjustment == "decrease" and current_level == "medium":
                new_level = "easy"
            else:
                new_level = current_level
            
            supabase.table("difficulty_tracking").update({
                "got_it_count": new_got_it,
                "confused_count": new_confused,
                "difficulty_level": new_level,
                "last_updated": "now()"
            }).eq("user_id", user_id).eq("chapter_id", chapter_id).execute()
            
        else:
            # Create new
            supabase.table("difficulty_tracking").insert({
                "user_id": user_id,
                "chapter_id": chapter_id,
                "subject": subject,
                "got_it_count": 1 if got_it else 0,
                "confused_count": 0 if got_it else 1,
                "difficulty_level": "medium"
            }).execute()
            
    except Exception as e:
        print(f"⚠️ Difficulty tracking update failed: {e}")


def get_explanation_prompt_modifier(difficulty_level: str, user_interest: str) -> str:
    """
    Return prompt addition based on difficulty level
    This will be injected into the Strategist node in agent_graph
    """
    modifiers = {
        "easy": f"""
DIFFICULTY LEVEL: EASY
- Use very simple language (avoid technical jargon)
- Add 3-4 {user_interest} analogies to make concepts concrete
- Break down complex ideas into smaller steps
- Include examples for each key point
""",
        "medium": f"""
DIFFICULTY LEVEL: MEDIUM
- Balance depth with clarity
- Use 1-2 {user_interest} analogies for key concepts
- Standard technical terminology is acceptable
""",
        "hard": f"""
DIFFICULTY LEVEL: ADVANCED
- Use advanced terminology and concepts
- Focus on nuanced details and edge cases
- Minimal analogies (user can handle abstract concepts)
- Assume strong foundational knowledge
"""
    }
    
    return modifiers.get(difficulty_level, modifiers["medium"])
