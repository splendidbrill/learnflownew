"""
Agent Graph - LangGraph-based multi-step explanation pipeline

This replaces the single-prompt approach with a 4-node workflow:
1. Parser: Extract concepts from content
2. Personalizer: Map concepts to interest-based analogy domains
3. Strategist: Generate 3 candidate explanations
4. Evaluator: Grade and select the best explanation
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
    temperature=0.3,
)

llm_creative = ChatOpenAI(
    model=text_model_name,
    api_key=text_api_key,
    base_url=text_base_url,
    temperature=0.7,
)


# --- Node 1: Parser ---
async def parser_node(state: AgentState) -> AgentState:
    """Extract core concepts and dependencies from the content"""
    print("🔍 [Parser] Extracting concepts...")
    
    prompt = f"""
    Analyze this educational content and extract the key concepts.
    
    CONTENT:
    {state['content'][:1500]}
    
    Return JSON only:
    {{
        "concepts": ["main concept 1", "main concept 2"],
        "dependencies": ["prerequisite concept 1"]
    }}
    """
    
    try:
        response = await llm.ainvoke([
            SystemMessage(content="You are a curriculum designer. Extract concepts as JSON."),
            HumanMessage(content=prompt)
        ])
        
        import json
        result = json.loads(response.content.replace("```json", "").replace("```", "").strip())
        state["concepts"] = result.get("concepts", [])
        state["dependencies"] = result.get("dependencies", [])
        print(f"   → Concepts: {state['concepts']}")
    except Exception as e:
        print(f"   ⚠️ Parser error: {e}")
        state["concepts"] = ["general concept"]
        state["dependencies"] = []
    
    return state


# --- Node 2: Personalizer (Deterministic) ---
async def personalizer_node(state: AgentState) -> AgentState:
    """Map concepts to interest-based analogy domains"""
    print(f"🎨 [Personalizer] Mapping to {state['user_interest']}...")
    
    # Interest -> Domain mapping (expand this over time)
    interest_domains = {
        "cricket": ["batting innings", "team strategy", "match scoring", "player positions"],
        "football": ["goal scoring", "team formations", "match tactics", "player roles"],
        "cooking": ["recipe steps", "ingredient mixing", "kitchen workflow", "flavor balance"],
        "music": ["song composition", "band coordination", "rhythm patterns", "note harmony"],
        "gaming": ["level progression", "character builds", "game mechanics", "quest chains"],
        "movies": ["plot structure", "character arcs", "scene transitions", "story climax"],
    }
    
    interest_lower = state["user_interest"].lower()
    
    # Find matching domain or use default
    domains = interest_domains.get(interest_lower)
    if not domains:
        # If no exact match, pick closest or use generic
        domains = [f"{state['user_interest']} strategy", f"{state['user_interest']} process", f"{state['user_interest']} teamwork"]
    
    state["analogy_domains"] = domains[:3]
    print(f"   → Domains: {state['analogy_domains']}")
    
    return state


# --- Node 3: Strategist ---
async def strategist_node(state: AgentState) -> AgentState:
    """Generate 3 candidate explanations with different approaches"""
    print("💡 [Strategist] Generating 3 candidates...")
    
    concepts_str = ", ".join(state["concepts"])
    domains_str = ", ".join(state["analogy_domains"])
    
    # Build avoid list
    avoid_warning = ""
    if state.get("failed_analogies"):
        avoid_list = "\n".join([f"- {a}" for a in state["failed_analogies"]])
        avoid_warning = f"\n\n⚠️ AVOID THESE ANALOGIES (they previously failed):\n{avoid_list}\n"
    
    prompt = f"""
    You are an expert tutor. Generate 3 DIFFERENT explanations for this concept.
    
    CONCEPTS TO EXPLAIN: {concepts_str}
    ORIGINAL CONTENT: {state['content'][:800]}
    USER'S INTEREST: {state['user_interest']}
    ANALOGY DOMAINS TO USE: {domains_str}{avoid_warning}
    
    Generate 3 explanations with DIFFERENT approaches:
    1. A direct analogy using {state['user_interest']}
    2. A story-based explanation
    3. A Socratic question that makes them think
    
    Return JSON only:
    {{
        "candidates": [
            {{"approach": "Analogy", "explanation": "Think of it like..."}},
            {{"approach": "Story", "explanation": "Imagine you are..."}},
            {{"approach": "Question", "explanation": "What would happen if..."}}
        ]
    }}
    """
    
    try:
        response = await llm_creative.ainvoke([
            SystemMessage(content="You generate diverse educational explanations as JSON."),
            HumanMessage(content=prompt)
        ])
        
        import json
        result = json.loads(response.content.replace("```json", "").replace("```", "").strip())
        state["candidates"] = result.get("candidates", [])
        print(f"   → Generated {len(state['candidates'])} candidates")
    except Exception as e:
        print(f"   ⚠️ Strategist error: {e}")
        state["candidates"] = [{"approach": "Default", "explanation": f"This is about {concepts_str}."}]
    
    return state


# --- Node 4: Evaluator ---
async def evaluator_node(state: AgentState) -> AgentState:
    """Grade candidates and select the best one"""
    print("⚖️ [Evaluator] Grading candidates...")
    
    if not state["candidates"]:
        state["best_explanation"] = "I couldn't generate an explanation."
        state["reasoning"] = "No candidates available"
        return state
    
    candidates_text = "\n".join([
        f"Option {i+1} ({c['approach']}): {c['explanation']}"
        for i, c in enumerate(state["candidates"])
    ])
    
    prompt = f"""
    You are a professor grading student explanations.
    
    ORIGINAL CONCEPT: {", ".join(state["concepts"])}
    USER'S INTEREST: {state["user_interest"]}
    
    CANDIDATE EXPLANATIONS:
    {candidates_text}
    
    Grade each on:
    1. ACCURACY: Is it technically correct?
    2. CLARITY: Is it easy to understand?
    3. RELATABILITY: Does it use {state["user_interest"]} effectively?
    
    Return JSON only:
    {{
        "best_option": 1,
        "reasoning": "Option 1 wins because...",
        "improved_explanation": "The final polished explanation..."
    }}
    """
    
    try:
        response = await llm.ainvoke([
            SystemMessage(content="You are an educational quality evaluator. Return JSON."),
            HumanMessage(content=prompt)
        ])
        
        import json
        result = json.loads(response.content.replace("```json", "").replace("```", "").strip())
        state["best_explanation"] = result.get("improved_explanation", state["candidates"][0]["explanation"])
        state["reasoning"] = result.get("reasoning", "")
        print(f"   → Selected option {result.get('best_option', 1)}: {state['reasoning'][:50]}...")
    except Exception as e:
        print(f"   ⚠️ Evaluator error: {e}")
        state["best_explanation"] = state["candidates"][0]["explanation"]
        state["reasoning"] = "Fallback to first candidate"
    
    return state


# --- Build the Graph ---
def build_explanation_graph() -> StateGraph:
    """Construct the LangGraph workflow"""
    
    graph = StateGraph(AgentState)
    
    # Add nodes
    graph.add_node("parser", parser_node)
    graph.add_node("personalizer", personalizer_node)
    graph.add_node("strategist", strategist_node)
    graph.add_node("evaluator", evaluator_node)
    
    # Define edges (linear flow)
    graph.set_entry_point("parser")
    graph.add_edge("parser", "personalizer")
    graph.add_edge("personalizer", "strategist")
    graph.add_edge("strategist", "evaluator")
    graph.add_edge("evaluator", END)
    
    return graph.compile()


# --- Main Entry Point ---
explanation_graph = build_explanation_graph()


async def generate_agentic_explanation(
    content: str, 
    user_interest: str, 
    context: str = "",
    failed_analogies: List[str] = None
) -> dict:
    """
    Main function to generate an explanation using the agentic pipeline.
    
    Args:
        content: The educational content to explain
        user_interest: User's interest for personalization
        context: Additional context
        failed_analogies: List of analogies to avoid (from misconception logs)
    
    Returns:
        {"explanation": str, "concepts": list, "reasoning": str}
    """
    print("\n" + "="*50)
    print("🧠 AGENTIC EXPLANATION PIPELINE")
    print("="*50)
    
    initial_state: AgentState = {
        "content": content,
        "user_interest": user_interest,
        "context": context,
        "failed_analogies": failed_analogies or [],
        "concepts": [],
        "dependencies": [],
        "analogy_domains": [],
        "candidates": [],
        "best_explanation": "",
        "reasoning": "",
    }
    
    result = await explanation_graph.ainvoke(initial_state)
    
    print("="*50)
    print("✅ PIPELINE COMPLETE")
    print("="*50 + "\n")
    
    return {
        "explanation": result["best_explanation"],
        "concepts": result["concepts"],
        "reasoning": result["reasoning"],
    }
