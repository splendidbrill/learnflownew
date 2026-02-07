"""
Misconception Query Service

Queries RDS database for successful analogies and failed attempts
to improve future explanations.
"""

from db_rds import rds_cursor
from typing import Optional, List, Dict


def get_best_analogy(concept: str, user_interest: str) -> Optional[Dict]:
    """
    Get the best-performing analogy for a concept + interest pair.
    Returns None if no proven analogy exists (success_count < 3).
    """
    try:
        with rds_cursor() as cursor:
            cursor.execute("""
                SELECT analogy_text, success_count
                FROM successful_analogies
                WHERE concept = %s AND user_interest = %s
                AND success_count >= 3
                ORDER BY success_count DESC
                LIMIT 1
            """, (concept, user_interest))
            
            result = cursor.fetchone()
            if result:
                return {
                    "analogy": result["analogy_text"],
                    "success_count": result["success_count"]
                }
            return None
    except Exception as e:
        print(f"⚠️ Best analogy query failed: {e}")
        return None


def get_failed_analogies(concept: str, user_interest: str) -> List[str]:
    """
    Get list of analogies that previously failed for this concept + interest.
    Used to avoid repeating mistakes.
    """
    try:
        with rds_cursor() as cursor:
            cursor.execute("""
                SELECT DISTINCT failed_analogy
                FROM misconception_logs
                WHERE concept = %s AND user_interest = %s
                AND failed_analogy IS NOT NULL
                LIMIT 10
            """, (concept, user_interest))
            
            results = cursor.fetchall()
            return [row["failed_analogy"] for row in results]
    except Exception as e:
        print(f"⚠️ Failed analogies query failed: {e}")
        return []


def should_use_cached_analogy(concept: str, user_interest: str) -> bool:
    """
    Quick check if a proven analogy exists.
    """
    return get_best_analogy(concept, user_interest) is not None


def log_cached_analogy_usage(concept: str, user_interest: str):
    """
    Log when we use a cached analogy (for analytics).
    """
    try:
        with rds_cursor() as cursor:
            cursor.execute("""
                UPDATE successful_analogies
                SET last_used = NOW()
                WHERE concept = %s AND user_interest = %s
            """, (concept, user_interest))
        print(f"📊 Cached analogy used: {concept} / {user_interest}")
    except Exception as e:
        print(f"⚠️ Cache usage log failed: {e}")
