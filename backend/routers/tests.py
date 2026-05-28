"""
Tests Router - AI Test Generation and Grading
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime
from db_helpers import db_fetch, db_fetchrow, db_execute, db_fetchval
from db import get_pool
from services.test_generator import generate_test_questions
from services.test_grader import grade_test

router = APIRouter(prefix="/api/tests", tags=["tests"])


class GenerateTestRequest(BaseModel):
    book_id: str
    user_id: str
    chapter_id: Optional[str] = None


class SubmitTestRequest(BaseModel):
    session_id: str
    answers: List[Dict]  # [{"question_id": "...", "answer": "..."}]


@router.post("/generate")
async def generate_test(req: GenerateTestRequest):
    """
    Generate AI test for book/chapter

    Requirements:
    - User must have completed at least 5 paragraphs
    - Generates 15 questions (MCQ, T/F, short answer)
    - Prioritizes concepts from user's weak areas
    """
    pool = await get_pool()

    # Check completion requirement (5 paragraphs minimum)
    progress_rows = await db_fetch(
        pool,
        "SELECT id FROM user_progress WHERE user_id = $1 AND book_id = $2 AND is_completed = TRUE",
        req.user_id, req.book_id
    )

    completed_count = len(progress_rows) if progress_rows else 0

    if completed_count < 5:
        raise HTTPException(
            status_code=400,
            detail=f"You must complete at least 5 paragraphs before taking a test. Currently completed: {completed_count}"
        )

    # Generate questions
    try:
        questions = await generate_test_questions(
            book_id=req.book_id,
            user_id=req.user_id,
            chapter_id=req.chapter_id,
            count=15
        )

        if not questions:
            raise HTTPException(500, "Failed to generate questions. Please try again.")

        # Create test session
        session_row = await db_fetchrow(
            pool,
            """INSERT INTO test_sessions (user_id, book_id, chapter_id, total_questions, created_at)
               VALUES ($1, $2, $3, $4, $5) RETURNING *""",
            req.user_id, req.book_id, req.chapter_id, len(questions), datetime.now().isoformat()
        )

        session_id = session_row["id"]

        # Save questions to database
        for q in questions:
            await db_execute(
                pool,
                """INSERT INTO test_questions (session_id, question_text, question_type, correct_answer, concept, options)
                   VALUES ($1, $2, $3, $4, $5, $6)""",
                session_id,
                q["question_text"],
                q["question_type"],
                q["correct_answer"],
                q.get("concept", "general"),
                q.get("options", [])
            )

        # Return questions (without correct answers for security)
        public_questions = []
        for q in questions:
            public_q = {
                "question_text": q["question_text"],
                "question_type": q["question_type"],
                "options": q.get("options", [])
            }
            public_questions.append(public_q)

        return {
            "session_id": session_id,
            "questions": public_questions,
            "total_questions": len(questions)
        }

    except Exception as e:
        print(f"❌ Test generation error: {e}")
        raise HTTPException(500, f"Test generation failed: {str(e)}")


@router.post("/submit")
async def submit_test(req: SubmitTestRequest):
    """
    Grade test and provide feedback

    Returns:
    - Overall score
    - Concept breakdown (which concepts user struggled with)
    - Weak concepts
    - Recommendations for review
    """
    try:
        pool = await get_pool()

        # Grade the test
        results = await grade_test(req.session_id, req.answers)

        # Update test session with results
        await db_execute(
            pool,
            "UPDATE test_sessions SET score = $1, correct_answers = $2, weak_concepts = $3 WHERE id = $4",
            results["score"], results["correct"], results["weak_concepts"], req.session_id
        )

        # Get session to find user_id and book_id
        session_row = await db_fetchrow(
            pool,
            "SELECT user_id, book_id FROM test_sessions WHERE id = $1",
            req.session_id
        )

        if session_row:
            user_id = session_row["user_id"]
            book_id = session_row["book_id"]

            #Add weak concepts to review queue
            for concept in results["weak_concepts"]:
                try:
                    await db_execute(
                        pool,
                        """INSERT INTO review_queue (user_id, book_id, concept, explanation, next_review, interval_days, review_count)
                           VALUES ($1, $2, $3, $4, $5, $6, $7)""",
                        user_id, book_id, concept,
                        "Review needed based on test performance",
                        datetime.now().isoformat(), 1, 0
                    )
                except:
                    pass  # Might already exist

            # Award XP for taking test
            from routers.gamification import add_xp, award_badge
            await add_xp(user_id, 30)  # Base XP for completing test

            # Check for "Test Ace" badge (90%+)
            if results["score"] >= 90:
                await award_badge(user_id, "test_ace")

        return {
            "score": results["score"],
            "correct": results["correct"],
            "total": results["total"],
            "concept_breakdown": results["concept_breakdown"],
            "weak_concepts": results["weak_concepts"],
            "recommendations": results["recommendations"],
            "question_results": results.get("question_results", [])
        }

    except Exception as e:
        print(f"❌ Test grading error: {e}")
        raise HTTPException(500, f"Test grading failed: {str(e)}")


@router.get("/history/{user_id}")
async def get_test_history(user_id: str, limit: int = 10):
    """Get user's test history"""
    pool = await get_pool()
    rows = await db_fetch(
        pool,
        "SELECT * FROM test_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2",
        user_id, limit
    )
    return [dict(r) for r in rows] if rows else []


@router.get("/session/{session_id}")
async def get_test_session_details(session_id: str):
    """Get detailed results for a specific test session"""
    pool = await get_pool()

    # Get session info
    session_row = await db_fetchrow(
        pool,
        "SELECT * FROM test_sessions WHERE id = $1",
        session_id
    )

    if not session_row:
        raise HTTPException(404, "Test session not found")

    # Get questions and answers
    questions_rows = await db_fetch(
        pool,
        "SELECT * FROM test_questions WHERE session_id = $1",
        session_id
    )

    return {
        "session": dict(session_row),
        "questions": [dict(r) for r in questions_rows] if questions_rows else []
    }
