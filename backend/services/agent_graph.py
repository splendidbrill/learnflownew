"""
Agent Graph - LangGraph-based multi-step explanation pipeline

This replaces the single-prompt approach with a Fast Chain-of-Thought workflow:
1. Fast Execution: Perform Concept Extraction, Domain Mapping, and Explanation in a single LLM call.
2. Latency: < 3s (Optimized)
"""

import os
from typing import TypedDict, List, Optional
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from dotenv import load_dotenv

load_dotenv()

# --- State Definition ---
class AgentState(TypedDict):
    """State passed between nodes in the graph"""
    # Input
    content: str
    user_interest: str
    context: str
    failed_analogies: List[str]  # Analogies to avoid
    difficulty_level: str  # 'easy', 'medium', or 'hard'
    
    # Parser output
    concepts: List[str]
    dependencies: List[str]
    
    # Personalizer output
    analogy_domains: List[str]
    
    # Strategist output
    candidates: List[dict]  # [{"approach": "Sports", "explanation": "..."}, ...]
    
    # Evaluator output
    best_explanation: str
    reasoning: str


# --- LLM Setup ---
text_base_url = os.getenv("AZURE_TEXT_BASE_URL")
text_api_key = os.getenv("AZURE_TEXT_API_KEY")
text_model_name = os.getenv("AZURE_TEXT_MODEL")

llm = ChatOpenAI(
    model=text_model_name,
    api_key=text_api_key,
    base_url=text_base_url,
    temperature=0.4, # Slightly higher for creativity in one shot
)

# --- Optimized Node: Fast Chain-of-Thought ---
async def fast_explainer_node(state: AgentState) -> AgentState:
    """
    Perform Concept Extraction, Domain Mapping, and Explanation Generation in ONE prompt.
    This reduces latency by 3x.
    """
    print(f"🚀 [Fast Explainer] Generating {state['user_interest']} analogy for: {state['content'][:50]}...")
    
    # 1. Prepare Inputs
    interest = state['user_interest']
    content = state['content']
    
    # 2. Get Difficulty Modifier (Python Logic - Fast)
    from services.adaptive_difficulty import get_explanation_prompt_modifier
    difficulty_modifier = get_explanation_prompt_modifier(
        state.get("difficulty_level", "medium"),
        interest
    )

    # 3. Construct Chain-of-Thought Prompt
    prompt = f"""
    You are an expert tutor specializing in explaining complex topics using relatable analogies.
    
    Original Content:
    "{content[:1500]}"
    
    User's Interest: {interest}
    Context: {state.get('context', '')}
    Difficulty: {state.get('difficulty_level', 'medium')} ({difficulty_modifier})
    
    TASK:
    Generate a high-quality explanation following these steps internally:
    1. Extract Key Concepts (What is the core idea?).
    2. Brainstorm an Analogy specific to '{interest}'.
       (e.g. if interest is 'Cooking', use recipes/ingredients. if 'Football', use players/goals).
    3. Draft the explanation connecting the Concept to the Analogy.
    
    OUTPUT JSON ONLY:
    {{
        "concepts": ["Concept 1", "Concept 2"],
        "analogy_domain_used": "Specific domain (e.g. Baking)",
        "explanation": "The final polished explanation text...",
        "reasoning": "Why this analogy works..."
    }}
    """
    
    try:
        response = await llm.ainvoke([
            SystemMessage(content="You are a Fast Chain-of-Thought Tutor. Think step-by-step, then output JSON."),
            HumanMessage(content=prompt)
        ])
        
        import json
        clean_json = response.content.replace("```json", "").replace("```", "").strip()
        result = json.loads(clean_json)
        
        # Populate State
        state["concepts"] = result.get("concepts", [])
        state["analogy_domains"] = [result.get("analogy_domain_used", interest)]
        state["best_explanation"] = result.get("explanation", "Could not generate explanation.")
        state["reasoning"] = result.get("reasoning", "Generated via Fast Chain-of-Thought")
        
        print(f"   → Generated: {state['best_explanation'][:50]}...")
        
    except Exception as e:
        print(f"   ⚠️ Fast Explainer Error: {e}")
        state["best_explanation"] = "I'm having trouble generating an analogy right now. Please try again."
        state["reasoning"] = "Error in Fast Chain-of-Thought"
        state["concepts"] = ["Error"]
    
    return state


# --- Build the Graph ---
def build_explanation_graph() -> StateGraph:
    """Construct the Optimized LangGraph workflow"""
    
    graph = StateGraph(AgentState)
    
    # Add single node
    graph.add_node("fast_explainer", fast_explainer_node)
    
    # Define edges (Entry -> Explainer -> End)
    graph.set_entry_point("fast_explainer")
    graph.add_edge("fast_explainer", END)
    
    return graph.compile()


# --- Main Entry Point ---
explanation_graph = build_explanation_graph()


async def generate_agentic_explanation(
    content: str, 
    user_interest: str, 
    context: str = "",
    failed_analogies: List[str] = None,
    difficulty_level: str = "medium"
) -> dict:
    """
    Main function to generate an explanation using the optimized pipeline.
    
    Args:
        content: The educational content to explain
        user_interest: User's interest for personalization
        difficulty_level: 'easy', 'medium', or 'hard'
        context: Additional context
        failed_analogies: List of analogies to avoid (from misconception logs)
    
    Returns:
        {"explanation": str, "concepts": list, "reasoning": str}
    """
    print("\n" + "="*50)
    print("🚀 FAST AGENTIC PIPELINE STARTED")
    print("="*50)
    
    initial_state: AgentState = {
        "content": content,
        "user_interest": user_interest,
        "context": context,
        "failed_analogies": failed_analogies or [],
        "difficulty_level": difficulty_level,
        "concepts": [],
        "dependencies": [],
        "analogy_domains": [],
        "candidates": [],
        "best_explanation": "",
        "reasoning": "",
    }
    
    result = await explanation_graph.ainvoke(initial_state)
    
    print("="*50)
    print("✅ PIPELINE COMPLETE (Optimized)")
    print("="*50 + "\n")
    
    return {
        "explanation": result["best_explanation"],
        "concepts": result.get("concepts", []),
        "reasoning": result.get("reasoning", ""),
    }
