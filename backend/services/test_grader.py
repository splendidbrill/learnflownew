"""
Test Grader Service - AI-powered test grading
"""

from typing import List, Dict, Optional
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from db_helpers import db_fetch, db_fetchrow, db_execute, db_fetchval
from db import get_pool
import os

# Initialize LLM
text_base_url = os.getenv("AZURE_TEXT_BASE_URL")
text_api_key = os.getenv("AZURE_TEXT_API_KEY")
text_model_name = os.getenv("AZURE_TEXT_MODEL")

llm = ChatOpenAI(
    model=text_model_name,
    api_key=text_api_key,
    base_url=text_base_url,
    temperature=0.3,
)


async def grade_test(session_id: str, user_answers: List[Dict]) -> Dict:
    """
    Grade test using direct comparison for MCQ/T-F and LLM for short answers

    Args:
        session_id: Test session ID
        user_answers: List of {question_id, answer}

    Returns:
        {
            "score": 85.5,
            "correct": 10,
            "total": 15,
            "concept_breakdown": {"photosynthesis": {"correct": 2, "total": 3}},
            "weak_concepts": ["photosynthesis"],
            "recommendations": "Review photosynthesis..."
        }
    """
    pool = await get_pool()

    # Get questions from session
    questions_list = await db_fetch(
        pool,
        "SELECT * FROM test_questions WHERE session_id = $1",
        session_id
    )

    if not questions_list:
        raise ValueError("No questions found for session")

    results = {
        "correct": 0,
        "total": len(questions_list),
        "concept_breakdown": {},
        "weak_concepts": [],
        "question_results": []
    }

    # Grade each question
    for q, ans in zip(questions_list, user_answers):
        question_type = q["question_type"]
        concept = q.get("concept", "general")

        if question_type in ["mcq", "true_false"]:
            # Direct string comparison
            is_correct = ans["answer"].strip() == q["correct_answer"].strip()
        else:
            # Use LLM to grade short answer
            is_correct = await grade_short_answer(q, ans["answer"])

        # Update question record with user's answer
        await db_execute(
            pool,
            "UPDATE test_questions SET user_answer = $1, is_correct = $2 WHERE id = $3",
            ans["answer"],
            is_correct,
            q["id"]
        )

        # Track by concept
        if concept not in results["concept_breakdown"]:
            results["concept_breakdown"][concept] = {"correct": 0, "total": 0}

        results["concept_breakdown"][concept]["total"] += 1
        if is_correct:
            results["correct"] += 1
            results["concept_breakdown"][concept]["correct"] += 1

        results["question_results"].append({
            "question_id": q["id"],
            "is_correct": is_correct,
            "concept": concept
        })

    # Calculate score
    results["score"] = (results["correct"] / results["total"]) * 100 if results["total"] > 0 else 0

    # Identify weak concepts (< 60% accuracy)
    for concept, stats in results["concept_breakdown"].items():
        accuracy = stats["correct"] / stats["total"] if stats["total"] > 0 else 0
        if accuracy < 0.6:
            results["weak_concepts"].append(concept)

    # Generate recommendations
    if results["weak_concepts"]:
        results["recommendations"] = f"Review: {', '.join(results['weak_concepts'][:3])}"
    else:
        results["recommendations"] = "Great job! You've mastered this material."

    return {
        "score": results["score"],
        "correct": results["correct"],
        "total": results["total"],
        "concept_breakdown": results["concept_breakdown"],
        "weak_concepts": results["weak_concepts"],
        "recommendations": results["recommendations"],
        "question_results": results["question_results"]
    }


async def grade_short_answer(question: Dict, user_answer: str) -> bool:
    """
    Use LLM to grade a short answer question

    Returns True if answer is acceptable, False otherwise
    """
    correct_answer = question.get("correct_answer", "")
    key_points = question.get("options", {})  # Stored as JSONB in options field

    if isinstance(key_points, dict):
        key_points = key_points.get("key_points", [])

    prompt = f"""
You are grading a short-answer test question.

QUESTION: {question['question_text']}

MODEL ANSWER: {correct_answer}

KEY POINTS TO CHECK: {', '.join(key_points) if key_points else 'N/A'}

STUDENT'S ANSWER: {user_answer}

Evaluate if the student's answer demonstrates understanding of the concept.
The answer doesn't need to be word-for-word identical, but should cover the key ideas.

Return ONLY valid JSON:
{{
  "is_correct": true,
  "feedback": "Brief explanation of why it's correct/incorrect"
}}
"""

    try:
        response = await llm.ainvoke([
            SystemMessage(content="You are a fair and accurate test grader. Return ONLY valid JSON."),
            HumanMessage(content=prompt)
        ])

        import json
        content = response.content.strip()
        # Remove markdown if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        content = content.strip()

        result = json.loads(content)
        return result.get("is_correct", False)

    except Exception as e:
        print(f"❌ Short answer grading failed: {e}")
        # Fallback: simple keyword matching
        return any(keyword.lower() in user_answer.lower() for keyword in correct_answer.split()[:5])
