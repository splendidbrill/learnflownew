import os
from openai import AsyncAzureOpenAI
from dotenv import load_dotenv

# Load env vars explicitly to be safe
load_dotenv()

# --- CONFIGURATION FROM .ENV ---
VISION_ENDPOINT = os.getenv("AZURE_VISION_ENDPOINT")
VISION_API_KEY = os.getenv("AZURE_VISION_API_KEY")
VISION_DEPLOYMENT = os.getenv("AZURE_VISION_DEPLOYMENT") # Should be "gpt-4.1-mini"
VISION_API_VERSION = os.getenv("AZURE_VISION_API_VERSION") # Should be "2025-01-01-preview"

async def analyze_diagram(image_url: str, topic: str, context_text: str = ""):
    """
    Analyzes a diagram using Azure OpenAI.
    """
    print(f"👁️ Analyzing with {VISION_DEPLOYMENT} | Context: {context_text}")
    
    if not VISION_API_KEY or not VISION_ENDPOINT:
        return "System Error: Azure Vision credentials missing in .env"

    # --- PROMPT STRATEGY ---
    # 1. Force reading labels to ground the AI (prevents hallucination).
    # 2. Use the 'context_text' (Chapter Title) to differentiate similar diagrams.
    prompt = f"""
    You are an expert personalized Tutor.
    
    CONTEXT: The student is reading a chapter titled "{context_text}".
    USER INTEREST: {topic} (Use this for analogies).

    TASK:
    1. **READ LABELS**: First, list the text labels you see inside the image.
    2. **IDENTIFY**: Based on the labels and the chapter context, what exactly is this diagram showing?
    3. **ANALOGY**: Explain the concept using a '{topic}' analogy. 
       - Map the visual elements (arrows, circles, containers) to elements of {topic}.
    
    Keep the explanation clear, encouraging, and under 150 words.
    """

    try:
        # Initialize Client using .env values
        client = AsyncAzureOpenAI(
            azure_endpoint=VISION_ENDPOINT,
            api_key=VISION_API_KEY,
            api_version=VISION_API_VERSION
        )

        response = await client.chat.completions.create(
            model=VISION_DEPLOYMENT, 
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url", 
                            "image_url": {
                                "url": image_url
                            }
                        },
                    ],
                }
            ],
            max_tokens=800, 
            temperature=0.3 # Lower temperature = Less hallucination
        )

        return response.choices[0].message.content

    except Exception as e:
        print(f"❌ Azure Vision Failed: {e}")
        return f"I couldn't analyze this image. Azure Error: {str(e)}"