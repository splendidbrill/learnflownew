"""
Math Detector Service - LaTeX extraction and math-specific explanations
Uses Azure GPT-4.1 mini vision API to extract LaTeX from equation images
"""

import os
from openai import AsyncAzureOpenAI
from dotenv import load_dotenv

load_dotenv()

# --- AZURE CONFIGURATION ---
AZURE_VISION_ENDPOINT = os.getenv("AZURE_VISION_ENDPOINT")
AZURE_VISION_API_KEY = os.getenv("AZURE_VISION_API_KEY")
AZURE_VISION_DEPLOYMENT = os.getenv("AZURE_VISION_DEPLOYMENT")
AZURE_VISION_API_VERSION = os.getenv("AZURE_VISION_API_VERSION")

print(f"🧮 Math Detector: Using Azure {AZURE_VISION_DEPLOYMENT}")


async def extract_latex_from_image(image_url: str) -> dict:
    """
    Extract LaTeX code from a math equation image.
    
    Args:
        image_url: URL of the image containing math equations
        
    Returns:
        dict: {"latex": "extracted LaTeX", "success": bool, "is_math": bool}
    """
    prompt = """
You are a LaTeX extraction expert. Analyze this image and determine if it contains mathematical equations.

TASK:
1. Check if this image contains math equations, formulas, or mathematical expressions
2. If YES, extract ALL equations as valid LaTeX code
3. If NO, return "NOT_MATH"

RULES FOR LATEX EXTRACTION:
- Use proper LaTeX syntax: \\frac{}{}, \\sqrt{}, \\sum, \\int, etc.
- For inline math, wrap in $...$
- For block equations, wrap in $$...$$
- Preserve all variables, operators, and symbols exactly
- If multiple equations, separate them with newlines
- Common patterns:
  * Fractions: \\frac{numerator}{denominator}
  * Exponents: x^{2}
  * Subscripts: x_{i}
  * Square root: \\sqrt{x}
  * Summation: \\sum_{i=1}^{n}
  * Integration: \\int_{a}^{b}

EXAMPLES:
- Simple interest formula: $$ si = \\frac{p \\times n \\times r}{100} $$
- Quadratic: $$ ax^2 + bx + c = 0 $$
- Pythagorean: $$ a^2 + b^2 = c^2 $$

OUTPUT FORMAT:
If math detected: Return ONLY the LaTeX code, nothing else.
If NOT math: Return exactly "NOT_MATH"

Analyze the image now:
"""
    
    try:
        result = await _azure_vision(image_url, prompt)
        
        # Check if it's actually math
        is_math = result.strip() != "NOT_MATH" and "NOT_MATH" not in result.upper()
        
        if is_math:
            # Clean up the response
            latex = result.strip()
            # Remove markdown code fences if present
            latex = latex.replace("```latex", "").replace("```", "").strip()
            
            return {
                "latex": latex,
                "success": True,
                "is_math": True
            }
        else:
            return {
                "latex": "",
                "success": False,
                "is_math": False
            }
            
    except Exception as e:
        print(f"❌ LaTeX extraction failed: {e}")
        return {
            "latex": "",
            "success": False,
            "is_math": False,
            "error": str(e)
        }


async def analyze_math_diagram(image_url: str, topic: str, context_text: str = "") -> str:
    """
    Provides specialized math-focused explanation for equations/diagrams.
    
    Args:
        image_url: URL of math diagram/equation
        topic: User's interest for analogies
        context_text: Chapter/section context
        
    Returns:
        str: Math-focused explanation with step-by-step breakdown
    """
    print(f"🧮 Math Analysis | Context: {context_text} | Interest: {topic}")
    
    prompt = f"""
You are an expert Math Tutor with a focus on conceptual understanding.

CONTEXT: Student is studying "{context_text}".
USER INTEREST: {topic} (use for relatable analogies).

TASK: Explain this mathematical content using this structure:

1. **What's in the image?**
   - List all equations, formulas, or mathematical expressions visible
   - Identify the type (formula, graph, proof, diagram)

2. **Symbol-by-Symbol Breakdown**
   - Define EVERY variable and constant
   - Explain what each operator means
   - Example: "In si = p × n × r / 100:"
     * si = Simple Interest (the money earned)
     * p = Principal (initial amount)
     * n = Time period
     * r = Rate of interest

3. **Conceptual Understanding** (MOST IMPORTANT)
   - Don't just say what it calculates - explain WHY it works
   - What's the underlying relationship?
   - Why are these variables connected this way?

4. **Real-World Connection**
   - Map to {topic} analogy if relevant
   - Provide a concrete example with numbers

Keep it clear, encouraging, and under 200 words. Focus on UNDERSTANDING over memorization.
"""
    
    return await _azure_vision(image_url, prompt)


async def _azure_vision(image_url: str, prompt: str) -> str:
    """Internal Azure OpenAI Vision implementation"""
    if not AZURE_VISION_API_KEY or not AZURE_VISION_ENDPOINT:
        return "System Error: Azure Vision credentials missing in .env"
    
    try:
        client = AsyncAzureOpenAI(
            azure_endpoint=AZURE_VISION_ENDPOINT,
            api_key=AZURE_VISION_API_KEY,
            api_version=AZURE_VISION_API_VERSION
        )

        response = await client.chat.completions.create(
            model=AZURE_VISION_DEPLOYMENT, 
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_url}},
                    ],
                }
            ],
            max_tokens=1000,
            temperature=0.2  # Lower temperature for more accurate LaTeX extraction
        )

        return response.choices[0].message.content

    except Exception as e:
        print(f"❌ Azure Vision Failed: {e}")
        return f"I couldn't analyze this image. Azure Error: {str(e)}"
