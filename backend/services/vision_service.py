# backend/services/vision_service.py

import os
from openai import AsyncOpenAI

# --- CONFIG ---
VISION_BASE_URL = os.getenv("AZURE_BASE_URL")
VISION_API_KEY = os.getenv("AZURE_API_KEY")
VISION_MODEL = os.getenv("AZURE_VISION_MODEL")

async def analyze_diagram(image_url: str, topic: str):
    print(f"👁️ Analyzing Diagram with Azure ({VISION_MODEL}): {image_url}")
    
    if not VISION_API_KEY:
        return "Error: Azure API Key missing."

    prompt = f"""
    You are a Physics Tutor. 
    Analyze this diagram image.
    1. Describe exactly what is visualised (vectors, graphs, machinery).
    2. Explain the scientific concept using a '{topic}' analogy.
    3. Keep it concise.
    """

    try:
        # Initialize Standard OpenAI Client pointing to Azure
        client = AsyncOpenAI(
            base_url=VISION_BASE_URL,
            api_key=VISION_API_KEY,
        )

        response = await client.chat.completions.create(
            model=VISION_MODEL,
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
            max_tokens=500,
            temperature=0.2
        )

        return response.choices[0].message.content

    except Exception as e:
        print(f"❌ Azure Vision Failed: {e}")
        return f"I couldn't analyze this image. (Error: {e})"