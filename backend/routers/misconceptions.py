"""
Misconceptions Router - Track student struggles and successful explanations
Uses AWS RDS PostgreSQL (NOT Supabase) for proprietary telemetry data.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db_rds import rds_cursor, init_rds_tables

router = APIRouter()


# --- Models ---

class MisconceptionLog(BaseModel):
    user_id: str
    paragraph_id: str
    concept: str
    failed_analogy: str
    user_interest: str


class SuccessLog(BaseModel):
    concept: str
    user_interest: str
    analogy_text: str


# --- Endpoints ---

@router.post("/misconception/log")
async def log_misconception(data: MisconceptionLog):
    """
    Log when a student says "I don't get it".
    This is the most valuable signal for improving explanations.
    """
    try:
        with rds_cursor() as cursor:
            cursor.execute("""
                INSERT INTO misconception_logs 
                (user_id, paragraph_id, concept, failed_analogy, user_interest)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (
                data.user_id,
                data.paragraph_id,
                data.concept,
                data.failed_analogy,
                data.user_interest
            ))
            result = cursor.fetchone()
        
        print(f"📊 Logged misconception: {data.concept} / {data.user_interest}")
        return {"status": "logged", "id": result["id"] if result else None}
    except Exception as e:
        # RDS might not be available locally - log but don't fail
        print(f"⚠️ Misconception log skipped (RDS unavailable): {e}")
        return {"status": "skipped", "reason": "RDS unavailable locally"}


@router.post("/misconception/success")
async def log_success(data: SuccessLog):
    """
    Log when a student says "Got it!" after an explanation.
    Increments success_count if analogy already exists.
    """
    try:
        with rds_cursor() as cursor:
            # Upsert: increment if exists, insert if not
            cursor.execute("""
                INSERT INTO successful_analogies (concept, user_interest, analogy_text, success_count)
                VALUES (%s, %s, %s, 1)
                ON CONFLICT (concept, user_interest) 
                DO UPDATE SET 
                    success_count = successful_analogies.success_count + 1,
                    analogy_text = EXCLUDED.analogy_text
                RETURNING id, success_count
            """, (data.concept, data.user_interest, data.analogy_text))
            result = cursor.fetchone()
        
        print(f"✅ Logged success: {data.concept} (count: {result['success_count']})")
        return {"status": "logged", "success_count": result["success_count"]}
    except Exception as e:
        # RDS might not be available locally - log but don't fail
        print(f"⚠️ Success log skipped (RDS unavailable): {e}")
        return {"status": "skipped", "reason": "RDS unavailable locally"}


@router.get("/misconception/best/{concept}")
async def get_best_analogy(concept: str, user_interest: Optional[str] = None):
    """
    Get the most successful analogy for a concept.
    If user_interest provided, prioritize that match.
    """
    try:
        with rds_cursor() as cursor:
            if user_interest:
                # Try exact match first
                cursor.execute("""
                    SELECT * FROM successful_analogies 
                    WHERE concept = %s AND user_interest = %s
                    ORDER BY success_count DESC
                    LIMIT 1
                """, (concept, user_interest))
                result = cursor.fetchone()
                
                if result:
                    return dict(result)
            
            # Fall back to any interest with highest success
            cursor.execute("""
                SELECT * FROM successful_analogies 
                WHERE concept = %s
                ORDER BY success_count DESC
                LIMIT 1
            """, (concept,))
            result = cursor.fetchone()
            
            if result:
                return dict(result)
        
        return {"message": "No successful analogies found for this concept"}
    except Exception as e:
        print(f"❌ Best analogy lookup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/misconception/stats")
async def get_misconception_stats():
    """
    Get aggregate stats on misconceptions and successful analogies.
    """
    try:
        with rds_cursor() as cursor:
            cursor.execute("SELECT COUNT(*) as count FROM misconception_logs")
            misconceptions = cursor.fetchone()
            
            cursor.execute("SELECT COUNT(*) as count FROM successful_analogies")
            successes = cursor.fetchone()
        
        return {
            "total_misconceptions": misconceptions["count"] if misconceptions else 0,
            "total_successful_patterns": successes["count"] if successes else 0,
        }
    except Exception as e:
        print(f"❌ Stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/misconception/init")
async def initialize_tables():
    """
    Manually trigger table initialization.
    Only needed if auto-init failed on startup.
    """
    try:
        init_rds_tables()
        return {"status": "initialized"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
