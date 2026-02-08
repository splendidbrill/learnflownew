"""
Test Generation Service - AI-powered test question generation
"""

import random
from typing import List, Dict, Optional
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from db import supabase
import os

# Initialize LLM
text_base_url = os.getenv("AZURE_TEXT_BASE_URL")
text_api_key = os.getenv("AZURE_TEXT_API_KEY")
text_model_name = os.getenv("AZURE_TEXT_MODEL")

llm = ChatOpenAI(
    model=text_model_name,
    api_key=text_api_key,
    base_url=text_base_url,
    temperature=0.7,
)


async def generate_test_questions(
    book_id: str,
    user_id: str,
    chapter_id: Optional[str] = None,
    count: int = 15
) -> List[Dict]:
    """
    Generate diverse test questions using LLM
    
    Process:
    1. Get book content + concepts
    2. Get user's misconception history
    3. Weight questions towards weak areas (60% weak, 40% strong)
    4. Mix question types (50% MCQ, 30% T/F, 20% short answer)
    5. Generate using LLM
    """
    # Get user's weak concepts from misconception logs
    weak_concepts = await get_user_weak_concepts(user_id, book_id)
    
    # Get all concepts from book paragraphs (only completed ones)
    all_concepts = await extract_concepts_from_book(book_id, user_id, chapter_id)
    
    if not all_concepts:
        # Fallback: generate generic questions
        all_concepts = ["general concept 1", "general concept 2", "general concept 3"]
    
    # Calculate distribution
    num_weak = min(int(count * 0.6), len(weak_concepts))
    num_general = count - num_weak
    
    questions = []
    
    # Generate questions from weak concepts (60%)
    for concept in weak_concepts[:num_weak]:
        question_type = _get_random_question_type()
        q = await generate_single_question(concept, question_type, "hard")
        if q:
            questions.append(q)
    
    # Generate questions from general concepts (40%)
    for concept in random.sample(all_concepts, min(num_general, len(all_concepts))):
        question_type = _get_random_question_type()
        q = await generate_single_question(concept, question_type, "medium")
        if q:
            questions.append(q)
    
    # Shuffle and limit
    random.shuffle(questions)
    return questions[:count]


def _get_random_question_type() -> str:
    """Randomly select question type based on distribution"""
    rand = random.random()
    if rand < 0.5:
        return "mcq"
    elif rand < 0.8:
        return "true_false"
    else:
        return "short_answer"


async def generate_single_question(
    concept: str,
    question_type: str,
    difficulty: str
) -> Optional[Dict]:
    """
    Generate a single question for a concept using LLM
    """
    if question_type == "mcq":
        prompt = f"""
Generate a multiple-choice question about '{concept}' at {difficulty} difficulty level.

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{{
  "question_text": "What is the primary function of {concept}?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_answer": "Option B",
  "explanation": "Brief explanation why Option B is correct"
}}

Make sure the question is clear, accurate, and at {difficulty} difficulty.
"""
    
    elif question_type == "true_false":
        prompt = f"""
Generate a true/false question about '{concept}' at {difficulty} difficulty level.

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{{
  "question_text": "{concept} is responsible for...",
  "correct_answer": "True",
  "explanation": "Brief explanation"
}}

The answer must be either "True" or "False".
"""
    
    else:  # short_answer
        prompt = f"""
Generate a short-answer question about '{concept}' at {difficulty} difficulty level.

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{{
  "question_text": "Explain the role of {concept} in...",
  "correct_answer": "A brief model answer (2-3 sentences)",
  "key_points": ["key point 1", "key point 2"]
}}
"""
    
    try:
        response = await llm.ainvoke([
            SystemMessage(content="You are an expert test question generator. Return ONLY valid JSON."),
            HumanMessage(content=prompt)
        ])
        
        import json
        # Clean up response
        content = response.content.strip()
        # Remove markdown code blocks if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        content = content.strip()
        
        question_data = json.loads(content)
        question_data["question_type"] = question_type
        question_data["concept"] = concept
        
        # Add options for T/F if not present
        if question_type == "true_false" and "options" not in question_data:
            question_data["options"] = ["True", "False"]
        
        return question_data
        
    except Exception as e:
        print(f"❌ Question generation failed for {concept}: {e}")
        return None


async def get_user_weak_concepts(user_id: str, book_id: str) -> List[str]:
    """
    Get concepts user struggled with from review queue and misconceptions
    """
    weak = []
    
    # From review queue (confused concepts)
    try:
        result = supabase.table("review_queue") \
            .select("concept") \
            .eq("user_id", user_id) \
            .eq("book_id", book_id) \
            .execute()
        
        if result.data:
            weak.extend([r["concept"] for r in result.data])
    except Exception as e:
        print(f"⚠️ Could not fetch weak concepts: {e}")
    
    return list(set(weak))  # Remove duplicates


async def extract_concepts_from_book(book_id: str, user_id: str, chapter_id: Optional[str] = None) -> List[str]:
    """
    Extract concepts from COMPLETED book paragraphs only
    """
    try:
        # First, get all completed paragraph IDs for this user in this book
        progress_result = supabase.table("user_progress") \
            .select("current_block_id") \
            .eq("user_id", user_id) \
            .eq("book_id", book_id) \
            .eq("is_completed", True) \
            .execute()
        
        if not progress_result.data:
            print(f"⚠️ No completed paragraphs found for user {user_id} in book {book_id}")
            return []
        
        completed_paragraph_ids = [p["current_block_id"] for p in progress_result.data]
        print(f"✅ Found {len(completed_paragraph_ids)} completed paragraphs")
        
        # If specific chapter requested, get its paragraphs and filter to completed ones
        if chapter_id:
            query = supabase.table("paragraphs") \
                .select("content, section_title") \
                .eq("chapter_id", chapter_id) \
                .in_("id", completed_paragraph_ids) \
                .limit(20).execute()
        else:
            # Get all chapters for this book first
            chapters_result = supabase.table("chapters") \
                .select("id") \
                .eq("book_id", book_id) \
                .execute()
            
            if not chapters_result.data:
                return []
            
            # Get paragraphs from all chapters, filtered to completed ones only
            chapter_ids = [c["id"] for c in chapters_result.data]
            query = supabase.table("paragraphs") \
                .select("content, section_title") \
                .in_("chapter_id", chapter_ids) \
                .in_("id", completed_paragraph_ids) \
                .limit(20).execute()
        
        if not query.data:
            return []
        
        # Extract concepts from content and section titles
        concepts = []
        for para in query.data:
            # Prefer section titles as concepts
            if para.get("section_title"):
                concepts.append(para["section_title"])
            else:
                # Fall back to first sentence of content
                content = para["content"][:100]
                if len(content) > 10:
                    concepts.append(content)
        
        return list(set(concepts))[:15]  # Deduplicate and limit for test generation
        
    except Exception as e:
        print(f"⚠️ Could not extract concepts: {e}")
        return []
