"""
Tests Router - AI Test Generation and Grading
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime
from db import supabase
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
    # Check completion requirement (5 paragraphs minimum)
    progress_result = supabase.table("user_progress") \
        .select("id") \
        .eq("user_id", req.user_id) \
        .eq("book_id", req.book_id) \
        .eq("is_completed", True) \
        .execute()
    
    completed_count = len(progress_result.data) if progress_result.data else 0
    
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
        session_result = supabase.table("test_sessions").insert({
            "user_id": req.user_id,
            "book_id": req.book_id,
            "chapter_id": req.chapter_id,
            "total_questions": len(questions),
            "created_at": datetime.now().isoformat()
        }).execute()
        
        session_id = session_result.data[0]["id"]
        
        # Save questions to database
        question_records = []
        for q in questions:
            question_records.append({
                "session_id": session_id,
                "question_text": q["question_text"],
                "question_type": q["question_type"],
                "correct_answer": q["correct_answer"],
                "concept": q.get("concept", "general"),
                "options": q.get("options", [])
            })
        
        supabase.table("test_questions").insert(question_records).execute()
        
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
        # Grade the test
        results = await grade_test(req.session_id, req.answers)
        
        # Update test session with results
        supabase.table("test_sessions").update({
            "score": results["score"],
            "correct_answers": results["correct"],
            "weak_concepts": results["weak_concepts"]
        }).eq("id", req.session_id).execute()
        
        # Get session to find user_id and book_id
        session_result = supabase.table("test_sessions") \
            .select("user_id, book_id") \
            .eq("id", req.session_id) \
            .execute()
        
        if session_result.data:
            user_id = session_result.data[0]["user_id"]
            book_id = session_result.data[0]["book_id"]
            
            #Add weak concepts to review queue
            for concept in results["weak_concepts"]:
                try:
                    supabase.table("review_queue").insert({
                        "user_id": user_id,
                        "book_id": book_id,
                        "concept": concept,
                        "explanation": f"Review needed based on test performance",
                        "next_review": datetime.now().isoformat(),
                        "interval_days": 1,
                        "review_count": 0
                    }).execute()
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
    result = supabase.table("test_sessions") \
        .select("*") \
        .eq("user_id", user_id) \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()
    
    return result.data or []


@router.get("/session/{session_id}")
async def get_test_session_details(session_id: str):
    """Get detailed results for a specific test session"""
    # Get session info
    session_result = supabase.table("test_sessions") \
        .select("*") \
        .eq("id", session_id) \
        .execute()
    
    if not session_result.data:
        raise HTTPException(404, "Test session not found")
    
    # Get questions and answers
    questions_result = supabase.table("test_questions") \
        .select("*") \
        .eq("session_id", session_id) \
        .execute()
    
    return {
        "session": session_result.data[0],
        "questions": questions_result.data or []
    }
