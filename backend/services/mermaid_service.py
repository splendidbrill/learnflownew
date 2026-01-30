"""
Mermaid Service - Generate Mermaid.js diagrams from educational content
Uses DeepSeek to generate Mermaid code, rendered client-side (free!)
"""

import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# DeepSeek via Azure
TEXT_BASE_URL = os.getenv("AZURE_TEXT_BASE_URL")
TEXT_API_KEY = os.getenv("AZURE_TEXT_API_KEY")
TEXT_MODEL = os.getenv("AZURE_TEXT_MODEL")

if TEXT_API_KEY and TEXT_BASE_URL:
    client = OpenAI(api_key=TEXT_API_KEY, base_url=TEXT_BASE_URL)
    print(f"📊 Mermaid Service initialized with {TEXT_MODEL}")
else:
    client = None
    print("⚠️ Mermaid Service: DeepSeek not configured")


def generate_concept_diagram(content: str, diagram_type: str = "flowchart") -> dict:
    """
    Generate a Mermaid.js diagram from educational content.
    
    Args:
        content: The text content to visualize
        diagram_type: "flowchart", "mindmap", "sequence", "timeline"
    
    Returns:
        {"mermaid_code": "...", "title": "...", "description": "..."}
    """
    if not client:
        return {"error": "Mermaid service not configured"}
    
    type_instructions = {
        "flowchart": "Create a flowchart (graph TD or LR) showing the process or concept flow.",
        "mindmap": "Create a mindmap showing the main concept and its related ideas.",
        "sequence": "Create a sequence diagram showing the order of events or interactions.",
        "timeline": "Create a timeline showing chronological progression."
    }
    
    instruction = type_instructions.get(diagram_type, type_instructions["flowchart"])
    
    prompt = f"""
You are an expert at creating educational Mermaid.js diagrams.

TASK: {instruction}

CONTENT TO VISUALIZE:
{content[:2000]}

RULES:
1. Return ONLY valid Mermaid.js code, nothing else
2. Use clear, short labels (max 5 words per node)
3. Keep diagrams simple (max 10-15 nodes)
4. Use meaningful node IDs (not just A, B, C)
5. For flowcharts, use: graph TD or graph LR
6. For mindmaps, use: mindmap format
7. Do not include any markdown formatting like ```mermaid

Example flowchart format:
graph TD
    start[Start Here] --> process1[First Step]
    process1 --> decision{{Decision?}}
    decision -->|Yes| action1[Do This]
    decision -->|No| action2[Do That]

Generate the Mermaid code now:
"""

    try:
        response = client.chat.completions.create(
            model=TEXT_MODEL,
            messages=[
                {"role": "system", "content": "You generate clean Mermaid.js diagram code. Output ONLY the Mermaid code, no explanations."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        
        mermaid_code = response.choices[0].message.content.strip()
        
        # Clean up any markdown formatting
        mermaid_code = mermaid_code.replace("```mermaid", "").replace("```", "").strip()
        
        return {
            "mermaid_code": mermaid_code,
            "diagram_type": diagram_type,
            "success": True
        }
        
    except Exception as e:
        print(f"❌ Mermaid generation failed: {e}")
        return {
            "error": str(e),
            "success": False
        }


def personalize_image_explanation(image_description: str, user_interest: str, context: str = "") -> str:
    """
    Take a cached image description and personalize it with user's interest analogy.
    This is the CHEAP call that happens per-user (text only, no vision).
    
    Args:
        image_description: Pre-generated description of the image (from Vision API)
        user_interest: User's interest for analogies (e.g., "cooking", "cricket")
        context: Chapter/topic context
    
    Returns:
        Personalized explanation with analogies
    """
    if not client:
        return "Explanation service not available"
    
    prompt = f"""
You are a friendly tutor who explains concepts using analogies.

DIAGRAM DESCRIPTION:
{image_description}

CHAPTER CONTEXT: {context}
USER'S INTEREST: {user_interest}

TASK: Explain this diagram using a {user_interest} analogy.
- Map the diagram elements to things in {user_interest}
- Make it engaging and easy to understand
- Keep it under 100 words

Generate the personalized explanation:
"""

    try:
        response = client.chat.completions.create(
            model=TEXT_MODEL,
            messages=[
                {"role": "system", "content": "You create engaging, personalized explanations using analogies."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=200
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        print(f"❌ Personalization failed: {e}")
        return f"I couldn't create a personalized explanation. Error: {str(e)}"
