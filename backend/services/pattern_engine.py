import json
from langchain_core.messages import HumanMessage, SystemMessage
# Import the existing LLM setup if possible, or re-init logic here
# Assuming we pass the llm object or re-instantiate for the service

async def find_math_pattern(llm, examples: list):
    """
    Takes 3 text blocks (Math Examples).
    Returns a structured pattern analysis.
    """
    
    # Combine the content of the 3 examples
    combined_text = "\n---\n".join([ex['content'] for ex in examples])

    prompt = f"""
    You are a Mathematics Pattern Engine. 
    Here are 3 example problems/solutions extracted from a textbook:
    
    {combined_text}
    
    TASK:
    1. Identify the common problem-solving heuristic or formula used in all three.
    2. Abstract it into a general "Tool" the student can use.
    
    OUTPUT JSON format only:
    {{
        "pattern_name": "e.g. Conservation of Momentum",
        "formula": "m1v1 + m2v2 = ... (LaTeX format)",
        "explanation": "A 1-sentence explanation of when to use this.",
        "steps": ["Step 1...", "Step 2...", "Step 3..."]
    }}
    """

    try:
        # Call DeepSeek
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        
        # Clean response to ensure valid JSON
        clean_json = response.content.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_json)
        
    except Exception as e:
        print(f"❌ Pattern Logic Failed: {e}")
        return None